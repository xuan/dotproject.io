---
name: add-canvas
description: Add a newly painted canvas (canvas 4, 5, …) to dotproject.io. Covers keeping the master photo private, building the web images with the owner's colour settings, mapping each painted dot to its comment in the sibling ig-comments repo, adding the site data, and checking the result. Use when the owner has a photo of a new canvas, or asks to add or publish canvas N.
---

# Add a canvas

N is the new canvas number. The work spans two repos:

- the dot pipeline in the sibling repo `../ig-comments/tools/canvas/`, which has its own README;
- the site, this repo.

The scripts need a Python with numpy, scipy, Pillow and opencv-python(-headless), plus macOS `sips`
and `cjpeg`.

CLAUDE.md's working agreement applies throughout:

- Ask when anything is unclear.
- Never commit or publish the master photo.
- Commit and deploy only when the owner says so.

## 1. Keep the master private

1. Put the photo at `images/canvasN/canvasN.jpg`.
2. In `.gitignore`, add `images/canvasN/*`, then a `!` line for each published file:
   - `canvasN-480.jpg`, `canvasN-720.jpg`, `canvasN-960.jpg` and `canvasN-1440.jpg`;
   - `canvasN.dzi` and `canvasN_files/`;
   - `dots.json` and `texts.json`.
3. In `_config.yml`, add the master (and any `_4x` upscale) to `exclude`.

Never add a bare `images/canvasN` exclude: it drops the whole `images/` tree, derivatives included.

## 2. Build the web images

The owner's settings (2026-11-23): pure white paper on every canvas, and dots as vivid as canvas 2's.

1. **Measure the master's dot colours first**, with
   `ig-comments/tools/canvas/dot_colours.py <master> <detect> 1:1:n K:G:w`. The boost needed depends
   on how the photo was exported.
2. **Aim for canvas 2's published reds:** L≈53, chroma≈104. Its blues are L≈47, chroma≈92.
3. **Build:**
   `web_images.py images/canvasN/canvasN.jpg images/canvasN canvasN --chroma K --gamma G --white`.
   It never modifies the master.
4. **Show the owner a side-by-side of close-ups before publishing.**

What the earlier canvases needed:

| Canvas | Master as exported | Settings |
| --- | --- | --- |
| 1 | pre-boosted (chroma ×1.4 and a white balance) | `--white` only |
| 2 | red 37 / 68 (dull) | `--chroma 1.9 --gamma 0.72 --white` |
| 3 | already vivid: red 47.5 / 92, blue 27.5 / 118 | `--chroma 1.2 --gamma 0.85 --white` |

- **Don't push past ×1.9:** above that, the reds hit the sRGB limit and go flat while the blues wash
  out.
- **The blue paint can differ:** canvas 3's is a deep ultramarine, already at the sRGB limit. Match the
  reds and leave the blue's hue alone.
- **What `--white` does:** it blends low-chroma, light pixels to #fff. The dots, the black origin dot
  and the gold crown are untouched.

The settings for tiles and landing sizes are fixed in `web_images.py`; CLAUDE.md's "Published images"
lists them.

## 3. Map dots to comments (in ig-comments)

1. **Find the dots.** Run `detect_dots.py` (draft divisor 1 for a normal photo), then `lattice.py`.
2. **Align dots with the comment stream.** Start `align.py` right after the previous canvas's last
   painted comment (canvas 3 ended at #34,094). Run it twice:
   - once with `--skip` set to the never-painted comments the rematch already placed on dots
     (`ig-comments/data/canvas/rematch.json` → `never_painted_used`, also listed in
     `ig-comments/data/canvas/REMATCH.md` for the painter);
   - once without `--skip`.

   Keep the run whose colours agree (~99.9%); the other collapses. That shows whether the painter
   skipped those comments. If they didn't, `build_site.py` moves the comments to the new canvas and
   refills the old dots, as it did for canvas 3.
3. **Register the canvas.** Add N to `painted.py` (`painted.py <ig> <site> N`) and to `CANVASES` in
   `build_site.py`.
4. **Rebuild the site data.** Run `build_site.py --check`, then for real. It writes
   `_data/canvases.json` and the canvas's `dots.json` and `texts.json`.
5. **Diff the old canvases' `dots.json` `ci` against the previous build.** Only the expected dots
   should change.

CLAUDE.md's "Which comment each dot shows" has the colour rules and the rematch rules.
**Never regenerate `comments.json` with `export_site_comments.py`:** it renumbers every comment and
breaks every dot's `ci`.

## 4. Add the site data (no code)

- **`_data/canvas_images.yml`:** add `"N": [w, h]`, taken from `w` and `h` in `images/canvasN/dots.json`.
- **`_data/prints.yml`:** add the canvas's page in the artist's store. Ask the owner for the URL.
  Without it, the viewer shows no "Buy a print" button.

Everything else follows from `_data/canvases.json`:

- the landing carousel slide;
- the viewer's arrows and "Canvas N of M";
- the red / blue / total counts;
- the search page's "Find this dot on canvas N" links.

## 5. Check

1. Run `bundle exec jekyll build`, then `bundle exec jekyll serve`.
2. In a browser, check:
   - the landing carousel, including the new slide;
   - switching canvases in the viewer;
   - a `canvas.html?c=N&dot=…` deep link;
   - the search page's "Find this dot on canvas N" links.
3. Add a row for the new canvas to the dot-count table in CLAUDE.md ("Canvases and dots").
4. Show the owner. Commit and deploy only on their say-so, following CLAUDE.md's workflow.
