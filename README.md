# Snip

Snip is a small URL shortener composed from three same-origin Git submodules:

- **backend/** — Bun HTTP API and static-file server. `POST /api/links` creates a short link, `GET /api/links` lists links, and `GET /:code` redirects.
- **frontend/** — Angular single-page application.
- **cli/** — Node command-line client (`snip add`, `snip ls`, `snip open`).

## Clone and run

Clone every component with the superproject:

```sh
git clone --recurse-submodules https://github.com/jasonybt88/snipdemo-day1.git
cd snipdemo-day1
```

Run the backend (requires Bun):

```sh
cd backend
bun run start
```

The API listens on `http://localhost:3000`. To develop the UI separately, run `npm install` then `npm start` in `frontend/`. The CLI calls the local API by default; run `node cli/cli.js help` for usage.

## Updating component pointers

Each submodule tracks its matching branch. Fetch and update all components, then record their new commit pointers in the superproject:

```sh
git submodule update --init --recursive
git submodule update --remote --recursive
git add backend frontend cli
git commit -m "chore: update component pointers"
git push origin main
```

## Deployment bundle

`bundle/` is a generated-output submodule. Run `node scripts/build-bundle.mjs` to build it locally, or pass `--push` to publish its `bundle` branch and update the superproject pointer. See the script and CI workflows for the deployment pipeline.
The bundle builder updates source submodules to their tracked tips, builds Angular, and writes only generated deployment files to the `bundle` submodule:

```sh
node scripts/build-bundle.mjs        # build and commit locally
node scripts/build-bundle.mjs --push # also publish bundle and main pointers
```

It refuses dirty component or bundle worktrees, so local edits are never silently overwritten. A repeat run with unchanged inputs is a no-op.
