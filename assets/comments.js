"use strict";
const PAGE = 200;
const results = document.getElementById("results");
const statusEl = document.getElementById("status");
const moreBtn = document.getElementById("more");
const retryBtn = document.getElementById("retry");
const countEl = document.getElementById("count");
const qEl = document.getElementById("q");

let DATA = [];        // [{comment, lc}], in comments.json order (array index = ci)
let matches = [];     // indices into DATA that match the query
let shown = 0;        // results rendered so far
let limit = PAGE;     // results the visitor has asked to see ("Show more" adds a page)
let query = "";
let loaded = false;   // the whole of comments.json has arrived
let failed = false;   // the download stopped (network); what arrived stays searchable
let dotOf = null;     // comment index -> dot index on its canvas (-1 if it has no dot)
let canvasOf = null;  // comment index -> canvas number (1, 2, ...)
const CANVASES = [1, 2, 3];
// Same Google Form as CHANGE_FORM in canvas.js (keep in sync); hidden while url is "".
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

const esc = (s) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fmt = (n) => n.toLocaleString("en-US");

function highlight(text, q) {
  let html = esc(text);
  if (q) {
    const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    html = html.replace(re, "<mark>$1</mark>");
  }
  // style redaction tokens
  return html.replace(/\[(name|handle|email|link|phone)\]/g,
    '<span class="redacted">[$1]</span>');
}

/* the count line (a live region: aria-busy holds announcements until the download finishes) */
function updateCount() {
  if (loaded) countEl.textContent = fmt(matches.length) + " of " + fmt(DATA.length);
  else if (failed) countEl.textContent = fmt(matches.length) + " in the first " + fmt(DATA.length);
  else if (!DATA.length) countEl.textContent = "loading…";
  else if (query) countEl.textContent = fmt(matches.length) + " found in the first " + fmt(DATA.length) + "…";
  else countEl.textContent = fmt(DATA.length) + " loaded…";
}

/* the line under the results: searching, nothing found, or the download stopped */
function updateStatus() {
  retryBtn.hidden = !failed;
  if (failed) {
    statusEl.hidden = false;
    statusEl.textContent = DATA.length
      ? "Only some of the comments loaded. Check your connection and try again."
      : "The comments didn't load. Check your connection and try again.";
  } else if (matches.length === 0) {
    statusEl.hidden = false;
    statusEl.textContent = loaded ? "No comments match." : (query ? "Searching…" : "Loading comments…");
  } else {
    statusEl.hidden = true;
  }
}

/* render matches up to the current limit; called as more comments arrive and on "Show more" */
function fill() {
  const end = Math.min(limit, matches.length);
  if (end > shown) {
    const frag = document.createDocumentFragment();
    for (let k = shown; k < end; k++) frag.appendChild(item(matches[k]));
    results.appendChild(frag);
    shown = end;
  }
  moreBtn.hidden = shown >= matches.length;
  updateStatus();
}

function item(ci) {
  const li = document.createElement("li");
  li.className = "item";
  li.innerHTML = '<div class="text">' + highlight(DATA[ci].comment, query) + "</div>";
  if (dotOf && ci < dotOf.length && dotOf[ci] >= 0) {
    const links = document.createElement("div");   // a wrapping row: the links line up on phones
    links.className = "locs";
    const a = document.createElement("a");
    a.className = "loc";
    a.href = "canvas.html?c=" + canvasOf[ci] + "&dot=" + dotOf[ci];
    a.textContent = "Find this dot on canvas " + canvasOf[ci] + " →";
    links.appendChild(a);
    const href = changeFormHref(canvasOf[ci], dotOf[ci], ci);
    if (href) {
      const r = document.createElement("a");
      r.className = "loc req";
      r.href = href; r.target = "_blank"; r.rel = "noopener";
      r.textContent = "Your comment? Request a change";
      links.appendChild(r);
    }
    li.appendChild(links);
  }
  return li;
}

/* a new query: search everything that has arrived so far, from the top */
function recompute() {
  matches = [];
  for (let i = 0; i < DATA.length; i++) {
    if (query && DATA[i].lc.indexOf(query) === -1) continue;
    matches.push(i);
  }
  shown = 0;
  limit = PAGE;
  results.innerHTML = "";
  updateCount();
  fill();
}

/* more comments arrived: match only the new ones and append, keeping what's on screen */
function addComments(recs) {
  const start = DATA.length;
  for (const d of recs) DATA.push({ comment: d.comment, lc: d.comment.toLowerCase() });
  for (let i = start; i < DATA.length; i++) {
    if (query && DATA[i].lc.indexOf(query) === -1) continue;
    matches.push(i);
  }
  updateCount();
  fill();
}

let t = null;
qEl.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(() => { query = qEl.value.trim().toLowerCase(); recompute(); }, 150);
});
moreBtn.addEventListener("click", () => { limit += PAGE; fill(); });
retryBtn.addEventListener("click", () => { DATA = []; recompute(); load(); });

// Seed the box from ?q= so the front-page "Search for your comment" hands off here.
const initialQ = new URLSearchParams(location.search).get("q");
if (initialQ) qEl.value = initialQ;
query = qEl.value.trim().toLowerCase();

// Which comments have a painted dot, and on which canvas (for "find this dot" links).
// Small files; they load well before most of comments.json below.
Promise.all(CANVASES.map((c) =>
  fetch("images/canvas" + c + "/dots.json")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)))
  .then((list) => {
    let max = -1;
    for (const d of list) if (d && d.ci) for (const c of d.ci) if (c > max) max = c;
    if (max < 0) return;
    dotOf = new Int32Array(max + 1).fill(-1);
    canvasOf = new Uint8Array(max + 1);
    list.forEach((d, n) => {
      if (!d || !d.ci) return;
      for (let i = 0; i < d.ci.length; i++) { dotOf[d.ci[i]] = i; canvasOf[d.ci[i]] = CANVASES[n]; }
    });
    if (shown) { results.innerHTML = ""; shown = 0; fill(); }   // re-render with the links
  });

/* comments.json is ~10 MB (~3 MB over the wire). Read it as it downloads: each record is matched
   and shown as soon as it arrives, so the first results appear long before the end of the file.
   The file is one JSON array of flat {comment, category:[...]} objects; the scanner below only
   tracks strings and nesting depth to find where each object ends, then JSON.parses that slice. */
async function streamComments(url, onRecords) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  if (!res.body || typeof TextDecoderStream === "undefined") {   // old browsers: all at once
    onRecords(await res.json());
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", pos = 0, start = -1, depth = 0, inStr = false, escaped = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const out = [];
    for (let i = pos; i < buf.length; i++) {
      const ch = buf.charCodeAt(i);
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === 92) escaped = true;            // backslash
        else if (ch === 34) inStr = false;             // closing quote
      } else if (ch === 34) {
        inStr = true;
      } else if (ch === 123 || ch === 91) {            // { or [
        depth++;
        if (depth === 2 && ch === 123) start = i;      // a record starts
      } else if (ch === 125 || ch === 93) {            // } or ]
        if (depth === 2 && ch === 125) { out.push(JSON.parse(buf.slice(start, i + 1))); start = -1; }
        depth--;
      }
    }
    // keep only the record still being received
    if (start >= 0) { buf = buf.slice(start); start = 0; } else buf = "";
    pos = buf.length;
    if (out.length) onRecords(out);
  }
}

function load() {
  loaded = false; failed = false;
  countEl.setAttribute("aria-busy", "true");
  updateCount(); updateStatus();
  streamComments("comments.json", addComments)
    .then(() => { loaded = true; })
    .catch(() => { failed = true; })
    .finally(() => {
      countEl.setAttribute("aria-busy", "false");
      updateCount(); updateStatus();
    });
}
load();
