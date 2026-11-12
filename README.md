# Snip CLI

A zero-dependency CommonJS command-line client for the Snip URL shortener API.

```text
snip add <url>
snip ls
snip open <code>
```

By default, the CLI calls `http://localhost:3000`. Set `SNIP_API` to use another
backend URL:

```powershell
$env:SNIP_API = "https://snip.example.com"
snip ls
```

`add` prints the newly created short URL. `ls` prints each code, hit count, and
destination URL. `open` resolves a code and launches its redirect target in the
default browser.
