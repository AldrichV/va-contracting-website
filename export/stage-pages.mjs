// Cross-platform version of Stage-Pages.ps1: assembles the Cloudflare Pages
// upload folder from the vinext build output. Usage: node export/stage-pages.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(root, process.argv[2] ?? "dist-pages");
const server = path.join(root, "dist", "server");
const client = path.join(root, "dist", "client");

for (const required of [path.join(server, "index.js"), path.join(client, "assets")]) {
  if (!fs.existsSync(required)) {
    console.error("Run `npm run build` first.");
    process.exit(1);
  }
}

fs.rmSync(out, { force: true, recursive: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ["index.js", "ssr", "__vite_rsc_assets_manifest.js", "assets"]) {
  const from = path.join(server, name);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, name), { recursive: true });
}
fs.cpSync(client, out, { force: true, recursive: true });
fs.copyFileSync(path.join(root, "worker", "pages-worker.js"), path.join(out, "_worker.js"));
console.log(out);
