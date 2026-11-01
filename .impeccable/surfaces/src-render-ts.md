---
version: 1
slug: "src-render-ts"
primary_target: "src/render.ts"
related_targets: []
---

# Surface: trending page (`GET /`, rendered by src/render.ts)

Mode: Read. A public developer checks what is gaining stars today and which repos are new or staying.

Audience and job: first-time and returning developers, desk or phone, a 10-second scan, then open a repo.
Content: one KV snapshot (about 17-25 repos), freshness time, per-repo history (days on chart, new today). API fields can be missing.
Constraints: no client JS (CSP has no script-src), fonts self-hosted in public/fonts (CSP font-src 'self'), follows system light/dark, keep "Not affiliated with GitHub" and the data credit.

## Direction contract

THESIS: GitHub trending is a singles chart; this page is the chart with memory. It refuses the card-list-of-repos and prints a dense numbered chart sheet: position, days on chart, title, stars today.
OWN-WORLD: two-colour trade-paper chart sheet. Chart yellow #ffde17 masthead band over a 6px ink rule, white sheet, ink #111, one hot pink #ff3d8b for NEW stamps. Big Shoulders Display condensed numerals for positions and gains; Archivo for text. Hairline row rules, a heavy rule under column heads, the No. 1 row printed reversed.
STORY: the visitor sees the date and time of this chart, reads No. 1, scans positions, spots NEW stamps and long runs in "Days on", opens a repo.
FIRST VIEWPORT: full-width yellow masthead: "TRENDING REPOS" huge condensed, left; tagline and chart key centre; chart date and "16:00 UTC" huge, right. Below, a two-column chart (positions 1 to n/2 left, rest right) on desktop; the No. 1 row reversed in ink with its gain in yellow. One column on phones.
FORM: The Singles Chart, position 1 on my ordered list (IMPECCABLE'S PICK). seed:14250a7849ea27dc
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: NEW stamps print onto the sheet once on load (stamp press), disabled under reduced motion.
Memorable moment: the reversed No. 1 row and the pink NEW stamps down the "Days on" column.
