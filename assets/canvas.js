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

  // keyboard: OpenSeadragon makes its canvas focusable; name it and say how to use it
  viewer.canvas.setAttribute("role", "application");
  viewer.canvas.setAttribute("aria-roledescription", "zoomable canvas");
  // show the canvas's focus ring (canvas.css, .cv.kbd) only to keyboard users: a key press turns it
  // on, any mouse, pen or touch press turns it off
  const cvRoot = document.querySelector(".cv");
  window.addEventListener("keydown", (e) => {
    if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) cvRoot.classList.add("kbd");
  }, true);
  window.addEventListener("pointerdown", () => cvRoot.classList.remove("kbd"), true);

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
    if (loadError === "canvas") hideError();
  });
  viewer.addHandler("open-failed", () => showError("canvas"));
  viewer.addHandler("animation-finish", () => { flyZoom = null; });
  viewer.addHandler("animation", draw);
  viewer.addHandler("update-viewport", draw);
  // a resize can change the panel's size, or swap the side panel for the phone sheet
  viewer.addHandler("resize", () => { syncPanel(); resizeOverlay(); draw(); });
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
  hideError();
  closePanel();
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
  const prev = document.getElementById("cprev"), next = document.getElementById("cnext");
  const focused = document.activeElement;    // read before disabling: that blurs the button
  prev.disabled = canvas <= 1;
  next.disabled = canvas >= CANVAS_COUNT;
  prev.title = canvas > 1 ? "Canvas " + (canvas - 1) : "";
  next.title = canvas < CANVAS_COUNT ? "Canvas " + (canvas + 1) : "";
  document.getElementById("cwhich").textContent = "Canvas " + canvas + " of " + CANVAS_COUNT;
  if (viewer && viewer.canvas) {
    viewer.canvas.setAttribute("aria-label",
      "Canvas " + canvas + " of " + CANVAS_COUNT + ". Press Enter to read the dot at the centre, " +
      "then use the arrow keys to move from dot to dot. Plus and minus zoom; Escape resets the view.");
    // reaching the first or last canvas hides the arrow that had focus: keep focus on the canvas
    if ((focused === prev && prev.disabled) || (focused === next && next.disabled)) viewer.canvas.focus();
  }
  updateInfo();
}

/* ---------- data ---------- */
function loadData() {
  const seq = ++loadSeq;
  const get = (file) => fetch(BASE + file).then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
  textsFailed = false;
  if (!D) get("dots.json").then(d => {
    if (seq !== loadSeq) return;
    D = d;
    buildIndex();
    draw();
    tryPending();
  }).catch(() => { if (seq === loadSeq) showError("data"); });
  if (!TEXTS) get("texts.json").then(t => {
    if (seq !== loadSeq) return;
    TEXTS = t;
    if (selected >= 0) renderPanel(selected);   // fill in if a dot was opened early
  }).catch(() => {
    if (seq !== loadSeq) return;
    textsFailed = true;
    showError("data");
    if (selected >= 0) renderPanel(selected);   // "didn't load" instead of "Loading…"
  });
}

/* ---------- load failures ---------- */
/* A plain message at the top of the stage instead of an endless "Loading…": what failed, and a
   retry plus a way back to search. "canvas" = the tiles; "data" = the dot positions or the words. */
let loadError = null;
let textsFailed = false;

function showError(kind) {
  if (loadError === "canvas") kind = "canvas";   // keep the bigger failure on screen
  loadError = kind;
  document.getElementById("loading").classList.add("hide");
  document.getElementById("cerror-msg").textContent = (kind === "canvas"
    ? "Canvas " + canvas + " didn't load."
    : "The comments for canvas " + canvas + " didn't load.") +
    " Check your connection and try again.";
  document.getElementById("cerror").hidden = false;
}

function hideError() {
  loadError = null;
  document.getElementById("cerror").hidden = true;
}

function retryLoad() {
  const kind = loadError;
  const hadFocus = document.getElementById("cerror").contains(document.activeElement);
  hideError();
  if (kind === "canvas") {
    document.getElementById("loading").classList.remove("hide");
    viewer.open(BASE + "canvas" + canvas + ".dzi");
  }
  if (!D || !TEXTS) loadData();
  if (hadFocus) viewer.canvas.focus();           // the button just disappeared
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
  centreOn(hit);                           // bring the tapped dot to the middle so it's never lost
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function onKey(e) {
  // typing in the header search: leave its keys (arrows move the caret, Esc clears it) alone
  if (e.target.closest && e.target.closest("input, textarea, select")) return;
  if (e.key === "Escape") {
    closePanel();                          // first: dropping the panel margins stops any animation
    viewer.viewport.goHome();              // reset zoom
    selected = -2;
    draw();
    return;
  }
  // Enter / Space on the focused canvas opens the dot nearest the centre of the view (at any zoom),
  // so keyboard users can start reading without a mouse; arrows then move from dot to dot
  if ((e.key === "Enter" || e.key === " ") && selected === -2 &&
      e.target.closest && e.target.closest("#osd")) {
    const id = centreDot();
    if (id !== -2) { e.preventDefault(); e.stopPropagation(); select(id); centreOn(id); }
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

/* the dot (or the origin) nearest the centre of the view, however far: a plain scan of ~11K dots,
   only run on a key press. -2 until the canvas and its dots have loaded */
function centreDot() {
  if (!D || !tiledImage) return -2;
  const c = tiledImage.viewportToImageCoordinates(viewer.viewport.getCenter(true));
  let best = -2, bd = Infinity;
  if (D.origin) {
    const dx = c.x - D.origin[0], dy = c.y - D.origin[1];
    best = -1; bd = dx * dx + dy * dy;
  }
  for (let i = 0; i < D.n; i++) {
    const dx = c.x - D.x[i], dy = c.y - D.y[i], dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = i; }
  }
  return best;
}

/* pan only when the selected dot drifts near the edge of the view */
function keepInView(id) {
  const b = tiledImage.viewportToImageRectangle(viewer.viewport.getBounds(true));
  const mx = b.width * 0.15, my = b.height * 0.15, x = D.x[id], y = D.y[id];
  if (x < b.x + mx || x > b.x + b.width - mx || y < b.y + my || y > b.y + b.height - my) centreOn(id);
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
    textEl.innerHTML = TEXTS ? renderText(TEXTS[id])
      : textsFailed ? "This comment didn't load." : "Loading…";
    nav.hidden = false;
    const href = D.ci ? changeFormHref(canvas, id, D.ci[id]) : "";
    report.hidden = !href;
    if (href) report.href = href;
  }
  // screen readers hear the position and the words (the panel is inert until it opens)
  document.getElementById("p-live").textContent = id === -1
    ? "The first Jane Doe. " + noteEl.textContent
    : catEl.textContent + ". " + (TEXTS ? TEXTS[id] : textsFailed ? "This comment didn't load." : "Loading.");
  openPanel();
}

function openPanel() {
  const panel = document.getElementById("panel");
  panel.inert = false;
  panel.classList.add("open");
  syncPanel();
}

/* after the panel opens, or its content or size changes (the phone sheet is as tall as the
   comment): keep --sheet-h (canvas.css) and the viewport margins in step, and if the visible area
   moved, re-centre the open dot, resuming a deep link's zoom if one was still flying */
function syncPanel() {
  const panel = document.getElementById("panel");
  document.querySelector(".cv").style.setProperty("--sheet-h", panel.offsetHeight + "px");
  if (setMargins(panelMargins()) && selected !== -2) centreOn(selected, flyZoom);
}

/* close the panel; if focus was inside it (Close, Previous / Next, the report link), hand it back
   to the canvas instead of letting it drop to the page */
function closePanel() {
  const panel = document.getElementById("panel");
  const hadFocus = panel.contains(document.activeElement);
  panel.classList.remove("open");
  panel.inert = true;
  setMargins(NO_MARGINS);
  if (hadFocus && viewer && viewer.canvas) viewer.canvas.focus();
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
  centreOn(id);
}

/* centre a dot (or the origin, id -1) in the part of the stage the visitor can see: beside the
   side panel, or above the phone's bottom sheet (see setMargins). zoom, when given, is in
   whole-stage terms, so a deep link shows the dots at the same size with or without the panel */
function centreOn(id, zoom) {
  if (!tiledImage || !D) return;
  const vp = viewer.viewport;
  const p = id === -1 ? D.origin : [D.x[id], D.y[id]];
  if (!p) return;
  flyZoom = zoom || null;                  // remembered until the animation finishes (syncPanel)
  if (zoom) {
    const w = vp.getContainerSize().x;
    vp.zoomTo(zoom * w / Math.max(1, w - margins.left - margins.right), null, reduceMotion);
  }
  vp.panTo(tiledImage.imageToViewportCoordinates(new OpenSeadragon.Point(p[0], p[1])), reduceMotion);
  vp.applyConstraints(reduceMotion);
}

/* fly to a dot: zoom in and centre it (used by deep-links) */
function goToDot(id) {
  centreOn(id, LINK_ZOOM);
}

/* While the comment panel is open, OpenSeadragon is told the strip under it is covered
   (viewport margins), so it centres and constrains the canvas to the uncovered area: a selected dot
   is centred where it can be seen, even one at the canvas's edge. Changing the margins keeps the
   picture exactly where it is on screen; only a following centreOn() moves it. */
const NO_MARGINS = { left: 0, top: 0, right: 0, bottom: 0 };
let margins = NO_MARGINS;

function panelMargins() {
  const panel = document.getElementById("panel");
  if (!panel.classList.contains("open")) return NO_MARGINS;
  // layout sizes, not the sliding transform: phones get a bottom sheet, wider screens a side panel
  return panel.offsetTop > 0
    ? { left: 0, top: 0, right: 0, bottom: panel.offsetHeight }
    : { left: 0, top: 0, right: panel.offsetWidth, bottom: 0 };
}

let flyZoom = null;                        // a deep link's zoom while it is still animating

/* returns true when the margins changed */
function setMargins(m) {
  if (!viewer || !viewer.viewport) return false;
  if (m.left === margins.left && m.top === margins.top &&
      m.right === margins.right && m.bottom === margins.bottom) return false;   // don't stop a fly-to
  const vp = viewer.viewport, size = vp.getContainerSize();
  const tl = vp.pointFromPixel(new OpenSeadragon.Point(m.left, m.top), true);
  const br = vp.pointFromPixel(new OpenSeadragon.Point(size.x - m.right, size.y - m.bottom), true);
  vp.setMargins(m);
  vp.fitBounds(new OpenSeadragon.Rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y), true);
  margins = m;
  return true;
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
  document.getElementById("cerror-retry").onclick = retryLoad;
  document.getElementById("cprev").onclick = () => switchCanvas(canvas - 1);
  document.getElementById("cnext").onclick = () => switchCanvas(canvas + 1);
  document.getElementById("p-prev").onclick = () => step(-1);
  document.getElementById("p-next").onclick = () => step(1);
  document.getElementById("p-close").onclick = () => {
    closePanel();
    selected = -2; draw();
  };
}
