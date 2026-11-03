"use strict";
/* Dot Project — canvas viewer.
   Deep-zoom the painted canvas (OpenSeadragon tiles) and open any dot to read the
   survivor comment mapped to it. Arriving with ?dot=N selects and flies to dot N
   (used by the search page's "show on the canvas" links). Esc resets the view. */

const BASE = "images/canvas1/";
const SELECT_RADIUS = 30;          // image px: how near a click must be to grab a dot
const LINK_ZOOM = 3.5;             // zoom level used when flying to a linked/selected dot
const OPEN_ZOOM = 2;               // fresh-open zoom (x the fit-to-view home zoom)

let viewer, tiledImage, D = null, TEXTS = null;
let overlay, octx, dpr = 1;
let buckets = null, cell = 48, gw = 0;
let selected = -2;                 // -2 none, -1 origin, >=0 dot index
let readOrder = null, orderPos = null;
let pendingDot = null;             // deep-link (?dot=N) target, resolved once ready

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
    animationTime: 0.6,
    springStiffness: 6.5,
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
    if (pendingDot !== null) {
      tryPending();
    } else {
      // fresh open (e.g. clicking the canvas on the landing page): start zoomed in
      viewer.viewport.zoomTo(viewer.viewport.getHomeZoom() * OPEN_ZOOM, null, true);
      viewer.viewport.applyConstraints(true);
    }
  });
  viewer.addHandler("animation", draw);
  viewer.addHandler("update-viewport", draw);
  viewer.addHandler("resize", () => { resizeOverlay(); draw(); });
  viewer.addHandler("canvas-click", onClick);
  window.addEventListener("resize", () => { resizeOverlay(); draw(); });
  window.addEventListener("keydown", onKey);

  wireControls();
  loadData();

  // deep-link: ?dot=N  (the search page links here)
  const dp = new URLSearchParams(location.search).get("dot");
  if (dp !== null && dp !== "") pendingDot = parseInt(dp, 10);

  // minimal hook for console debugging / deep-links
  window.__cv = { viewer, select, goToDot, data: () => D };
}

/* ---------- data ---------- */
function loadData() {
  fetch(BASE + "dots.json").then(r => r.json()).then(d => {
    D = d;
    buildIndex();
    draw();
    tryPending();
  }).catch(() => {});
  fetch(BASE + "texts.json").then(r => r.json()).then(t => {
    TEXTS = t;
    if (selected >= 0) renderPanel(selected);   // fill in if a dot was opened early
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
  // exact reading order (serpentine rows), precomputed in the data pipeline.
  orderPos = D.read;
  readOrder = new Int32Array(D.n);
  for (let i = 0; i < D.n; i++) readOrder[D.read[i]] = i;
}

function tryPending() {
  if (pendingDot === null || !tiledImage || !D) return;
  const id = pendingDot;
  pendingDot = null;
  if (Number.isInteger(id) && id >= 0 && id < D.n) {
    select(id);
    goToDot(id);
  }
}

/* nearest dot to an image-space point */
function nearestDot(ix, iy) {
  if (!buckets) return -2;
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

function onKey(e) {
  if (e.key === "Escape") {
    viewer.viewport.goHome();              // reset zoom
    document.getElementById("panel").classList.remove("open");
    selected = -2;
    draw();
  }
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
  const noteEl = document.getElementById("p-note");
  const nav = document.getElementById("p-nav");

  if (id === -1) {
    catEl.hidden = false;
    catEl.className = "cv-cat origin";
    catEl.innerHTML = '<span class="sw"></span>The first Jane Doe';
    textEl.textContent = "The black dot at the heart of the canvas.";
    noteEl.textContent =
      "This dot is the origin — the first Jane Doe. It stands for her, not for a " +
      "comment, and the canvas grows outward from here.";
    noteEl.hidden = false;
    nav.hidden = true;
  } else {
    catEl.hidden = false;                  // position in the reading order (no category)
    catEl.className = "cv-pos";
    catEl.textContent = "Dot " + (orderPos[id] + 1).toLocaleString() +
      " of " + D.n.toLocaleString();
    noteEl.hidden = true;
    textEl.innerHTML = TEXTS ? renderText(TEXTS[id]) : "Loading…";
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

/* fly to a dot: zoom in and centre it (used by deep-links) */
function goToDot(id) {
  const vp = tiledImage.imageToViewportCoordinates(
    new OpenSeadragon.Point(D.x[id], D.y[id]));
  viewer.viewport.zoomTo(LINK_ZOOM);
  viewer.viewport.panTo(vp);
  viewer.viewport.applyConstraints();
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
  if (selected !== -2 && D && tiledImage) drawSelection();
}

function drawSelection() {
  let ix, iy;
  if (selected === -1) {
    if (!D.origin) return;
    ix = D.origin[0]; iy = D.origin[1];
  } else {
    ix = D.x[selected]; iy = D.y[selected];
  }
  const o = pxFromImage(0, 0), ex = pxFromImage(D.w, 0);
  const sx = (ex.x - o.x) / D.w;
  const rScreen = 16 * sx;
  const px = o.x + ix * sx, py = o.y + iy * (sx);  // sx==sy (uniform scale)
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
  document.getElementById("zin").onclick = () => viewer.viewport.zoomBy(2).applyConstraints();
  document.getElementById("zout").onclick = () => viewer.viewport.zoomBy(0.5).applyConstraints();
  document.getElementById("zhome").onclick = () => viewer.viewport.goHome();
  document.getElementById("p-prev").onclick = () => step(-1);
  document.getElementById("p-next").onclick = () => step(1);
  document.getElementById("p-close").onclick = () => {
    document.getElementById("panel").classList.remove("open");
    selected = -2; draw();
  };
}
