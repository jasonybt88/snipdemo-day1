#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "bundle");
const push = process.argv.slice(2).includes("--push");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const sourceModules = [
  ["backend", "backend"],
  ["frontend", "frontend"],
  ["cli", "cli"],
];

function run(command, args, cwd = root) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
  });
}

function output(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
}

function assertClean(directory, label) {
  if (output("git", ["status", "--porcelain"], directory)) {
    throw new Error(`${label} has uncommitted changes; refusing to overwrite it.`);
  }
}

function commitIfStaged(directory, message) {
  try {
    run("git", ["diff", "--cached", "--quiet"], directory);
    return false;
  } catch (error) {
    if (error.status !== 1) throw error;
    run("git", ["commit", "-m", message], directory);
    return true;
  }
}

async function replaceDirectory(path) {
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
}

async function main() {
  for (const [directory, branch] of sourceModules) {
    const path = join(root, directory);
    assertClean(path, directory);
    run("git", ["fetch", "origin", branch], path);
    run("git", ["checkout", "-B", branch, `origin/${branch}`], path);
  }

  assertClean(bundle, "bundle");
  run(npm, ["install", "--package-lock=false"], join(root, "frontend"));
  run(npm, ["run", "build"], join(root, "frontend"));

  const frontendOutput = join(root, "frontend", "dist", "snip-frontend", "browser");
  const index = join(frontendOutput, "index.html");
  if (!existsSync(index)) {
    throw new Error(`Frontend build did not produce ${index}.`);
  }

  await replaceDirectory(join(bundle, "public"));
  await copyFile(join(root, "backend", "server.js"), join(bundle, "server.js"));
  await copyFile(join(root, "cli", "cli.js"), join(bundle, "cli.js"));
  await cp(frontendOutput, join(bundle, "public"), { recursive: true });
  await writeFile(join(bundle, ".env"), "PUBLIC_DIR=./public\n");
  await writeFile(join(bundle, "package.json"), `${JSON.stringify({
    name: "snip-bundle",
    private: true,
    scripts: { start: "bun server.js" },
  }, null, 2)}\n`);
  await writeFile(join(bundle, "Dockerfile"), "FROM oven/bun:1\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD [\"bun\", \"server.js\"]\n");
  await writeFile(join(bundle, ".dockerignore"), ".git\n.gitignore\nnode_modules\nnpm-debug.log\n");
  await writeFile(join(bundle, "railway.json"), `${JSON.stringify({
    $schema: "https://railway.app/railway.schema.json",
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
  }, null, 2)}\n`);

  run("git", ["add", "-A"], bundle);
  const bundleCommitted = commitIfStaged(bundle, "chore: build deployment bundle");

  run("git", ["add", "backend", "frontend", "cli", "bundle"], root);
  const mainCommitted = commitIfStaged(root, "chore: update deployment bundle");

  if (push) {
    run("git", ["push", "origin", "HEAD:bundle"], bundle);
    run("git", ["push", "origin", "main"], root);
  }

  console.log(`Bundle ${bundleCommitted ? "updated" : "unchanged"}; main ${mainCommitted ? "updated" : "unchanged"}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});