import { safePublicPath, serveStatic } from "./static";

const PORT = Number(process.env.PORT ?? 3000);

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    const path = safePublicPath(url);

    if (!path) {
      return new Response("Bad request", { status: 400 });
    }

    return serveStatic(path);
  },
});

console.log(`Contribution page running at http://localhost:${PORT}`);
