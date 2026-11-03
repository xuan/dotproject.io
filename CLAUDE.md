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
index.html             landing page — wordmark + search form + responsive canvas image
images/canvas1/        everything for canvas 1 (masters ignored, see below):
                         canvas1-{480,720,960,1440}.jpg  landing-page derivatives
                         canvas1.dzi + canvas1_files/    deep-zoom tiles for canvas.html
                         dots.json                       dot positions, reading rank, comment index
                         texts.json                      comment text per dot
canvas.html            deep-zoom canvas viewer — tap a dot to read its comment (?dot=N deep-link)
comments.html          results page — client-side search UI (front matter + body)
404.html               not-found page (permalink: /404.html)
assets/canvas.css      styles for the canvas viewer
assets/canvas.js       OpenSeadragon viewer + dot hit-testing over images/canvas1/
assets/comments.css    styles for the results page
assets/comments.js     client-side search over comments.json (+ "find this dot" links)
style.css              global styles (landing page + shared tokens in :root)
comments.json          search data — ~11.6 MB, ~49,865 records (tracked, served as-is)
Gemfile                github-pages gem + webrick
.ruby-version          3.3.13 (matches the Ruby GitHub Pages runs)
CNAME                  dotproject.io
```

Each page carries YAML front matter (`layout: default`, `title`, `description`, optional
`noindex`, `styles:`, `scripts:`) and contributes only its body; the layout supplies the
`<head>` and shell.

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
  `name="q"`. Submitting navigates to `comments.html?q=<text>` — **no JavaScript on the landing
  page**, and the ~11.6 MB `comments.json` is *not* fetched there.
- **comments.html** (`assets/comments.js`) `fetch`es `comments.json`, reads `?q=` from the URL
  to seed the box, and does an in-memory substring search, paginating 200 results at a time.
- `comments.json` records are `{comment, category:[...]}`. The UI currently shows **only the
  comment text** — category tags/badges and the category filter chips were intentionally removed.
  `category` still exists in the data; don't rely on it being displayed.
- `comments.js` styles redaction tokens (`[name]`, `[handle]`, `[email]`, `[link]`, `[phone]`)
  and highlights the query. The source comments are already anonymized.

## Do not commit / publish

The raw sources are git-ignored and must **never** be committed or published anywhere:

- `images/canvas1/canvas1.jpg` — the full-resolution master photograph (~11 MB).
- `images/canvas1/canvas1_4x.jpg` — the 4× upscaled master (~65 MB).
- the raw close-up macro photo set (hundreds of large frames), wherever it lands under
  `images/canvas1/`.
- `canvas1_stitch/` — stitching working files / handoff.

They are source material for a gigapixel image being assembled with external tools, not web
assets. `.gitignore` ignores **everything** under `images/canvas1/` and then re-includes only the
small web derivatives by name, so a new master/frame dropped in there stays private by default.
`_config.yml` separately excludes the two named masters from the Jekyll build (the sources aren't in
git, so a server build never sees them anyway — but don't re-add a bare `images/canvas1` exclude: it
greedily drops the whole `images/` tree, derivatives included).

**What IS published** (tracked and served): the resized/compressed web derivatives
`images/canvas1/canvas1-{480,720,960,1440}.jpg` (~0.14–1.0 MB each), shown on the landing page via a
responsive `<img srcset>` with `loading="lazy"`. Regenerate them from the master with `sips`
(`--resampleWidth <w>`) piped through `cjpeg -quality 72 -progressive -optimize`. **Adding a new
size means three edits:** generate the file, add a `!images/canvas1/canvas1-<w>.jpg` line to
`.gitignore`, and add it to the `srcset` in `index.html`.

Also published from the same folder (each re-included by name in `.gitignore`): the deep-zoom tiles
`canvas1.dzi` + `canvas1_files/` (417 tiles, ~8 MB, generated from `canvas1.jpg` — the owner
approved publishing the master as tiles for the zoom viewer) and the viewer data `dots.json` /
`texts.json`. Any new file you want served from `images/canvas1/` needs its own `!` line.

Also keep `_site/`, `.jekyll-cache/`, `Gemfile.lock`, and `vendor/` out of commits (already in
`.gitignore`).

## Git workflow & attribution

- Branch off, commit, **merge to `main`**, push `main` (and keep `develop` in sync). Don't commit
  straight onto `main`/`develop` for feature work.
- End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- End PR descriptions with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
