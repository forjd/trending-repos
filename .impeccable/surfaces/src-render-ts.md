---
version: 2
slug: "src-render-ts"
primary_target: "src/render.ts"
related_targets: ["src/index.ts"]
---

# Surface: trending page (`GET /` and `GET /?sort=github`, rendered by src/render.ts)

Mode: Read. A public developer checks what is gaining stars today and which repos are new or staying.

Audience and job: first-time and returning developers, desk or phone, a 10-second scan, then open a repo.
Content: one KV snapshot (about 17-25 repos), freshness (age and exact UTC time), per-repo history (days on chart, new today). API fields can be missing.
Order: `/` ranks by stars today, stable on ties; `/?sort=github` keeps github.com/trending's own order. `src/index.ts` reads `sort` and adds it to the ETag.
Constraints: no client JS (CSP has no script-src), fonts self-hosted in public/fonts (CSP font-src 'self'), follows system light/dark, keep "Not affiliated with GitHub" and the data credit.

## Direction contract

Revised 2026-11-04 to match the shipped redesign. The build wins; DESIGN.md records it in full.

THESIS: GitHub trending is a singles chart; this page is the chart with memory. It refuses the card-list-of-repos and prints a dense numbered chart sheet: rank, days on chart, title, stars today.
OWN-WORLD: two-colour trade-paper chart sheet. Chart yellow #ffde17 masthead band over a 6px ink rule, white sheet, ink #111. Inside the chart, yellow marks NEW only (a tinted tag on the light sheet, an outline on the dark sheet). Big Shoulders Display condensed numerals for ranks, gains, days on and the update age; Archivo for text. Hairline row rules, a heavy rule under column heads, a 2px ink divider between desktop columns, reversed ink boxes for runs of 4+ days, the top gain in GitHub's order and the active rank order.
STORY: the visitor sees how long ago the chart was updated, reads No. 1 (the day's top gain), scans gains and their bars, spots NEW tags and boxed runs in "Days on", switches to GitHub's order if they want it, opens a repo.
FIRST VIEWPORT: full-width yellow masthead: "TRENDING REPOS" huge condensed, left; strapline and one-line description centre; "Updated" over "2 HOURS AGO" in display caps over "Chart of <day>, <hh:mm> UTC", right. Below, the key strip: totals and the "Rank by" switch, then the legend. Then a two-column chart (positions 1 to n/2 left, rest right, rows paired by subgrid, sticky heads with ranges) on desktop. One column on phones, with "UPDATED 2 HOURS AGO" on one line.
FORM: The Singles Chart, position 1 on my ordered list (IMPECCABLE'S PICK). seed:14250a7849ea27dc
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: NEW tags press onto the sheet once on load (scale only), disabled under reduced motion. The "Rank by" switch re-ranks the chart with a plain link.
Memorable moment: the boxed runs down the "Days on" column, and the update age leading the masthead.
