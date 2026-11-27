# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: survivors who commented.** People who left their account on the "I am Jane Doe"
Instagram reel and come to find their own words: searching for a line they remember writing, or
finding the dot that holds it on a canvas. They are reading about their own sexual assault and
thousands of others'. When needs conflict, they come first (confirmed 2026-11-27).

Secondary audiences, served after the survivor:

- **The wider public:** visitors who never commented and come to grasp what 34,078 dots mean.
- **Art collectors and press:** people who come for the paintings and the prints.

The comments were written on Instagram, so many people arrive on phones. The viewer has explicit
phone and touch behaviour.

## Product Purpose

The Dot Project turns every survivor comment on the "I am Jane Doe" reel into one painted dot. A
dot is red if the person was assaulted under 18 or by a family member, and blue if they were 18 or
older. The artist, Elise Khong, paints the dots by hand in the order the comments were posted, row
by row, outward from a black origin dot that stands for the first Jane Doe.

dotproject.io is where people see every canvas up close, open any dot to read the words it holds,
and search every reviewed comment for their own. Success is a survivor finding their own words,
seeing them held on the canvas, and being able to correct them if they are wrong.

What the project is building toward (confirmed 2026-11-27):

- **Paint every comment.** There are 49,148 reviewed comments at about 11,400 per canvas, so
  roughly 4–5 canvases in all. Three are done and canvas 4 is planned.
- **A launch or exhibition.** At that public moment the site becomes the project's official home.
  Today's "coming soon" framing is temporary.
- **The gigapixel image** of canvas 1, stitched from macro photography.

## Positioning

Every dot is a specific, real comment, and the site can show which one. Each painted dot is mapped
back to the exact words it stands for (painted colours agree with the comment stream 99.9% of the
time after alignment). The scale is literal, not illustrative: a number on this site counts people
who wrote something. Survivors can find themselves inside the artwork, and the people in the
artwork can correct it.

## Operating Context

- **Source and review.** Comments come from a public Instagram reel. They are exported and
  classified as UNDERAGE, ADULT or INCEST by the sibling `ig-comments` repo, then hand-reviewed by
  the owner (every comment was reviewed by 2026-11-23). Usernames, handles and contact details are
  removed. Names inside the text are redacted.
- **The painting.** By hand on paper, on a hex lattice of 46-dot rows, in comment order. Each
  canvas is photographed. The masters stay private, and only resized images, deep-zoom tiles and
  dot data are published.
- **Surfaces.** Four pages:
  - landing page: wordmark, search, red/blue/total counts with their key, canvas carousel;
  - canvas viewer: deep zoom; tap a dot to read it; previous/next in reading order; arrow keys;
    deep links with `?c=N&dot=N`;
  - search page: substring search over every comment, 200 results per page, with "find this dot
    on canvas N" links;
  - 404 page.
- **Change requests.** "Is this your comment?" links open the owner's Google Form, prefilled with
  the canvas, dot and comment index. The owner reviews every request. The Instagram handle on the
  form is optional and used only to check authorship. The site itself stores nothing.
- **Prints.** Each canvas has a "Buy a print" link to Elise Khong's store (elisekhong.art).
  Proceeds support the artist.
- **Adding a canvas** is a recurring ritual with a fixed checklist (the add-canvas skill,
  `.claude/skills/add-canvas/SKILL.md`).

## Capabilities and Constraints

- Static Jekyll site on GitHub Pages: no server, no database, no accounts. Pages are Liquid
  templates and must be built by Jekyll.
- A push to `main` deploys the live site. Nothing is committed or deployed without the owner's
  explicit approval.
- The ~10 MB `comments.json` loads only on the search page, and streams there so results appear
  while it downloads. The landing page loads no data and only one small script.
- **Colour rule:** red means UNDERAGE or any INCEST; blue means ADULT without incest. A dot's colour
  always matches its comment. A few dots are half red and half blue and take either.
- Comments without a dot stay searchable. A comment sits on at most one dot.
- The search UI shows only the comment text. Category badges and filter chips were removed on
  purpose.
- Redaction tokens are `[name]`, `[handle]`, `[email]`, `[link]` and `[phone]`.
- Master photographs and the macro photo set are never published.
- **Terminology:**
  - **dot**: one comment, one person;
  - **canvas**: numbered 1–N;
  - **comment / words**: what a survivor wrote;
  - **red / blue**: under 18 or incest / 18+;
  - **the first Jane Doe**: the black origin dot, which stands for her, not for a comment;
  - **survivor**.

**Open decisions.** These are current states, not rules. Changing one is the owner's call, not a
design default:

- whether the canvas and search pages stay out of search engines (`noindex` today) after launch;
- support resources such as crisis lines (none exist; not adopted as a rule);
- analytics (none today; not adopted as a rule);
- who is credited as the project's owner beyond Elise Khong as the artist;
- whether the first Jane Doe is named or described beyond the origin dot's current copy.

## Brand Commitments

- **Name:** Dot Project. The wordmark has no period; it was removed on purpose.
- **Artist:** Elise Khong. Credit her by name and link her Instagram, **@elisvkho** (confirmed
  2026-11-27), and her store, elisekhong.art. The site doesn't show the handle yet.
- **Red and blue carry the project's meaning.** The wordmark's red and blue "o"s name it.
  Elsewhere, red and blue are not available as decoration or as generic UI signals.
- **The colour key reads** "Red: under 18, or abused by a family member. Blue: 18 or older."
  (approved 2026-11-27).
- **Voice,** as the shipped copy has it (inferred from the site, not separately confirmed): plain
  words and short sentences that speak to the survivor as "you" ("Search for your comment", "Every
  dot is a survivor. Zoom in and tap a dot to read their words."). It is never sensational or
  clinical, and it asks the reader to read with care.

## Evidence on Hand

- Three painted, photographed canvases, each in `images/canvasN/` with landing images, deep-zoom
  tiles, `dots.json` and `texts.json`.
- Dot counts in `_data/canvases.json`, rewritten on every rebuild: 34,078 dots across three
  canvases, 26,146 red and 7,932 blue by comment colour (2026-11-26 build). Always read counts from
  this file, never from memory.
- `comments.json`: 49,148 reviewed, anonymized comments.
- Store pages for canvases 1–3 (`_data/prints.yml`) and the live change-request form
  (`_data/change_form.yml`).
- **Absent:** no artist statement or bio, no photography of the artist or studio in the repo, no
  press, testimonials, exhibition dates or venue, nothing about the first Jane Doe beyond the
  origin-dot copy, and no visitor numbers. The gigapixel image is not assembled yet. Future work
  must not invent any of these.

## Product Principles

1. **The survivor comes first.** Finding your own words is the primary path. When a choice helps a
   browser or a buyer at a survivor's expense, the survivor wins.
2. **Every number is people.** Counts come from the build, are never rounded up or estimated, and
   a dot's colour always matches its comment.
3. **Their words, unframed.** Comments appear as written, redacted only to protect identity, with
   no category labels or editorial framing laid over them. The people in the work can correct it.
4. **Anonymity is not negotiable.** No username, handle or contact detail of a commenter ever
   reaches a page (confirmed as binding 2026-11-27).
5. **Red and blue mean something here.** They stand for under 18 and 18+, so nothing else on the
   site borrows them.
