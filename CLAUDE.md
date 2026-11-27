# CLAUDE.md

Context for working on **dotproject.io**, the public website for the Dot Project.

- **Product context** (users, purpose, care rules, brand) is in [PRODUCT.md](PRODUCT.md).
- **Setup, build and the domain** are in [README.md](README.md).
- **Adding a canvas:** the owner puts the photo in a new folder as `images/canvasN/canvasN.jpg`.
  Claude first makes `canvasN_4x.jpg` with colouring and brightness identical to `canvas1_4x.jpg`,
  then the rest of the images. The steps are in the [add-canvas skill](.claude/skills/add-canvas/SKILL.md).

## Working agreement (read first)

**Ask before changing anything unless you are ≥90% confident you understand the task.**
When the request is ambiguous, underspecified, or could be read more than one way, stop and ask
clarifying questions *before* editing files, running destructive commands, or deploying. Only
proceed without asking when the intent is unmistakable. A quick question is always cheaper than
undoing the wrong change on a live site.

- **Nothing is committed or deployed without explicit say-so.** Make changes locally, show them (a
  local `bundle exec jekyll serve` preview is ideal), and wait for approval. Pushing to `main`
  redeploys the live site.
- **Git workflow:** branch off, commit, merge the branch into `main` (`--no-ff`) and push `main`.
  Then fast-forward `develop` to `main` and push it, so the two stay in sync. Don't commit feature
  work straight onto `main` or `develop`.
- **Never commit or publish the master photos** or other image working files. See
  [Images](#images-what-is-published-and-what-never-is).
- **This repo is public.** Anyone can read everything committed, including this file.

## What this is

A small static **Jekyll** site on **GitHub Pages**, live at <https://dotproject.io> (custom domain,
HTTPS enforced). There is no server: the dot data is built offline in the sibling `ig-comments`
repo and committed here. The site has four pages:

- **landing** (`index.html`): wordmark, search box, red / blue / total dot counts with their key,
  and a carousel with one slide per canvas;
- **canvas viewer** (`canvas.html`): deep zoom into a painted canvas; open any dot to read the
  comment it holds;
- **search** (`comments.html`): client-side search over every reviewed comment;
- **404** (`404.html`).

Each page carries YAML front matter (`layout: default`, `title`, `description`, optional `noindex`,
`styles:`, `scripts:`) and contributes only its body; the layout supplies the `<head>` and shell.

### Files

```text
_config.yml               site config: title, url, baseurl "", exclude list (docs, masters)
_layouts/default.html     page shell: <head> (meta, icons, link previews), style.css, per-page styles/scripts,
                            the analytics beacon (live build only)
_includes/site-data.html  #site-data JSON (canvases, prints, change form) read by canvas.js and comments.js
_data/canvases.json       dot counts, all canvases and per canvas; written by build_site.py, never by hand
_data/canvas_images.yml   [width, height] of each canvas's published image (carousel img attributes)
_data/prints.yml          "Buy a print" link per canvas (the artist's store)
_data/change_form.yml     the owner's Google Form (url + entry ids) behind the change-request links
index.html                landing page; carousel slides generated from _data/canvases.json
canvas.html               viewer: ?c=N picks the canvas (default 1), ?dot=N opens a dot
comments.html             search page: ?q= seeds the search
404.html                  not-found page (permalink /404.html)
style.css                 global styles and the whole palette in :root (see Design rules)
assets/canvas.css, .js    viewer: OpenSeadragon, dot hit-testing, panel, keyboard, load failures
assets/comments.css, .js  search: streamed search, "find this dot" and "request a change" links
assets/home.js            landing carousel arrows (the landing page's only script)
assets/lib/               self-hosted OpenSeadragon 4.1.0 (byte-identical to cdnjs; sha512 in canvas.html)
images/canvasN/           per canvas: canvasN-{480,720,960,1440}.jpg (landing), canvasN.dzi +
                            canvasN_files/ (deep-zoom tiles), dots.json (positions, paint, reading
                            rank, comment index), texts.json (comment text per dot); masters ignored
images/share.jpg          1200×630 link-preview image (og:image), a close crop of canvas 1
favicon.ico, favicon.svg  the icon: one red dot; apple-touch-icon.png is the dot on white
comments.json             search data: ~10 MB, 49,148 reviewed records; written by build_site.py, served as-is
PRODUCT.md                product context for design work; excluded from the build
.impeccable/              design-tool config (detector ignores, live-mode target); never built
.claude/skills/           Claude Code skills for this repo (add-canvas); never built
Gemfile, .ruby-version    github-pages gem + webrick; Ruby 3.3.13, as on GitHub Pages
CNAME                     dotproject.io
```

## Build and deploy

```sh
bundle exec jekyll serve      # → http://localhost:4000 (rebuilds on save)
bundle exec jekyll build      # → _site/ (what Pages produces)
```

- **Pages are Liquid templates and must be built by Jekyll.** Opening the `.html` files directly or
  through `python3 -m http.server` leaves `{{ }}` unrendered and `relative_url` paths unresolved.
- **Setup and macOS troubleshooting** (Ruby 3.3.13, `bundle install`, the `SDKROOT` fix) are in
  README.md.
- **Deploys are automatic from `main`.** GitHub Pages (*Deploy from a branch*, `main` / root) builds
  server-side with the same `github-pages` gem versions, so a clean local `bundle exec jekyll build`
  predicts a clean deploy. A push goes live in about 1–2 minutes; watch the repo's **Actions** tab or
  `gh api repos/<owner>/dotproject.io/pages/builds/latest`, then check the live files.
- **There is deliberately no `.nojekyll` file.** It would disable the server-side build.
- **`baseurl` is `""`,** so `{{ '/x' | relative_url }}` gives root-relative `/x`. Keep using
  `relative_url` for internal links and assets rather than hardcoding.
- **Locally, `jekyll serve` rewrites the site URL to localhost,** so `og:url` and `og:image` show
  localhost in the preview. Production builds use `https://dotproject.io`.

## Design rules

- **Palette.** `style.css` `:root` holds every colour: `--bg --surface --fg --muted --line --edge
  --field --mark --red --blue`. All CSS uses these names, never raw hex.
- **Red and blue carry the project's meaning:** red means under 18 or abused by a family member;
  blue means 18 or older. Use them only for that, and for the landing wordmark. Never use them for
  decoration or as generic UI signals.
- **Wordmark (owner, 2026-11-27):** the red and blue "o"s appear on the landing page only. The inner
  headers and the 404 page are plain.
- **Contrast (WCAG AA).** `--muted` text is 5.3:1 on `--bg`. Text-field borders use `--field`
  (3.2:1); buttons keep the lighter `--edge`, since their labels identify them.
- **Browser surfaces.** `[hidden]` always hides: no display rule can re-show it. Focus rings and text
  selection use the palette, not the browser's blue.
- **Approved wording (owner, 2026-11-27):**
  - the red / blue key: "Red: under 18, or abused by a family member. Blue: 18 or older.";
  - the placeholder in all three search fields: "A line you remember…".
- **Favicon:** one red dot (owner's choice).

## How the site works

The heavy data is deliberately split so it never loads on the landing page.

### Landing page

- **Search:** a plain `<form method="get" action="/comments.html">` with an input `name="q"`.
  Submitting goes to `comments.html?q=<text>`.
- **Counts:** the red / blue / total counts for all canvases come from `_data/canvases.json` at
  build time, so the page loads no data.
  - Red and blue are the colour of the comment each dot shows (red = UNDERAGE or INCEST), so red +
    blue = total.
  - The 10 half red / half blue dots count by their comment here. The table in
    [Canvases and dots](#canvases-and-dots) counts them by paint.
  - The key sits under the counts. At large text sizes on narrow screens the counts stack
    (a container query on `.totals`).
- **Carousel:** a CSS scroll-snap strip (swipe, trackpad, ←→ keys).
  - The side arrows appear on hover, are always shown on touch screens, and hide at either end.
  - Slides are generated, one per canvas in `_data/canvases.json`, with image sizes from
    `_data/canvas_images.yml`. Each links to `canvas.html?c=N`.
  - Canvas 1's image loads eagerly at high priority; the rest load lazily.
  - `main` is pinned to `width: 100%`, so the carousel's minimum width can't widen the page on
    320px phones.
- **Scripts:** `assets/home.js` (the carousel arrows) is the page's only script. The ~10 MB
  `comments.json` is *not* fetched here.

### Canvas viewer

- **Header search:** the same form as the landing page (`.cv-search`). `canvas.js` ignores keys
  typed into it, so arrows move the caret instead of jumping between dots. On phones the search
  takes its own full-width line under the wordmark.
- **Count bar** (`.cv-info`): the open canvas's red / blue / total dots and a "Buy a print" button to
  that canvas's page in the artist's store (new tab). Both come from `#site-data`, and the bar is
  refilled on every canvas switch.
  - On phones the bar drops the canvas name (the "Canvas N of M" pill shows it) and visually hides
    the words "Red" and "Blue". Screen readers still get them, with their meaning; a tooltip gives
    the meaning on desktop.
  - The bar wraps at large text sizes.
- **Switching canvases:** the carousel's `.car-arrow` buttons sit at the stage's sides, plus a
  "Canvas N of M" label. The arrows show on hover, always on touch, hide at the ends, and stay clear
  of the open panel. Switching happens in place: the old canvas slides out, `viewer.open()` loads
  the other DZI and its dots and texts (stale fetches are ignored), and the URL becomes `?c=N`
  (`history.replaceState`, so Back still leaves the viewer).
- **The selected dot is centred in the part of the stage you can see.**
  - While the panel is open, `canvas.js` sets OpenSeadragon viewport margins for the strip under it
    (the side panel, or the phone bottom sheet). `centreOn()` then centres in the uncovered area,
    and the pan limits hold there.
  - Clicks and taps, `?dot=` deep links, Previous / Next and Enter all centre the dot. Arrow keys
    recentre only near the visible edge.
  - Changing the margins never moves the picture (`setMargins` refits the same area).
- **Keyboard:**
  - Tab reaches the canvas (`role="application"`, with an aria-label saying how to use it).
  - Enter opens the dot nearest the centre, arrows move between dots, and Escape closes the panel
    and resets the view.
  - The panel is `inert` while closed, and focus returns to the canvas when it closes. Opened dots
    are announced through the hidden `#p-live` region.
  - The canvas focus ring shows only after a key press (`.cv.kbd`), because OpenSeadragon focuses
    its canvas from script on every click.
- **Phone bottom sheet:** as tall as its comment (max 62vh; long ones scroll). `canvas.js` keeps
  `--sheet-h` and the viewport margins in step with it, and the zoom buttons ride above it in a row.
- **Load failures** (tiles, `dots.json` or `texts.json`) show `.cv-error` at the top of the stage:
  what failed, "Try again", and a link to search. OpenSeadragon's own error text is hidden.
- **The origin dot** (canvas 1's black dot, "The first Jane Doe") stands for her, not for a comment.
  Its panel has no Previous / Next or report link.

### Search page

- **`comments.js` reads `?q=` to seed the box and streams `comments.json`.** It scans the download
  for each `{…}` record as it arrives, so matches show within a second while the rest (~3 MB
  gzipped) is still coming ("12 found in the first 2,400…"). The streamer relies on the file being
  one flat array of `{comment, category:[...]}` objects.
- **The final count reads "N of 49,148".** The search is an in-memory substring match, 200 results
  per page.
- **Failure and empty states:** if the download fails, the status line says so, with a "Try again"
  button. "No comments match." suggests trying fewer or different words.
- **Only the comment text is shown.** Category tags, badges and filter chips were removed on
  purpose. `category` still exists in the data; don't rely on it being displayed.
- **Redaction tokens** (`[name]`, `[handle]`, `[email]`, `[link]`, `[phone]`) are styled, and the
  query is highlighted. The source comments are already anonymized.
- **The page is one reading column** (35rem, about 74 characters of comment a line).

### Shared data

`_includes/site-data.html` embeds `#site-data` on the viewer and search pages. It carries the
per-canvas counts (`_data/canvases.json`), the print links (`_data/prints.yml`) and the change form
(`_data/change_form.yml`). The scripts hold no canvas count or form settings of their own, so adding
a canvas needs no code (see the add-canvas skill).

## Canvases and dots

Recounted on 2026-11-23 from `images/canvas1/canvas1_4x.jpg` and `images/canvas2/canvas2.jpg`, and
on 2026-11-25 from `images/canvas3/canvas3.jpg`. The method, with
`ig-comments/tools/canvas/detect_dots.py` and `lattice.py`: colour segmentation, connected
components, every dot placed on the hex lattice. Red = assaulted under 18; blue = 18+.

| Canvas   | Red   | Blue  | Half red / half blue | Total dots |
|----------|------:|------:|---------------------:|-----------:|
| Canvas 1 | 8,660 | 2,733 | 3                    | **11,396** |
| Canvas 2 | 8,762 | 2,599 | 1                    | **11,362** |
| Canvas 3 | 8,719 | 2,595 | 6                    | **11,320** |

- **Canvas 1** excludes the single black dot in the middle and the small gold crown painted above
  it. The 2026-11-22 count (11,395) missed one brownish red-over-blue dot at row 85, column 6; it is
  now dot index 11395 in `dots.json` (`n = 11396`). The only gaps in the lattice are the deliberate
  blank ring around the black dot. At the bottom edge, one oversized blob is two overlapping dots
  (kept as 2).
- **Canvas 2** is a full 92-column lattice, 247 rows × 46 dots, with no gaps. One blob of two
  touching red dots counts as 2.
- **Canvas 3** is 246 full rows × 46 dots plus a last row of only 4 (bottom left; the rest of that
  row is blank paper, not cropped). Two blobs of two touching red dots had been split into 3 parts
  each; `lattice.py` now merges parts of one blob that land on the same site. A few red dots near
  the top left are brownish (red painted over blue); they count as red and match red comments.
- **A dot is half red / half blue** when at least 30% of it is the second colour. Many blue dots
  carry a small red crescent (and a few red dots a blue one). Those are brush slips, not a code:
  they don't follow the incest label, and they count by their main colour.

### Which comment each dot shows

**The painting order.** Every canvas was painted in comment order (`#k`, the classifier's numbering
1–49,865), row by row from top to bottom, every row left to right, red or blue by the classifier's
original age label.

| Canvas | Comments        | Mapping recovered |
|--------|-----------------|-------------------|
| 1      | #1–#11,416      | 2026-11-03        |
| 2      | #11,417–#22,777 | 2026-11-23        |
| 3      | #22,778–#34,094 | 2026-11-25        |

The mapping was recovered by aligning painted colours with the comment stream, with 99.9% colour
agreement.

**Canvas 3 and the rematch.** Canvas 3 was painted before the 2026-11-23 rematch, so the painter did
**not** skip the 865 comments (#22,778–#27,349) that the rematch had used to fill dots on canvases
1–2. Those comments now sit on canvas 3, where they are painted (the same rule as #16,003). The 865
dots on canvases 1–2 that held them (470 on canvas 1, 395 on canvas 2) got new comments. No other
dot on canvases 1–2 changed.

**Rebuilding.** After the hand review of all comments (2026-11-23), the site data is rebuilt from
`ig-comments/data/classified/markdown` by `ig-comments/tools/canvas/build_site.py` (see
`ig-comments/tools/canvas/README.md`).

**Owner rules:**

- **A dot's colour must match its comment.** Red = UNDERAGE or any INCEST; blue = ADULT without
  INCEST; a half red / half blue dot takes either.
- **Every dot keeps the comment painted there** unless the review removed it or its colour no
  longer fits. Mismatches are refilled in this order:
  1. a swap with the nearest opposite mismatch;
  2. displaced comments;
  3. never-painted comments, in painting order, right after the last painted canvas.

  After canvas 3 that means #34,109 onwards: 1,298 used, up to #40,832. They are listed in
  `ig-comments/data/canvas/REMATCH.md` for the painter to skip on canvas 4.
- **A comment is on at most one dot.** Comments without a dot stay searchable.

**`dots.json` fields:**

- `w`, `h`: image size;
- `origin`: canvas 1 only;
- `n`: number of dots;
- `x`, `y`: dot positions;
- `cat`: 0 under 18, 1 adult, 2 incest;
- `paint`: 0 red, 1 blue, 2 half;
- `read`: rank in painting order;
- `ci`: index into `comments.json`.

**Don't regenerate `comments.json` with `ig-comments/tools/export_site_comments.py`.** That is the
old, unreviewed export; it renumbers every comment and breaks every dot's `ci`.

## Analytics

**Cloudflare Web Analytics** (owner, 2026-11-27) counts visits. The numbers are in the Cloudflare
dashboard under Web Analytics. The DNS records are grey-cloud, so the beacon is the snippet in
`_layouts/default.html`, not Cloudflare's automatic injection.

- **Live build only.** The snippet sits inside `{% if jekyll.environment == "production" %}`. The
  Pages builder sets `JEKYLL_ENV=production`, and local `jekyll serve` / `build` don't, so previews
  aren't counted. `JEKYLL_ENV=production bundle exec jekyll build` shows what ships.
- **No search text leaves the browser.** The beacon (checked at version 2026.10.1) strips the query
  and `#` part from the page URL and the referrer before sending. Cloudflare gets `/comments.html`,
  never `?q=…`, and it sets no cookies or storage. Re-check this before ever making the URL carry
  something new.
- **`"spa": false`** in `data-cf-beacon`: a page view is a real page load. The default would count
  every `history.replaceState` (the viewer's `?c=N` switch) as another view of `/canvas.html`.
- **The token is public** by design (it is in every page's source); it only identifies the site.
- Ad blockers and privacy browsers block the beacon, so the counts are a floor.

## Change requests (fix my comment / wrong colour)

**Where the links are.** In the viewer, the dot panel has a quiet link under Previous / Next: "Is
this your comment? Fix the wording or report the wrong colour". On the search page, each result
with a dot has a "Request a change" link.

**Where they go.** Both open the owner's **Google Form** in a new tab, prefilled with the canvas
number, the dot index (the `?dot=` value) and the comment index (`ci` in `comments.json`).
Responses go to a linked Google Sheet, and Forms emails the owner when one arrives. The site stores
nothing. The form URL and its `entry.NNN` ids live in one place, `_data/change_form.yml`. While
`url` is `""` both links stay hidden.

**Acting on a request.** The owner reviews every one; the Instagram handle on the form is optional
and only used to check authorship.

1. Edit the comment, or its age / incest label, in `ig-comments/data/classified/markdown`.
2. Run `build_site.py --check`, then the real build (see
   [Which comment each dot shows](#which-comment-each-dot-shows)).

The colour rules decide whether the comment moves to another dot.

## Images: what is published and what never is

**Never committed or published anywhere.** These raw sources are git-ignored:

- `images/canvas1/canvas1.jpg`: the full-resolution master photograph (~11 MB);
- `images/canvas1/canvas1_4x.jpg`: the 4× master, rebuilt on 2026-11-27 with `upscale4x.py --white`
  (canvas 1's web settings). The previous version, with grey paper and lighter reds, is in
  `_pre_colour/`. Dot detection on the new file finds the same 11,397 dots;
- `images/canvas2/canvas2.jpg` / `canvas2_4x.jpg`: canvas 2's master photo and its 4×, rebuilt on
  2026-11-27 with `upscale4x.py` and canvas 2's flags (below). The 2026-11-15 original (Lanczos ×4,
  unsharp mask, chroma ×1.4, q94) is in `_pre_colour/`;
- `images/canvas3/canvas3.jpg`: canvas 3's master (a Lightroom export carrying camera EXIF and the
  owner's copyright and contact), left unboosted;
- `images/canvas3/canvas3_4x.jpg`: its 4×, built on 2026-11-27 with `upscale4x.py` and canvas 3's
  flags (below);
- `images/canvas1/_pre_wb/`: backups of the canvas 1 masters from before the white-balance fix;
- the raw close-up macro photo set (hundreds of large frames), wherever it lands under
  `images/canvas1/`;
- `canvas1_stitch/`: stitching working files and handoff.

They are source material for a gigapixel image being assembled with external tools, not web
assets.

**How the ignore rules work.** `.gitignore` ignores **everything** under each `images/canvasN/` and
re-includes only the web files by name, so a new master or frame dropped in there stays private by
default. `_config.yml` also excludes the named masters from the Jekyll build. Don't add a bare
`images/canvas1` exclude: it drops the whole `images/` tree, derivatives included.

**Published** (tracked and served), each re-included by name in `.gitignore`:

- the landing sizes `canvasN-{480,720,960,1440}.jpg` (~0.2–1.0 MB each), used in the carousel's
  `srcset`;
- the deep-zoom tiles `canvasN.dzi` + `canvasN_files/` (canvas 1: 417 tiles, ~11 MB). The owner
  approved publishing the masters as tiles for the zoom viewer;
- the viewer data `dots.json` and `texts.json`.

Any new file served from `images/canvasN/` needs its own `!` line. **Adding a landing size** takes
three edits: generate the file, add its `!` line to `.gitignore` for each canvas, and add it to the
`srcset` in `index.html`'s slide loop.

**Regenerating.** `ig-comments/tools/canvas/web_images.py` builds every canvas's published images
(landing sizes and tiles) in one step and never modifies the masters:

```sh
web_images.py images/canvas1/canvas1.jpg images/canvas1 canvas1 --white
web_images.py images/canvas2/canvas2.jpg images/canvas2 canvas2 --chroma 1.9 --gamma 0.72 --match canvas2 --white
web_images.py images/canvas3/canvas3.jpg images/canvas3 canvas3 --chroma 1.2 --gamma 0.85 --match canvas3 --white
```

**Every canvas looks like canvas 1** (owner, 2026-11-27), with the same red (L≈45 / chroma≈89 / hue
34°), the same blue (L≈37 / chroma≈101 / hue −60°) and white paper. This replaced the earlier aim of
canvas 2's brighter reds. Canvas 1 is the reference.

- **`--white`** makes the paper pure white (owner, 2026-11-23): pixels with low colour and high
  lightness are blended to #fff. The dots, the black dot and the gold crown are untouched, and dot
  edges blend without halos.
- **`--chroma` / `--gamma`** (`vivid.py`) give a rough boost first: ×1.9 / 0.72 for canvas 2's dull
  export, ×1.2 / 0.85 for canvas 3's already vivid one. Canvas 1's master already carries chroma ×1.4
  and a white balance.
- **`--match canvasN`** (`paint_match.py`, fitted to `canvas1_4x.jpg`, stored in
  `paint_match.json`) then moves the red paint and the blue paint separately (lightness, chroma, hue)
  onto canvas 1's. One boost can't do it: canvas 2's reds needed less chroma while its blues needed
  more, and canvas 3's blue is a different paint (an ultramarine). Paper, the black dot and grey are
  untouched.
- **Encoding:** tiles are 256 px, overlap 1, quality 75. Landing sizes go through `sips`, then
  `cjpeg -quality 72 -progressive -optimize -sample 1x1`. Both use full-resolution colour (4:4:4),
  so the white paper doesn't pick up a pink or blue tint next to the dots, and carry no EXIF, XMP or
  ICC metadata.

**The 4× masters** (private) are made with `upscale4x.py`, using the same flags as each canvas's
web images, e.g.
`upscale4x.py images/canvas3/canvas3.jpg images/canvas3/canvas3_4x.jpg --chroma 1.2 --gamma 0.85 --match canvas3 --white`.
Two checks must print OK. `colour_check.py <4x> <canvasN-1440.jpg>` checks the 4× against its own web
images, and `colour_check.py <4x> images/canvas1/canvas1_4x.jpg --across` checks it against canvas 1.

For a new canvas, the add-canvas skill covers measuring the master and choosing its settings.

`_site/`, `.jekyll-cache/`, `Gemfile.lock` and `vendor/` also stay out of commits (already in
`.gitignore`).
