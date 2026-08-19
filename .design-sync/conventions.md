## Setup

No provider/root wrapper is required — these are shadcn/ui components on Radix
primitives; each manages its own internal context. `styles.css` (imported
automatically) ships FlexPass's full CSS custom-property set for both light
and dark mode, so no extra token setup is needed either.

**Dark mode**: wrap the surface in an element with class `dark` — the tokens
below are class-scoped light (`:root`) vs. dark (`.dark`), same as the rest
of FlexPass.

## Styling idiom: Tailwind utility classes + CSS variables

Style with Tailwind utility classes via `className` (all components accept
and merge one). The classes resolve to FlexPass's real design tokens —
these are the real names, confirmed present in the shipped CSS:

| Class | Token | Use |
|---|---|---|
| `bg-primary` / `text-primary-foreground` | `--primary` (brand indigo) | primary actions |
| `bg-secondary` / `text-secondary-foreground` | `--secondary` | secondary buttons, subtle fills |
| `bg-destructive` / `text-destructive-foreground` | `--destructive` (red) | delete/danger actions |
| `bg-background` | `--background` | dialog/panel surfaces |
| `border-input` | `--input` | input/field borders |
| `ring-ring` | `--ring` | focus rings |
| `text-muted-foreground` | `--muted-foreground` | secondary/help text |
| `rounded-md` / `rounded-lg` / `rounded-xl` | — | Button/Input ≈ `rounded-md`, Dialog ≈ `rounded-lg` |

For a one-off brand accent outside this token set, FlexPass's raw hex values
are `#480082` (indigo), `#9F67FE` (lavender), `#FFB700` (amber), `#0E0D0D`
(near-black) — prefer the token classes above when one fits.

## Where the truth lives

- `styles.css` → imports `fonts/fonts.css` (Clash Display, self-hosted) and
  `_ds_bundle.css` (the full compiled token set + component styles, light
  and dark). Read it before styling anything new.
- Headings/display text use `font-family: "Clash Display", ...` — it's
  wired at the base-element level (`h1`–`h6`), not a utility class.
- Per-component API: `components/general/<Name>/<Name>.d.ts` and
  `.prompt.md`.

## Compound components: compose, don't use sub-parts standalone

`DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
`DialogDescription`, `DialogFooter`, `DialogClose`, `DialogOverlay`,
`DialogPortal` all require a `Dialog` ancestor — they throw outside one. Use
them together, e.g. (verified real render):

```tsx
<Dialog defaultOpen>
  <DialogTrigger asChild>
    <Button variant="outline">Delete event</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Delete this event?</DialogTitle>
      <DialogDescription>
        This can't be undone. Attendees who already bought tickets will be notified.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="secondary">Cancel</Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

`Button` has `variant`: `default | secondary | outline | ghost | destructive | link`
and `size`: `sm | default | lg | icon`. `Input` is a plain styled `<input>` —
pass any native input prop (`type`, `disabled`, `readOnly`, etc.) directly.
