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
let dotOf = null;     // comment index -> dot index on canvas1 (-1 if not on the canvas)

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
      a.href = "canvas.html?dot=" + dotOf[ci];
      a.textContent = "Find this dot on the canvas →";
      li.appendChild(a);
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

// Which comments have a painted dot on the canvas (for "find this dot" links).
// Small file; loads well before the big comments.json below.
fetch("images/canvas1/dots.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    if (!d || !d.ci) return;
    let max = 0;
    for (const c of d.ci) if (c > max) max = c;
    dotOf = new Int32Array(max + 1).fill(-1);
    for (let i = 0; i < d.ci.length; i++) dotOf[d.ci[i]] = i;
    if (DATA.length) recompute();   // re-render with links if results already shown
  })
  .catch(() => {});

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
