# CLAUDE.md

Context for working on **dotproject.io** — the public website for the Dot Project.

## Working agreement (read first)

**Ask before changing anything unless you are ≥90% confident you understand the task.**
When the request is ambiguous, underspecified, or could be interpreted more than one way,
stop and ask clarifying questions *before* editing files, running destructive commands, or
deploying. Only proceed without asking when the intent is unmistakable. A quick question is
always cheaper than undoing the wrong change on a live site.

Related standing rules:

- **Nothing is committed or deployed without explicit say-so.** Make changes locally, show
  them (a local `jekyll serve` preview is ideal), and wait for approval before
  commit/push — pushing to `main` redeploys the live site (see [Deploy](#deploy)).
- **Never commit or publish the large image working files** — see
  [Do not commit / publish](#do-not-commit--publish).

## What this is

A small, static **Jekyll** site hosted on **GitHub Pages**, live at **<https://dotproject.io>**
(custom domain, HTTPS enforced). It is intentionally minimal: a "coming soon" landing page plus
a client-side search over anonymized survivor comments.

Tracked files:

```text
_config.yml            site config (title, url, baseurl="", exclude list)
_layouts/default.html  shared page shell: <head>, global stylesheet, per-page styles:/scripts:
index.html             landing page — wordmark + search form + canvas carousel (one slide per canvas)
images/canvas1/        everything for canvas 1 (masters ignored, see below):
                         canvas1-{480,720,960,1440}.jpg  landing-page derivatives
                         canvas1.dzi + canvas1_files/    deep-zoom tiles for canvas.html
                         dots.json                       dot positions, paint, reading rank, comment index
                         texts.json                      comment text per dot
images/canvas2/        the same set for canvas 2 (canvas2-*.jpg, canvas2.dzi + canvas2_files/,
                         dots.json, texts.json)
canvas.html            deep-zoom canvas viewer — tap a dot to read its comment
                         (?c=N picks the canvas, default 1; ?dot=N deep-links to a dot);
                         side arrows switch canvases in place, like the landing carousel
comments.html          results page — client-side search UI (front matter + body)
404.html               not-found page (permalink: /404.html)
assets/canvas.css      styles for the canvas viewer
assets/canvas.js       OpenSeadragon viewer + dot hit-testing over images/canvas<N>/
assets/comments.css    styles for the results page
assets/comments.js     client-side search over comments.json (+ "find this dot on canvas N" links)
assets/home.js         landing-page carousel arrows (the only script on the landing page)
style.css              global styles (landing page + carousel + shared tokens in :root)
comments.json          search data — ~10 MB, 49,148 reviewed records (tracked, served as-is)
Gemfile                github-pages gem + webrick
.ruby-version          3.3.13 (matches the Ruby GitHub Pages runs)
CNAME                  dotproject.io
```

Each page carries YAML front matter (`layout: default`, `title`, `description`, optional
`noindex`, `styles:`, `scripts:`) and contributes only its body; the layout supplies the
`<head>` and shell.

## Canvas dot counts

Recounted on 2026-11-23 from `images/canvas1/canvas1_4x.jpg` and `images/canvas2/canvas2.jpg`
(`ig-comments/tools/canvas/detect_dots.py` + `lattice.py`): colour segmentation, connected
components, every dot placed on the hex lattice. Red = assaulted under 18; blue = 18+.

| Canvas   | Red   | Blue  | Half red / half blue | Total dots |
|----------|------:|------:|---------------------:|-----------:|
| Canvas 1 | 8,660 | 2,733 | 3                    | **11,396** |
| Canvas 2 | 8,762 | 2,599 | 1                    | **11,362** |

- **Canvas 1** excludes the single black dot in the middle and the small gold crown painted above it.
  The 2026-11-22 count (11,395) missed one brownish red-over-blue dot at row 85, column 6; it is now
  dot index 11395 in `dots.json` (`n = 11396`). The only gaps in the lattice are the deliberate blank
  ring around the black dot. At the bottom edge one oversized blob is two overlapping dots (kept as 2).
- **Canvas 2** is a full 92-column lattice, 247 rows × 46 dots, no gaps; one blob of two touching red
  dots counts as 2.
- A dot is **half red / half blue** when at least 30% of it is the second colour. Many blue dots carry
  a small red crescent (and a few red dots a blue one); those are brush slips, not a code — they
  don't follow the incest label — and count by their main colour.

## Which comment each dot shows

Both canvases were painted in comment order (`#k`, the classifier's numbering 1–49,865), row by row
top to bottom, every row left to right, red/blue by the classifier's original age label. Canvas 1
holds #1–#11,416, canvas 2 #11,417–#22,777. The painted mapping was recovered by aligning painted
colours with the comment stream (canvas 1 on 2026-11-03, canvas 2 on 2026-11-23, 99.9% colour
agreement).

After the hand review of all comments (2026-11-23) the site data is rebuilt from
`ig-comments/data/classified/markdown` by `ig-comments/tools/canvas/build_site.py`
(see `ig-comments/tools/canvas/README.md`). Owner rules:

- a dot's colour must match its comment: **red = UNDERAGE or any INCEST**, blue = ADULT without
  INCEST; a half red / half blue dot takes either;
- every dot keeps the comment painted there unless the review removed it or its colour no longer fits;
  mismatches first swap with the nearest opposite mismatch, then take displaced comments, then
  never-painted comments in painting order right after canvas 2 (#22,778 on);
- a comment is on at most one dot; comments without a dot stay searchable.

`dots.json` = `{w, h, origin (canvas 1 only), n, x, y, cat (0 under 18, 1 adult, 2 incest),
paint (0 red, 1 blue, 2 half), read (rank in painting order), ci (index into comments.json)}`.
**Don't regenerate `comments.json` with `ig-comments/tools/export_site_comments.py`** — that is the
old unreviewed export; it renumbers every comment and breaks every dot's `ci`.

## Adding a canvas (canvas 3, …)

Scripts are in `ig-comments/tools/canvas/` (README there); they need a Python with numpy, scipy,
Pillow and opencv-python(-headless), plus macOS `sips` and `cjpeg`. N = the new canvas number.

1. **Masters stay private.** Put the photo at `images/canvasN/canvasN.jpg`. In `.gitignore` add
   `images/canvasN/*` plus `!` lines for `canvasN-{480,720,960,1440}.jpg`, `canvasN.dzi`,
   `canvasN_files/`, `dots.json` and `texts.json`. In `_config.yml`, exclude the master (and any `_4x`).
2. **Images — the owner's settings (2026-11-23):** pure white paper on every canvas, and dots as
   vivid as canvas 2's.
   `web_images.py images/canvasN/canvasN.jpg images/canvasN canvasN --chroma K --gamma G --white`.
   Start from canvas 2's `--chroma 1.9 --gamma 0.72` for an untouched photo; skip the boost if the
   master is already boosted (canvas 1 is). Target dot colours, measured in LAB on the master: canvas 2
   red L≈52 / chroma≈102 and blue L≈45 / chroma≈97 (canvas 1: red 46/87, blue 35/101). Check close-ups
   before publishing; going much past ×1.9 makes the reds go flat and the blues wash out.
3. **Dots → comments.** Run `detect_dots.py` (draft divisor 1 for a normal photo) and `lattice.py`.
   Then run `align.py`, starting the comment stream right after canvas 2's last painted comment
   (#22,777). Pass `--skip` with the 865 never-painted comments the rematch already placed on
   canvases 1–2 (#22,778–#27,349; listed in `ig-comments/data/canvas/rematch.json` →
   `never_painted_used`), if the painter skipped them as asked. Then extend `painted.py` and
   `CANVASES` in `build_site.py` to canvas N, and run `build_site.py --check`, then for real.
4. **Site code.** Add a slide to the carousel in `index.html`, and raise `CANVAS_COUNT` in
   `assets/canvas.js` and `CANVASES` in `assets/comments.js`. The viewer arrows and the "Canvas N of M"
   label follow automatically.
5. **Check:** `bundle exec jekyll build`; then in a browser check the carousel, the viewer's
   switching, a `?c=N&dot=…` link and the search page's "Find this dot on canvas N" links. Add the new
   canvas to the dot-count table above.

## Build & run locally

Needs **Ruby ≥ 3.0** (system Ruby 2.6 is too old). With rbenv, `cd`-ing in selects 3.3.13 from
`.ruby-version`. One-time: `bundle install`. Then:

```sh
bundle exec jekyll serve      # → http://localhost:4000 (rebuilds on save)
bundle exec jekyll build      # → _site/ (what Pages produces)
```

**The pages are Liquid templates — they must be built by Jekyll.** Opening the `.html` files
directly or via `python3 -m http.server` will not work (unrendered `{{ }}` / `{% %}`, and
`relative_url` paths won't resolve).

**macOS native-gem gotcha:** if `bundle install` fails compiling `ffi` with a linker/SDK error
(`ld: … unknown architecture`, "C compiler cannot create executables"), the Command Line Tools
SDK is broken — point the build at Xcode's SDK and add it to `~/.zshrc`:

```sh
export SDKROOT=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk
```

## Deploy

**Automatic from `main`.** GitHub Pages is set to *Deploy from a branch* (`main` / `/root`)
and runs the Jekyll build **server-side** using the same `github-pages` gem versions, so a clean
local `bundle exec jekyll build` predicts a clean deploy. A push to `main` goes live in ~1–2 min;
watch the repo's **Actions** tab, or `gh api repos/<owner>/dotproject.io/pages/builds/latest`.

- There is deliberately **no `.nojekyll` file** — that file would disable the server-side Jekyll
  build. Don't add one.
- `baseurl` is `""`, so `{{ '/x' | relative_url }}` yields root-relative `/x`. Keep using
  `relative_url` for internal links/assets rather than hardcoding.

## How the comment search works

Two pages, one dataset, deliberately split so the heavy JSON never loads on the landing page:

- **index.html** has a plain `<form method="get" action="/comments.html">` with an input
  `name="q"`. Submitting navigates to `comments.html?q=<text>`. The only script on the landing page
  is the small carousel helper `assets/home.js`; the ~10 MB `comments.json` is *not* fetched there.
- The landing carousel is a CSS scroll-snap strip (swipe / trackpad / ←→ keys); the side arrows
  appear on hover (always shown on touch screens, which can't hover) and hide at either end. Each
  slide links to `canvas.html?c=N`. Adding a canvas = a new slide in `index.html`, its number in
  `CANVAS_COUNT` (`assets/canvas.js`) and `CANVASES` (`assets/comments.js`).
- The viewer (`canvas.html`) reuses the carousel's `.car-arrow` buttons at the stage's sides (shown on
  hover, always on touch, hidden at the ends, kept clear of the open comment panel) plus a
  "Canvas N of M" label. Switching happens in place: the old canvas slides out, `viewer.open()` loads
  the other DZI and its dots/texts (stale fetches are ignored), and the URL becomes `?c=N`
  (`history.replaceState`, so Back still leaves the viewer).
- **comments.html** (`assets/comments.js`) `fetch`es `comments.json`, reads `?q=` from the URL
  to seed the box, and does an in-memory substring search, paginating 200 results at a time.
- `comments.json` records are `{comment, category:[...]}`. The UI currently shows **only the
  comment text** — category tags/badges and the category filter chips were intentionally removed.
  `category` still exists in the data; don't rely on it being displayed.
- `comments.js` styles redaction tokens (`[name]`, `[handle]`, `[email]`, `[link]`, `[phone]`)
  and highlights the query. The source comments are already anonymized.

## Change requests (fix my comment / wrong colour)

Under the Previous/Next buttons, the viewer's dot panel has a quiet link: "Is this your comment? Fix the
wording or report the wrong colour". Each search result with a dot also has a "Request a change" link.
Both open the owner's **Google Form** in a new tab. The form is prefilled with the canvas number, the dot
index (the `?dot=` value) and the comment index (`ci` in `comments.json`). Responses go to a linked
Google Sheet, and Forms emails the owner when one arrives. The site stores nothing. The form URL and
its `entry.NNN` ids are in `CHANGE_FORM`, which appears in both `assets/canvas.js` and
`assets/comments.js`; keep the two in sync. While `url` is `""` both links stay hidden.

Acting on a request (the owner reviews every one; the Instagram handle is optional and only used to
check authorship): edit the comment, or its age/incest label, in `ig-comments/data/classified/markdown`.
Then run `build_site.py --check`, then the real build, as in "Which comment each dot shows". The colour
rules there decide whether the comment moves to another dot.

## Do not commit / publish

The raw sources are git-ignored and must **never** be committed or published anywhere:

- `images/canvas1/canvas1.jpg` — the full-resolution master photograph (~11 MB).
- `images/canvas1/canvas1_4x.jpg` — the 4× upscaled master (~65 MB).
- `images/canvas2/canvas2.jpg` / `canvas2_4x.jpg` — canvas 2's master photo and 4× upscale.
- `images/canvas1/_pre_wb/` — backups of the canvas 1 masters from before the white-balance fix.
- the raw close-up macro photo set (hundreds of large frames), wherever it lands under
  `images/canvas1/`.
- `canvas1_stitch/` — stitching working files / handoff.

They are source material for a gigapixel image being assembled with external tools, not web
assets. `.gitignore` ignores **everything** under `images/canvas1/` and then re-includes only the
small web derivatives by name, so a new master/frame dropped in there stays private by default.
`images/canvas2/` works the same way.
`_config.yml` separately excludes the two named masters from the Jekyll build (the sources aren't in
git, so a server build never sees them anyway — but don't re-add a bare `images/canvas1` exclude: it
greedily drops the whole `images/` tree, derivatives included).

**What IS published** (tracked and served): the resized/compressed web derivatives
`images/canvas1/canvas1-{480,720,960,1440}.jpg` (~0.2–1.0 MB each), shown on the landing page via a
responsive `<img srcset>` with `loading="lazy"`. Regenerate them (and the tiles) with `web_images.py`
(see below). **Adding a new
size means three edits:** generate the file, add a `!images/canvas1/canvas1-<w>.jpg` line to
`.gitignore`, and add it to the `srcset` in `index.html`.

Also published from the same folder (each re-included by name in `.gitignore`): the deep-zoom tiles
`canvas1.dzi` + `canvas1_files/` (417 tiles, ~11 MB, generated from `canvas1.jpg` — the owner
approved publishing the master as tiles for the zoom viewer) and the viewer data `dots.json` /
`texts.json`. Any new file you want served from `images/canvas1/` needs its own `!` line.
Both canvases' published images (landing sizes + tiles) are built in one step by
`ig-comments/tools/canvas/web_images.py`, which never modifies the masters:

```sh
web_images.py images/canvas1/canvas1.jpg images/canvas1 canvas1 --white
web_images.py images/canvas2/canvas2.jpg images/canvas2 canvas2 --chroma 1.9 --gamma 0.72 --white
```

- `--white` makes the paper pure white (owner, 2026-11-23): pixels with low colour and high lightness
  are blended to #fff; the dots, the black dot and the gold crown are untouched and dot edges blend
  without halos.
- Canvas 2 is boosted first (LAB chroma ×1.9, lightness gamma 0.72; `vivid.py`). The untouched photo
  looked dull next to canvas 1, whose master already carries chroma ×1.4 and a white balance, and the
  owner asked twice for stronger and brighter. ×1.9 is about the ceiling: beyond it the reds hit the
  sRGB limit and go flat while the blues wash out.
- Tiles: 256 px, overlap 1, quality 75; landing sizes: `sips` → `cjpeg -quality 72 -progressive
  -optimize -sample 1x1`. Both use full-resolution colour (4:4:4) so the white paper doesn't pick up a
  pink/blue tint next to the dots; no EXIF/XMP/ICC metadata.

Also keep `_site/`, `.jekyll-cache/`, `Gemfile.lock`, and `vendor/` out of commits (already in
`.gitignore`).

## Git workflow & attribution

- Branch off, commit, **merge to `main`**, push `main` (and keep `develop` in sync). Don't commit
  straight onto `main`/`develop` for feature work.
- End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- End PR descriptions with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
