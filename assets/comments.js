"use strict";
const PAGE = 200;
const results = document.getElementById("results");
const statusEl = document.getElementById("status");
const moreBtn = document.getElementById("more");
const countEl = document.getElementById("count");
const qEl = document.getElementById("q");

let DATA = [];        // [{comment, lc}]
let matches = [];     // current filtered indices
let shown = 0;
let query = "";
let dotOf = null;     // comment index -> dot index on its canvas (-1 if it has no dot)
let canvasOf = null;  // comment index -> canvas number (1, 2, ...)
const CANVASES = [1, 2];
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

function recompute() {
  const q = query;
  matches = [];
  for (let i = 0; i < DATA.length; i++) {
    if (q && DATA[i].lc.indexOf(q) === -1) continue;
    matches.push(i);
  }
  shown = 0;
  results.innerHTML = "";
  countEl.textContent = matches.length.toLocaleString() + " of " +
    DATA.length.toLocaleString();
  if (matches.length === 0) {
    statusEl.hidden = false;
    statusEl.textContent = "No comments match.";
    moreBtn.hidden = true;
    return;
  }
  statusEl.hidden = true;
  renderMore();
}

function renderMore() {
  const frag = document.createDocumentFragment();
  const end = Math.min(shown + PAGE, matches.length);
  for (let k = shown; k < end; k++) {
    const d = DATA[matches[k]];
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = '<div class="text">' + highlight(d.comment, query) + "</div>";
    const ci = matches[k];
    if (dotOf && ci < dotOf.length && dotOf[ci] >= 0) {
      const a = document.createElement("a");
      a.className = "loc";
      a.href = "canvas.html?c=" + canvasOf[ci] + "&dot=" + dotOf[ci];
      a.textContent = "Find this dot on canvas " + canvasOf[ci] + " →";
      li.appendChild(a);
      const href = changeFormHref(canvasOf[ci], dotOf[ci], ci);
      if (href) {
        const r = document.createElement("a");
        r.className = "loc req";
        r.href = href; r.target = "_blank"; r.rel = "noopener";
        r.textContent = "Your comment? Request a change";
        li.appendChild(r);
      }
    }
    frag.appendChild(li);
  }
  results.appendChild(frag);
  shown = end;
  moreBtn.hidden = shown >= matches.length;
}

let t = null;
qEl.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(() => { query = qEl.value.trim().toLowerCase(); recompute(); }, 150);
});
moreBtn.addEventListener("click", renderMore);

// Seed the box from ?q= so the front-page "Search for your comment" hands off here.
const initialQ = new URLSearchParams(location.search).get("q");
if (initialQ) qEl.value = initialQ;

// Which comments have a painted dot, and on which canvas (for "find this dot" links).
// Small files; they load well before the big comments.json below.
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
    if (DATA.length) recompute();   // re-render with links if results already shown
  });

fetch("comments.json")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((arr) => {
    DATA = arr.map((d) => ({ comment: d.comment, lc: d.comment.toLowerCase() }));
    query = qEl.value.trim().toLowerCase();
    recompute();
  })
  .catch(() => {
    countEl.textContent = "";
    statusEl.textContent = "Couldn't load comments.";
  });
