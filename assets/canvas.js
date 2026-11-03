"use strict";
/* Dot Project — canvas viewer.
   Deep-zoom the painted canvas (OpenSeadragon tiles) and open any dot to read the
   survivor comment mapped to it. Dot positions were detected from the painting;
   each dot is linked to a real comment of its own category (red = underage/family,
   blue = adult), in the canvas reading order (left-to-right, then right-to-left).  */

const BASE = "assets/canvas1/";
const CAT = { 0: "under", 1: "adult", 2: "family" };
const CAT_LABEL = { 0: "Underage", 1: "Adult", 2: "Family / incest" };
const CAT_COLOR = { 0: "#d6283b", 1: "#1f50d0", 2: "#8c1d2e" };
const SELECT_RADIUS = 30;          // image px: how near a click must be to grab a dot

let viewer, tiledImage, D = null, TEXTS = null;
let overlay, octx, dpr = 1;
let buckets = null, cell = 48, gw = 0;
let showCats = false;
const catOn = { 0: true, 1: true, 2: true };
let selected = -2;                 // -2 none, -1 origin, >=0 dot index
let readOrder = null, orderPos = null;

/* ---------- boot ---------- */
window.addEventListener("load", init);

function init() {
  viewer = OpenSeadragon({
    element: document.getElementById("osd"),
    tileSources: BASE + "canvas1.dzi",
    prefixUrl: "",                 // we supply our own controls
    showNavigationControl: false,
    showNavigator: false,
    maxZoomPixelRatio: 2.2,
    visibilityRatio: 1,
    constrainDuringPan: true,
    minZoomImageRatio: 0.8,
    gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
    gestureSettingsTouch: { clickToZoom: false },
    animationTime: 0.5,
    springStiffness: 7,
  });

  overlay = document.createElement("canvas");
  overlay.id = "dot-overlay";
  document.querySelector(".cv-stage-wrap").appendChild(overlay);
  octx = overlay.getContext("2d");

  viewer.addHandler("open", () => {
    tiledImage = viewer.world.getItemAt(0);
    document.getElementById("loading").classList.add("hide");
    resizeOverlay();
    draw();
  });
  viewer.addHandler("animation", draw);
  viewer.addHandler("update-viewport", draw);
  viewer.addHandler("resize", () => { resizeOverlay(); draw(); });
  viewer.addHandler("canvas-click", onClick);
  window.addEventListener("resize", () => { resizeOverlay(); draw(); });

  wireControls();
  loadData();

  // minimal hook for console debugging / future deep-links
  window.__cv = { viewer, select, panTo, data: () => D };
}

/* ---------- data ---------- */
function loadData() {
  fetch(BASE + "dots.json").then(r => r.json()).then(d => {
    D = d;
    buildIndex();
    draw();
  }).catch(() => {});
  fetch(BASE + "texts.json").then(r => r.json()).then(t => {
    TEXTS = t;
    if (selected >= 0) renderPanel(selected);   // fill in if a dot was tapped early
  }).catch(() => {});
}

function buildIndex() {
  gw = Math.ceil(D.w / cell);
  const gh = Math.ceil(D.h / cell);
  buckets = new Array(gw * gh);
  for (let i = 0; i < D.n; i++) {
    const b = Math.floor(D.y[i] / cell) * gw + Math.floor(D.x[i] / cell);
    (buckets[b] || (buckets[b] = [])).push(i);
  }
  // exact reading order (serpentine rows), precomputed in the data pipeline:
  // D.read[i] is dot i's rank along the reading path.
  orderPos = D.read;
  readOrder = new Int32Array(D.n);
  for (let i = 0; i < D.n; i++) readOrder[D.read[i]] = i;
}

/* nearest dot to an image-space point, honoring category filter when overlay on */
function nearestDot(ix, iy) {
  if (!buckets) return -2;
  // origin first
  if (D.origin) {
    const dx = ix - D.origin[0], dy = iy - D.origin[1];
    if (dx * dx + dy * dy < 24 * 24) return -1;
  }
  const cx = Math.floor(ix / cell), cy = Math.floor(iy / cell);
  let best = -2, bd = SELECT_RADIUS * SELECT_RADIUS;
  for (let yy = cy - 1; yy <= cy + 1; yy++) {
    for (let xx = cx - 1; xx <= cx + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= gw) continue;
      const arr = buckets[yy * gw + xx];
      if (!arr) continue;
      for (const i of arr) {
        if (showCats && !catOn[D.cat[i]]) continue;
        const dx = ix - D.x[i], dy = iy - D.y[i], dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = i; }
      }
    }
  }
  return best;
}

/* ---------- interaction ---------- */
function onClick(e) {
  if (!e.quick || !tiledImage) return;
  const vp = viewer.viewport.pointFromPixel(e.position, true);
  const p = tiledImage.viewportToImageCoordinates(vp);
  const hit = nearestDot(p.x, p.y);
  if (hit === -2) return;
  select(hit);
}

function select(id) {
  selected = id;
  renderPanel(id);
  draw();
}

function renderPanel(id) {
  const panel = document.getElementById("panel");
  const catEl = document.getElementById("p-cat");
  const textEl = document.getElementById("p-text");
  const metaEl = document.getElementById("p-meta");
  const noteEl = document.getElementById("p-note");
  const nav = document.getElementById("p-nav");

  if (id === -1) {
    catEl.className = "cv-cat origin";
    catEl.innerHTML = '<span class="sw"></span>The first Jane Doe';
    textEl.textContent = "The black dot at the heart of the canvas.";
    noteEl.textContent =
      "This dot is the origin — the first Jane Doe. It stands for her, not for a " +
      "comment, and the canvas grows outward from here.";
    noteEl.hidden = false;
    metaEl.textContent = "";
    nav.hidden = true;
  } else {
    const c = D.cat[id];
    catEl.className = "cv-cat " + CAT[c];
    catEl.innerHTML = '<span class="sw"></span>' + CAT_LABEL[c];
    noteEl.hidden = true;
    if (TEXTS) {
      textEl.innerHTML = renderText(TEXTS[id]);
    } else {
      textEl.textContent = "Loading…";
    }
    metaEl.textContent = "Dot " + (orderPos[id] + 1).toLocaleString() +
      " of " + D.n.toLocaleString();
    nav.hidden = false;
  }
  panel.classList.add("open");
}

function renderText(t) {
  const esc = t.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
  return esc.replace(/\[(name|handle|email|link|phone)\]/g,
    '<span class="redacted">[$1]</span>');
}

function step(delta) {
  if (selected < 0) return;
  let pos = orderPos[selected] + delta;
  pos = Math.max(0, Math.min(D.n - 1, pos));
  const id = readOrder[pos];
  select(id);
  panTo(id);
}

function panTo(id) {
  const vp = tiledImage.imageToViewportCoordinates(
    new OpenSeadragon.Point(D.x[id], D.y[id]));
  viewer.viewport.panTo(vp);
}

/* ---------- overlay drawing ---------- */
function resizeOverlay() {
  dpr = window.devicePixelRatio || 1;
  const r = document.getElementById("osd").getBoundingClientRect();
  overlay.width = Math.round(r.width * dpr);
  overlay.height = Math.round(r.height * dpr);
  overlay.style.width = r.width + "px";
  overlay.style.height = r.height + "px";
}

function draw() {
  if (!octx) return;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (!D || !tiledImage) { if (selected !== -2) drawSelection(); return; }

  // affine image->screen from two reference points (no rotation in use)
  const o = pxFromImage(0, 0), ex = pxFromImage(D.w, 0), ey = pxFromImage(0, D.h);
  const sx = (ex.x - o.x) / D.w, sy = (ey.y - o.y) / D.h;
  const rScreen = 16 * sx;                       // painted dot radius ~16 img px

  if (showCats && rScreen > 0.6) {
    const W = overlay.width / dpr, H = overlay.height / dpr;
    const rr = Math.max(1.1, rScreen * 0.82);
    for (let i = 0; i < D.n; i++) {
      const c = D.cat[i];
      if (!catOn[c]) continue;
      const px = o.x + D.x[i] * sx, py = o.y + D.y[i] * sy;
      if (px < -5 || py < -5 || px > W + 5 || py > H + 5) continue;
      octx.beginPath();
      octx.arc(px, py, rr, 0, 6.2832);
      octx.fillStyle = CAT_COLOR[c];
      octx.globalAlpha = 0.9;
      octx.fill();
    }
    octx.globalAlpha = 1;
  }
  drawSelection(o, sx, sy, rScreen);
}

function drawSelection(o, sx, sy, rScreen) {
  if (selected === -2 || !D) return;
  let ix, iy, col;
  if (selected === -1) {
    if (!D.origin) return;
    ix = D.origin[0]; iy = D.origin[1]; col = "#111";
  } else {
    ix = D.x[selected]; iy = D.y[selected]; col = CAT_COLOR[D.cat[selected]];
  }
  if (!o) { o = pxFromImage(0, 0); const ex = pxFromImage(D.w, 0), ey = pxFromImage(0, D.h);
            sx = (ex.x - o.x) / D.w; sy = (ey.y - o.y) / D.h; rScreen = 16 * sx; }
  const px = o.x + ix * sx, py = o.y + iy * sy;
  const r = Math.max(9, rScreen + 6);
  octx.beginPath(); octx.arc(px, py, r, 0, 6.2832);
  octx.lineWidth = 3; octx.strokeStyle = "#111"; octx.stroke();
  octx.beginPath(); octx.arc(px, py, r + 3, 0, 6.2832);
  octx.lineWidth = 2; octx.strokeStyle = "#fff"; octx.stroke();
}

function pxFromImage(ix, iy) {
  const vp = tiledImage.imageToViewportCoordinates(new OpenSeadragon.Point(ix, iy));
  return viewer.viewport.pixelFromPoint(vp, true);
}

/* ---------- controls ---------- */
function wireControls() {
  document.getElementById("zin").onclick = () => viewer.viewport.zoomBy(1.6).applyConstraints();
  document.getElementById("zout").onclick = () => viewer.viewport.zoomBy(0.625).applyConstraints();
  document.getElementById("zhome").onclick = () => viewer.viewport.goHome();
  document.getElementById("p-prev").onclick = () => step(-1);
  document.getElementById("p-next").onclick = () => step(1);
  document.getElementById("p-close").onclick = () => {
    document.getElementById("panel").classList.remove("open");
    selected = -2; draw();
  };

  const catToggle = document.getElementById("t-cats");
  catToggle.onclick = () => {
    showCats = !showCats;
    catToggle.setAttribute("aria-pressed", String(showCats));
    document.getElementById("chiprow").hidden = !showCats;
    draw();
  };
  document.querySelectorAll(".chip.filter").forEach(ch => {
    ch.onclick = () => {
      const c = +ch.dataset.cat;
      catOn[c] = !catOn[c];
      ch.setAttribute("aria-pressed", String(catOn[c]));
      draw();
    };
  });
}
