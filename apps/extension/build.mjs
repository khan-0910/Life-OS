// Builds the unpacked extension into dist/.
// LIFEOS_ORIGINS: comma-separated LifeOS web origins allowed to message the extension.
// Default is the local dev server only.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
const origins = (process.env.LIFEOS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

for (const o of origins) {
  const u = new URL(o);
  if (u.origin !== o) throw new Error(`LIFEOS_ORIGINS entries must be bare origins like https://app.example.com (got ${o})`);
  if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error(`Only https origins (or localhost) are allowed: ${o}`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { background: join(root, "src/background.ts"), popup: join(root, "src/popup.ts") },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "chrome120",
  minify: false,
  sourcemap: false,
  define: { __LIFEOS_ORIGINS__: JSON.stringify(origins) },
  logLevel: "info",
});

cpSync(join(root, "static"), out, { recursive: true });

// Match patterns cannot carry ports; the exact origin (with port) is re-checked in code.
const matches = [...new Set(origins.map((o) => `${new URL(o).protocol}//${new URL(o).hostname}/*`))];

const manifest = {
  manifest_version: 3,
  name: "LifeOS Focus Blocker",
  version: "0.1.0",
  description: "Blocks the sites you choose, only during LifeOS focus sessions. Never reads pages or history.",
  minimum_chrome_version: "120",
  permissions: ["declarativeNetRequest", "storage", "alarms"],
  optional_host_permissions: ["*://*/*"],
  background: { service_worker: "background.js", type: "module" },
  action: { default_popup: "popup.html", default_title: "LifeOS Focus" },
  externally_connectable: { matches },
  web_accessible_resources: [{ resources: ["blocked.html", "ui.css"], matches: ["<all_urls>"] }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" },
};
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Built extension → ${out}\nAllowed LifeOS origins: ${origins.join(", ")}`);
