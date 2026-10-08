# dotproject.io

Static website for [dotproject.io](https://dotproject.io), hosted on GitHub Pages.

Plain HTML/CSS — no build step.

## Local preview

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

Pushing to `main` publishes automatically (GitHub Pages → *Deploy from a branch*,
`main` / `/root`). Live at `https://xuan.github.io/dotproject.io/` until the custom
domain's DNS is live.

## Custom domain (dotproject.io)

Once the domain is purchased, add these DNS records at the registrar:

| Type  | Name  | Value                                                        |
| ----- | ----- | ------------------------------------------------------------ |
| A     | `@`   | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA  | `@`   | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `xuan.github.io`                                             |

If the registrar supports `ALIAS`/`ANAME` at the apex, that's preferable to the A
records. After DNS propagates, go to **Settings → Pages**, confirm the domain check
passes, and enable **Enforce HTTPS**.
