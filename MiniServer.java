import com.sun.net.httpserver.*;
import java.net.InetSocketAddress;
import java.nio.file.*;

public class MiniServer {
    public static void main(String[] args) throws Exception {
        int port = 80; // use 80 later if you want (admin required)
        Path root = Paths.get(".").toAbsolutePath().normalize();

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();

            // default to index.html
            if (path.equals("/")) path = "/index.html";

            Path file = root.resolve(path.substring(1)).normalize();

            // prevent ../ escaping
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

        server.setExecutor(null);
        server.start();
        System.out.println("Serving " + root + " on http://rankr.com:" + port);
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