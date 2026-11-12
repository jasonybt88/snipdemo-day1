#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const API_BASE_URL = (process.env.SNIP_API || "http://localhost:3000").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;

const usage = `Usage:
  snip add <url>    Create a short link
  snip ls           List short links
  snip open <code>  Open a short link in the default browser
  snip help         Show this help

Set SNIP_API to use a backend other than http://localhost:3000.`;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function errorMessage(response, fallback) {
  return response
    .json()
    .then((body) => (body && typeof body.error === "string" ? body.error : fallback))
    .catch(() => fallback);
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error.name === "AbortError" ? "request timed out" : error.message;
    throw new Error(`Backend unavailable at ${API_BASE_URL}: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

function parseHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function isCode(value) {
  return /^[A-Za-z0-9]+$/.test(value);
}

async function add(urlValue) {
  const url = parseHttpUrl(urlValue);
  if (!url) {
    fail("Invalid URL: provide an absolute http(s) URL.");
    return;
  }

  const response = await request("/api/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: url.toString() }),
  });

  if (!response.ok) {
    fail(`Unable to create link: ${await errorMessage(response, response.statusText)}.`);
    return;
  }

  const link = await response.json();
  if (!link || typeof link.shortUrl !== "string") {
    fail("Unable to create link: backend returned an invalid response.");
    return;
  }

  process.stdout.write(`${link.shortUrl}\n`);
}

async function list() {
  const response = await request("/api/links");
  if (!response.ok) {
    fail(`Unable to list links: ${await errorMessage(response, response.statusText)}.`);
    return;
  }

  const links = await response.json();
  if (!Array.isArray(links)) {
    fail("Unable to list links: backend returned an invalid response.");
    return;
  }
  if (links.length === 0) {
    process.stdout.write("No links yet.\n");
    return;
  }

  const codeWidth = Math.max(4, ...links.map((link) => String(link.code || "").length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits ?? "").length));
  process.stdout.write(`${"CODE".padEnd(codeWidth)}  ${"HITS".padStart(hitsWidth)}  URL\n`);
  for (const link of links) {
    process.stdout.write(
      `${String(link.code || "").padEnd(codeWidth)}  ${String(link.hits ?? "").padStart(hitsWidth)}  ${String(link.url || "")}\n`,
    );
  }
}

function openInBrowser(url) {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", (error) => fail(`Unable to open browser: ${error.message}`));
  child.unref();
}

async function open(code) {
  if (!isCode(code)) {
    fail("Invalid code: use letters and numbers only.");
    return;
  }

  const response = await request(`/${encodeURIComponent(code)}`, { redirect: "manual" });
  if (response.status === 404) {
    fail(`Unknown link code: ${code}.`);
    return;
  }
  if (response.status < 300 || response.status >= 400) {
    fail(`Unable to open link: ${await errorMessage(response, response.statusText)}.`);
    return;
  }

  const location = response.headers.get("location");
  if (!location) {
    fail("Unable to open link: backend response did not include a redirect location.");
    return;
  }
  openInBrowser(location);
}

async function main(args) {
  const [command, value, ...extra] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${usage}\n`);
    return;
  }

  if (command === "add") {
    if (!value || extra.length > 0) {
      fail("Usage: snip add <url>");
      return;
    }
    await add(value);
    return;
  }

  if (command === "ls") {
    if (value) {
      fail("Usage: snip ls");
      return;
    }
    await list();
    return;
  }

  if (command === "open") {
    if (!value || extra.length > 0) {
      fail("Usage: snip open <code>");
      return;
    }
    await open(value);
    return;
  }

  fail(`Unknown command: ${command}\n${usage}`);
}

main(process.argv.slice(2)).catch((error) => fail(error.message));
