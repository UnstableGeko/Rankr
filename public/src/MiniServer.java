import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.Properties;

public class MiniServer {
    public static void main(String[] args) throws Exception {
        int port = 8080;
        Path root = Paths.get("..").toAbsolutePath().normalize();

        Properties config = new Properties();
        try (FileInputStream fis = new FileInputStream("../../config.properties")) {
            config.load(fis);
        } catch (IOException e) {
            System.err.println("ERROR: config.properties file not found!");
            System.err.println("Please create config.properties with your IGDB credentials");
            System.err.println("See README.md for setup instructions");
            System.exit(1);
        }
        
        final String configClientId = config.getProperty("igdb.client.id");
        final String configAccessToken = config.getProperty("igdb.access.token");

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/games/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String slug = path.substring("/games/".length());
            
            if (slug.isEmpty()) {
                exchange.sendResponseHeaders(302, 0);
                exchange.getResponseHeaders().set("Location", "/");
                exchange.close();
                return;
            }

            Path file = root.resolve("game.html").normalize();

            if (!Files.exists(file)) {
                String msg = "404 Not Found";
                exchange.sendResponseHeaders(404, msg.length());
                exchange.getResponseBody().write(msg.getBytes());
                exchange.close();
                return;
            }

            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            byte[] data = Files.readAllBytes(file);
            exchange.sendResponseHeaders(200, data.length);
            exchange.getResponseBody().write(data);
            exchange.close();
        });
        
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            
            if (path.startsWith("/api/")) {
                return;
            }

            if (path.equals("/")) {
                exchange.getResponseHeaders().set("Location", "/home");
                exchange.sendResponseHeaders(302, -1);
                exchange.close();
                return;
            }

            if (path.equals("/home")) {
                path = "/index.html";
            }

            if (path.equals("/about")) {
                path = "/about.html";
            }

            Path file = root.resolve(path.substring(1)).normalize();

            if (!file.startsWith(root) || Files.isDirectory(file) || !Files.exists(file)) {
                String msg = "404 Not Found";
                exchange.sendResponseHeaders(404, msg.length());
                exchange.getResponseBody().write(msg.getBytes());
                exchange.close();
                return;
            }

            String contentType = guessContentType(file);
            exchange.getResponseHeaders().set("Content-Type", contentType);
            byte[] data = Files.readAllBytes(file);
            exchange.sendResponseHeaders(200, data.length);
            exchange.getResponseBody().write(data);
            exchange.close();
        });

        server.createContext("/api/games", exchange -> {
        if (!exchange.getRequestMethod().equals("POST")) {
            exchange.sendResponseHeaders(405, 0);
            exchange.close();
            return;
        }

        try {
            String clientId = configClientId;
            String accessToken = configAccessToken;
            
            if (clientId == null || accessToken == null) {
                String error = "{\"error\": \"Missing IGDB credentials in config.properties\"}";
                exchange.sendResponseHeaders(500, error.length());
                exchange.getResponseBody().write(error.getBytes());
                exchange.close();
                return;
            }
            
            // Read request body
            InputStream requestBody = exchange.getRequestBody();
            String bodyStr = new String(requestBody.readAllBytes());
            
            // Parse sortBy parameter
            String sortBy = "rating"; // default
            if (bodyStr.contains("\"sortBy\"")) {
                int sortStart = bodyStr.indexOf("\"sortBy\":") + 9;
                String afterColon = bodyStr.substring(sortStart).trim();
                
                if (afterColon.startsWith("\"")) {
                    int openQuote = bodyStr.indexOf("\"", sortStart);
                    int closeQuote = bodyStr.indexOf("\"", openQuote + 1);
                    sortBy = bodyStr.substring(openQuote + 1, closeQuote);
                }
            }

            // Parse page and limit parameters
            int page = 1;
            int limit = 40;

            if (bodyStr.contains("\"page\"")) {
                int pageStart = bodyStr.indexOf("\"page\":") + 7;
                String afterColon = bodyStr.substring(pageStart).trim();
                int commaOrBrace = Math.min(
                    afterColon.indexOf(",") == -1 ? Integer.MAX_VALUE : afterColon.indexOf(","),
                    afterColon.indexOf("}") == -1 ? Integer.MAX_VALUE : afterColon.indexOf("}")
                );
                String pageStr = afterColon.substring(0, commaOrBrace).trim();
                page = Integer.parseInt(pageStr);
            }

            if (bodyStr.contains("\"limit\"")) {
                int limitStart = bodyStr.indexOf("\"limit\":") + 8;
                String afterColon = bodyStr.substring(limitStart).trim();
                int commaOrBrace = Math.min(
                    afterColon.indexOf(",") == -1 ? Integer.MAX_VALUE : afterColon.indexOf(","),
                    afterColon.indexOf("}") == -1 ? Integer.MAX_VALUE : afterColon.indexOf("}")
                );
                String limitStr = afterColon.substring(0, commaOrBrace).trim();
                limit = Integer.parseInt(limitStr);
            }

            int offset = (page - 1) * limit;
            
            // Build sort clause
            String sortClause;
            switch (sortBy) {
                case "rating_count":
                    sortClause = "sort rating_count desc";
                    break;
                case "release_date":
                    sortClause = "sort first_release_date desc";
                    break;
                case "trending":
                    sortClause = "sort rating_count desc";
                    break;
                default: // "rating"
                    sortClause = "sort rating desc";
                    break;
            }
            
            String fields = "fields name, slug, summary, rating, rating_count, cover.image_id, genres.name, genres.slug, themes.name, themes.slug, platforms.name, platforms.slug, involved_companies.publisher, involved_companies.developer, involved_companies.company.name";
            if (sortBy.equals("release_date")) {
                fields += ", first_release_date";
            }
            
            String igdbQuery = fields + "; where cover != null & rating != null & rating_count > 500; " + sortClause + "; limit " + limit + "; offset " + offset + ";";
            
            URI uri = new URI("https://api.igdb.com/v4/games");
            URL url = uri.toURL();

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Client-ID", clientId);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            
            conn.getOutputStream().write(igdbQuery.getBytes());
            
            InputStream responseStream = conn.getInputStream();
byte[] gamesData = responseStream.readAllBytes();

        // Wrap response with totalPages
        String gamesJson = new String(gamesData);
        int totalPages = 10; // Hardcoded for now
        String wrappedResponse = "{\"games\":" + gamesJson + ",\"totalPages\":" + totalPages + "}";
        byte[] responseData = wrappedResponse.getBytes();

        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(200, responseData.length);
        exchange.getResponseBody().write(responseData);
        exchange.close();
            
        } catch (Exception e) {
            e.printStackTrace();
            String error = "{\"error\": \"" + e.getMessage() + "\"}";
            exchange.sendResponseHeaders(500, error.length());
            exchange.getResponseBody().write(error.getBytes());
            exchange.close();
        }
    });

        server.createContext("/api/game-single", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, 0);
                exchange.close();
                return;
            }

            try {
                String query = exchange.getRequestURI().getQuery();
                String slug = "";
                
                if (query != null) {
                    for (String param : query.split("&")) {
                        if (param.startsWith("slug=")) {
                            slug = URLDecoder.decode(param.substring(5), "UTF-8");
                        }
                    }
                }

                if (slug.isEmpty()) {
                    String error = "{\"error\": \"Missing slug parameter\"}";
                    exchange.sendResponseHeaders(400, error.length());
                    exchange.getResponseBody().write(error.getBytes());
                    exchange.close();
                    return;
                }

                URI uri = new URI("https://api.igdb.com/v4/games");
                URL url = uri.toURL();

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Client-ID", configClientId);
                conn.setRequestProperty("Authorization", "Bearer " + configAccessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);

                String body = "fields name, slug, summary, rating, rating_count, total_rating, total_rating_count, cover.image_id, genres.name, genres.slug, themes.name, themes.slug, platforms.name, platforms.slug, involved_companies.publisher, involved_companies.developer, involved_companies.company.name; where slug = \"" + slug + "\"; limit 1;";
                conn.getOutputStream().write(body.getBytes());

                InputStream responseStream = conn.getInputStream();
                byte[] responseData = responseStream.readAllBytes();

                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.sendResponseHeaders(200, responseData.length);
                exchange.getResponseBody().write(responseData);
                exchange.close();

            } catch (Exception e) {
                e.printStackTrace();
                String error = "{\"error\": \"" + e.getMessage() + "\"}";
                exchange.sendResponseHeaders(500, error.length());
                exchange.getResponseBody().write(error.getBytes());
                exchange.close();
            }
        });

        server.createContext("/api/browse", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, 0);
                exchange.close();
                return;
            }

            try {
                InputStream requestBody = exchange.getRequestBody();
                String bodyStr = new String(requestBody.readAllBytes());
                
                System.out.println("=== BROWSE REQUEST ===");
                System.out.println("Request Body: " + bodyStr);
                
                String filterType = null;
                String filterValue = null;
                
                int ftIndex = bodyStr.indexOf("\"filterType\"");
                if (ftIndex != -1) {
                    int colonIndex = bodyStr.indexOf(":", ftIndex);
                    int openQuoteIndex = bodyStr.indexOf("\"", colonIndex);
                    int closeQuoteIndex = bodyStr.indexOf("\"", openQuoteIndex + 1);
                    filterType = bodyStr.substring(openQuoteIndex + 1, closeQuoteIndex);
                }
                
                if (bodyStr.contains("\"filterValue\"")) {
                    int valStart = bodyStr.indexOf("\"filterValue\":") + 14;
                    
                    // Check if the value is a string (has quotes) or a number (no quotes)
                    String afterColon = bodyStr.substring(valStart).trim();
                    
                    if (afterColon.startsWith("\"")) {
                        // It's a string value - find the closing quote
                        int openQuote = bodyStr.indexOf("\"", valStart);
                        int closeQuote = bodyStr.indexOf("\"", openQuote + 1);
                        filterValue = bodyStr.substring(openQuote + 1, closeQuote);
                    } else {
                        // It's a number - find the comma or closing brace
                        int valEnd = bodyStr.indexOf(",", valStart);
                        if (valEnd == -1) valEnd = bodyStr.indexOf("}", valStart);
                        if (valStart > 13 && valEnd > valStart) {
                            filterValue = bodyStr.substring(valStart, valEnd).trim();
                            if (filterValue.equals("null")) filterValue = null;
                        }
                    }
                }

                System.out.println("Parsed filterType: " + filterType);
                System.out.println("Parsed filterValue: " + filterValue);

                URI uri = new URI("https://api.igdb.com/v4/games");
                URL url = uri.toURL();

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Client-ID", configClientId);
                conn.setRequestProperty("Authorization", "Bearer " + configAccessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);

                String whereClause = "where cover != null & rating != null & rating_count > 20";
                
                // Parse sortBy parameter
                String sortBy = "rating"; // default
                if (bodyStr.contains("\"sortBy\"")) {
                    int sortStart = bodyStr.indexOf("\"sortBy\":") + 9;
                    String afterColon = bodyStr.substring(sortStart).trim();
                    
                    if (afterColon.startsWith("\"")) {
                        int openQuote = bodyStr.indexOf("\"", sortStart);
                        int closeQuote = bodyStr.indexOf("\"", openQuote + 1);
                        sortBy = bodyStr.substring(openQuote + 1, closeQuote);
                    }
                }

                // Parse page and limit parameters
                int page = 1;
                int limit = 40;

                if (bodyStr.contains("\"page\"")) {
                    int pageStart = bodyStr.indexOf("\"page\":") + 7;
                    String afterColon = bodyStr.substring(pageStart).trim();
                    int commaOrBrace = Math.min(
                        afterColon.indexOf(",") == -1 ? Integer.MAX_VALUE : afterColon.indexOf(","),
                        afterColon.indexOf("}") == -1 ? Integer.MAX_VALUE : afterColon.indexOf("}")
                    );
                    String pageStr = afterColon.substring(0, commaOrBrace).trim();
                    page = Integer.parseInt(pageStr);
                }

                if (bodyStr.contains("\"limit\"")) {
                    int limitStart = bodyStr.indexOf("\"limit\":") + 8;
                    String afterColon = bodyStr.substring(limitStart).trim();
                    int commaOrBrace = Math.min(
                        afterColon.indexOf(",") == -1 ? Integer.MAX_VALUE : afterColon.indexOf(","),
                        afterColon.indexOf("}") == -1 ? Integer.MAX_VALUE : afterColon.indexOf("}")
                    );
                    String limitStr = afterColon.substring(0, commaOrBrace).trim();
                    limit = Integer.parseInt(limitStr);
                }

                int offset = (page - 1) * limit;
                if (filterType != null && filterValue != null) {
                    if (filterType.equals("genre")) {
                        whereClause += " & genres = [" + filterValue + "]";
                    } else if (filterType.equals("platform")) {
                        String cleanValue = filterValue.replaceAll("\"", "");
                        whereClause += " & platforms.slug = \"" + cleanValue + "\"";
                    }
                }
            // Build sort clause
            String sortClause;
            switch (sortBy) {
                case "rating_count":
                    sortClause = "sort rating_count desc";
                    break;
                case "release_date":
                    sortClause = "sort first_release_date desc";
                    break;
                case "trending":
                    sortClause = "sort rating_count desc";
                    break;
                default: // "rating"
                    sortClause = "sort rating desc";
                    break;
            }

            String fields = "fields name, slug, cover.image_id, rating, rating_count";
            if (sortBy.equals("release_date")) {
                fields += ", first_release_date";
            }

            String igdbQuery = fields + "; " + whereClause + "; " + sortClause + "; limit " + limit + "; offset " + offset + ";";

            System.out.println("=== FINAL IGDB QUERY ===");
            System.out.println(igdbQuery);
            System.out.println("========================");
                
            System.out.println("Where Clause: " + whereClause);
            System.out.println("Full IGDB Query: " + igdbQuery);
            System.out.println("===================");
                
            conn.getOutputStream().write(igdbQuery.getBytes());

            InputStream responseStream = conn.getInputStream();
            byte[] gamesData = responseStream.readAllBytes();

            // Wrap response with totalPages
            String gamesJson = new String(gamesData);
            int totalPages = 10; // Hardcoded for now
            String wrappedResponse = "{\"games\":" + gamesJson + ",\"totalPages\":" + totalPages + "}";
            byte[] responseData = wrappedResponse.getBytes();

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.sendResponseHeaders(200, responseData.length);
            exchange.getResponseBody().write(responseData);
            exchange.close();

            } catch (Exception e) {
                e.printStackTrace();
                String error = "{\"error\": \"" + e.getMessage() + "\"}";
                exchange.sendResponseHeaders(500, error.length());
                exchange.getResponseBody().write(error.getBytes());
                exchange.close();
            }
        });

        server.createContext("/api/platforms", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, 0);
                exchange.close();
                return;
            }

            try {
                URI uri = new URI("https://api.igdb.com/v4/platforms");
                URL url = uri.toURL();

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Client-ID", configClientId);
                conn.setRequestProperty("Authorization", "Bearer " + configAccessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);

                String body = "fields name, slug; sort name asc; limit 500;";
                conn.getOutputStream().write(body.getBytes());

                InputStream responseStream = conn.getInputStream();
                byte[] responseData = responseStream.readAllBytes();

                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.sendResponseHeaders(200, responseData.length);
                exchange.getResponseBody().write(responseData);
                exchange.close();

            } catch (Exception e) {
                e.printStackTrace();
                String error = "{\"error\": \"" + e.getMessage() + "\"}";
                exchange.sendResponseHeaders(500, error.length());
                exchange.getResponseBody().write(error.getBytes());
                exchange.close();
            }
        });
        server.createContext("/api/search", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, 0);
                exchange.close();
                return;
            }

            try {
                String query = exchange.getRequestURI().getQuery();
                String searchQuery = "";
                
                if (query != null) {
                    for (String param : query.split("&")) {
                        if (param.startsWith("q=")) {
                            searchQuery = URLDecoder.decode(param.substring(2), "UTF-8");
                        }
                    }
                }

                if (searchQuery.isEmpty()) {
                    String error = "{\"error\": \"Missing search query\"}";
                    exchange.sendResponseHeaders(400, error.length());
                    exchange.getResponseBody().write(error.getBytes());
                    exchange.close();
                    return;
                }

                URI uri = new URI("https://api.igdb.com/v4/games");
                URL url = uri.toURL();

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Client-ID", configClientId);
                conn.setRequestProperty("Authorization", "Bearer " + configAccessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);

                String body = "search \"" + searchQuery + "\"; " +
                            "fields name, slug, cover.image_id, summary, rating, rating_count; " +
                            "where cover != null; " +
                            "limit 20;";
                
                conn.getOutputStream().write(body.getBytes());

                InputStream responseStream = conn.getInputStream();
                byte[] responseData = responseStream.readAllBytes();

                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.sendResponseHeaders(200, responseData.length);
                exchange.getResponseBody().write(responseData);
                exchange.close();

            } catch (Exception e) {
                e.printStackTrace();
                String error = "{\"error\": \"" + e.getMessage() + "\"}";
                exchange.sendResponseHeaders(500, error.length());
                exchange.getResponseBody().write(error.getBytes());
                exchange.close();
            }
        });
        server.setExecutor(null);
        server.start();
        System.out.println("Server running at http://localhost:" + port);
    }

    private static String guessContentType(Path file) {
        String name = file.getFileName().toString().toLowerCase();
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".css"))  return "text/css; charset=utf-8";
        if (name.endsWith(".js"))   return "application/javascript; charset=utf-8";
        if (name.endsWith(".png"))  return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".svg"))  return "image/svg+xml";
        if (name.endsWith(".ico"))  return "image/x-icon";
        return "application/octet-stream";
    }
}