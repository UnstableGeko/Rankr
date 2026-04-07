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
        
        // Store credentials for use in the endpoint
        final String configClientId = config.getProperty("igdb.client.id");
        final String configAccessToken = config.getProperty("igdb.access.token");

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Serve game pages at /games/(slug)
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
        
        // Serve static files (HTML, CSS, JS, images)
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

            // Map /home to index.html
            if (path.equals("/home")) {
                path = "/index.html";
            }

            // Map /about to about.html
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

        // IGDB API Proxy - all games (for home page)
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
                
                URI uri = new URI("https://api.igdb.com/v4/games");
                URL url = uri.toURL();

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Client-ID", clientId);
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                
                // FIXED: This endpoint gets ALL top games, not a specific slug
                String body = "fields name, slug, summary, rating, rating_count, cover.image_id, genres.name, genres.slug, themes.name, themes.slug, platforms.name, platforms.slug, involved_companies.publisher, involved_companies.developer, involved_companies.company.name; where cover != null & rating != null & rating_count > 500; sort rating desc; limit 40;";
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

        // Single game lookup by slug (for game page)
        server.createContext("/api/game-single", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, 0);
                exchange.close();
                return;
            }

            try {
                String query = exchange.getRequestURI().getQuery();
                String slug = ""; // FIXED: Declare slug variable
                
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

                // FIXED: Use slug to get specific game
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