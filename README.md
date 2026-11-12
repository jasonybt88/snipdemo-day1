# Snip backend

Zero-dependency Bun URL shortener.

```powershell
bun run start
```

`POST /api/links` accepts `{ "url": "https://example.com" }`. `GET /api/links`
lists links, and `GET /:code` redirects to the original URL.

Environment variables: `PORT` (default `3000`), `BASE_URL`, `RAILWAY_PUBLIC_DOMAIN`,
and `PUBLIC_DIR` for optional static files.
