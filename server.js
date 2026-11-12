import { basename, extname, resolve, sep } from "node:path";

const links = new Map();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const publicDir = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null;
const baseUrl = (
  process.env.BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`)
).replace(/\/+$/, "");

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function corsHeaders(headers = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...headers,
  };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders(),
  });
}

function createCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function createUniqueCode() {
  let code;
  do {
    code = createCode();
  } while (links.has(code));
  return code;
}

async function serveStatic(pathname) {
  if (!publicDir) {
    return null;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
  const filePath = resolve(publicDir, relativePath);
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }

  return new Response(file, {
    headers: corsHeaders({
      "content-type": contentTypes[extname(basename(filePath)).toLowerCase()] ?? file.type,
    }),
  });
}

const server = Bun.serve({
  port: Number.isFinite(port) ? port : 3000,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === "POST" && url.pathname === "/api/links") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      if (!payload || typeof payload.url !== "string") {
        return json({ error: "A url string is required." }, 400);
      }

      let target;
      try {
        target = new URL(payload.url);
      } catch {
        return json({ error: "url must be a valid http(s) URL." }, 400);
      }

      if (!["http:", "https:"].includes(target.protocol)) {
        return json({ error: "url must use http or https." }, 400);
      }

      const code = createUniqueCode();
      const link = {
        code,
        url: target.toString(),
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return json(link, 201);
    }

    if (request.method === "GET" && url.pathname === "/api/links") {
      return json([...links.values()]);
    }

    if (request.method === "GET") {
      const staticResponse = await serveStatic(url.pathname);
      if (staticResponse) {
        return staticResponse;
      }

      const code = url.pathname.slice(1);
      const link = links.get(code);
      if (code && link) {
        link.hits += 1;
        return new Response(null, {
          status: 302,
          headers: corsHeaders({ location: link.url }),
        });
      }
    }

    return json({ error: "Not found." }, 404);
  },
});

console.log(`Snip backend listening on ${server.url}`);
