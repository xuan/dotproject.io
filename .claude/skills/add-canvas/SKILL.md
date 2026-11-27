---
name: add-canvas
description: Add a newly painted canvas (canvas 4, 5, …) to dotproject.io. Covers keeping the master photo private, making the 4× master canvasN_4x.jpg match canvas 1's colouring, then the web images, mapping each painted dot to its comment in the sibling ig-comments repo, adding the site data, and checking the result. Use when a new images/canvasN/canvasN.jpg appears, when the owner has a photo of a new canvas, or asks to add or publish canvas N.
---

# Add a canvas

N is the new canvas number.

## The workflow (owner, 2026-11-27)

1. **The owner** creates the folder `images/canvasN/` and puts the photo in it as `canvasN.jpg`.
   That is the cue to start.
2. **Claude makes `canvasN_4x.jpg` first:** a 4× upscale whose colouring and brightness look
   identical to `canvas1_4x.jpg`.
3. **After that, Claude generates the rest of the images** (deep-zoom tiles and landing sizes) with
   the same colour settings, so they match the 4×.
4. Then come the dot mapping and the site data (sections 3 to 5).

The work spans two repos:

- the dot pipeline in the sibling repo `../ig-comments/tools/canvas/`, which has its own README;
- the site, this repo.

The scripts need a Python with numpy, scipy, Pillow and opencv-python(-headless), plus macOS `sips`
and `cjpeg`.

CLAUDE.md's working agreement applies throughout:

- Ask when anything is unclear.
- Never commit or publish the master photo.
- Commit and deploy only when the owner says so.

## 1. Keep the master private

1. The owner has put the photo at `images/canvasN/canvasN.jpg`.
2. In `.gitignore`, add `images/canvasN/*`, then a `!` line for each published file:
   - `canvasN-480.jpg`, `canvasN-720.jpg`, `canvasN-960.jpg` and `canvasN-1440.jpg`;
   - `canvasN.dzi` and `canvasN_files/`;
   - `dots.json` and `texts.json`.
3. In `_config.yml`, add both `images/canvasN/canvasN.jpg` and `images/canvasN/canvasN_4x.jpg` to
   `exclude`.

Never add a bare `images/canvasN` exclude: it drops the whole `images/` tree, derivatives included.

## 2. Make the 4×, then the rest of the images

**The look (owner, 2026-11-27):** every canvas's colouring looks identical to `canvas1_4x.jpg`, with
the same red, the same blue and pure white paper. Canvas 1 is the reference and is never matched to
anything. The scripts are in `ig-comments/tools/canvas/`, and none of them modifies the master.
`SCRATCH` below is a scratch folder outside the site.

1. **Choose a rough boost K, G.** Run `detect_dots.py <master> 1 data/canvas/canvasN_detect.json`
   (it is also step 3.1), then `dot_colours.py <master> data/canvas/canvasN_detect.json 1:1:n K:G:w …`.
   Pick K and G that bring a dull export near canvas 1's dots: red L≈45 / chroma≈90, blue L≈37 /
   chroma≈101. For an already vivid export, use 1 and 1. The paint match below does the exact part.
2. **Build an unmatched 4×:**
   `upscale4x.py images/canvasN/canvasN.jpg $SCRATCH/canvasN_4x_base.jpg --chroma K --gamma G --white`.
3. **Fit the paint match to canvas 1:**
   `paint_match.py images/canvas1/canvas1_4x.jpg $SCRATCH/canvasN_4x_base.jpg canvasN`.
   It moves the red paint and the blue paint separately (lightness, chroma and hue) and stores the
   result in `paint_match.json` under `canvasN`. Each photo, and sometimes the paint (canvas 3's blue
   is an ultramarine), differs, so one boost can't do it.
4. **Make the 4×:**
   `upscale4x.py images/canvasN/canvasN.jpg images/canvasN/canvasN_4x.jpg --chroma K --gamma G --match canvasN --white`.
   It upscales (Lanczos ×4 plus a mild unsharp mask), then applies the same colour step as
   `web_images.py`. The output is about 300 MP and 80 MB; the run takes about 30 s and 3 GB of RAM.
   It refuses to overwrite an existing 4×.
5. **Then generate the rest:**
   `web_images.py images/canvasN/canvasN.jpg images/canvasN canvasN --chroma K --gamma G --match canvasN --white`.
   Use the same four flags as the 4×. Build from the master, not the 4×: the tiles, `dots.json` and
   `_data/canvas_images.yml` all use the master's pixel size.
6. **Check.** Both commands must print OK:
   - `colour_check.py images/canvasN/canvasN_4x.jpg images/canvasN/canvasN-1440.jpg`: the 4× matches
     its own web images;
   - `colour_check.py images/canvasN/canvasN_4x.jpg images/canvas1/canvas1_4x.jpg --across`: it
     matches canvas 1.
7. **Show the owner a side-by-side of close-ups before publishing.**

The settings in use:

| Canvas | Master as exported | Flags (4× and web images alike) |
| --- | --- | --- |
| 1 | pre-boosted (chroma ×1.4 and a white balance) | `--white` (the reference) |
| 2 | red 37 / 68 (dull) | `--chroma 1.9 --gamma 0.72 --match canvas2 --white` |
| 3 | already vivid: red 47.5 / 92, ultramarine blue 27.5 / 118 | `--chroma 1.2 --gamma 0.85 --match canvas3 --white` |

- **The reds land within about 1 unit of canvas 1's.** Not closer, because a dark, saturated red sits
  at the edge of what sRGB can show.
- **What `--white` does:** it blends low-chroma, light pixels to #fff. The dots, the black origin dot
  and the gold crown are untouched.
- **What `--match` leaves alone:** anything below chroma 12 (paper, the black dot, grey) and hues far
  from the red and the blue paint.

The settings for tiles and landing sizes are fixed in `web_images.py`; CLAUDE.md's "Published images"
lists them. The 4×'s are fixed in `upscale4x.py`: JPEG quality 95, 4:4:4 colour, no metadata.

**Recolouring is part of the workflow** (owner, 2026-11-27). Whenever a canvas's settings change or
its images are rebuilt, both checks in step 6 must still pass. If one fails, re-fit the match
(steps 2 and 3), then rebuild the 4× (with `--force`) and the web images. If the 4× being replaced
predates this workflow, first move it to `images/canvasN/_pre_colour/`.

On 2026-11-27 all three canvases passed both checks: lightness within 1.2, chroma within 2%, hue
within 1.1°. The 4× files from before then are in the `_pre_colour/` folders of canvases 1 and 2.
Canvas 3 had none.

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
