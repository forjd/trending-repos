---
name: Trending Repos
description: GitHub trending printed as a three-ink trade-paper singles chart (yellow, pink and black), with memory.
colors:
  chart-yellow: "#ffde17"
  bar-gold: "#977600"
  stamp-pink: "#ff3d8b"
  band-muted: "#3b3000"
  ink: "#111"
  sheet: "#fff"
  desc: "#383838"
  muted: "#444"
  faint: "#767676"
  rule: "#d4d4d4"
  hover-wash: "#fff8cc"
  sheet-dark: "#161513"
  chart-yellow-dark: "#e7c537"
  stamp-pink-dark: "#f2508f"
  ink-dark: "#e8e4da"
  desc-dark: "#c9c5bb"
  muted-dark: "#d2cec4"
  faint-dark: "#94918a"
  rule-dark: "#42403b"
  hover-wash-dark: "#24210f"
  position-dark: "#c9c5bb"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(60px, 5.8vw, 92px)"
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "32px"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "0em"
  numeral-position:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "40px"
    fontWeight: 900
    lineHeight: 0.84
  numeral-gain:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 0.9
  numeral-days:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1
  days-unit:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  stamp:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\" 1"
  body-small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  switch:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.45
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0.08em"
rounded:
  none: "0px"
spacing:
  gutter: "40px"
  gutter-phone: "16px"
  column-gutter: "24px"
  cell-gap: "14px"
  cell-gap-phone: "12px"
  row-pad: "12px"
  row-pad-dense: "7px"
  row-pad-phone: "14px"
  key-pad: "10px"
components:
  masthead:
    backgroundColor: "{colors.chart-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "16px 0 14px"
  chart-key:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.muted}"
    typography: "{typography.body-small}"
    padding: "10px 0"
  rank-switch:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.switch}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
  rank-switch-hover:
    backgroundColor: "{colors.hover-wash}"
  rank-switch-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  column-heads:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "10px 10px 6px"
  chart-row:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "12px 10px"
  chart-row-hover:
    backgroundColor: "{colors.hover-wash}"
  top-gain-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.numeral-gain}"
    rounded: "{rounded.none}"
    padding: "4px 6px 2px"
  days-run:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.numeral-days}"
    rounded: "{rounded.none}"
    padding: "3px 6px 2px"
  stamp-new:
    backgroundColor: "{colors.stamp-pink}"
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
    padding: "3px 5px 2px"
  stamp-new-dark:
    backgroundColor: "{colors.stamp-pink-dark}"
    textColor: "{colors.ink}"
  chart-row-one:
    backgroundColor: "{colors.chart-yellow}"
    textColor: "{colors.ink}"
  gain-bar:
    backgroundColor: "{colors.bar-gold}"
  gain-bar-dark:
    backgroundColor: "{colors.chart-yellow-dark}"
  stale-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.body-small}"
    padding: "12px 40px"
---

# Design System: Trending Repos

## Overview

**Creative North Star: "The Trade-Paper Chart Sheet"**

The page is a printed singles chart, not a list of cards. A yellow masthead band carries the title, the strapline and the dateline, which leads with how long ago the chart was updated. Below it, a key strip gives the day's totals, a "Rank by" switch and a legend. Then a dense numbered sheet prints four columns per row: rank, days on, the repository, and stars today. Three inks do the work: chart yellow and ink black on a white sheet, with pink as a second spot colour for NEW. Yellow runs down the chart in the gain bars and the No. 1 band, so the masthead's colour does not stop at the masthead. Hierarchy comes from condensed display numerals at very different sizes, heavy and hairline rules, and small reversed ink boxes that mark the facts worth a second look.

The chart ranks by stars today by default, so No. 1 is the day's top gain. GitHub's own order is one click away on the switch. Memory is the point of difference: the "Days on" column counts the days each repo has trended, and long runs print boxed in ink so staying power reads down the column at a glance.

Density is the point. On wide screens the sheet prints two columns at chart density, paired row by row, so a full chart reads like a page of a trade paper. On phones it collapses to one column without losing the rank, days-on and gain figures. The system follows the operating system's light and dark preference; the dark sheet keeps the yellow band.

There is no client script. Motion is one gesture: the NEW tag presses onto the sheet once on load.

**Key Characteristics:**
- Chart yellow masthead band; white sheet; ink #111. Inside the chart, yellow prints the gain bars (a deep gold on the light sheet) and the No. 1 band; pink prints NEW.
- Condensed Big Shoulders Display numerals for ranks, gains, days on and the dateline's age; Archivo for all text.
- Ruled, not boxed: hairline row rules, a 3px rule under column heads and over the footer, a 6px rule under the masthead, a 2px ink divider between the desktop columns.
- Reversed ink boxes for rank-worthy facts: runs of 4 days or more, the top gain in GitHub's order, the active rank order.
- Square corners everywhere; no drop shadows.
- Tabular numerals across the whole page.

## Colors

A three-ink trade-paper palette (yellow, pink and ink) on a white or near-black sheet. Greys are steps of the ink, not new colours, except Band Grey, a shade of gold for grey text inside the No. 1 band.

### Primary
- **Chart Yellow** (`chart-yellow`): the masthead band, the No. 1 band, the text-selection highlight, the light `theme-color` and the favicon.
- **Bar Gold** (`bar-gold`, `--bar`): the gain bars and the key's bar sample on the light sheet. Chart Yellow is invisible as a 7px mark on white (1.0:1 on the track), so the bars print a deep gold that keeps 3:1 on the track.
- **Night Chart Yellow** (`chart-yellow-dark`): Chart Yellow under `prefers-color-scheme: dark`, for the masthead, the No. 1 band, the gain bars (`--bar` is Night Chart Yellow on the dark sheet), the selection highlight and the dark `theme-color`. The favicon keeps Chart Yellow.

### Secondary
- **Stamp Pink** (`stamp-pink`): the NEW tag's ground, with black type (5.7:1). It prints on nothing else.
- **Night Stamp Pink** (`stamp-pink-dark`): Stamp Pink a little softer on the dark sheet, at the same lightness, still with black type.

### Neutral
- **Ink** (`ink`): all primary text, rank and days numerals, gains, the masthead rule, the column-head and footer rules, the column divider, gain bar tracks (at 12%), focus outlines, and the ground of every reversed box (days runs, the top-gain chip, the active switch option, the stale strip).
- **Black** (`--black`, #111 in both schemes): type on yellow and pink (the masthead, the No. 1 band, the NEW tag). Inside the No. 1 band, `--ink` is Black, so the band's gain bar, focus outline, boxed-run ground and top-gain chip print Black.
- **Sheet** (`sheet`): the page background, and the text in every reversed ink box (Chart Yellow inside the No. 1 band).
- **Body Grey** (`desc`): repository descriptions.
- **Press Grey** (`muted`): secondary text: the owner, the meta line (language, total stars, forks, homepage), topics, the chart key's prose, the "Rank by" label, footer prose, the "–" no-history mark and the italic "No description".
- **Faint Grey** (`faint`): a quiet step, 4.5:1 on the sheet. The contrast tests hold it there; no current element prints in it.
- **Hairline** (`rule`): 1px row rules and the key strip's bottom rule.
- **Yellow Wash** (`hover-wash`): row hover and the hover on the inactive switch option.
- **Band Grey** (`band-muted`): a deep gold for Body Grey's and Press Grey's roles inside the No. 1 band (9.8:1 on Chart Yellow, 7.7:1 on Night Chart Yellow).
- **Dark sheet set** (`sheet-dark`, `ink-dark`, `desc-dark`, `muted-dark`, `faint-dark`, `rule-dark`, `hover-wash-dark`): the same roles under `prefers-color-scheme: dark`.
- **Night Position Grey** (`position-dark`): rank numerals on the dark sheet, except No. 1, which prints in Black on its yellow band. In light mode ranks print in Ink.

### Dark Sheet Legibility
The dark sheet is newsprint at night, not white on black. Pure white on near-black glares, and thin light strokes blur, so:
- Ink is a warm off-white (`#e8e4da`, 14:1 on the sheet) on a lifted warm sheet (`#161513`). Do not push ink back to white or the sheet to black.
- Text set in Archivo on the dark sheet prints at weight 450 instead of 400, and uses the platform's default font smoothing. Display numerals (title, age, ranks, days, gains, empty title) keep `antialiased`, so the heavy figures stay crisp. Dark type on light grounds (the masthead, the No. 1 band, the NEW tag) keeps the light-mode weight and smoothing; the stale strip keeps the smoothing.
- Yellow steps down to `chart-yellow-dark` (`#e7c537`). Full-strength yellow on the near-black sheet is the brightest thing on the page by far, and it glares. Ink #111 on it stays above 11:1. Do not push the dark yellow back to `#ffde17`. The No. 1 band is the one large yellow block inside the dark chart. It is deliberate: No. 1 earns the masthead's colour.
- The NEW tag fills on both sheets, in Night Stamp Pink on the dark one. It is a small tag, so it does not glare as a yellow block would.
- Rank numerals step down to `position-dark`: a column of large, full-white 900-weight figures pulls the eye off the repository names. Gains outside the No. 1 band stay full Ink, because they lead the row with the name.
- The tests hold ink and Press Grey at 7:1 or more on both sheets, Faint Grey at 4.5:1 or more, ink on both yellows at 7:1 or more, black on both pinks at 4.5:1 or more, Band Grey on both yellows at 7:1 or more, and the gain bars at 3:1 or more on their track on both sheets.

### Named Rules
**The Pink Means New Rule.** Pink means "first day on GitHub trending" and nothing else. Long runs, the top-gain chip and the active order print in ink, never pink.

**The Yellow Is the Chart Rule.** Inside the chart, yellow belongs to the gain and the position: the bars and the No. 1 band. It never marks a state. The row hover wash is a tint, not a mark.

**The Three-Ink Rule.** Everything prints in yellow, pink and ink. Language swatches are the only other colours, because they are data from GitHub, not palette.

## Typography

Both faces are self-hosted in `public/fonts` as variable woff2 files (Big Shoulders Display, latin; Archivo, latin and latin-ext), with their SIL OFL licences beside them. The CSP allows fonts from the site only. CJK descriptions fall back to PingFang SC, Hiragino Sans, Microsoft YaHei or Noto Sans SC/CJK SC.

**Display Font:** Big Shoulders Display 700/800/900 (with Arial Narrow, sans-serif)
**Body Font:** Archivo 400/450/500/600/700/800 (with system-ui, sans-serif). 450 is the text weight on the dark sheet

**Character:** A tall condensed poster face for every figure the eye scans, against a sturdy grotesque that stays readable at 12 to 18px. The contrast between the two sizes is the hierarchy.

### Hierarchy
- **Display** (900, clamp(60px, 5.8vw, 92px), 0.78, uppercase): the "Trending Repos" title in the masthead only. Phones: min(12.5vw, 64px) on one line.
- **Headline** (900, 32px, 0.9, uppercase): the dateline's age ("2 hours ago"); 18px on phones. The empty state title uses the same face at 48px.
- **Position numeral** (900, 40px, 0.84): the "Rank" column. 38px at 641 to 1100px, 36px at 1101px and up, 34px on phones. No. 1 prints at 44px (42px at 1101px and up).
- **Gain numeral** (800, 24px, 0.9): "+1,527" in the "Stars today" column; 22px at 1101px and up and on phones.
- **Days numeral** (800, 23px, 1): the "Days on" count. A boxed run of 4 to 6 days sets at 22px; 7 days or more at 26px, weight 900. Phones: 20px, 22px and 24px. The legend sample sets at 16px.
- **Days unit** (Big Shoulders 700, 18px, 0.04em, uppercase): "DAYS" beside the count; 14px under the count in a stacked phone box.
- **NEW tag** (Big Shoulders 800, 15px, 0.06em, uppercase).
- **Title** (Archivo 800, 17px, 1.2): the repository link. 18px at 641 to 1100px, at 1500px and up, and on phones; line-height 1.15 at 1101px and up. The owner part is weight 500 in Press Grey, and 14px on its own line where it stacks.
- **Body** (400, 15px, 1.45): base text.
- **Small** (400, 14px): the meta line, descriptions, the chart key, the stale strip (600) and the footer (links 600, in ink). Meta line and descriptions step up to 15px at 1500px and up. Topics at 13.5px.
- **Switch** (700, 13px): the "Rank by" options; the "Rank by" label is 600 in Press Grey.
- **Label** (800, 12px, 0.08em tracking, uppercase): column heads (0.06em on phones). The masthead strapline (800, 14px, 0.06em) and the dateline's "Updated" label (800, 13px, 0.08em) are its larger kin.

### Named Rules
**The Numerals Are Display Rule.** Every number the reader ranks by (rank, days on, stars today, the dateline's age) sets in Big Shoulders Display. Counts inside running text (total stars, forks, the key's totals, the exact UTC time) stay in Archivo.

**The Tabular Rule.** `font-variant-numeric: tabular-nums` applies to the whole page, so figures align down each column.

**The Label Names Data Rule.** Uppercase tracked labels name a column, a date or a data key. They never decorate a section heading.

## Layout

The page is a centred sheet, max 1440px, with 40px side gutters (16px at 640px and below). Every band (masthead, key strip, chart, footer) shares the same container and gutters, so their left edges align.

**Masthead.** A three-column grid (title, strapline and description, dateline), bottom-aligned, gaps 16px by 40px. At 1100px and below the title and strapline stack on the left and the dateline stands to their right. At 640px everything stacks: the title on one line, the strapline without its description (the key already says what the chart is), then the dateline on one line, "UPDATED 2 HOURS AGO", over "Chart of Sun 1 Nov 2026, 16:00 UTC".

**Chart key strip.** A full-width strip under the masthead, padded 10px, closed by a hairline. Its top line puts the live counts ("17 repos gained 13,245 stars today, 4 of them new to trending.") on the left and the "Rank by" switch on the right; a screen-reader-only sentence names the order. Under it, the legend: NEW, a boxed days sample ("N DAYS = days on GitHub trending since 5 Oct 2026; boxed from 4 days"), and a bar sample ("share of the day's top gain"). The days sample shows today's longest run (at least 3). The NEW sample is omitted when no repo is new, and the bar sample when there is only one repo. At 1100px and below the samples sit in a fixed 60px column so their text lines up; on phones that column is 52px, the same as the rank column, and the "Rank by" label takes the same 52px, so the legend text, the switch and the repository column share one left edge. The bar sample is hidden on phones, where bars are hidden.

**Chart order.** `/` ranks by stars today; the sort is stable, so ties keep GitHub's order. `/?sort=github` keeps github.com/trending's own order. The ETag carries the order.

**Chart grid.** Each row is a four-column grid: rank 40px, days on 86px, repository flexible, stars today 128px (160px at 1500px and up), with 14px column gaps. Rows pad 12px by 10px and close with a 1px hairline. Rank and days span the row's height on the left; the name and the meta line sit beside the gain; the description and topics run under both the repository and the gain columns. Column heads ("Rank", "Days on", "Repository", "Stars today") repeat the grid over a 3px ink rule and stay stuck to the top of the viewport while the chart scrolls.

**Two-column reading order (1101px and up).** The chart prints as two columns, the left holding positions 1 to ceil(n/2), the right the rest. The column heads carry the range ("Repository 1–8", "Repository 9–16"). A 2px ink divider runs between the columns, with 24px on each side. Both columns are subgrids of one grid, so row N on the left and row N on the right share one grid row: each pair is only as tall as its taller row, and the columns stay in step. The DOM keeps assistive-tech order correct: two ordered lists, the second with `start`, each in a labelled section ("Positions 1 to 8", "Positions 9 to 16"). The last row of each column drops its hairline, because the footer rule closes the chart.

**Desktop density (1101px and up).**
- Rows pad 7px by 10px; ranks drop to 36px and gains to 22px.
- Forks go to screen readers only. The homepage sits in a slot that takes what is left of the meta line (19px high, 20px at 1500px and up, overflow hidden). A hostname that does not fit wraps inside the slot onto its clipped second line and is hidden whole, never shown as a cut-off fragment. Language and total stars are never clipped; the line wraps instead. The slot opens when its link holds focus.
- Topics are hidden.
- From 1101 to 1439px, where each column is narrow, the owner prints on its own small line over the name. From 1440px the pair sits on one line.
- From 1101 to 1499px descriptions use the mid cut; at 1500px and up the long cut, and text steps up a size.

**Descriptions.** Leading emoji and `:shortcodes:` and every bare URL are stripped. The server cuts each description at a word (or a CJK character) in three lengths: long (about 150 Latin characters, for tablets and 1500px and up), mid (104, for 1101 to 1499px) and short (76, for phones). Only one prints at each width, and the full text sits in `title`. A 2-line clamp is a safety net only.

**Tablet (641 to 1100px).** One chart column; the second list's column heads are hidden so the chart reads as one continuous sheet. Topics show (up to three, separated by "·"). The switch options pad 12px by 14px for touch.

**Phone (640px and below).** Three columns: 52px left, flexible body, auto gain, with 12px gaps; rows pad 14px top and bottom with no side padding. The No. 1 band pads 10px at the sides and reaches 10px into the gutter, and the stuck column heads cover that reach so the band never shows beside them. Days on sits right under the rank in the left column, and its head ("Days") sits under "Rank". Boxed runs stack number over unit so a two-digit run fits. The owner prints on its own line; the gain aligns with the repository name, not the owner line. Forks, topics and gain bars are hidden. The name and homepage links extend their tap area 10px by 6px. The footer stacks, and its links pad 10px top and bottom.

## Elevation & Depth

The system is flat. There are no shadows. Depth comes from print devices: rule weight (1px hairline, 2px column divider, 3px head and footer rules, 6px masthead rule), solid bands of colour, and small reversed ink boxes. The one `box-shadow` in the build is a 1.5px inset black edge on a NEW tag inside the No. 1 band, where pink on yellow barely separates. It is a stroke with no offset or blur.

### Named Rules
**The Rules, Not Boxes Rule.** Separate content with rules of graded weight. Do not use cards, borders on four sides, or shadows. The only four-sided borders are the "Rank by" switch, which is a control, not a container.

**The Band Edge Rule.** In dark mode the 6px ink rule under the masthead does not print on the near-black sheet; the yellow band's own edge serves as the rule. Do not add a substitute rule colour to make it show.

## Shapes

Square corners throughout (0px): language swatches (10px squares, desaturated to 75%), the NEW tag, days boxes, the top-gain chip, the switch and gain bars (7px high). Nothing rotates; the only drawn mark is the switch's check, two 2px borders turned -45 degrees. Icons are inline SVG: GitHub's star before the total, and an arrow after the homepage.

## Components

### Masthead
Chart yellow band with ink type, closed by a 6px ink rule. Title left; strapline ("GitHub trending, with memory") and a one-line description centre (max 54ch); dateline right: an "Updated" label, then the age in display caps ("2 HOURS AGO"), then "Chart of Sun 1 Nov 2026, 16:00 UTC" with the time in a `<time>` element. The age leads because it needs no time-zone sums. The dateline is omitted when there is no snapshot or the timestamp does not parse.

### Chart Key
See Layout. Bold ink figures inside Press Grey prose; the NEW sample is static (no press motion).

### Rank By Switch
A segmented control of two links, "Stars today" (`/`) and "GitHub's order" (`/?sort=github`), in a `<nav aria-label="Chart order">` after a "Rank by" label. Each option has a 1.5px ink border; the borders overlap so the pair reads as one control. The current option has `aria-current="page"`, an ink fill with sheet text, and a drawn check before its label. The other option takes the yellow wash on hover. No underlines.

### Stale Warning
When the snapshot is more than 12 hours old (three missed runs), a full-width strip prints between the masthead and the key: the sheet reversed (ink ground, sheet-coloured text), Archivo 600 at 14px, centred, `role="status"`. It is the one place the chart admits it is old, so it never uses yellow.

### Chart Row
- **Columns:** rank numeral, days on, repository block (link, meta line, description, topics), stars-today gain with its bar.
- **Repository link:** one link, "owner / name". The owner is weight 500 in Press Grey; only the name is underlined (1px, 3px offset, 45% of the text colour), and the underline goes solid on row hover. A long pair breaks before the name, never inside it.
- **Meta line:** language with a 10px square swatch, GitHub's star with the compact total ("39.8k total"), compact forks, and the homepage hostname. Compact figures carry the full figure in `title` and in screen-reader text.
- **Homepage:** grey with an arrow and no underline; it goes ink and underlined on hover, so each row has one underlined link. A homepage on github.com, www.github.com or any *.github.com host is dropped, because it only leads back to GitHub. Only `http(s)` URLs print.
- **Gain:** "+1,527" over a 7px bar. The bar's width is the repo's share of the day's top gain, at least 8%, in Bar Gold (Night Chart Yellow on the dark sheet) on a 12% ink track. Screen readers hear "stars today", and "the top gain" on that row.
- **Top-gain chip:** in GitHub's order, the row with the day's biggest gain (on a tie, the higher position) prints its gain reversed, on an ink chip. In stars order there is no chip, because No. 1 is the top gain.
- **No. 1:** prints on a Chart Yellow band, the masthead's colour, never reversed in ink. Its rank numeral is larger (44px). The band remaps the tokens: type is black, grey text is Band Grey, a boxed run and the top-gain chip print yellow on black, and the gain bar prints in black. The name's underline is 60% of the text colour, not 45%, because all type on the band is black. A NEW tag on the band gets a 1.5px black edge. The band keeps its colour on hover, closes with a 1px black rule (also as the last row of a column), and on phones reaches 10px into the gutter so its type does not touch the edge. Text selection inside it is black with yellow text. The band marks position 1 in either order.
- **Hover:** yellow wash background (No. 1 keeps its band) and a solid underline on the name.
- **Focus:** the row draws a 2px ink outline inset 2px when its name link has focus. Other links use a 2px currentColor outline, offset 2px.
- **Degrades quietly:** a missing language, homepage or topics removes its element. A missing description prints "No description" in italic Press Grey, so every row keeps its shape.

### Days On Cell
- **Short run (1 to 3 days):** the count in ink with a condensed uppercase "DAY"/"DAYS" unit beside it (screen readers hear "Trended on 3 days").
- **Run (4 days or more):** count and unit print together in an ink box with sheet text, padding 3px 6px 2px; on phones the box stacks the number over the unit.
- **Long run (7 days or more):** the boxed count prints larger and heavier (900, 26px; 24px on phones).
- **NEW:** the NEW tag replaces the count (screen readers hear "New today").
- **No history:** a Press Grey "–" with screen-reader text "No history yet".

### NEW Tag
A small uppercase tag in Big Shoulders 800, 15px, 0.06em, padding 3px 5px 2px. Stamp Pink ground with black text (Night Stamp Pink on the dark sheet). On load it presses onto the sheet: scale 1.9 to 1 in 0.42s, `cubic-bezier(.16, 1, .3, 1)`, staggered 40ms per position (capped at position 25). The animation is disabled under `prefers-reduced-motion: reduce`, and on the key's legend sample.

### Empty State
"No trending data yet." in uppercase display at 48px, then one line saying the first chart is compiled on the next 4-hour run. The key strip and dateline are omitted.

### Footer
A 3px ink rule over Press Grey 14px text: the data credit to github.com/trending and the GitHub API, "Not affiliated with GitHub", and ink links (600) to the JSON, the source, "Trending AI models" (models.ddewhurst.com) and the author's site (ddewhurst.com, `rel="author"`). The links wrap on narrow screens.

## Do's and Don'ts

### Do:
- **Do** set every ranking figure (rank, days on, gain, the dateline's age) in Big Shoulders Display, at sizes that keep rank largest.
- **Do** keep pink for NEW only, and yellow inside the chart for the gain bars and the No. 1 band.
- **Do** mark rank-worthy facts with a reversed ink box: runs of 4 days or more, the top gain in GitHub's order, the active rank order.
- **Do** separate rows with 1px hairlines and heads with a 3px ink rule.
- **Do** keep the two-column chart in DOM order as two ordered lists, the second with `start`, and pair their rows with subgrid.
- **Do** keep the stars-today sort stable, so ties keep GitHub's order.
- **Do** cut descriptions at a word on the server, and keep the full text in `title`.
- **Do** keep one underlined link per row: the repository name.
- **Do** hide a homepage whole when it does not fit the one-line desktop meta row.
- **Do** give every compact or visual-only figure a full screen-reader equivalent.
- **Do** disable the NEW press under reduced motion.

### Don't:
- **Don't** put repos in cards, rounded boxes or shadowed panels.
- **Don't** round corners.
- **Don't** add a fourth palette colour; language swatches are data, not palette.
- **Don't** reverse the No. 1 row in ink; it prints on yellow. Don't mark the top-gain chip in yellow or pink.
- **Don't** print avatars; the owner's name is enough.
- **Don't** print a truncated fragment of a link; hide it whole.
- **Don't** link a homepage that leads back to GitHub.
- **Don't** put uppercase tracked labels above section headings as decoration.
- **Don't** add motion beyond the NEW press.
