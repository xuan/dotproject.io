"use strict";
/* Dot Project — canvas viewer.
   Deep-zoom a painted canvas (OpenSeadragon tiles) and open any dot to read the
   survivor comment mapped to it. ?c=N picks the canvas (1 when absent); ?dot=N selects
   and flies to dot N (used by the search page's "find this dot" links). Esc resets the view.
   The side arrows (shown on hover, like the landing page) switch canvases in place. */

const CANVAS_COUNT = 3;
/* "Request a change" link in the dot panel → owner's Google Form, prefilled with
   canvas, dot index (?dot= value) and comment index (ci into comments.json).
   Keep in sync with CHANGE_FORM in comments.js. The link stays hidden while url is "". */
const CHANGE_FORM = {
  url: "https://docs.google.com/forms/d/e/1FAIpQLSd-dLZonVQzHA44ixR2Yg-7XvNwHKt8mBlhTzfrZzzIpOtpcQ/viewform",
  canvas: "entry.647534290", dot: "entry.178890866", ci: "entry.545841760",
};
function changeFormHref(c, dot, ci) {
  if (!CHANGE_FORM.url) return "";
  const q = new URLSearchParams({ usp: "pp_url" });
  q.set(CHANGE_FORM.canvas, c); q.set(CHANGE_FORM.dot, dot); q.set(CHANGE_FORM.ci, ci);
  return CHANGE_FORM.url + "?" + q.toString();
}
let canvas = (() => {
  const c = parseInt(new URLSearchParams(location.search).get("c"), 10);
  return c >= 1 && c <= CANVAS_COUNT ? c : 1;
})();
let BASE = "images/canvas" + canvas + "/";

/* the bar under the header: the open canvas's red / blue / total dots (site.data.canvases, the
   same counts as the landing page) and its "Buy a print" link (site.data.prints), embedded in
   canvas.html as #canvas-info. Filled right away (no flash) and again on every canvas switch. */
const INFO = (() => {
  try { return JSON.parse(document.getElementById("canvas-info").textContent); } catch (e) { return null; }
})();
function updateInfo() {
  const row = INFO && INFO.counts && INFO.counts.find(r => r.canvas === canvas);
  const bar = document.getElementById("cinfo");
  bar.hidden = !row;
  if (!row) return;
  const fmt = (n) => n.toLocaleString("en-US");
  document.getElementById("i-name").textContent = "Canvas " + canvas;
  document.getElementById("i-red").textContent = fmt(row.red);
  document.getElementById("i-blue").textContent = fmt(row.blue);
  document.getElementById("i-total").textContent = fmt(row.dots);
  const buy = document.getElementById("i-buy");
  const url = INFO.prints && INFO.prints[String(canvas)];
  buy.hidden = !url;
  if (url) {
    buy.href = url;
    buy.setAttribute("aria-label", "Buy a print of canvas " + canvas + " (opens the artist's store)");
  }
}
updateInfo();
let loadSeq = 0;                   // ignores data that arrives for a canvas we already left
let slideIn = 0;                   // direction of the switch animation still to finish (+1 / -1)
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  if (canvas !== 1) document.title = "Canvas " + canvas + " \u2014 Dot Project";
  viewer = OpenSeadragon({
    element: document.getElementById("osd"),
    tileSources: BASE + "canvas" + canvas + ".dzi",
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
    if (slideIn) finishSlide();
  });
  viewer.addHandler("animation", draw);
  viewer.addHandler("update-viewport", draw);
  viewer.addHandler("resize", () => { resizeOverlay(); draw(); });
  viewer.addHandler("canvas-click", onClick);
  window.addEventListener("resize", () => { resizeOverlay(); draw(); });
  window.addEventListener("keydown", onKey, true);   // capture: beat OSD's own arrow-key panning

  wireControls();
  loadData();

  // deep-link: ?dot=N  (the search page links here)
  const dp = new URLSearchParams(location.search).get("dot");
  if (dp !== null && dp !== "") pendingDot = parseInt(dp, 10);

  updateSwitcher();

  // minimal hook for console debugging / deep-links
  window.__cv = { viewer, select, goToDot, switchCanvas, data: () => D, canvas: () => canvas };
}

/* ---------- switching canvases (side arrows) ---------- */
function switchCanvas(c) {
  if (c === canvas || c < 1 || c > CANVAS_COUNT) return;
  const dir = c > canvas ? 1 : -1;
  canvas = c;
  BASE = "images/canvas" + c + "/";
  document.getElementById("panel").classList.remove("open");
  selected = -2; pendingDot = null;
  D = null; TEXTS = null; buckets = null; tiledImage = null;
  draw();
  history.replaceState(null, "", "?c=" + c);
  document.title = c === 1 ? "The canvas \u2014 Dot Project" : "Canvas " + c + " \u2014 Dot Project";
  updateSwitcher();
  const osd = document.getElementById("osd");
  osd.classList.add(dir > 0 ? "go-left" : "go-right");       // slide the old canvas out
  setTimeout(() => {
    slideIn = dir;
    document.getElementById("loading").classList.remove("hide");
    viewer.open(BASE + "canvas" + c + ".dzi");
    loadData();
  }, reduceMotion ? 0 : 260);
}

function finishSlide() {                                       // slide the new canvas in
  const osd = document.getElementById("osd");
  osd.classList.remove("go-left", "go-right");
  osd.classList.add(slideIn > 0 ? "from-right" : "from-left");
  slideIn = 0;
  void osd.offsetWidth;                                        // commit the start position
  osd.classList.remove("from-right", "from-left");
}

function updateSwitcher() {
  document.getElementById("cprev").disabled = canvas <= 1;
  document.getElementById("cnext").disabled = canvas >= CANVAS_COUNT;
  document.getElementById("cprev").title = canvas > 1 ? "Canvas " + (canvas - 1) : "";
  document.getElementById("cnext").title = canvas < CANVAS_COUNT ? "Canvas " + (canvas + 1) : "";
  document.getElementById("cwhich").textContent = "Canvas " + canvas + " of " + CANVAS_COUNT;
  updateInfo();
}

/* ---------- data ---------- */
function loadData() {
  const seq = ++loadSeq;
  fetch(BASE + "dots.json").then(r => r.json()).then(d => {
    if (seq !== loadSeq) return;
    D = d;
    buildIndex();
    draw();
    tryPending();
  }).catch(() => {});
  fetch(BASE + "texts.json").then(r => r.json()).then(t => {
    if (seq !== loadSeq) return;
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

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function onKey(e) {
  // typing in the header search: leave its keys (arrows move the caret, Esc clears it) alone
  if (e.target.closest && e.target.closest("input, textarea, select")) return;
  if (e.key === "Escape") {
    viewer.viewport.goHome();              // reset zoom
    document.getElementById("panel").classList.remove("open");
    selected = -2;
    draw();
    return;
  }
  const dir = ARROWS[e.key];
  if (!dir || selected === -2 || !buckets) return;
  e.preventDefault(); e.stopPropagation();
  const next = neighbour(selected, dir);
  if (next !== -2) { select(next); keepInView(next); }
}

/* nearest dot in a direction: left/right stay in the same straight row, up/down stay in the
   same column (the hex diagonals at ~27deg are excluded by the narrow cone) */
function neighbour(id, [dx, dy]) {
  const x0 = id === -1 ? D.origin[0] : D.x[id];
  const y0 = id === -1 ? D.origin[1] : D.y[id];
  const gh = buckets.length / gw, R = 6;     // search ~6 cells: enough to hop the centre clearing
  const cx = Math.floor(x0 / cell), cy = Math.floor(y0 / cell);
  let best = -2, bs = Infinity;
  for (let yy = cy - R; yy <= cy + R; yy++) {
    for (let xx = cx - R; xx <= cx + R; xx++) {
      if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
      const arr = buckets[yy * gw + xx];
      if (!arr) continue;
      for (const i of arr) {
        if (i === id) continue;
        const vx = D.x[i] - x0, vy = D.y[i] - y0;
        const along = vx * dx + vy * dy, perp = Math.abs(vx * dy - vy * dx);
        if (along <= 0 || perp > along * 0.3) continue;
        const s = along + 2 * perp;
        if (s < bs) { bs = s; best = i; }
      }
    }
  }
  return best;
}

/* pan only when the selected dot drifts near the edge of the view */
function keepInView(id) {
  const b = tiledImage.viewportToImageRectangle(viewer.viewport.getBounds(true));
  const mx = b.width * 0.15, my = b.height * 0.15, x = D.x[id], y = D.y[id];
  if (x < b.x + mx || x > b.x + b.width - mx || y < b.y + my || y > b.y + b.height - my) panTo(id);
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
  const report = document.getElementById("p-report");

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
    report.hidden = true;
  } else {
    catEl.hidden = false;                  // position in the reading order (no category)
    catEl.className = "cv-pos";
    catEl.textContent = "Canvas " + canvas + " \u00b7 Dot " + (orderPos[id] + 1).toLocaleString() +
      " of " + D.n.toLocaleString();
    noteEl.hidden = true;
    textEl.innerHTML = TEXTS ? renderText(TEXTS[id]) : "Loading…";
    nav.hidden = false;
    const href = D.ci ? changeFormHref(canvas, id, D.ci[id]) : "";
    report.hidden = !href;
    if (href) report.href = href;
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
  document.getElementById("cprev").onclick = () => switchCanvas(canvas - 1);
  document.getElementById("cnext").onclick = () => switchCanvas(canvas + 1);
  document.getElementById("p-prev").onclick = () => step(-1);
  document.getElementById("p-next").onclick = () => step(1);
  document.getElementById("p-close").onclick = () => {
    document.getElementById("panel").classList.remove("open");
    selected = -2; draw();
  };
}
