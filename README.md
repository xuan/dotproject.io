# dotproject.io

Website for [dotproject.io](https://dotproject.io), built with **Jekyll** and hosted on
GitHub Pages.

## Structure

```text
_config.yml          site config
_layouts/default.html shared page shell (head, stylesheet, body)
index.html           landing page        (front matter + content)
comments.html        survivor-story search (front matter + content)
404.html             not-found page
assets/comments.css  styles for the search page
assets/comments.js   client-side search over comments.json
style.css            global styles
comments.json        search data (static, served as-is)
CNAME                custom domain
```

Each page carries YAML front matter (`layout: default`, `title`, `description`) and
contributes only its body; the layout supplies the `<head>` and shell. Pages can pull in
extra assets with `styles:` / `scripts:` front-matter lists.

## Prerequisites

- **Ruby ≥ 3.0** — the macOS system Ruby (2.6) is too old. This repo pins **3.3.13** (the
  version GitHub Pages runs) in `.ruby-version`; with [rbenv](https://github.com/rbenv/rbenv)
  installed, `cd`-ing into the repo selects it automatically (`rbenv install 3.3.13` if you
  don't have it yet).
- **Bundler** — ships with modern Ruby; otherwise `gem install bundler`.

## Setup (one-time)

```sh
bundle install
```

Installs the `github-pages` gem (which pins the exact Jekyll + plugin versions GitHub Pages
uses, so local and production builds match) and `webrick` (the local server, no longer
bundled with Ruby ≥ 3.0).

## Build & preview locally

Build the static site into `_site/`:

```sh
bundle exec jekyll build
```

…or run the live-reloading dev server:

```sh
bundle exec jekyll serve
# → http://localhost:4000   (rebuilds on save; Ctrl-C to stop)
```

(Opening the `.html` files directly or via `python3 -m http.server` no longer works — the
pages are Liquid templates and must be built by Jekyll first.)

## Deploy

**Live at <https://dotproject.io>** (custom domain active, HTTPS enforced).

Deployment is automatic — just push to `main`:

```sh
git push origin main
```

GitHub Pages is configured as *Deploy from a branch* (`main` / `/root`) and runs the Jekyll
build **server-side** using the same `github-pages` gem versions, so a clean local
`bundle exec jekyll build` means the production build will succeed too. There is deliberately
no `.nojekyll` file (that would disable the server-side build). A push usually goes live
within a minute or two — watch the repo's **Actions** tab for the Pages build status.

## Troubleshooting (macOS)

`bundle install` compiles native gem extensions (e.g. `ffi`). If it fails with a linker/SDK
error (`ld: … unknown architecture`, or "C compiler cannot create executables"), your
Command Line Tools SDK is broken — point the build at Xcode's SDK instead:

```sh
export SDKROOT=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk
bundle install
```

Add that `export` line to your shell profile (`~/.zshrc`) so new shells pick it up.

## Custom domain (dotproject.io)

Registered and served through **Cloudflare**. The domain is live and resolving; these
are the DNS records that make it work (Cloudflare dashboard → DNS → Records), all set to
**DNS only / grey cloud** so GitHub can issue and renew the HTTPS certificate:

| Type  | Name  | Value                                                        |
| ----- | ----- | ------------------------------------------------------------ |
| A     | `@`   | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA  | `@`   | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `dotproject.io`                                              |

GitHub Pages (**Settings → Pages**) has the domain verified with **Enforce HTTPS** on.
(Optional later: to put it behind Cloudflare's proxy/CDN, set SSL/TLS mode to `Full` —
never `Flexible` — then switch the records to proxied / orange cloud.)
