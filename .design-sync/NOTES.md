# design-sync notes — FlexPass

## Scope

This repo is the FlexPass **product app**, not a design-system package —
there's no `.storybook/`, no `*.stories.*`, and `package.json` has no
`main`/`module`/`exports` (it's not built/published as a library). By
explicit user decision, this sync covers **only `components/ui/`** (the 3
shadcn/ui primitives: `Button`, `Dialog`, `Input` — 12 exports total
counting Dialog's sub-parts). The rest of `components/` (EventCard,
CheckoutModal, TicketQR, Navbar, AuthModal, etc.) is bespoke, tightly
coupled to Supabase/Next.js/business logic, and intentionally out of scope.

## Real bug fixed as a prerequisite

`components.json` declares `cssVariables: true, baseColor: "neutral"`
(shadcn's setup), but `app/globals.css` never actually defined the
semantic tokens (`--primary`, `--secondary`, `--accent`, `--destructive`,
`--ring`, `--input`, `--border`, `--muted[-foreground]`, `--card`,
`--popover`) that `Button`/`Dialog`/`Input` are built on. This wasn't just
a sync-fidelity problem — it meant these components were rendering
**unstyled in production** (used live in `AuthModal`, `BankSettings`, and
`app/dashboard/wallet/page.tsx`). Added both light and dark token sets to
`app/globals.css`, mapped onto FlexPass's existing `--brand-*` tokens
where they overlap (see the `@theme inline` block + `:root`/`.dark`
additions). Verified with `npm run build` before and after, and confirmed
`.bg-primary{background-color:var(--primary)}` compiles in the real
output. This is a real repo fix, independent of the sync — keep it even
if design-sync itself is dropped later.

## No package/library build — how the converter gets an entry

There's no `dist/`. The converter needs `--entry` to anchor `PKG_DIR` at
the repo root (walking up from the entry file's own directory to find the
first `package.json` with a `name`) — so:

- **`.design-sync/entry.tsx`** is a hand-authored aggregating entry
  (`export {...} from "@/components/ui/button"` etc.) — NOT
  `.ds-sync/entry.tsx`: `.ds-sync/package.json` has `name: "ds-sync-deps"`,
  which would be found by the walk-up FIRST and wrongly pin `PKG_DIR` to
  the scratch dir. `.design-sync/` has no `package.json`, so the walk-up
  correctly continues to the real repo root. Don't move this file into
  `.ds-sync/`.
- `cfg.componentSrcMap` explicitly pins all 12 export names to their real
  source paths — this is what avoids the "synthesize from src/" fallback
  scanning ALL of `components/` (which would pull in every business-logic
  component). Because of this pin, `cfg.srcDir: "components/ui"` isn't
  strictly load-bearing (componentSrcMap short-circuits the fuzzy src
  search either way) but keep it — it scopes the `walk()` call and avoids
  ever touching the rest of `components/`.
- `cfg.tsconfig: "tsconfig.json"` is required for the `@/*` alias in
  `entry.tsx` and inside button/dialog/input.tsx (`@/lib/utils`) to
  resolve via esbuild.

## CSS — no stable dist stylesheet either

Next's own compiled CSS is a hash-named chunk under `.next/static/chunks/`
with no stable path, and it's the WHOLE app's CSS. **`.design-sync/compile-css.mjs`**
recompiles `app/globals.css` through the real `@tailwindcss/postcss`
pipeline (the same plugin Next uses) into `.ds-sync/app-compiled.css`,
which `cfg.cssEntry` points at. This must be re-run on every sync —
`.ds-sync/` is gitignored/regenerated, and `app/globals.css` may have
changed since.

## Fonts

Clash Display's `@font-face` in `app/globals.css` uses `/fonts/...`
(root-absolute — only resolves inside the actual Next.js app). Passing the
raw `.woff2` files as bare `extraFonts` entries left the *original*
absolute-path `@font-face` rule dangling (`[FONT_DANGLING]`) instead of
being rewritten. Fixed by pointing `cfg.extraFonts` at
**`.ds-sync/extra-fonts.css`** — a hand-authored `@font-face` block with
paths relative to itself (`../public/fonts/clash-display-*.woff2`) — which
the extraFonts CSS-parsing path handles correctly (copies the referenced
files, produces a working `fonts/fonts.css`). Space Grotesk is loaded via
`next/font/google` in `app/layout.tsx`, not a static `@font-face` — it
isn't in this bundle; components here don't rely on it directly (base
`font-family` inheritance covers body text, and none of these 3
components override it).

## Re-sync — exact command sequence

```sh
# from repo root
node .design-sync/compile-css.mjs                      # refresh .ds-sync/app-compiled.css
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./.design-sync/entry.tsx --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json          # fetch this first via DesignSync get_file on _ds_sync.json
```

If `.storybook/` or a real component-library build ever gets added to
this repo, re-run shape detection from scratch — don't assume `package`
shape / this config still applies.

## Re-sync risks

- **`app-compiled.css` isn't committed** (lives in gitignored `.ds-sync/`)
  and its content-scan result can shift slightly between runs (observed:
  98KB → 110KB across two back-to-back compiles with no source change —
  likely Tailwind's content-detection picking up build-artifact noise
  under `.next/`). Harmless for these 3 components (same classes present
  either time, verified), but if a re-sync's bundle looks unexpectedly
  different in size, check this first before assuming a real regression.
- **Token mapping is a judgment call, not a 1:1 port.** `--secondary`,
  `--muted`, and `--accent` all currently map to the same
  `--surface-raised` value (light) / dark equivalent — shadcn expects
  these to be distinguishable in general, but FlexPass's own design
  doesn't currently have 3 distinct subtle-fill tones. If FlexPass's
  brand tokens gain more granularity later, revisit this mapping.
- **Only `Button`, `Input`, and one composed `Dialog` story are authored.**
  The other 9 Dialog sub-exports (`DialogTrigger`, `DialogContent`, etc.)
  are floor cards by design — they throw outside a `Dialog` parent, so
  there's no meaningful standalone preview for them. This is expected,
  not a gap to close.
- **`components.json` `baseColor: "neutral"`** was honored loosely — the
  actual `--destructive` red (`#ef4444`/`#f87171`) was picked to match
  colors already used elsewhere in the app (`text-red-500`, `#ef4444` in
  `app/admin/*`), not shadcn's literal neutral-palette default. If FlexPass
  later runs `shadcn add` for a new component, check its generated
  destructive/etc. don't drift from what's now in `globals.css`.
