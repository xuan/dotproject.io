"use strict";
const PAGE = 200;
const results = document.getElementById("results");
const statusEl = document.getElementById("status");
const moreBtn = document.getElementById("more");
const countEl = document.getElementById("count");
const qEl = document.getElementById("q");

let DATA = [];        // [{comment, category:[...], lc}]
let matches = [];     // current filtered indices
let shown = 0;
let query = "";
const activeFilters = new Set();

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

function badges(cat) {
  const out = [];
  if (cat.includes("UNDERAGE")) out.push('<span class="badge under">Underage</span>');
  if (cat.includes("ADULT")) out.push('<span class="badge adult">Adult</span>');
  if (cat.includes("UNDETERMINED")) out.push('<span class="badge">Undetermined</span>');
  if (cat.includes("INCEST")) out.push('<span class="badge inc">Family member</span>');
  return out.join("");
}

function passesFilter(cat) {
  if (activeFilters.size === 0) return true;
  for (const f of activeFilters) if (!cat.includes(f)) return false;
  return true;
}

function recompute() {
  const q = query;
  matches = [];
  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i];
    if (!passesFilter(d.category)) continue;
    if (q && d.lc.indexOf(q) === -1) continue;
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
    li.innerHTML = '<div class="text">' + highlight(d.comment, query) +
      '</div><div class="badges">' + badges(d.category) + "</div>";
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
document.getElementById("filters").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const f = b.dataset.f;
  if (activeFilters.has(f)) { activeFilters.delete(f); b.setAttribute("aria-pressed", "false"); }
  else { activeFilters.add(f); b.setAttribute("aria-pressed", "true"); }
  recompute();
});
moreBtn.addEventListener("click", renderMore);

fetch("comments.json")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((arr) => {
    DATA = arr.map((d) => ({ comment: d.comment, category: d.category,
                             lc: d.comment.toLowerCase() }));
    recompute();
  })
  .catch(() => {
    countEl.textContent = "";
    statusEl.textContent = "Couldn't load comments.";
  });
