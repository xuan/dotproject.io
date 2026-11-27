# dotproject.io

Source for [dotproject.io](https://dotproject.io): a static site built with **Jekyll** and hosted
on **GitHub Pages**.

## Structure

```text
_config.yml               site config; the exclude list keeps docs and master photos out of the build
_layouts/default.html     shared page shell: <head>, icons, link previews, stylesheets, scripts
_includes/site-data.html  canvas counts, print links and the change form, as JSON for the scripts
_data/                    canvases.json (generated), canvas_images.yml, prints.yml, change_form.yml
index.html                landing page
canvas.html               deep-zoom canvas viewer
comments.html             search page
404.html                  not-found page
style.css                 global styles and the colour palette
assets/                   per-page CSS and JS; lib/ holds a self-hosted OpenSeadragon 4.1.0
images/canvasN/           per canvas: landing images, deep-zoom tiles, dots.json, texts.json
images/share.jpg          link-preview image
favicon.ico, favicon.svg  icons (with apple-touch-icon.png)
comments.json             search data (static, served as-is)
CNAME                     custom domain
```

Each page carries YAML front matter (`layout: default`, `title`, `description`, optional
`noindex`, `styles:` and `scripts:` lists) and contributes only its body; the layout supplies the
`<head>` and shell.

**Generated data.** `_data/canvases.json`, `comments.json` and each canvas's `dots.json` and
`texts.json` are written by `build_site.py` in the sibling `ig-comments` repo. Don't edit them by
hand. Master photos stay out of git (see `.gitignore`).

**More detail.** [CLAUDE.md](CLAUDE.md) has the full notes on how the site and its data work, and
[.claude/skills/add-canvas/SKILL.md](.claude/skills/add-canvas/SKILL.md) has the steps for adding
a canvas.

## Prerequisites

- **Ruby ≥ 3.0.** The macOS system Ruby (2.6) is too old. This repo pins **3.3.13**, the version
  GitHub Pages runs, in `.ruby-version`. With [rbenv](https://github.com/rbenv/rbenv) installed,
  `cd`-ing into the repo selects it automatically (`rbenv install 3.3.13` if you don't have it yet).
- **Bundler.** It ships with modern Ruby; otherwise `gem install bundler`.

## Setup (one-time)

```sh
bundle install
```

This installs the `github-pages` gem, which pins the exact Jekyll and plugin versions GitHub Pages
uses so local and production builds match. It also installs `webrick`, the local server, which is
no longer bundled with Ruby ≥ 3.0.

## Build and preview locally

```sh
bundle exec jekyll serve      # → http://localhost:4000 (rebuilds on save; Ctrl-C to stop)
bundle exec jekyll build      # → _site/, what GitHub Pages produces
```

The pages are Liquid templates and must be built by Jekyll. Opening the `.html` files directly, or
serving them with `python3 -m http.server`, doesn't work.

## Deploy

**Live at <https://dotproject.io>** (custom domain, HTTPS enforced). Deployment is automatic: a push
to `main` goes live, usually within a minute or two.

```sh
git push origin main
```

- **Workflow.** Work on a branch, merge it into `main`, and push `main`. Then bring `develop` up to
  `main` and push it too, so the two stay in sync.
- **The server-side build.** GitHub Pages is set to *Deploy from a branch* (`main` / root) and runs
  the Jekyll build server-side with the same `github-pages` gem versions. A clean local
  `bundle exec jekyll build` therefore means the production build will succeed too.
- **No `.nojekyll` file,** deliberately: it would disable the server-side build.
- **Build status** shows in the repo's **Actions** tab.

## Troubleshooting (macOS)

`bundle install` compiles native gem extensions (such as `ffi`). It can fail with a linker or SDK
error (`ld: … unknown architecture`, or "C compiler cannot create executables"). That means your
Command Line Tools SDK is broken; point the build at Xcode's SDK instead:

```sh
export SDKROOT=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk
bundle install
```

Add that `export` line to your shell profile (`~/.zshrc`) so new shells pick it up.

## Custom domain

`dotproject.io` is registered and served through **Cloudflare**. These DNS records make it work
(Cloudflare dashboard → DNS → Records). All are set to **DNS only / grey cloud**, so GitHub can
issue and renew the HTTPS certificate:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `dotproject.io` |

In GitHub Pages (**Settings → Pages**), the domain is verified with **Enforce HTTPS** on.

To put the site behind Cloudflare's proxy / CDN later, first set the SSL/TLS mode to `Full`, never
`Flexible`. Then switch the records to proxied (orange cloud).
