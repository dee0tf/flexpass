// One-off: compile app/globals.css through the real Tailwind v4 pipeline
// (same plugin Next.js uses) into a stable, standalone file the design-sync
// converter can point cfg.cssEntry at. Next's own build output is a
// hash-named chunk containing the WHOLE app's CSS with no stable path —
// this recompiles just the stylesheet, content-scanned the same way.
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

const result = await postcss([tailwindcss({ base: process.cwd() })]).process(css, {
  from: "app/globals.css",
  to: ".ds-sync/app-compiled.css",
});

writeFileSync(".ds-sync/app-compiled.css", result.css);
console.log(`wrote .ds-sync/app-compiled.css (${result.css.length} bytes)`);
