import com.sun.net.httpserver.*;
import java.net.InetSocketAddress;
import java.nio.file.*;
import java.io.*;
import java.net.*;

public class MiniServer {
    public static void main(String[] args) throws Exception {
        int port = 8080;
        Path root = Paths.get(".").toAbsolutePath().normalize();

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        
        // Serve static files (HTML, CSS, JS, images)
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            
            if (path.startsWith("/api/")) {
                return;
            }

            if (path.equals("/")) path = "/index.html";

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

        // IGDB API Proxy
        server.createContext("/api/games", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, 0);
                exchange.close();
                return;
            }

            try {
                String clientId = System.getenv("IGDB_CLIENT_ID");
                String accessToken = System.getenv("IGDB_ACCESS_TOKEN");
                
                // Check if they're set
                if (clientId == null || accessToken == null) {
                    String error = "{\"error\": \"Missing IGDB credentials. Please set IGDB_CLIENT_ID and IGDB_ACCESS_TOKEN environment variables.\"}";
                    exchange.sendResponseHeaders(500, error.length());
                    exchange.getResponseBody().write(error.getBytes());
                    exchange.close();
                    return;
                }
                
                // Create connection to IGDB
                URI uri = new URI("https://api.igdb.com/v4/games");
                URL url = uri.toURL();

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Client-ID", clientId);
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                
                // Send query
                int randomOffset = (int)(Math.random() * 500);
                String body = "fields name, cover.image_id; where rating > 80 & cover != null; limit 12; offset " + randomOffset + ";";
                conn.getOutputStream().write(body.getBytes());
                
                // Read response
                InputStream responseStream = conn.getInputStream();
                byte[] responseData = responseStream.readAllBytes();
                
                // Add CORS headers
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                
                // Send to frontend
                exchange.sendResponseHeaders(200, responseData.length);
                exchange.getResponseBody().write(responseData);
                exchange.close();
                
            } catch (Exception e) {
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