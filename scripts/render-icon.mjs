// Render the brand SVG to the PNG that `tauri icon` consumes.
//
//   node scripts/render-icon.mjs
//
// Source of truth is assets/brand/app-icon.svg (vector); this keeps the icon
// set in sync with the mark instead of hand-rasterizing.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const svg = readFileSync(resolve(root, "assets/brand/app-icon.svg"), "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
});
const png = resvg.render().asPng();
const out = resolve(root, "assets/icon-source.png");
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
