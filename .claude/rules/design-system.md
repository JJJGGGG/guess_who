---
paths:
  - "client/src/**/*.tsx"
---

# Guess Who design system

UI work in the client follows the Guess Who design system. Tokens live in
`client/src/index.css` (CSS variables, light + dark) and are mapped in
`tailwind.config.cjs`. Component styles are the `gw-*` classes in the
`@layer components` block of `index.css`. Full reference (tokens, component
guidelines, screen mockups): https://claude.ai/artifact/1sbJ23VCb9T2KDmzwX8T3n

## Use what exists first

- Reach for `client/src/ui/` before writing markup: `Button`, `Banner`,
  `PlayerBadge`, `CharacterTile`, `Board`, `SecretCard`, `icons`. Links styled
  as buttons use `buttonClass()` from `ui/classes.ts`.
- Use `gw-*` classes for components and Tailwind utilities for layout
  (flex/grid, gap, width). Don't restyle a component with utilities; add a
  variant to its `gw-*` class instead.

## Colour

- Only token colours: `bg`, `surface`, `surface-sunk`, `line`, `line-strong`,
  `ink`, `ink-muted`, `seat-1*`, `seat-2*`, `danger*`, `warn*`, `success`,
  `focus` (e.g. `text-ink-muted`, `bg-surface`). Never Tailwind palette colours
  (`bg-sky-600`, `text-red-600`, `bg-blue-500`…) or hex literals in TSX.
- `seat-1` (cobalt) means *you* and primary actions; `seat-2` (tangerine)
  means *the opponent* and is never an action. Spectators: seat order.
- On a `seat-2` fill use `on-seat-2` (dark), never white. Orange text uses
  `seat-2-ink`.
- Status colours always come with a word ("Locked in", "Away"), never a dot alone.

## Type

- `gw-display` (Dela Gothic One): one headline per screen, the wordmark, the
  secret character name. Never body text or buttons.
- `gw-label` for uppercase section labels; write the text in sentence case,
  CSS uppercases it.
- Room ids, seat counts, countdowns, tile counts go in `gw-code` (mono,
  tabular figures). Room ids are written `#383`; countdowns `m:ss`.

## Components

- Buttons: at most one `primary` per view. Leave/exit is `danger` (outlined).
  Low-emphasis inline actions are `ghost`. Sizes `sm` in rows, `lg` only on
  the welcome form.
- Keep a disabled button visible rather than hiding it (e.g. "Start game").
- Panels are `gw-panel`; don't add borders/shadows/radius to arbitrary divs.
- Tiles keep the 50:78 portrait ratio and live inside `Board` (6 columns at
  every width). Flipping is `CharacterTile`'s `flipped` prop, not removal.
- Status messages use `Banner` (`danger` own connection, `warn` opponent
  away, `info` transitions).

## Tailwind gotcha

- Never build `gw-*` or Tailwind class names by interpolation
  (`` `gw-btn--${variant}` ``): the content scan won't see them and the styles
  get stripped. Map variants to full literal class names.

## Copy

- English everywhere, sentence case, address the player as "you".
- Say what happened and what happens next ("Connection lost. Reconnecting…").
- Use "…" (ellipsis character), not "...". No emoji in UI chrome.
- If copy changes, update the matching queries in `components.test.tsx`.

## Accessibility

- Every interactive element keeps the `focus` ring (`:focus-visible`, 2px,
  offset 2px); don't remove outlines.
- Inputs have a visible `<label>`; errors use `aria-invalid` + `aria-describedby`.
- Icons are `aria-hidden`; icon-only buttons need `aria-label`.
- Animations respect `prefers-reduced-motion`.
