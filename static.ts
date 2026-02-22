const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function safePublicPath(url: URL): string | null {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const decoded = decodeURIComponent(pathname);

  if (decoded.includes("..")) {
    return null;
  }

  return `./public${decoded}`;
}

export function contentTypeFromPath(path: string): string {
  const extensionIndex = path.lastIndexOf(".");
  if (extensionIndex === -1) {
    return "application/octet-stream";
  }

  const extension = path.slice(extensionIndex);
  return contentTypes[extension] ?? "application/octet-stream";
}

export async function serveStatic(path: string): Promise<Response> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": contentTypeFromPath(path),
      "Cache-Control": "no-cache",
    },
  });
}
