"use strict";
/* ==========================================================
   PC & Laptop Troubleshooting Field Guide — script.js
   Part 1: application core (rendering, search, modal, checklists)
   Part 2: original SVG illustration generators (ART)
   Part 3: troubleshooting content (PROBLEMS)
   ========================================================== */

const PROBLEMS = [];
const ART = {};

const CATS = {
  common:   { name: "Common Problems",     letter: "A" },
  hardware: { name: "Critical Hardware",   letter: "B" },
  boot:     { name: "Boot & BIOS",         letter: "C" },
  display:  { name: "Display & POST",      letter: "D" },
  psu:      { name: "Power Supply",        letter: "E" }
};
const LEVELS = { "Beginner": "beginner", "Intermediate": "intermediate", "Advanced": "advanced", "Technician Only": "tech" };
const BY_ID = {};

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const getDone = id => { const v = store.get("pcg:" + id); return Array.isArray(v) ? v : []; };
const setDone = (id, arr) => store.set("pcg:" + id, arr);
const levelBadge = lv => `<span class="badge lvl-${LEVELS[lv] || "beginner"}">${esc(lv)}</span>`;

const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3L2 21h20L12 3z"/><path d="M12 10v5M12 18.2v.1"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

/* ---------- search engine ---------- */
const STOP = new Set(["the", "a", "an", "my", "is", "are", "to", "of", "and", "or", "in", "on", "it", "i", "do", "doe", "why", "how", "what", "when", "with", "for", "this", "that", "over", "me", "can", "not", "get", "got", "ha", "have", "be"]);
function norm(s) { return String(s).toLowerCase().replace(/[\u2019\u2018`]/g, "'").replace(/'/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function stem(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|os|is)$/.test(w)) return w.slice(0, -1);
  return w;
}
function stemText(s) { return " " + norm(s).split(" ").filter(Boolean).map(stem).join(" ") + " "; }

const SYN_GROUPS = [
  ["restart", "reboot", "loop", "cycle"],
  ["display", "screen", "monitor", "video", "signal", "image", "picture"],
  ["turn", "power", "start", "dead", "boot", "startup"],
  ["ram", "memory", "dimm", "ddr"],
  ["hot", "overheat", "heat", "temperature", "thermal", "temp", "cooling"],
  ["cmos", "bios", "uefi", "battery", "clock"],
  ["psu", "supply"],
  ["shut", "off", "die", "shutdown"],
  ["beep", "sound", "noise", "buzzer", "speaker"],
  ["gpu", "graphic", "card", "artifact", "vga"],
  ["network", "pxe", "dhcp", "ethernet", "lan"],
  ["crash", "freeze", "hang", "bsod", "blue"]
];
const SYN = {};
SYN_GROUPS.forEach(g => {
  const st = g.map(stem);
  st.forEach(w => { SYN[w] = Array.from(new Set([...(SYN[w] || []), ...st.filter(x => x !== w)])); });
});

function buildIndex(p) {
  const f = [];
  const add = (arr, w) => arr.forEach(t => f.push({ w, s: stemText(t) }));
  add([p.title], 6); add(p.err || [], 6); add(p.kw || [], 5); add([p.blurb], 2);
  add(p.see || [], 3); add(p.causes || [], 1.5); add((p.steps || []).map(s => s[0] + " " + s[1]), 0.8); add([p.means || ""], 1);
  if (p.extra) add(p.extra.map(e => e.h + " " + (e.p || []).join(" ")), 1);
  p._f = f;
}
function scoreProblem(p, q) {
  const qs = stemText(q).trim();
  const toks = qs.split(" ").filter(t => t && !STOP.has(t));
  if (!toks.length) return 0;
  let sc = 0, hits = 0;
  p._f.forEach(f => { if (f.s.includes(" " + qs)) sc += f.w * 4; });
  toks.forEach(t => {
    let hit = false;
    p._f.forEach(f => {
      if (f.s.includes(" " + t)) { sc += f.w; hit = true; }
      else (SYN[t] || []).forEach(sy => { if (f.s.includes(" " + sy + " ") || f.s.includes(" " + sy)) { sc += f.w * 0.25; hit = true; } });
    });
    if (hit) hits++;
  });
  return hits >= Math.ceil(toks.length / 2) ? sc : 0;
}

/* ---------- state ---------- */
const state = { cat: "all", q: "", lastFocus: null, openId: null };

/* ---------- rendering: cards ---------- */
const artHTML = p => (ART[p.art] ? ART[p.art]() : "");

function cardHTML(p) {
  const done = getDone(p.id).length, total = p.steps.length;
  return `<article class="card" tabindex="0" role="button" data-id="${p.id}" aria-label="Open solution: ${esc(p.title)}">
    <div class="card-art" aria-hidden="true">${artHTML(p)}<span class="card-code">${p.code}</span></div>
    <div class="card-body">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.blurb)}</p>
      <div class="card-prog-text ${done ? "show" : ""}" data-pt="${p.id}">${done} of ${total} steps done</div>
      <div class="card-progress ${done ? "show" : ""}" data-pb="${p.id}"><i style="width:${Math.round(done / total * 100)}%"></i></div>
      <div class="card-foot">${levelBadge(p.level)}<span class="card-cta">View solution <span aria-hidden="true">&rarr;</span></span></div>
    </div>
  </article>`;
}

function refreshCardProgress(p) {
  const done = getDone(p.id).length, total = p.steps.length;
  const pt = $(`[data-pt="${p.id}"]`), pb = $(`[data-pb="${p.id}"]`);
  if (pt) { pt.textContent = `${done} of ${total} steps done`; pt.classList.toggle("show", done > 0); }
  if (pb) { pb.classList.toggle("show", done > 0); $("i", pb).style.width = Math.round(done / total * 100) + "%"; }
  updateStats();
}
function updateStats() {
  $("#statTopics").textContent = PROBLEMS.length;
  $("#statSteps").textContent = PROBLEMS.reduce((n, p) => n + p.steps.length, 0);
  $("#statDone").textContent = PROBLEMS.reduce((n, p) => n + getDone(p.id).length, 0);
}

function updateFilterCounts(validMatches) {
  const elAll = $('[data-filter-count="all"]');
  if (elAll) elAll.textContent = validMatches.length;

  Object.keys(CATS).forEach(cat => {
    const count = validMatches.filter(p => p.cat === cat).length;
    const elCat = $(`[data-filter-count="${cat}"]`);
    if (elCat) elCat.textContent = count;
  });
}

function applyFilters() {
  const q = state.q.trim();
  let validMatches = PROBLEMS;

  if (q) {
    const scored = PROBLEMS.map(p => ({ p, s: scoreProblem(p, q) })).filter(x => x.s > 0);
    const maxScore = Math.max(0, ...scored.map(x => x.s));
    validMatches = scored.filter(x => x.s >= maxScore * 0.18).sort((a, b) => b.s - a.s).map(x => x.p);
  }

  /* Dynamic updates to the filter button numbers */
  updateFilterCounts(validMatches);

  let totalShown = 0;

  Object.keys(CATS).forEach(cat => {
    const sec = $("#" + cat), grid = $("#grid-" + cat);
    let list = validMatches.filter(p => p.cat === cat);

    if (state.cat !== "all" && state.cat !== cat) {
      list = [];
    }

    grid.innerHTML = list.map(cardHTML).join("");
    sec.hidden = list.length === 0;
    $(`[data-count="${cat}"]`).textContent = list.length + (list.length === 1 ? " topic" : " topics");
    totalShown += list.length;
  });

  $("#noResults").hidden = totalShown > 0;
  const info = $("#resultInfo");
  if (q) {
    info.innerHTML = totalShown
      ? `Showing <b>${totalShown}</b> of ${PROBLEMS.length} topics matching “${esc(q)}”`
      : `No topics match “${esc(q)}”.`;
  } else {
    info.innerHTML = state.cat === "all"
      ? `Showing all <b>${PROBLEMS.length}</b> troubleshooting topics. Select any card for the full solution.`
      : `Showing <b>${totalShown}</b> topics in ${esc(CATS[state.cat].name)}.`;
  }
  $("#searchClear").classList.toggle("show", !!state.q);
}

function buildFilters() {
  const box = $("#filters");
  const mk = (key, label, n) => `<button type="button" class="filter-btn" data-cat="${key}" aria-pressed="${state.cat === key}">${esc(label)} <span class="count" data-filter-count="${key}">${n}</span></button>`;
  box.innerHTML = mk("all", "All Topics", PROBLEMS.length) + Object.keys(CATS).map(k => mk(k, CATS[k].name, PROBLEMS.filter(p => p.cat === k).length)).join("");
}

function setCategory(cat) {
  state.cat = cat;
  $$(".filter-btn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
  applyFilters();
}

function setQuery(q, focus) {
  state.q = q;
  const input = $("#searchInput");
  if (input.value !== q) input.value = q;
  applyFilters();
  if (focus) input.focus();
}

/* ---------- modal ---------- */
function stepsHTML(p) {
  const done = getDone(p.id);
  return p.steps.map((s, i) => `<li><label class="step"><input type="checkbox" data-i="${i}" ${done.includes(i) ? "checked" : ""}><span class="box"><span class="num">${i + 1}</span>${ICON_CHECK}</span><span class="txt"><b>${fmt(s[0])}${s[2] ? levelBadge(s[2]) : ""}</b><span>${fmt(s[1])}</span></span></label></li>`).join("");
}
function listSec(cls, title, arr) {
  if (!arr || !arr.length) return "";
  return `<section class="m-sec ${cls}"><h3>${title}</h3><ul>${arr.map(x => `<li>${fmt(x)}</li>`).join("")}</ul></section>`;
}
function modalHTML(p) {
  const total = p.steps.length, done = getDone(p.id).length;
  const warn = p.warn ? `<div class="warn-box" role="alert">${ICON_WARN}<div><b>${esc(p.warn.t)}</b>${(Array.isArray(p.warn.d) ? p.warn.d : [p.warn.d]).map(d => `<span>${fmt(d)}</span>`).join("")}</div></div>` : "";
  const banner = p.banner ? `<div class="tech-banner">${esc(p.banner)}</div>` : "";
  const extra = (p.extra || []).map(e => `<section class="m-sec extra ${e.tech ? "tech" : ""}"><h3>${esc(e.h)}</h3>${(e.p || []).map(t => `<p>${fmt(t)}</p>`).join("")}${e.ul ? `<ul>${e.ul.map(x => `<li>${fmt(x)}</li>`).join("")}</ul>` : ""}${e.link ? `<button type="button" class="link-btn" data-open="${e.link[0]}">${esc(e.link[1])}</button>` : ""}</section>`).join("");
  const related = (p.related || []).filter(id => BY_ID[id]).map(id => `<button type="button" data-open="${id}">${esc(BY_ID[id].title)}</button>`).join("");
  return `
    <figure class="m-art">${artHTML(p)}<figcaption><b>What it looks like</b>${esc(p.caption || "")}</figcaption></figure>
    <div class="m-meta">${levelBadge(p.level)}<span class="badge" style="color:var(--pink);border-color:var(--line-strong)">${esc(CATS[p.cat].name)}</span>${p.scope ? `<span class="scope">${esc(p.scope)}</span>` : ""}</div>
    ${banner}${warn}
    <div class="m-pad">
      ${listSec("see", "What you see", p.see)}
      <section class="m-sec"><h3>What it means</h3><p>${fmt(p.means)}</p></section>
      ${listSec("cause", "Possible causes", p.causes)}
      ${extra}
      <section class="m-sec">
        <h3>Step-by-step troubleshooting</h3>
        <div class="check-head">
          <div class="progress-wrap">
            <div class="progress-label"><span>Your progress</span><span><b id="progCount">${done}</b> of ${total} steps completed</span></div>
            <div class="progress ${done === total ? "done" : ""}" id="progBar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="Checklist progress"><i style="width:${Math.round(done / total * 100)}%"></i></div>
          </div>
          <button type="button" class="clear-btn" id="clearChecklist">Clear checklist</button>
        </div>
        <ul class="steps" id="stepList">${stepsHTML(p)}</ul>
      </section>
      ${listSec("dont", "What you should NOT do", p.dont)}
      ${listSec("call", "When to contact a technician", p.call)}
      ${related ? `<section class="m-sec"><h3>Related topics</h3><div class="related">${related}</div></section>` : ""}
    </div>
    <div class="m-foot"><span>Press <b style="color:#fff">Esc</b> to close. Your checklist is saved on this device.</span><button type="button" class="link-btn" data-close="1">Close panel</button></div>`;
}
function updateModalProgress(p) {
  const total = p.steps.length, n = getDone(p.id).length;
  $("#progCount").textContent = n;
  const bar = $("#progBar");
  bar.setAttribute("aria-valuenow", n);
  bar.classList.toggle("done", n === total);
  $("i", bar).style.width = Math.round(n / total * 100) + "%";
  refreshCardProgress(p);
}
function openModal(id, trigger) {
  const p = BY_ID[id];
  if (!p) return;
  const modal = $("#modal");
  if (!modal.classList.contains("open")) state.lastFocus = trigger || document.activeElement;
  state.openId = id;
  $("#modalCode").textContent = `${p.code}  /  ${CATS[p.cat].name.toUpperCase()}`;
  $("#modalTitle").textContent = p.title;
  $("#modalBody").innerHTML = modalHTML(p);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  modal.scrollTop = 0;
  $("#modalPanel").scrollTop = 0;
  $("#modalPanel").focus({ preventScroll: true });
}
function closeModal() {
  const modal = $("#modal");
  if (!modal.classList.contains("open")) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.openId = null;
  if (state.lastFocus && document.contains(state.lastFocus) && typeof state.lastFocus.focus === "function") state.lastFocus.focus({ preventScroll: true });
}

/* ---------- navigation ---------- */
function goToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.hidden) { state.q = ""; $("#searchInput").value = ""; setCategory("all"); }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  try { history.replaceState(null, "", "#" + id); } catch (e) { /* ignore */ }
}
function setupNav() {
  const toggle = $("#navToggle"), nav = $("#mainNav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const id = a.getAttribute("href").slice(1);
    if (!id) return;
    e.preventDefault();
    if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" }); else goToSection(id);
    nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false");
  }));
  if ("IntersectionObserver" in window) {
    const links = $$(".main-nav a");
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) links.forEach(l => l.classList.toggle("active", l.dataset.sec === en.target.id));
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    $$(".topic-section, #audit").forEach(s => io.observe(s));
  }
}

/* ---------- init ---------- */
function init() {
  const counts = {};
  PROBLEMS.forEach(p => {
    counts[p.cat] = (counts[p.cat] || 0) + 1;
    p.code = CATS[p.cat].letter + "-" + String(counts[p.cat]).padStart(2, "0");
    BY_ID[p.id] = p;
    buildIndex(p);
  });
  buildFilters();
  applyFilters();
  updateStats();
  setupNav();

  const input = $("#searchInput");
  let timer;
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => setQuery(input.value), 120); });
  input.addEventListener("keydown", e => { if (e.key === "Escape" && input.value) { setQuery(""); } });
  $("#searchClear").addEventListener("click", () => setQuery("", true));
  $("#resetSearch").addEventListener("click", () => { state.cat = "all"; setCategory("all"); setQuery("", true); });
  $$(".chip").forEach(c => c.addEventListener("click", () => { setQuery(c.dataset.q); input.scrollIntoView({ behavior: "smooth", block: "center" }); }));
  $("#filters").addEventListener("click", e => { const b = e.target.closest(".filter-btn"); if (b) setCategory(b.dataset.cat); });

  /* cards */
  const main = $("#main");
  main.addEventListener("click", e => {
    const open = e.target.closest("[data-open]");
    if (open) { openModal(open.dataset.open, open); return; }
    const card = e.target.closest(".card");
    if (card) openModal(card.dataset.id, card);
  });
  main.addEventListener("keydown", e => {
    const card = e.target.closest(".card");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openModal(card.dataset.id, card); }
  });

  /* modal */
  const modal = $("#modal");
  $("#modalClose").addEventListener("click", closeModal);
  modal.addEventListener("mousedown", e => { if (e.target === modal) closeModal(); });
  modal.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    const o = e.target.closest("[data-open]");
    if (o) { openModal(o.dataset.open); return; }
    if (e.target.closest("#clearChecklist")) {
      const p = BY_ID[state.openId]; setDone(p.id, []);
      $$("#stepList input").forEach(i => { i.checked = false; });
      updateModalProgress(p);
    }
  });
  modal.addEventListener("change", e => {
    if (!e.target.matches("#stepList input")) return;
    const p = BY_ID[state.openId];
    const arr = $$("#stepList input").filter(i => i.checked).map(i => Number(i.dataset.i));
    setDone(p.id, arr);
    updateModalProgress(p);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("open")) { e.preventDefault(); closeModal(); return; }
    if (e.key === "Tab" && modal.classList.contains("open")) {
      const f = $$('button, [href], input, [tabindex]:not([tabindex="-1"])', modal).filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $("#modalPanel"))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === "/" && !modal.classList.contains("open") && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

/* ==========================================================
   PART 2 — ORIGINAL SVG ILLUSTRATIONS (generated, no external images)
   ========================================================== */
const svg = (label, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300" role="img" aria-label="${esc(label)}"><rect width="640" height="300" fill="url(#bgArt)"/><rect width="640" height="300" fill="url(#gridArt)"/>${inner}</svg>`;
const tx = (x, y, s, fill, t, a = "") => `<text x="${x}" y="${y}" font-size="${s}" fill="${fill}" ${a}>${t}</text>`;
const mt = (x, y, s, fill, t, a = "") => `<text class="mono" x="${x}" y="${y}" font-size="${s}" fill="${fill}" ${a}>${t}</text>`;
const ML = (arr, x, y, s = 12, fill = "#eaeaea", lh) => arr.map((t, i) => mt(x, y + i * (lh || s * 1.55), s, fill, t)).join("");
const pill = (x, y, t, c = "#ff6b9d", s = 11) => { const w = Math.round(t.length * s * 0.58 + 18); return `<rect x="${x}" y="${y - s - 4}" width="${w}" height="${s + 10}" rx="${(s + 10) / 2}" fill="#12060a" stroke="${c}" stroke-opacity=".75"/><text x="${x + w / 2}" y="${y}" font-size="${s}" font-weight="700" fill="${c}" text-anchor="middle">${t}</text>`; };
const fan = (cx, cy, r, spin, col = "#8a7a80") => {
  let b = "";
  for (let i = 0; i < 5; i++) b += `<ellipse cx="${cx}" cy="${cy - r * 0.52}" rx="${(r * 0.24).toFixed(1)}" ry="${(r * 0.46).toFixed(1)}" transform="rotate(${i * 72} ${cx} ${cy})" fill="${col}" opacity=".85"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d0709" stroke="${col}" stroke-opacity=".55"/><g class="${spin ? "spin" : ""}">${b}<circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" fill="#26181d"/></g>`;
};
/* monitor: (x,y) = desired top-left of bezel, s = scale. Screen area in local coords: x134..506, y28..242 */
const mon = (inner, o = {}) => {
  const s = o.s || 1, x = o.x === undefined ? 120 : o.x, y = o.y === undefined ? 14 : o.y;
  return `<g transform="translate(${x - 120 * s} ${y - 14 * s}) scale(${s})"><rect x="120" y="14" width="400" height="250" rx="12" fill="#1a1215" stroke="#4a1f2a" stroke-width="2"/><rect x="134" y="28" width="372" height="214" rx="3" fill="${o.bg || "#000"}"/>${inner}<rect x="134" y="28" width="372" height="214" rx="3" fill="url(#glare)"/><circle cx="320" cy="254" r="3.2" fill="${o.led || "#4a4a50"}" class="${o.ledClass || ""}"/><path d="M300 264h40l8 22h-56z" fill="#22141a"/><rect x="262" y="284" width="116" height="8" rx="4" fill="#2c1820"/></g>`;
};
/* desktop tower (120x210) with side window; options: on, rgb, led, ledClass, ramColor, spin */
const tower = (x, y, o = {}) => {
  const on = o.on !== false, spin = on && o.spin !== false, g = on ? o.rgb : null;
  const led = o.led || "#3a3a40";
  return `<g transform="translate(${x} ${y})"><rect width="120" height="210" rx="8" fill="url(#caseG)" stroke="#4a1f2a" stroke-width="2"/><rect x="10" y="26" width="100" height="130" rx="4" fill="#0a0507" stroke="#2c1118"/>${g ? `<rect x="10" y="26" width="100" height="130" rx="4" fill="${g}" opacity=".13"/>` : ""}${fan(46, 66, 22, spin, g || "#8a7a80")}${[0, 1, 2].map(i => `<rect x="${80 + i * 8}" y="40" width="5" height="52" rx="1" fill="${o.ramColor || "#5a5560"}"/>`).join("")}<rect x="18" y="108" width="84" height="22" rx="3" fill="#1b1316" stroke="${g || "#4a3a40"}" stroke-opacity=".6"/>${fan(38, 119, 8, spin, g || "#8a7a80")}${fan(66, 119, 8, spin, g || "#8a7a80")}<rect x="86" y="113" width="10" height="12" fill="#2a2a2f"/><rect x="18" y="138" width="84" height="6" rx="2" fill="#24161b"/><rect x="10" y="164" width="100" height="36" rx="3" fill="#120a0d" stroke="#2c1118"/>${fan(60, 182, 13, spin, "#7a6a70")}<circle cx="20" cy="13" r="5.5" fill="#1a1215" stroke="#6a5a60"/><circle cx="40" cy="13" r="2.8" fill="${led}" class="${on ? o.ledClass || "" : ""}"/><rect x="62" y="10" width="42" height="6" rx="3" fill="#0e0709"/></g>`;
};

/* 01 Power cable / connection */
ART.powerCable = () => svg("Desktop computer with all lights off and its power plug pulled partly out of the wall outlet",
  tower(40, 48, { on: false }) +
  `<path d="M160 215 C 210 275, 300 150, 395 195" fill="none" stroke="#2b2b32" stroke-width="8" stroke-linecap="round"/><path d="M160 215 C 210 275, 300 150, 395 195" fill="none" stroke="#4a4a54" stroke-width="2" stroke-linecap="round" opacity=".6"/>
   <g transform="translate(392 178)"><rect width="50" height="34" rx="6" fill="#222228" stroke="#66666f" stroke-width="2"/><rect x="50" y="6" width="16" height="6" rx="1" fill="#c7c7cf"/><rect x="50" y="22" width="16" height="6" rx="1" fill="#c7c7cf"/></g>
   <path d="M470 195 H 508" stroke="#ff4d6d" stroke-width="3" class="dash"/>
   <rect x="510" y="95" width="100" height="130" rx="12" fill="#1d1114" stroke="#5a2431" stroke-width="2"/><rect x="540" y="130" width="9" height="26" rx="2" fill="#000"/><rect x="572" y="130" width="9" height="26" rx="2" fill="#000"/><circle cx="560" cy="185" r="7" fill="#000"/>` +
  tx(560, 250, 13, "#a1969a", "Wall outlet", 'text-anchor="middle"') + pill(414, 150, "Loose / not inserted", "#ff4d6d", 11) +
  tx(100, 282, 13, "#a1969a", "No lights  -  No fan movement  -  Nothing happens", 'text-anchor="start"') + pill(40, 34, "POWER: NONE", "#ff6b9d", 11));

/* No power at all */
ART.noPower = () => svg("Desktop PC and laptop that are both completely dead with a power button being pressed and no lights anywhere",
  tower(50, 48, { on: false }) +
  `<path d="M82 62 L 215 100" stroke="#ff6b9d" stroke-width="1.5" stroke-dasharray="4 4"/><circle cx="250" cy="125" r="38" fill="#14070a" stroke="#5a5560" stroke-width="3"/><path d="M241.5 114 A14 14 0 1 0 258.5 114" fill="none" stroke="#7a7580" stroke-width="3.2" stroke-linecap="round"/><path d="M250 107 V 123" stroke="#7a7580" stroke-width="3.2" stroke-linecap="round"/>
   <circle cx="250" cy="125" r="46" fill="none" stroke="#ff2d55" stroke-width="2" class="pulse"/>
   <rect x="390" y="62" width="190" height="122" rx="8" fill="#0b0507" stroke="#4a1f2a" stroke-width="3"/><rect x="400" y="72" width="170" height="102" rx="3" fill="#050203"/>
   <path d="M372 190 H598 L610 214 H360 Z" fill="#241419" stroke="#4a1f2a" stroke-width="2"/><rect x="450" y="196" width="80" height="10" rx="3" fill="#150b0e"/><circle cx="388" cy="202" r="3.5" fill="#3a3a40"/><circle cx="402" cy="202" r="3.5" fill="#3a3a40"/>` +
  pill(372, 238, "Charging light: OFF", "#ff6b9d", 11) + pill(206, 190, "Button pressed", "#ff6b9d", 11) +
  tx(320, 284, 13, "#a1969a", "Zero lights  -  zero fans  -  zero response", 'text-anchor="middle"'));

/* 05 Fans spin but no display */
ART.fansNoDisplay = () => svg("Desktop PC with spinning fans and RGB lighting beside a monitor displaying the message No Signal",
  tower(30, 48, { rgb: "#ff2d9a", led: "#34d399" }) +
  `<path d="M150 205 C 200 275, 290 255, 345 236" fill="none" stroke="#2b2b32" stroke-width="6" stroke-linecap="round"/>` +
  mon(`<rect x="134" y="28" width="372" height="214" fill="#070a18"/>${tx(320, 126, 30, "#ffffff", "No Signal", 'text-anchor="middle" font-weight="700"')}${tx(320, 156, 14, "#9aa0c0", "Check your video cable", 'text-anchor="middle"')}<rect x="150" y="38" width="36" height="6" rx="3" fill="#2a3060"/><circle cx="320" cy="198" r="9" fill="none" stroke="#7a82c0" stroke-width="3" stroke-dasharray="14 42" class="spin"/>`, { s: 0.78, x: 240, y: 28, led: "#fbbf24", ledClass: "blink" }) +
  pill(30, 34, "Fans + RGB: ON", "#34d399", 11) + pill(548, 256, "Screen: no image", "#ff6b9d", 10));

/* 07 Boot loop */
ART.bootLoop = () => svg("Monitor showing a manufacturer-style logo and spinner with a circular restart arrow beside it",
  mon(`<polygon points="320,66 348,82 348,114 320,130 292,114 292,82" fill="none" stroke="#ff6b9d" stroke-width="3.5"/><polygon points="320,78 338,88 338,108 320,118 302,108 302,88" fill="#ff2d55" opacity=".25"/>${tx(320, 105, 20, "#fff", "PC", 'text-anchor="middle" font-weight="800"')}${mt(320, 160, 13, "#d0d0d8", "YOUR PC BRAND", 'text-anchor="middle" letter-spacing="3"')}<circle cx="320" cy="200" r="13" fill="none" stroke="#ff6b9d" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="22 60" class="spin"/>${mt(146, 234, 10, "#6a6a72", "Press DEL or F2 for setup")}${mt(498, 234, 10, "#6a6a72", "Restart #4", 'text-anchor="end"')}`, { led: "#34d399" }) +
  `<g class="spin-slow"><path d="M578 112 A30 30 0 1 1 549 138" fill="none" stroke="#ff2d55" stroke-width="6" stroke-linecap="round"/><path d="M536 126 L551 148 L566 130 Z" fill="#ff2d55"/></g>` +
  pill(530, 214, "Restarting...", "#ff4d6d", 11) + pill(10, 150, "Stuck on logo", "#ff6b9d", 11));

/* 08 RAM not seated */
ART.ramSeated = () => {
  let slots = "";
  for (let i = 0; i < 4; i++) {
    const x = 300 + i * 36;
    slots += `<rect x="${x}" y="36" width="18" height="216" rx="3" fill="#0b0507" stroke="#3a1a22"/><rect x="${x - 2}" y="30" width="22" height="8" rx="2" fill="#b9b9c4"/><rect x="${x - 2}" y="250" width="22" height="8" rx="2" fill="#b9b9c4"/>`;
    if (i !== 2) {
      slots += `<rect x="${x + 2}" y="42" width="14" height="204" rx="2" fill="#2b2f45"/>${[0, 1, 2, 3].map(k => `<rect x="${x + 4}" y="${56 + k * 40}" width="10" height="26" rx="1" fill="#0c0c14"/>`).join("")}<rect x="${x + 2}" y="242" width="14" height="4" fill="url(#goldG)"/>`;
    }
  }
  return svg("Top view of a motherboard with one memory stick sitting crooked and not clicked into its slot, a magnified gap and a red DRAM light",
    `<rect x="20" y="14" width="450" height="272" rx="10" fill="url(#pcbG)" stroke="#4a1f2a" stroke-width="2"/>
     <path d="M180 90 H 290 M180 130 H 270 L 290 150 M180 170 H 290 M60 200 V 262 H 250" fill="none" stroke="#ff2d55" stroke-opacity=".22" stroke-width="2"/>
     <rect x="46" y="56" width="128" height="128" rx="4" fill="#120a0d" stroke="#6b2a3a" stroke-width="2"/>${fan(110, 120, 44, false, "#7a6a70")}` + tx(110, 204, 11, "#a1969a", "CPU + cooler", 'text-anchor="middle"') + slots +
    `<g transform="translate(0 -14) rotate(6 381 150)"><rect x="374" y="40" width="14" height="204" rx="2" fill="#2b2f45" stroke="#ff6b9d" stroke-width="1.5"/>${[0, 1, 2, 3].map(k => `<rect x="376" y="${56 + k * 40}" width="10" height="26" rx="1" fill="#0c0c14"/>`).join("")}<rect x="374" y="240" width="14" height="4" fill="url(#goldG)"/></g>
     <path d="M366 252 H 394" stroke="#ff2d55" stroke-width="3" class="dash"/><path d="M392 254 L 484 196" stroke="#ff6b9d" stroke-width="1.5" stroke-dasharray="4 4"/>
     <circle cx="548" cy="150" r="70" fill="#0d0508" stroke="#ff6b9d" stroke-width="2.5"/>
     <rect x="502" y="172" width="92" height="16" rx="3" fill="#0b0507" stroke="#4a1f2a"/><rect x="502" y="160" width="92" height="12" fill="#ff2d55" opacity=".3" class="pulse"/><g transform="rotate(-5 548 140)"><rect x="508" y="100" width="80" height="54" rx="2" fill="#2b2f45"/><rect x="508" y="154" width="80" height="6" fill="url(#goldG)"/></g>` +
    tx(548, 210, 13, "#ff6b9d", "GAP", 'text-anchor="middle" font-weight="800"') +
    `<circle cx="58" cy="266" r="6" fill="#ff2d55" class="blink" filter="url(#glow)"/>` + mt(72, 270, 10, "#ff6b9d", "DRAM LED stays on") + pill(478, 286, "Stick not clicked in", "#ff4d6d", 10));
};

/* 11 Faulty RAM */
ART.faultyRam = () => svg("Blue screen error reading MEMORY_MANAGEMENT next to a memory module with a damaged red chip",
  mon(`<rect x="134" y="28" width="372" height="214" fill="#0b62bd"/>${tx(152, 100, 56, "#fff", ":(")}${tx(152, 130, 13, "#fff", "Your PC ran into a problem and needs to restart.")}${tx(152, 152, 13, "#dbeafe", "We're just collecting some error info.")}${tx(152, 176, 13, "#fff", "25% complete")}<rect x="152" y="196" width="40" height="40" fill="#fff"/>${[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => ((r * 3 + c * 5 + r * c) % 3 === 0 ? `<rect x="${156 + c * 7}" y="${200 + r * 7}" width="7" height="7" fill="#0b62bd"/>` : "")).join("")).join("")}${mt(204, 212, 11, "#fff", "Stop code:")}${mt(204, 228, 12, "#fff", "MEMORY_MANAGEMENT", 'font-weight="700"')}`, { s: 0.9, x: 220, y: 14, led: "#34d399" }) +
  `<rect x="14" y="130" width="186" height="42" rx="3" fill="#262a40" stroke="#4a4f70"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${22 + i * 22}" y="138" width="16" height="24" rx="1.5" fill="#0c0c14" ${i === 5 ? 'stroke="#ff2d55" stroke-width="2"' : ""}/>`).join("")}<path d="M132 140 L148 160 M148 140 L132 160" stroke="#ff2d55" stroke-width="3" stroke-linecap="round" class="blink-slow"/><rect x="14" y="172" width="186" height="8" fill="url(#goldG)"/><rect x="104" y="172" width="5" height="8" fill="#150a0e"/><rect x="8" y="140" width="6" height="14" rx="2" fill="#b9b9c4"/><rect x="200" y="140" width="6" height="14" rx="2" fill="#b9b9c4"/>` +
  pill(14, 118, "Memory module", "#ff6b9d", 11) + pill(14, 206, "Errors detected", "#ff4d6d", 11) + pill(14, 250, "Random restarts", "#ff6b9d", 10));

/* 10 CPU overheating */
ART.cpuOverheat = () => {
  const temps = [94, 96, 98, 95];
  const bars = temps.map((t, i) => `${mt(312, 80 + i * 24, 11, "#bdb5b9", "Core " + i)}<rect x="360" y="${71 + i * 24}" width="130" height="11" rx="3" fill="#201018"/><rect x="360" y="${71 + i * 24}" width="${Math.round(130 * t / 110)}" height="11" rx="3" fill="${t > 96 ? "#ff2d55" : "#ff7a45"}"/>${mt(496, 80 + i * 24, 10, "#fff", t, 'text-anchor="end"')}`).join("");
  return svg("Hardware monitor screen showing the CPU at 98 degrees Celsius with a thermal throttling warning, a hot thermometer and a stopped fan",
    mon(`<rect x="134" y="28" width="372" height="214" fill="#0b0a10"/><rect x="134" y="28" width="372" height="22" fill="#2a0a14"/>${mt(144, 43, 11, "#ff6b9d", "HW MONITOR  -  CPU PACKAGE")}${mt(146, 72, 11, "#9a8f93", "Temperature")}${mt(144, 114, 44, "#ff2d55", "98&#176;C", 'font-weight="700"')}<rect x="144" y="124" width="150" height="62" rx="3" fill="#120810" stroke="#3a1a22"/><polyline points="148,180 170,174 190,166 210,154 232,142 252,136 272,130 290,128" fill="none" stroke="#ff2d55" stroke-width="2.5"/><path d="M148 140 H 290" stroke="#ffb020" stroke-dasharray="3 4" stroke-opacity=".7"/>${bars}<rect x="144" y="196" width="352" height="38" rx="6" fill="#4a0a18" stroke="#ff2d55" class="pulse"/><path d="M166 226 L176 206 L186 226 Z" fill="none" stroke="#ffb020" stroke-width="2" stroke-linejoin="round"/><path d="M176 212 V 219" stroke="#ffb020" stroke-width="2"/>${mt(198, 211, 12, "#fff", "THERMAL THROTTLING", 'font-weight="700"')}${mt(198, 226, 10, "#ffb4c4", "CPU speed reduced to protect the chip")}`, { led: "#ff2d55" }) +
    `<rect x="46" y="60" width="18" height="150" rx="9" fill="#220c12" stroke="#6b2a3a" stroke-width="2"/><rect x="51" y="82" width="8" height="132" rx="4" fill="#ff2d55"/><circle cx="55" cy="226" r="21" fill="#ff2d55" filter="url(#glow)"/>${[0, 1, 2, 3, 4].map(i => `<path d="M68 ${72 + i * 28} h8" stroke="#8a7a80" stroke-width="2"/>`).join("")}` + pill(24, 44, "TOO HOT", "#ff4d6d", 11) +
    fan(578, 130, 36, false, "#a33a4a") + pill(534, 196, "CPU fan stopped", "#ff4d6d", 10));
};

/* 12 Motherboard short */
ART.mbShort = () => svg("Bare motherboard on a bench with a stray screw causing a spark and burn mark near the components, and an extra standoff underneath",
  `<rect x="110" y="18" width="430" height="266" rx="10" fill="url(#pcbG)" stroke="#4a1f2a" stroke-width="2"/>
   <path d="M150 70 H 290 V 110 M300 130 H 420 M140 220 H 330 V 190 M400 180 V 250" fill="none" stroke="#ff2d55" stroke-opacity=".22" stroke-width="2"/>
   <rect x="140" y="50" width="110" height="110" rx="4" fill="#120a0d" stroke="#6b2a3a" stroke-width="2"/><rect x="160" y="70" width="70" height="70" fill="#1b1013" stroke="#4a2a34"/>${tx(195, 110, 12, "#a1969a", "CPU", 'text-anchor="middle"')}
   ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${290 + i * 24}" cy="52" r="8" fill="#26161b" stroke="#9a8f93"/>`).join("")}
   ${[0, 1, 2].map(i => `<rect x="${440 + i * 24}" y="46" width="12" height="150" rx="2" fill="#0b0507" stroke="#3a1a22"/>`).join("")}
   <rect x="150" y="236" width="200" height="12" rx="2" fill="#0b0507" stroke="#3a1a22"/>
   ${[[128, 36], [520, 36], [128, 266], [520, 266]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="none" stroke="url(#goldG)" stroke-width="3"/><circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#f6d98a"/>`).join("")}
   <ellipse cx="362" cy="166" rx="30" ry="16" fill="#000" opacity=".55" filter="url(#blur6)"/>
   <circle cx="360" cy="152" r="10" fill="url(#metalG)" stroke="#444"/><path d="M354 148 L366 156" stroke="#333" stroke-width="2.5"/>
   <polygon points="340,126 352,138 346,140 360,152 349,146 351,151 338,136 345,135" fill="#ffd54a" filter="url(#glow)" class="flick"/>
   <circle cx="250" cy="206" r="15" fill="none" stroke="#ff2d55" stroke-width="2" class="dash"/><circle cx="250" cy="206" r="5" fill="#b38a2e"/>
   <path d="M385 140 L 560 108" stroke="#ff6b9d" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M236 214 L 100 222" stroke="#ff6b9d" stroke-width="1.5" stroke-dasharray="4 4"/>` +
  pill(550, 106, "Stray screw", "#ff4d6d", 10) + pill(6, 222, "Extra standoff", "#ff4d6d", 10) + pill(150, 276, "Powers on, then shuts off instantly", "#ff6b9d", 10) + pill(550, 150, "Spark / burn", "#ffd54a", 10));

/* 14 GPU failure */
ART.gpuFail = () => {
  const cols = ["#ff00e6", "#00f0ff", "#ffee00", "#27ff6a", "#ff2020", "#ffffff"];
  let lines = "", blocks = "";
  for (let i = 0; i < 24; i++) lines += `<rect x="${138 + i * 15}" y="${28 + ((i * 29) % 60)}" width="${i % 3 ? 3 : 6}" height="${70 + ((i * 53) % 140)}" fill="${cols[i % 6]}" opacity=".85"/>`;
  for (let i = 0; i < 16; i++) blocks += `<rect x="${140 + ((i * 71) % 330)}" y="${40 + ((i * 47) % 170)}" width="${14 + (i % 3) * 8}" height="${10 + (i % 4) * 5}" fill="${cols[(i * 5) % 6]}" opacity=".7"/>`;
  return svg("Monitor showing colored vertical lines and corrupted blocks typical of graphics card failure, next to a graphics card",
    `<rect x="8" y="104" width="12" height="100" rx="2" fill="url(#metalG)"/><rect x="22" y="110" width="212" height="86" rx="9" fill="#1a1014" stroke="#4a1f2a" stroke-width="2"/>${fan(70, 153, 30, false, "#ff6b9d")}${fan(150, 153, 30, false, "#ff6b9d")}<rect x="196" y="96" width="34" height="14" rx="2" fill="#2a2a30" stroke="#555"/><rect x="40" y="196" width="130" height="10" fill="url(#goldG)"/><rect x="100" y="196" width="5" height="10" fill="#150a0e"/><path d="M30 118 H 226" stroke="#ff2d55" stroke-width="2" opacity=".6"/>` +
    mon(`<rect x="134" y="28" width="372" height="214" fill="#14143a"/><g class="flick">${lines}${blocks}<rect x="134" y="132" width="372" height="12" fill="#fff" opacity=".16"/><rect x="134" y="150" width="200" height="6" fill="#ff00e6" opacity=".4"/></g>`, { s: 0.78, x: 262, y: 28, led: "#34d399" }) +
    pill(22, 98, "Graphics card", "#ff6b9d", 11) + pill(22, 238, "Artifacts / lines", "#ff4d6d", 11) + pill(556, 256, "Or: black", "#ff6b9d", 10));
};

/* 02 No bootable device */
ART.noBootable = () => svg("Black BIOS-style startup screen in white monospaced text reading No Bootable Device Found, beside a drive with a question mark",
  mon(ML(["No Bootable Device Found.", "", "Reboot and Select proper Boot device", "or Insert Boot Media in selected", "Boot device and press a key"], 148, 64, 12.5, "#f0f0f0", 19) + `<rect x="352" y="132" width="8" height="14" fill="#f0f0f0" class="blink"/>`, { led: "#34d399" }) +
  `<rect x="12" y="116" width="94" height="64" rx="7" fill="#1b1316" stroke="#6a5a60" stroke-width="2"/><rect x="106" y="138" width="8" height="20" rx="2" fill="#9a8f93"/>` + mt(59, 138, 11, "#a1969a", "SSD / HDD", 'text-anchor="middle"') + tx(59, 172, 30, "#ff2d55", "?", 'text-anchor="middle" font-weight="800" class="pulse"') +
  pill(12, 206, "Drive detected?", "#ff6b9d", 10) + pill(530, 150, "Black screen", "#ff6b9d", 10));

/* 03 PXE / DHCP */
ART.pxe = () => svg("Black startup screen listing Start PXE over IPv4, Checking Media Presence and Start PXE over IPv6 network boot messages, beside a network cable plug",
  mon(ML([">>Start PXE over IPv4.", "Station IP address is 0.0.0.0", "Checking Media Presence......", "Media Present......", "No DHCP or proxyDHCP offers were received.", "", ">>Start PXE over IPv6.", "Checking Media Presence......", "Media Present......"], 146, 54, 11, "#ececec", 16) + `<rect x="260" y="182" width="7" height="12" fill="#ececec" class="blink"/>`, { led: "#34d399" }) +
  `<path d="M0 150 H 24" stroke="#2b2b32" stroke-width="8"/><rect x="24" y="128" width="62" height="44" rx="5" fill="#7d8c99" stroke="#c3ccd4" stroke-width="2" opacity=".95"/><rect x="38" y="118" width="26" height="12" fill="#7d8c99"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${31 + i * 6.4}" y="156" width="3" height="16" fill="url(#goldG)"/>`).join("")}` +
  mt(55, 146, 10, "#12060a", "LAN", 'text-anchor="middle" font-weight="700"') + pill(10, 206, "Network boot", "#ff6b9d", 11) + pill(530, 150, "Black screen", "#ff6b9d", 10));

/* 04 UEFI vs Legacy */
ART.uefiLegacy = () => {
  const box = (x, y, w, t, sub, c) => `<rect x="${x}" y="${y}" width="${w}" height="72" rx="10" fill="#1d0a10" stroke="${c}" stroke-width="2"/>${tx(x + 14, y + 28, 14, "#fff", t, 'font-weight="700"')}${tx(x + 14, y + 48, 11, "#a1969a", sub)}`;
  const bar = (x, y, parts) => { let cx = x, o = ""; parts.forEach(p => { o += `<rect x="${cx}" y="${y}" width="${p[0]}" height="12" rx="2" fill="${p[2]}"/>`; cx += p[0] + 3; }); return o; };
  return svg("Diagram showing UEFI firmware matching a GPT disk and Legacy CSM firmware matching an MBR disk, with mismatched pairs crossed out and an Operating System not found message",
    box(30, 54, 210, "Firmware: UEFI mode", "Looks for EFI boot files", "#ff6b9d") + box(30, 150, 210, "Firmware: Legacy / CSM", "Looks for MBR boot code", "#ff6b9d") +
    box(400, 54, 210, "Windows on a GPT disk", "", "#9a8f93") + box(400, 150, 210, "Windows on an MBR disk", "", "#9a8f93") +
    bar(414, 98, [[30, 0, "#4a6a9a"], [110, 0, "#ff2d55"], [30, 0, "#6a4a7a"]]) + bar(414, 194, [[30, 0, "#4a6a9a"], [140, 0, "#ff2d55"]]) +
    `<path d="M240 90 H 400" stroke="#34d399" stroke-width="3"/><path d="M240 186 H 400" stroke="#34d399" stroke-width="3"/><path d="M240 100 L 400 176" stroke="#ff2d55" stroke-width="2.5" class="dash"/><path d="M240 176 L 400 100" stroke="#ff2d55" stroke-width="2.5" class="dash"/>
     <circle cx="320" cy="138" r="15" fill="#12060a" stroke="#ff2d55" stroke-width="2.5"/><path d="M313 131 L 327 145 M327 131 L 313 145" stroke="#ff2d55" stroke-width="3" stroke-linecap="round"/>` +
    tx(320, 82, 11, "#34d399", "matches", 'text-anchor="middle" font-weight="700"') + tx(320, 208, 11, "#34d399", "matches", 'text-anchor="middle" font-weight="700"') +
    pill(30, 38, "Firmware boot mode", "#ff6b9d", 11) + pill(400, 38, "How Windows was installed", "#ff6b9d", 11) +
    `<rect x="150" y="240" width="340" height="40" rx="4" fill="#000" stroke="#4a1f2a"/>` + mt(320, 265, 14, "#f0f0f0", "Operating System not found", 'text-anchor="middle"'));
};

/* 13 BIOS / CMOS */
ART.bios = () => svg("BIOS setup screen showing the system date reset to 01/01/2000 and a CMOS checksum error warning, beside a coin cell battery",
  `<circle cx="100" cy="146" r="58" fill="url(#metalG)" stroke="#6a6a72" stroke-width="3"/><circle cx="100" cy="146" r="44" fill="none" stroke="#7a7a82" stroke-width="2"/>` + tx(100, 144, 17, "#26262c", "CR2032", 'text-anchor="middle" font-weight="800"') + tx(100, 166, 13, "#26262c", "3V   +", 'text-anchor="middle" font-weight="700"') +
  pill(30, 236, "CMOS battery", "#ff6b9d", 11) +
  mon(`<rect x="134" y="28" width="372" height="214" fill="#0a1030"/><rect x="134" y="28" width="372" height="22" fill="#1c2b6b"/>${mt(144, 43, 11, "#cfd8ff", "SETUP UTILITY  -  Main")}<rect x="322" y="62" width="128" height="20" fill="#ff2d55" opacity=".28" stroke="#ff2d55"/>${mt(146, 76, 12, "#e6ebff", "System Date")}${mt(330, 76, 12, "#ffffff", "[01/01/2000]", 'font-weight="700"')}${mt(146, 102, 12, "#e6ebff", "System Time")}${mt(330, 102, 12, "#ffffff", "[00:00:07]")}${mt(146, 128, 12, "#e6ebff", "Boot Option #1")}${mt(330, 128, 12, "#ffffff", "[Not set]")}${mt(146, 154, 12, "#e6ebff", "XMP / Memory profile")}${mt(330, 154, 12, "#ffffff", "[Disabled]")}<rect x="134" y="190" width="372" height="52" fill="#4a3600" stroke="#ffb020"/>${mt(144, 210, 11.5, "#ffd54a", "CMOS checksum error - Defaults loaded", 'font-weight="700"')}${mt(144, 228, 10.5, "#ffffff", "Press F1 to continue, DEL to enter setup")}`, { s: 0.86, x: 214, y: 22, led: "#34d399" }) +
  pill(520, 262, "Date reset", "#ff4d6d", 10));

/* 09 PSU failure */
ART.psuFail = () => svg("Desktop PC that is powered off with no lights next to a power supply rear view with a dead fan, a burn mark and smoke rising",
  tower(24, 48, { on: false }) +
  `<g stroke-linecap="round" fill="none" stroke-width="5"><path d="M290 120 C 250 120, 230 170, 190 190" stroke="#e8c030"/><path d="M290 134 C 255 140, 235 185, 192 200" stroke="#d63a3a"/><path d="M290 148 C 260 158, 240 195, 194 210" stroke="#222"/><path d="M290 162 C 265 175, 245 205, 196 220" stroke="#ff8a30"/></g>
   <rect x="290" y="68" width="236" height="168" rx="9" fill="#17181c" stroke="#5a2431" stroke-width="2"/>${[56, 45, 34, 23, 12].map(r => `<circle cx="372" cy="152" r="${r}" fill="none" stroke="#3a3a42" stroke-width="2"/>`).join("")}<path d="M316 152 H 428 M372 96 V 208" stroke="#3a3a42" stroke-width="2"/><circle cx="372" cy="152" r="7" fill="#26262c"/>
   <rect x="452" y="88" width="56" height="38" rx="4" fill="#0a0a0c" stroke="#777" stroke-width="2"/><rect x="462" y="98" width="6" height="18" fill="#333"/><rect x="476" y="98" width="6" height="18" fill="#333"/><rect x="490" y="98" width="6" height="18" fill="#333"/>
   <rect x="462" y="162" width="36" height="46" rx="5" fill="#222" stroke="#666"/><rect x="468" y="170" width="24" height="14" rx="2" fill="#0a0a0c"/>` + tx(480, 200, 10, "#888", "I   O", 'text-anchor="middle"') +
  `<ellipse cx="320" cy="92" rx="22" ry="12" fill="#000" opacity=".65" filter="url(#blur6)"/><circle class="smoke" cx="318" cy="60" r="13" fill="#8a8a92" filter="url(#blur6)"/><circle class="smoke d2" cx="334" cy="60" r="11" fill="#8a8a92" filter="url(#blur6)"/><circle class="smoke d3" cx="324" cy="60" r="12" fill="#8a8a92" filter="url(#blur6)"/>` +
  pill(24, 34, "PC: completely dead", "#ff6b9d", 11) + pill(290, 260, "No fan - no LED - burning smell", "#ff4d6d", 10) + pill(510, 42, "Dead PSU", "#ff4d6d", 10));

/* Paperclip test (technician only) */
ART.paperclip = () => svg("Warning illustration: a power supply connector with a crossed-out paperclip, labelled technician only, next to a dedicated PSU tester device showing voltage readings",
  `<rect width="640" height="30" fill="url(#hazard)" opacity=".85"/><rect x="110" y="4" width="420" height="22" rx="11" fill="#12060a" stroke="#ff2d55"/>` + tx(320, 19, 11.5, "#ffffff", "TECHNICIAN ONLY - NOT RECOMMENDED FOR BEGINNERS", 'text-anchor="middle" font-weight="800" letter-spacing=".5"') +
  `<rect x="16" y="80" width="170" height="124" rx="8" fill="#17181c" stroke="#5a2431" stroke-width="2"/>${fan(76, 142, 38, false, "#4a4a52")}<rect x="132" y="96" width="40" height="28" rx="3" fill="#0a0a0c" stroke="#777"/>
   <path d="M186 142 H 262" stroke="#2a2a30" stroke-width="14"/><path d="M186 136 H 262 M186 148 H 262" stroke="#e8c030" stroke-width="2" opacity=".6"/>
   <rect x="262" y="112" width="104" height="62" rx="5" fill="#d8d4cc" stroke="#9a968e" stroke-width="2"/>${[0, 1].map(r => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `<rect x="${268 + i * 8}" y="${120 + r * 26}" width="5" height="12" rx="1" fill="#26262c"/>`).join("")).join("")}
   <circle cx="436" cy="118" r="36" fill="#12060a" stroke="#ff2d55" stroke-width="5"/><g transform="translate(436 118)"><path d="M-9 14 V-12 A8 8 0 0 1 7 -12 V12 A13 13 0 0 1 -19 12 V-8" fill="none" stroke="#c9c9d0" stroke-width="3.5" stroke-linecap="round"/></g><path d="M411 93 L 461 143" stroke="#ff2d55" stroke-width="5" stroke-linecap="round"/>
   <rect x="488" y="62" width="142" height="178" rx="10" fill="#1c1c22" stroke="#4a4a58" stroke-width="2"/><rect x="498" y="72" width="122" height="72" rx="4" fill="#06180f" stroke="#1e6a44"/>` +
  ML(["+3.3V   3.31", "+5V     5.03", "+12V   12.07", "Power Good: OK"], 506, 90, 10.5, "#5cff9c", 15) +
  `${[0, 1, 2, 3, 4].map(i => `<circle cx="${512 + i * 20}" cy="160" r="5" fill="#34d399"/>`).join("")}<rect x="502" y="182" width="114" height="34" rx="4" fill="#d8d4cc"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<rect x="${507 + i * 10.5}" y="188" width="5" height="10" fill="#26262c"/><rect x="${507 + i * 10.5}" y="202" width="5" height="10" fill="#26262c"/>`).join("")}` +
  pill(490, 262, "Dedicated PSU tester", "#34d399", 11) + pill(16, 232, "Not for beginners", "#ff4d6d", 11) +
  tx(250, 284, 12, "#a1969a", "A spinning fan does NOT prove a PSU is healthy.", 'text-anchor="middle"'));

/* 06 Beep codes */
ART.beep = () => svg("Black monitor and a motherboard with a small buzzer emitting sound waves, plus a short and long beep pattern to count",
  mon("", { s: 0.62, x: 18, y: 38, led: "#34d399" }) + pill(18, 238, "Black screen", "#ff6b9d", 11) +
  `<rect x="298" y="30" width="324" height="160" rx="9" fill="url(#pcbG)" stroke="#4a1f2a" stroke-width="2"/><rect x="316" y="48" width="64" height="64" rx="3" fill="#120a0d" stroke="#6b2a3a"/><rect x="326" y="58" width="44" height="44" fill="#1b1013"/>${[0, 1, 2].map(i => `<rect x="${404 + i * 20}" y="46" width="11" height="104" rx="2" fill="#0b0507" stroke="#3a1a22"/>`).join("")}<path d="M316 130 H 400 V 170 H 520" fill="none" stroke="#ff2d55" stroke-opacity=".25" stroke-width="2"/>
   <circle cx="540" cy="110" r="19" fill="#101014" stroke="#9a9aa4" stroke-width="2"/><circle cx="540" cy="110" r="4.5" fill="#444"/>
   <path class="wave" d="M566 94 Q 580 110 566 126" fill="none" stroke="#ff6b9d" stroke-width="3" stroke-linecap="round"/><path class="wave w2" d="M577 84 Q 599 110 577 136" fill="none" stroke="#ff6b9d" stroke-width="3" stroke-linecap="round"/><path class="wave w3" d="M588 74 Q 618 110 588 146" fill="none" stroke="#ff6b9d" stroke-width="3" stroke-linecap="round"/>
   <rect x="302" y="222" width="30" height="22" rx="11" fill="#ff2d55" class="beep1"/><rect x="342" y="222" width="30" height="22" rx="11" fill="#ff2d55" class="beep2"/><rect x="382" y="222" width="76" height="22" rx="11" fill="#ff6b9d" class="beep3"/>` +
  pill(482, 244, "Buzzer on board", "#ff6b9d", 11) + tx(300, 264, 11.5, "#a1969a", "Example pattern only. Meanings differ by board maker.") + tx(300, 282, 12, "#ff6b9d", "Count the beeps and write them down.", 'font-weight="700"') + pill(316, 208, "Short, short, long", "#ff6b9d", 9));

/* 15 Power light blinking */
ART.blinking = () => svg("Desktop PC with its power light blinking amber, a magnified blinking LED, and a black monitor",
  tower(36, 44, { led: "#ffb020", ledClass: "blink", spin: false }) +
  `<path d="M78 57 L 232 96" stroke="#ffb020" stroke-width="1.5" stroke-dasharray="4 4"/><circle cx="276" cy="110" r="50" fill="#14070a" stroke="#ffb020" stroke-width="2.5"/><g class="blink">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M276 ${110 - 26} v-8" transform="rotate(${a} 276 110)" stroke="#ffb020" stroke-width="3" stroke-linecap="round"/>`).join("")}<circle cx="276" cy="110" r="15" fill="#ffb020" filter="url(#glow)"/></g>` +
  mon("", { s: 0.7, x: 380, y: 40, led: "#ffb020", ledClass: "blink-slow" }) +
  pill(218, 190, "Power LED blinking", "#ffb020", 11) + pill(470, 252, "Screen: black", "#ff6b9d", 10) +
  `${[0, 1, 2].map(i => `<rect x="${220 + i * 22}" y="226" width="12" height="14" rx="3" fill="#ffb020"/>`).join("")}${[0, 1, 2, 3, 4].map(i => `<rect x="${290 + i * 14}" y="231" width="8" height="4" rx="2" fill="#4a3a20"/>`).join("")}` +
  tx(220, 262, 11.5, "#a1969a", "Example: 3 blinks, pause, repeat.") + tx(220, 280, 11.5, "#ffb020", "Count and note the pattern and colour.", 'font-weight="700"'));

/* 16 Running, no display, no beeps */
ART.runningNoBeeps = () => svg("Desktop PC with spinning fans and a completely black monitor, and a speaker icon crossed out meaning there are no beeps",
  tower(30, 50, { led: "#34d399" }) +
  mon("", { s: 0.8, x: 200, y: 24, led: "#4a4a50" }) +
  `<path d="M548 120 h14 l22 -18 v62 l-22 -18 h-14 z" fill="#9a8f93"/><path d="M594 116 Q 604 134 594 152 M604 106 Q 620 134 604 162" fill="none" stroke="#6a6a72" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 5"/><path d="M536 94 L 616 176" stroke="#ff2d55" stroke-width="6" stroke-linecap="round"/>` +
  tx(180, 80, 34, "#ff6b9d", "?", 'font-weight="800" class="pulse"') + tx(552, 80, 28, "#ff6b9d", "?", 'font-weight="800" class="pulse"') +
  pill(30, 34, "Fans + lights ON", "#34d399", 11) + pill(200, 268, "Screen fully black", "#ff6b9d", 10) + pill(536, 206, "No beep", "#ff4d6d", 11) +
  tx(320, 292, 11.5, "#a1969a", "Many modern boards have no speaker, so silence proves nothing.", 'text-anchor="middle"'));

/* ==========================================================
   PART 3 — TROUBLESHOOTING CONTENT
   Fields: id, cat, level, title, blurb, art, caption, scope, kw (everyday phrases), err (exact messages),
   see, means, causes, extra [{h,p,ul,link,tech}], steps [[title, detail, optionalLevel]], dont, call, warn, banner, related
   ========================================================== */

/* ---------------- SECTION A — COMMON PROBLEMS ---------------- */
PROBLEMS.push({
  id: "power-cable", cat: "common", level: "Beginner",
  title: "Power Cable / Power Connection Issue",
  blurb: "No lights, no fans, nothing happens when you press the power button. Often just a loose cable or dead outlet.",
  art: "powerCable", caption: "A desktop with no lights, and a power plug that is not fully in the wall outlet.",
  scope: "Applies to desktops and laptop chargers",
  kw: ["pc won't turn on", "computer won't turn on", "nothing happens when i press power", "no lights", "dead computer", "loose plug", "power cord", "won't start", "no response", "unplugged", "laptop not charging", "no power light", "power strip"],
  err: [],
  see: ["No lights on the case, keyboard or monitor.", "No fan movement or noise at all.", "Nothing happens when you press the power button.", "On a laptop: the charging light stays off and the battery seems empty."],
  means: "Your computer is not receiving electricity. Before suspecting parts inside the machine, check the path from the wall to the computer: a loose plug, a switched-off power strip, a dead outlet or a damaged cable. This is the most common reason a PC looks 'dead', and checking costs nothing.",
  causes: ["Cable is loose at the wall, the power strip, or the back of the PC.", "Wall outlet or power strip is switched off, tripped or dead.", "Power cable is damaged (bent, chewed, crushed or worn).", "The power switch on the back of a desktop power supply is set to O (off).", "Laptop charger or adapter has failed, or the charger plug is loose in the laptop.", "If everything above is fine: the power supply (PSU) or internal power circuitry is the likely culprit."],
  steps: [
    ["Look for any sign of life", "Check for any light on the PC, keyboard, monitor, or a charging light on a laptop. Note exactly what you see; it helps later."],
    ["Re-seat both ends of the power cable", "Push the cable firmly into the wall or power strip and into the back of the PC (or the laptop charger port). Unplug and plug it back in; it should feel snug."],
    ["Test the wall outlet", "Plug a lamp or phone charger you know works into the same outlet. If it stays off, try another outlet, press the reset button on the power strip, or check your circuit breaker."],
    ["Check the PSU switch (desktop)", "On the back of a desktop there is a small rocker switch near the cable. I means on, O means off. Set it to I."],
    ["Try a known-working cable", "Most desktops use a standard 'kettle lead' (IEC C13) cable, the same type used by many monitors. Inspect it for damage first; never use a cable with exposed wire or melted plastic.", "Beginner"],
    ["Laptop: test the charger and battery", "Check that the charger light is on and try another outlet. Unplug the charger, hold the power button for 15-30 seconds, plug the charger back in and try again. Use only a charger with the same voltage and connector rating as the original."],
    ["Escalate if still dead", "If the cable and outlet are both confirmed good, the fault is likely in the PSU or power circuitry. Continue with 'No Power at All' and 'PSU Not Working'."]
  ],
  dont: ["Do not use a damaged, frayed or hot cable.", "Do not use an unknown adapter or a charger with a different voltage rating.", "Do not open the computer or the power supply to 'have a look' while it is plugged in.", "Do not force a plug that will not fit; check that you have the right cable."],
  call: ["The cable and outlet are both confirmed working but nothing happens.", "There is a burning smell, sparks, popping sounds, or a plug that is hot or discoloured.", "A laptop will not charge even with a genuine, known-good charger."],
  warn: { t: "Electrical safety", d: "Unplug the computer before touching anything inside it. If you see melted plastic or scorch marks, or smell burning, stop and do not plug it in again." },
  related: ["no-power", "psu-failure"]
});

PROBLEMS.push({
  id: "no-power", cat: "common", level: "Beginner",
  title: "No Power at All (Completely Dead PC)",
  blurb: "No lights, no fans, no beeps and no display, whatever you do. Work out whether it is the supply, the button or the board.",
  art: "noPower", caption: "A desktop and a laptop where pressing the power button produces no lights, sound or movement.",
  scope: "Desktop and laptop",
  kw: ["pc won't turn on", "computer wont power on", "completely dead", "no power", "no lights no fans", "power button does nothing", "pc dead", "laptop dead", "won't charge or turn on", "totally dead", "nothing happens"],
  err: [],
  see: ["No lights, no fans, no beeps and no display.", "Pressing the power button does nothing.", "The front-panel power light stays dark.", "The motherboard's small standby LED (on boards that have one) is off.", "Laptop: no charging light and no response."],
  means: "No electricity is reaching, or being distributed inside, the computer. The break could be outside (cable, outlet), in the power supply, in the small cable that connects the case's power button to the motherboard, or on the motherboard itself. We work from the easiest and safest check to the hardest.",
  causes: ["Power cable, outlet, power strip or PSU rear switch (see Power Cable Issue).", "Failed or protection-tripped power supply (PSU).", "Case power-button cable disconnected or the button itself is faulty.", "Motherboard fault or short circuit.", "Laptop: faulty charger, drained or failed battery, or board-level fault.", "Residual electrical state (the system sometimes needs a power drain to reset)."],
  steps: [
    ["Rule out the basics first", "Work through the 'Power Cable Issue' checklist: cable, outlet, power strip and the PSU rear switch."],
    ["Remove everything extra", "Unplug USB devices, printers, docks and memory cards. A faulty accessory can stop a PC from starting."],
    ["Look for a standby light on the motherboard (desktop)", "Many motherboards have a tiny LED that glows whenever the PSU is plugged in and switched on. If it is lit, power is reaching the board. If you cannot see one, that does not prove anything.", "Intermediate"],
    ["Do a power drain (desktop)", "Shut down, unplug the cable, switch the PSU off, hold the case power button for 15 seconds, wait a minute, then reconnect and try again."],
    ["Do a power drain (laptop)", "Unplug the charger, hold the power button for 30 seconds, plug the charger back in and try again. If the battery is removable, take it out first. Do not open a laptop with a sealed battery."],
    ["Test the power supply safely", "Use a dedicated plug-in PSU tester, or ask a technician. See 'PSU Not Working'. Do not attempt advanced electrical tests yourself.", "Advanced"],
    ["Check the case power-button connection", "A technician or experienced builder can check that the front-panel power switch lead is connected to the correct motherboard header (see the motherboard manual).", "Advanced"]
  ],
  dont: ["Do not keep mashing the power button; it will not help and can corrupt data on a half-started system.", "Do not borrow a PSU or cable with different connectors or wattage to 'try it'.", "Do not open the power supply under any circumstances.", "Do not short motherboard pins with a screwdriver to start the PC unless you are trained; the wrong pins can destroy the board."],
  call: ["Cable, outlet and PSU switch are fine and there is still no sign of life.", "A PSU tester shows a fault, or you smell burning.", "A laptop is dead with a known-good charger."],
  warn: { t: "Never open a power supply", d: "Power supplies can hold dangerous charge even when unplugged. Test them only from the outside with a dedicated tester, or let a professional do it." },
  related: ["power-cable", "psu-failure", "mb-short"]
});

PROBLEMS.push({
  id: "fans-no-display", cat: "common", level: "Beginner",
  title: "Fans Spin but No Display",
  blurb: "The PC is clearly on (fans, RGB lights) but the monitor says No Signal or stays blank.",
  art: "fansNoDisplay", caption: "A running PC with RGB lighting, and a monitor that only shows 'No Signal'.",
  scope: "Mostly desktops; laptop notes included",
  kw: ["no signal", "fans spinning no display", "rgb on screen black", "monitor no input", "pc on but black screen", "no image", "no display", "black screen but pc running", "monitor says no signal", "screen not turning on", "no video", "monitor not detecting pc"],
  err: ["No Signal", "No Input", "Check Cable", "No video input", "Cable not connected"],
  see: ["Case fans are running.", "RGB or case lights are on.", "Monitor shows 'No Signal' (or stays black).", "No image appears at all, not even the manufacturer logo."],
  means: "The computer has power, but either the picture is not reaching the monitor, or the computer is stuck before it can create a picture. Start with the monitor and cable (cheap and easy); only then suspect the memory, graphics card or motherboard.",
  causes: ["Monitor is off, asleep, or set to the wrong input (HDMI 1, HDMI 2, DisplayPort...).", "Loose or damaged HDMI/DisplayPort cable.", "Cable plugged into the motherboard port while a dedicated graphics card is installed (or the reverse).", "RAM not seated properly.", "Graphics card not seated or missing its power cable.", "CPU, BIOS or motherboard fault (a new CPU may need a BIOS update first).", "Faulty monitor."],
  steps: [
    ["Check monitor power and input", "Make sure the monitor's power light is on. Press its input/source button and select the port you are using (HDMI, DisplayPort, DVI or VGA)."],
    ["Reseat the video cable at both ends", "Switch everything off, unplug and firmly re-plug the cable on the monitor and PC. Try a different cable if you have one."],
    ["Use the correct port", "If your PC has a separate graphics card (a card with its own ports at the bottom/back), plug the monitor into the graphics card, not the motherboard's ports above it."],
    ["Try another monitor or TV", "This tells you instantly whether the monitor or the computer is at fault."],
    ["Check the motherboard's diagnostic lights", "Many desktop boards have small LEDs or a code display labelled CPU, DRAM, VGA and BOOT. A light that stays on points to the faulty area. Check your motherboard manual.", "Intermediate"],
    ["Re-seat the RAM (desktop)", "Follow the 'RAM Not Seated Properly' checklist. Memory problems are a very common cause.", "Intermediate"],
    ["Check the graphics card (desktop)", "With the PC off and unplugged, check the card is firmly in its slot and that its power cables are fully connected.", "Intermediate"],
    ["Laptop: external monitor and screen test", "Connect an external monitor. If that works, the laptop's screen or its cable is the problem. A faint image visible with a torch could mean a backlight fault.", "Beginner"]
  ],
  dont: ["Do not connect cables to both the graphics card and the motherboard unless you know why.", "Do not open the case while the computer is powered or plugged in.", "Do not force connectors; they only fit one way.", "Do not flash or update the BIOS as a first reaction."],
  call: ["The monitor works on another PC, and swapping cable, port and RAM does nothing.", "Diagnostic LEDs point to the CPU or motherboard.", "A laptop screen stays black but an external monitor works."],
  warn: null,
  related: ["ram-seated", "gpu-failure", "beep-codes", "running-no-beeps"]
});

PROBLEMS.push({
  id: "boot-loop", cat: "common", level: "Intermediate",
  title: "Stuck on Logo / Boot Loop (Constant Restarting)",
  blurb: "The manufacturer logo appears, then the PC restarts again and again or freezes before Windows loads.",
  art: "bootLoop", caption: "A startup logo with a spinner, repeating over and over: the PC restarts before reaching Windows.",
  scope: "Desktop and laptop",
  kw: ["computer keeps restarting", "restart loop", "stuck on logo", "stuck on manufacturer logo", "reboots over and over", "windows never loads", "freezes at startup", "boot loop", "keeps rebooting", "stuck on loading screen", "constant restarting", "pc restarts by itself", "stuck at startup", "spinning dots forever"],
  err: ["Preparing Automatic Repair", "Automatic Repair couldn't repair your PC", "Diagnosing your PC", "Your PC did not start correctly"],
  see: ["The manufacturer logo appears.", "The computer restarts again and again.", "Windows never finishes loading.", "The system freezes during startup (often with spinning dots)."],
  means: "The computer is starting but cannot complete the boot process, and then resets. It could be a software problem (damaged Windows files, a bad update or driver), or hardware that cannot cope (overheating, unstable memory, failing drive, power problems).",
  causes: ["Overheating (dust, a stopped fan, dried thermal paste).", "Unstable or faulty RAM.", "Faulty external device (USB drive, dock, printer).", "Incorrect BIOS settings or a failed overclock/memory profile.", "Corrupt Windows files after a failed update or driver install.", "Failing storage drive.", "Weak or failing power supply."],
  steps: [
    ["Wait a few minutes", "After an update, Windows can take a long time to finish. If the drive light is flickering, give it 10-15 minutes before acting."],
    ["Disconnect unnecessary devices", "Unplug USB drives, printers, docks, extra monitors and memory cards, then restart."],
    ["Check for overheating", "Listen for the CPU fan, feel for warm air from vents, and clear dust from accessible vents. If it restarts only after a few minutes, suspect heat. See 'CPU Overheating Shutdown'."],
    ["Power drain and restart", "Unplug power (and remove a removable laptop battery), hold the power button for 15-30 seconds, reconnect and start again."],
    ["Check BIOS settings", "If you changed a BIOS setting or enabled a memory profile (XMP/EXPO), return to the previous setting. Load defaults only if you understand what will be reset. See 'BIOS / CMOS Problems'.", "Intermediate"],
    ["Check the RAM", "Re-seat memory (desktop) and, if you have more than one module, test with a single module. See 'RAM Not Seated Properly' and 'Faulty RAM'.", "Intermediate"],
    ["Use Windows Startup Repair", "After two or three failed starts Windows usually shows a recovery screen. Choose Troubleshoot, then Advanced options, then Startup Repair. This does not delete your files.", "Intermediate"],
    ["Try Safe Mode or System Restore", "In Advanced options you can start in Safe Mode, uninstall the latest update, or run System Restore to go back to a working point. These keep your personal files.", "Intermediate"],
    ["Check the drive's health before anything drastic", "Back up your data first if you can (for example by connecting the drive to another PC). A failing drive can look exactly like a boot loop.", "Advanced"]
  ],
  dont: ["Do not reinstall Windows or choose 'Reset this PC' as a first step; try Startup Repair and System Restore first.", "Do not cut power repeatedly during an update unless it has been stuck for a very long time.", "Do not run tools that erase or format the drive before you have backed up your files.", "Do not ignore overheating signs."],
  call: ["Startup Repair fails and Safe Mode will not load.", "The drive is making clicking noises or is not detected.", "The restarts continue with no operating system involved (for example, they also happen in the BIOS screen), which points to hardware.", "You need data recovery."],
  warn: { t: "Data loss risk", d: "Options such as 'Reset this PC', 'Remove everything', formatting or reinstalling Windows can erase your files. Back up first wherever possible." },
  related: ["cpu-overheat", "faulty-ram", "no-bootable", "bios-cmos"]
});

PROBLEMS.push({
  id: "ram-seated", cat: "common", level: "Intermediate",
  title: "RAM Not Seated Properly",
  blurb: "After installing or moving memory, the PC starts but never shows a picture. The DRAM light may stay on.",
  art: "ramSeated", caption: "A memory stick sitting crooked, not clicked into its slot, with the DRAM warning light lit on the motherboard.",
  scope: "Desktop procedure; laptops may need a professional",
  kw: ["dram light", "ram light on", "after installing ram no display", "memory not seated", "memory slot", "new ram pc won't start", "dimm", "reseat ram", "ram not detected", "installed memory no boot", "fans spin no post"],
  err: ["DRAM LED", "Memory not detected", "No memory installed"],
  see: ["Fans spin but there is no display.", "The computer never completes POST (the startup self-test).", "A DRAM indicator light stays on (on boards that have one).", "The PC fails to start right after a RAM installation."],
  means: "RAM (memory) is your computer's short-term workspace. The PC cannot start without working RAM. If a memory stick is not pushed fully into its slot, the contacts do not touch properly and the computer cannot use it, so startup stops before anything appears on screen.",
  causes: ["Memory stick not pushed in until both side clips clicked.", "Stick inserted in the wrong slot for a two-stick setup.", "Dust or debris in the slot or on the contacts.", "Incompatible memory type (for example DDR4 in a DDR5 board) or unsupported speed/size.", "A faulty memory stick or faulty slot."],
  steps: [
    ["Shut down completely and unplug", "Turn the PC off, switch the PSU off at the back, unplug the power cable, then press the power button once to drain leftover power."],
    ["Protect against static", "Touch an unpainted metal part of the case before touching components, or use an anti-static wrist strap. Hold memory sticks only by the edges."],
    ["Find your RAM and the correct slots", "Check the motherboard manual: with two sticks, they usually go in slots 2 and 4 (counting from the CPU) or the slots marked A2 and B2."],
    ["Remove and inspect", "Push the plastic clips outward to release each stick. Look for dust or damage on the gold contacts. Do not touch the gold contacts."],
    ["Re-insert firmly", "Line up the notch in the stick with the key in the slot. Press down evenly on both ends until both clips click into place. It takes more force than you expect, but never use extreme force."],
    ["Reconnect and test", "Plug power back in, switch the PSU on and start the PC. A POST beep or an image means it worked."],
    ["Test sticks one at a time", "If it still fails, start with a single stick in the manual's recommended slot. Then try each stick alone, and each slot, to find a faulty stick or slot.", "Advanced"],
    ["Check compatibility", "Make sure the RAM type (DDR4/DDR5), speed and capacity are supported by your motherboard and CPU (see the manual or the maker's compatibility list).", "Advanced"],
    ["Laptop?", "Some laptops have a memory door; many have RAM under the keyboard or soldered to the board. If you are not sure, ask a professional.", "Technician Only"]
  ],
  dont: ["Do not install or remove RAM while the PC is plugged in or powered.", "Do not mix DDR4 and DDR5, or force a stick that does not line up with the notch.", "Do not touch the gold contacts or use metal tools to pry.", "Do not disassemble a laptop if you are unsure; it can damage it and void warranty."],
  call: ["The DRAM light stays on with a single known-good stick in the correct slot.", "A memory slot is visibly damaged or has bent pins.", "A laptop requires opening beyond a simple memory door."],
  warn: { t: "Static and power", d: "Unplug the desktop before opening it, and touch bare metal on the case first to discharge static electricity, which can damage memory." },
  related: ["faulty-ram", "fans-no-display", "beep-codes"]
});

/* ---------------- SECTION B — CRITICAL HARDWARE PROBLEMS ---------------- */
PROBLEMS.push({
  id: "faulty-ram", cat: "hardware", level: "Intermediate",
  title: "Faulty RAM",
  blurb: "Random restarts, blue screens and crashing apps that point to unstable or failing memory.",
  art: "faultyRam", caption: "A Windows blue screen with a memory-related stop code, next to a memory module with a failing chip.",
  scope: "Desktop and laptop",
  kw: ["ram problem", "memory problem", "blue screen", "bsod", "random restarts", "apps crashing", "memory error", "bad ram", "memtest", "pc crashes randomly", "computer freezes", "memory diagnostic", "blue screen of death"],
  err: ["MEMORY_MANAGEMENT", "PAGE_FAULT_IN_NONPAGED_AREA", "BAD_POOL_HEADER", "IRQL_NOT_LESS_OR_EQUAL", "Your PC ran into a problem and needs to restart", "Memory test failed", "Windows Memory Diagnostic"],
  see: ["Random restarts with no warning.", "Blue screen errors, often naming memory.", "Applications or games crash for no obvious reason.", "The PC fails to POST (startup self-test).", "Error messages mentioning memory or 'page fault'."],
  means: "RAM holds the data your programs are actively using. If part of it is faulty, programs receive corrupted data and the computer crashes, restarts or shows a blue screen. Not every blue screen is RAM (drivers and storage cause many), so testing is the way to be sure.",
  causes: ["A failing memory module or a worn slot.", "Memory not fully seated.", "Mismatched or incompatible modules.", "An unstable memory overclock or XMP/EXPO profile.", "Overheating or an inadequate power supply that is making memory unstable.", "Not RAM at all: bad drivers, failing storage or malware can look similar."],
  steps: [
    ["Write down the error", "Note the stop code on the blue screen (for example MEMORY_MANAGEMENT) or take a photo with your phone."],
    ["Run Windows Memory Diagnostic", "Press the Windows key, type 'Windows Memory Diagnostic', choose 'Restart now and check for problems'. The PC restarts and tests the memory; it can take 10-30 minutes."],
    ["Read the result", "After Windows starts, the result appears as a notification. For details, open Event Viewer, then Windows Logs, then System, and look for 'MemoryDiagnostics-Results'."],
    ["Run a deeper test if needed", "For a more thorough check, use a trusted tool such as MemTest86 or MemTest86+ from a USB stick and let it run several full passes. Any error means a fault.", "Intermediate"],
    ["Check memory seating (desktop)", "Follow 'RAM Not Seated Properly' to power off, unplug and re-seat the modules.", "Intermediate"],
    ["Test modules individually", "If you have several compatible modules, test each one alone in the recommended slot to find the faulty one. Also try each slot.", "Advanced"],
    ["Turn off memory overclocking", "If you enabled XMP/EXPO or a manual overclock in BIOS, switch it off temporarily and see whether crashes stop.", "Advanced"],
    ["Replace a failed module", "If any test shows errors that follow a specific module, replace it with a compatible module (same type, e.g. DDR4/DDR5). Laptop RAM may need a professional.", "Intermediate"]
  ],
  dont: ["Do not assume every blue screen is RAM; test before buying parts.", "Do not mix memory types or speeds without checking compatibility.", "Do not touch the gold contacts or work on a powered PC.", "Do not keep using a PC with failing memory for important work; it can corrupt files."],
  call: ["Tests show errors and you are unsure which part is faulty.", "The laptop's memory is soldered or hard to reach.", "Memory tests pass but the crashes continue (the cause may be the CPU, motherboard, storage or power supply)."],
  warn: { t: "Back up important files", d: "Unstable memory can corrupt files while it is being written. Back up your important data to external storage if the PC still starts." },
  related: ["ram-seated", "boot-loop", "cpu-overheat"]
});

PROBLEMS.push({
  id: "cpu-overheat", cat: "hardware", level: "Intermediate",
  title: "CPU Overheating Shutdown",
  blurb: "The PC shuts down after seconds or minutes, runs hot, gets loud or slows down badly.",
  art: "cpuOverheat", caption: "A hardware monitor showing 98 degrees Celsius and a thermal throttling warning, plus a stopped CPU fan.",
  scope: "Desktop and laptop",
  kw: ["pc shuts down automatically", "shuts down by itself", "computer turns off after few minutes", "overheating", "too hot", "laptop hot", "fan loud", "cpu temp", "thermal throttling", "slow when hot", "turns off when gaming", "random shutdown", "computer gets hot", "fan not spinning"],
  err: ["CPU Over Temperature Error", "CPU fan error", "CPU Fan Error!", "Thermal trip", "System shutdown due to overheating"],
  see: ["The PC shuts down after several seconds or minutes.", "CPU temperature is unusually high in a monitoring tool.", "The CPU fan does not spin, or spins loudly at full speed.", "Thermal throttling: the PC becomes slow and laggy when hot."],
  means: "The processor produces heat and relies on a heatsink and fan to carry it away. When heat builds up, the CPU slows itself down (thermal throttling) to protect itself and, if it still gets too hot, the computer shuts off suddenly. Frequent overheating shortens the life of components.",
  causes: ["Dust blocking vents, heatsinks or fans.", "CPU fan stopped, jammed or unplugged.", "Poor airflow (blocked vents, cramped case, laptop on a soft surface).", "Dried-out or badly applied thermal paste.", "Loose or incorrectly mounted CPU cooler.", "Heavy background load or malware.", "High room temperature."],
  steps: [
    ["Check the temperature", "Use a trusted monitoring tool (for example HWMonitor or Core Temp) or the BIOS screen. Safe temperatures depend on the CPU model; as a rough guide, consistently reaching the 90s under load is a problem. Check your CPU maker's specification."],
    ["Check the CPU fan", "Look and listen: the fan on the CPU cooler should spin when the PC is on. If it does not, shut down immediately."],
    ["Improve ventilation", "Keep vents clear of walls, fabric and dust. Place a laptop on a hard, flat surface or a cooling stand. Make sure case fans are running."],
    ["Clean dust safely", "Shut down, unplug and let it cool. Use short bursts of compressed air at vents and heatsinks, holding fan blades still with a soft tool so they do not over-spin. Work outside if possible. Do not use a household vacuum cleaner, which can create static.", "Intermediate"],
    ["Check for background load", "Open Task Manager (Ctrl + Shift + Esc) to see whether a program is using the CPU heavily when you are not doing anything."],
    ["Consider thermal paste", "Thermal paste is a thin layer that helps move heat from the CPU to the cooler. It can dry out after several years. Replacing it requires removing the cooler. Only do it if you are experienced.", "Advanced"],
    ["Get help for cooler removal or laptops", "Removing a CPU cooler, or opening a laptop to clean the fan and heatsink, can damage parts if done wrongly. Ask a technician.", "Technician Only"]
  ],
  dont: ["Do not keep using a PC that shuts down from heat; each overheating event stresses the hardware.", "Do not spray liquids or use a vacuum cleaner on internal parts.", "Do not remove a CPU cooler without knowing how to reapply thermal paste and reseat it correctly.", "Do not block laptop vents with bedding, cushions or laps."],
  call: ["The CPU fan is dead or the cooler is loose.", "Temperatures stay high after cleaning.", "You need a laptop opened to clean the cooling system or replace thermal paste.", "Shutdowns happen even when temperatures look normal (could be power supply or motherboard)."],
  warn: { t: "Hot surfaces", d: "Heatsinks and laptop bases can be hot enough to burn. Shut down and let components cool for several minutes before touching them." },
  related: ["boot-loop", "psu-failure", "faulty-ram"]
});

PROBLEMS.push({
  id: "mb-short", cat: "hardware", level: "Technician Only",
  title: "Motherboard Short Circuit",
  blurb: "The PC turns on and shuts off instantly, never reaches POST, or behaves differently outside the case.",
  art: "mbShort", caption: "A motherboard with a stray screw sparking against components, and an extra standoff touching the underside.",
  scope: "Mostly desktop builds and repairs",
  kw: ["turns on and immediately shuts off", "turns on then off", "pc powers on then off instantly", "short circuit", "standoff", "pc dies instantly", "burning smell motherboard", "new build won't boot", "shorting", "pc turns on for one second", "spark", "stray screw"],
  err: [],
  see: ["The computer turns on and immediately shuts down.", "There is no POST (no startup self-test).", "Unexpected power behaviour: it works one time and not the next.", "It may behave differently outside the case (for example it works on a table but not in the case)."],
  means: "A short circuit means electricity is taking an unintended path, usually because something metal touches the motherboard where it should not. Power supplies are designed to shut down instantly when they detect this, which is why the PC starts and stops straight away. The risk is real damage to the board, so careful inspection matters.",
  causes: ["Motherboard standoffs (the small brass posts) in positions that do not match the board's mounting holes.", "Loose screws or metal debris left inside the case.", "Damaged connectors or bent pins.", "Conductive debris, liquid or corrosion on the board.", "Case wiring (front-panel or USB connectors) pinched or touching the board.", "A faulty component on the board."],
  steps: [
    ["Switch off and unplug completely", "Switch off the PSU, unplug the power cable, and wait a minute. Never inspect a powered system."],
    ["Look and listen for loose metal", "With everything unplugged, gently tilt the case and listen for rattling. Remove any loose screw or metal debris you can see and reach safely."],
    ["Check for burn marks or damage", "Look (with a torch) for burnt spots, swollen capacitors, liquid residue or bent pins. If you see damage, stop."],
    ["Check front-panel and USB cables", "Make sure no cable is pinched behind the board or touching exposed contacts, and that they are plugged into the correct headers."],
    ["Verify standoffs (technician)", "Only a person who has removed a motherboard before should check that standoffs match the board's holes and that there are no extra ones underneath.", "Technician Only"],
    ["Out-of-case ('breadboard') testing (technician)", "A qualified technician can test the board outside the case on a non-conductive surface to separate a case-related short from a board fault. This involves live exposed hardware and is not for inexperienced users.", "Technician Only"]
  ],
  dont: ["Do not power on an exposed motherboard placed on a metal or conductive surface.", "Do not poke at a powered board with screwdrivers or other metal tools.", "Do not keep switching the PC on and off hoping it will work; it can worsen the damage.", "Do not encourage inexperienced users to operate exposed hardware."],
  call: ["The problem remains after removing loose objects and checking cables.", "You see burn marks, swollen capacitors or bent pins.", "The case, standoffs or board need to be removed or checked.", "You need out-of-case testing."],
  warn: { t: "Shock and damage risk", d: ["Always unplug the PC before touching the inside.", "Out-of-case testing involves exposed live hardware. It should be done only by a qualified technician."] },
  banner: "Technician only: out-of-case testing is not for beginners",
  related: ["no-power", "psu-failure", "fans-no-display"]
});

PROBLEMS.push({
  id: "gpu-failure", cat: "hardware", level: "Intermediate",
  title: "Graphics Card Failure",
  blurb: "Screen artifacts, coloured lines, black screens or no display when the dedicated graphics card is installed.",
  art: "gpuFail", caption: "A monitor with coloured vertical lines and corrupted blocks, the typical look of a failing graphics card.",
  scope: "Desktop (most laptop GPUs are not user-serviceable)",
  kw: ["artifacts", "colored lines", "coloured lines", "lines on screen", "graphics card", "gpu not working", "screen glitching", "black screen when gaming", "no display with graphics card", "integrated graphics works", "screen flickering", "video card dead", "driver crash", "display driver stopped responding"],
  err: ["Display driver stopped responding and has recovered", "VIDEO_TDR_FAILURE", "Code 43", "No Signal", "nvlddmkm stopped responding"],
  see: ["Display artifacts such as dots, flashing squares or distorted shapes.", "Coloured lines across the screen.", "A black screen.", "No POST (no startup self-test) when the graphics card is installed.", "The display works through the motherboard's (integrated) graphics but not through the dedicated GPU."],
  means: "The graphics card creates the picture you see. When it is faulty, damaged by heat, not getting enough power or not seated properly, the picture becomes corrupt or disappears. Sometimes it is only a driver (software) problem, which is much easier to fix.",
  causes: ["Loose monitor cable or a faulty cable or monitor.", "Graphics card not fully seated in the PCIe slot.", "Missing or loose GPU power cable(s).", "Overheating (dust, stopped fans).", "Corrupted or incompatible drivers.", "Not enough power from the PSU.", "Failing graphics card (memory or core damage)."],
  steps: [
    ["Rule out the cable and monitor", "Try another cable (HDMI or DisplayPort) and, if possible, another monitor or TV."],
    ["Use the graphics card's own ports", "With a dedicated card installed, the monitor should be plugged into the card, not into the motherboard ports."],
    ["Power down and check the card (desktop)", "Shut down and unplug. Check that the card is firmly clicked into its slot and the screw/bracket is secure."],
    ["Check the GPU power connectors", "Most gaming cards need one or more power cables from the PSU. Press each connector in fully until the latch clicks. Use the cables supplied with your PSU.", "Intermediate"],
    ["Test with integrated graphics", "If the CPU has built-in graphics (most Intel CPUs and some AMD), remove the card, plug the monitor into the motherboard and start the PC. If the display works, the card is the likely culprit.", "Advanced"],
    ["Fix drivers if Windows starts", "Start in Safe Mode if needed. Remove the display driver and install a fresh one from the official NVIDIA, AMD or Intel website. Do not use driver packs from random sites.", "Intermediate"],
    ["Check temperatures and dust", "Make sure the graphics card fans spin and the card is not clogged with dust (see 'CPU Overheating Shutdown' for cleaning advice).", "Intermediate"],
    ["Replace or get a professional diagnosis", "If artifacts persist across cables, drivers and another PC, the card is probably failing. A technician can confirm before you buy a new one.", "Advanced"]
  ],
  dont: ["Do not force a card into the slot or handle it by the circuit board edges or chips.", "Do not install drivers from unofficial websites.", "Do not run the PC with a graphics card that is overheating or smoking.", "Do not open a laptop to replace a GPU; on most laptops it is soldered to the board."],
  call: ["Artifacts persist with new cables and fresh drivers.", "The card works in another PC but not yours (the issue may be the motherboard or PSU).", "The card shows burn marks or you smell burning.", "A laptop has a faulty GPU."],
  warn: { t: "Power off first", d: "Always shut down and unplug before touching a graphics card. Some cards carry high-power connectors; make sure they are fully latched and not bent." },
  related: ["fans-no-display", "psu-failure", "cpu-overheat"]
});

/* ---------------- SECTION C — BOOT AND BIOS PROBLEMS ---------------- */
PROBLEMS.push({
  id: "no-bootable", cat: "boot", level: "Intermediate",
  title: "No Bootable Media / No Bootable Device",
  blurb: "A black screen with 'No Bootable Device Found'. The PC cannot find a drive that holds Windows.",
  art: "noBootable", caption: "A BIOS-style black screen with white monospaced text: 'No Bootable Device Found.'",
  scope: "Desktop and laptop",
  kw: ["no bootable device", "no bootable media", "operating system not found", "windows cannot start", "black screen error", "hard drive not detected", "ssd not detected", "boot device not found", "missing operating system", "boot failure", "drive not found", "disk not detected", "reboot and select proper boot device"],
  err: ["No Bootable Device Found.", "Reboot and Select Proper Boot Device", "Insert Boot Media in selected Boot device and press a key", "No bootable device", "Boot device not found", "Operating System not found", "Missing operating system"],
  see: ["Black screen with white text.", "'No Bootable Device Found.'", "'Reboot and Select Proper Boot Device.'", "Windows cannot start."],
  means: "When the computer starts, the BIOS/UEFI looks for a drive that contains a startup program (the 'boot loader') and Windows. This message means it either cannot see any drive, or sees drives but none that it can start from. The cause is a connection or detection problem, a wrong boot setting, or a damaged operating system.",
  causes: ["SSD/HDD not detected (loose or failed connection, failed drive).", "SATA data or power cable loose or faulty.", "NVMe SSD (M.2) not properly installed.", "Boot order or the 'Windows Boot Manager' entry is missing or wrong.", "Drive failing or damaged.", "Damaged bootloader or Windows files, so the drive is detected but will not start.", "Boot-mode mismatch (see UEFI vs Legacy)."],
  extra: [
    { h: "How to identify the operating-system drive", p: ["Do not assume the smallest drive is the Windows drive. Many PCs have a small fast SSD for Windows and a big hard drive for files, but others are the opposite, or have two similar SSDs. Use clues instead:"], ul: ["In BIOS, note each drive's model name and size, and match them with the labels on the drives or your purchase records.", "On a working Windows PC (or if you connect the drive to one), open Disk Management: the Windows drive usually shows 'Boot' and 'Page File' and holds a Windows folder.", "Open the drive in File Explorer: a Windows drive contains the folders Windows, Users and Program Files.", "From a Windows installer USB, a technician can open Command Prompt (Shift + F10) and check which drive holds the Windows folder; drive letters there can differ from normal."] }
  ],
  steps: [
    ["Enter the BIOS and check whether the drive is listed", "Restart and press the BIOS key shown at startup (often Del, F2, F10 or F12). Look for your SSD/HDD model in the storage or boot section."],
    ["If the drive is missing: power off and unplug", "Shut down, switch off the PSU and unplug the power cable before you touch any internal cable.", "Intermediate"],
    ["Check the physical connection", "SATA drives have a thin data cable and a wider power cable; both must be firmly plugged in at both ends. Try another SATA port or cable. For NVMe (M.2) drives, check it is fully seated and secured with its screw.", "Intermediate"],
    ["Laptop: get the drive checked", "Do not open a sealed laptop casually. A technician can re-seat or replace the drive.", "Technician Only"],
    ["If the drive is listed: check boot order", "In BIOS, set 'Windows Boot Manager' (or your drive) as the first boot option. Remove USB drives and discs.", "Intermediate"],
    ["Check the drive's health", "Use the drive maker's utility or a tool such as CrystalDiskInfo (on another PC if necessary). A 'Caution' or 'Bad' status means back up and replace the drive.", "Intermediate"],
    ["If the drive is healthy: repair startup files", "Boot from a Windows installer USB, choose 'Repair your computer', then Startup Repair. This keeps your files. A technician can use advanced boot-repair commands if this fails.", "Advanced"],
    ["Only reinstall Windows as a last resort", "Reinstalling can erase data. Back up the drive first or have a technician recover files.", "Advanced"]
  ],
  dont: ["Do not format or 'clean' a drive (for example with diskpart clean) before you know what is on it; it permanently erases data.", "Do not reinstall Windows without backing up important files.", "Do not assume the smallest drive is the OS drive.", "Do not pull cables out while the PC is plugged in."],
  call: ["The drive does not appear in BIOS after you check the cables.", "The drive makes clicking or grinding sounds.", "Startup Repair fails and you need your files.", "A laptop drive needs to be reseated or replaced."],
  warn: { t: "Possible data loss", d: "Storage and operating-system recovery steps can erase files. If your data matters, back it up or ask a technician to clone the drive before you try repairs." },
  related: ["pxe-dhcp", "uefi-legacy", "bios-cmos", "boot-loop"]
});

PROBLEMS.push({
  id: "pxe-dhcp", cat: "boot", level: "Intermediate",
  title: "DHCP / Network Boot (PXE) Error",
  blurb: "'Start PXE over IPv4' and 'No DHCP or proxyDHCP offers were received': the PC is trying to boot from the network.",
  art: "pxe", caption: "A black startup screen listing 'Start PXE over IPv4', 'Checking Media Presence' and 'Start PXE over IPv6'.",
  scope: "Desktop and laptop",
  kw: ["pxe boot", "network boot", "start pxe over ipv4", "start pxe over ipv6", "checking media presence", "dhcp error", "no dhcp offers", "pc trying to boot from network", "booting from lan", "pxe e61", "network boot loop", "ipv4 ipv6 boot screen"],
  err: ["Start PXE over IPv4.", "Start PXE over IPv6.", "Checking Media Presence", "No DHCP or proxyDHCP offers were received.", "Media Present"],
  see: ["'Start PXE over IPv4.'", "'Start PXE over IPv6.'", "'Checking Media Presence.'", "'No DHCP or proxyDHCP offers were received.'"],
  means: "PXE (Preboot Execution Environment) lets a computer start from a network server instead of its own drive; companies use it to install Windows on many PCs at once. At home, you see it when the PC could not find an operating system on its drive and has fallen back to network boot. The 'no DHCP offers' message just means there is no network boot server answering. The real problem is usually that your drive is not being found or booted.",
  causes: ["The internal SSD/HDD is not detected (loose cable, failed drive).", "Network boot is listed before the drive in boot priority.", "The Windows boot entry is missing or damaged.", "The drive is detected but has no valid operating system.", "On a work or school PC, network boot may be intentionally used; ask IT."],
  steps: [
    ["Wait for the timeout", "The PC will usually give up on network boot after a short time and show another error or try the next device. Do not panic: this is not a virus or a network fault."],
    ["Enter the BIOS and check that the drive is detected", "Restart, press the BIOS key (often Del, F2, F10 or F12) and look for your SSD/HDD in the storage or boot menu."],
    ["Check the boot priority", "Put 'Windows Boot Manager' or your SSD/HDD ahead of 'Network' / 'PXE' / 'LAN'. You can leave network boot enabled in a lower position or disable it if you never use it.", "Intermediate"],
    ["Remove other devices", "Unplug USB drives and discs. This also helps to rule out a wrong boot device.", "Beginner"],
    ["If the drive is missing from BIOS", "Follow 'No Bootable Media': power off, unplug, and check that SATA or NVMe connections are secure. Laptop drives should be checked by a technician.", "Intermediate"],
    ["If the drive is present but there is no boot entry", "The startup files may be damaged. Use Windows Startup Repair from an installer USB. Back up first if possible.", "Advanced"],
    ["Work or school computer", "Do not change settings; contact your IT team, as network boot may be part of how the device is managed.", "Beginner"]
  ],
  dont: ["Do not blame your internet connection: the router is rarely the cause.", "Do not disable all boot options or change many BIOS settings at once.", "Do not format or reinstall Windows before checking that the drive is detected.", "Do not change settings on a managed work PC without IT approval."],
  call: ["The drive is not detected after you check the cables.", "Windows will not start even with the right boot entry first.", "A company PC suddenly boots to PXE."],
  warn: null,
  related: ["no-bootable", "uefi-legacy", "bios-cmos"]
});

PROBLEMS.push({
  id: "uefi-legacy", cat: "boot", level: "Advanced",
  title: "UEFI vs Legacy Boot Mismatch",
  blurb: "Windows stops booting after BIOS settings were changed, because the boot mode no longer matches how Windows was installed.",
  art: "uefiLegacy", caption: "UEFI firmware pairs with a GPT disk and Legacy/CSM pairs with an MBR disk; mismatched pairs cannot start Windows.",
  scope: "Desktop and laptop",
  kw: ["uefi vs legacy", "csm", "legacy boot", "uefi boot", "operating system not found after bios change", "boot device not recognized", "windows won't start after changing bios", "gpt mbr", "secure boot", "boot mode", "windows not booting after bios reset", "bios reset boot problem"],
  err: ["Operating System not found", "Boot device not found", "No bootable device", "Invalid partition table", "Missing operating system", "Secure Boot violation"],
  see: ["'Operating system not found' or a similar message.", "Boot device is not recognized.", "Windows fails to start after BIOS settings were changed or reset."],
  means: "UEFI is the modern way a PC starts: it expects the drive to use a style called GPT. Legacy (also called CSM) is the older way, which expects a style called MBR. Windows was installed in one of these modes and can only start in the matching mode. If a BIOS reset, update or setting change flips the mode, the PC looks for Windows in the wrong way and cannot find it, even though your files are fine.",
  causes: ["BIOS reset or update returned to a different default boot mode.", "CSM/Legacy was enabled or disabled by accident.", "The disk partition style (GPT/MBR) no longer matches the firmware mode.", "Windows installed from a USB stick that started in a different mode.", "Secure Boot setting changed."],
  extra: [
    { h: "Simple explanation", p: ["UEFI and Legacy are two different 'languages' for starting a computer. Windows installed in the UEFI language will not answer when the PC asks for it in the Legacy language, and vice versa."], ul: ["UEFI + GPT: modern, used on nearly all PCs since about 2012; required for Windows 11 and Secure Boot.", "Legacy/CSM + MBR: older systems and older installations."] },
    { h: "Check the existing installation before changing settings", p: ["If Windows still starts on this or another PC, you can check how it is installed:"], ul: ["Press Windows + R, type `msinfo32`, press Enter, and read 'BIOS Mode': it says UEFI or Legacy.", "Open Disk Management, right-click the system disk, choose Properties, then the Volumes tab, and read 'Partition style': GUID Partition Table (GPT) or Master Boot Record (MBR).", "Match them: UEFI goes with GPT, and Legacy goes with MBR."] }
  ],
  steps: [
    ["Remember what changed", "Think about the last BIOS change: reset to defaults, update, a changed boot option or a newly enabled CSM/Legacy setting. The safest fix is usually to undo that change."],
    ["Stop flipping settings back and forth", "Do not repeatedly toggle UEFI and Legacy to 'see if it works'. Changes can also affect Secure Boot and storage modes."],
    ["Open BIOS and note the current boot mode", "Look for 'Boot Mode', 'CSM', 'Launch CSM', 'UEFI/Legacy' or 'Secure Boot'. Photograph the settings before changing anything.", "Intermediate"],
    ["Restore the previous setting", "If you know the old mode, set it back. For modern PCs, this is typically UEFI with CSM disabled; older installs may need Legacy/CSM.", "Intermediate"],
    ["Check the disk style from another PC (if needed)", "Connect the drive to another working PC and check GPT or MBR in Disk Management. This tells you which mode is needed. Do not initialise or format it.", "Advanced"],
    ["Repair with Startup Repair", "If boot files are missing, use Windows installer USB, then Repair, then Startup Repair. Back up first where possible.", "Advanced"],
    ["Conversion only with a backup", "Converting between MBR and GPT (for example with Microsoft's MBR2GPT tool) is possible but risky and needs a full backup. Ask a technician.", "Technician Only"]
  ],
  dont: ["Do not blindly tell beginners (or yourself) to toggle UEFI and Legacy.", "Do not reformat or reinstall Windows just to change the boot mode.", "Do not convert disks (MBR/GPT) without a backup.", "Do not disable Secure Boot without knowing why."],
  call: ["The right boot mode is unknown and the PC holds important data.", "Windows needs recovery or disk conversion.", "Multiple operating systems or drives are installed.", "A managed work PC changed mode unexpectedly."],
  warn: { t: "Back up before conversions", d: "Changing disk types or reinstalling Windows can erase data. Prefer undoing the BIOS change first, and involve a professional if the files matter." },
  related: ["no-bootable", "pxe-dhcp", "bios-cmos"]
});

PROBLEMS.push({
  id: "bios-cmos", cat: "boot", level: "Intermediate",
  title: "BIOS / CMOS Problems and Reset",
  blurb: "Date and time keep resetting, settings are lost or the boot order changes: usually a flat CMOS battery.",
  art: "bios", caption: "A BIOS setup screen showing the date reset to 01/01/2000 and a 'CMOS checksum error', beside a coin-cell battery.",
  scope: "Desktop procedure; laptops usually need a professional",
  kw: ["cmos battery", "date and time keep resetting", "bios settings lost", "boot order changes", "clock resets", "cmos checksum error", "reset bios", "clear cmos", "bios password", "bios update", "coin battery", "cr2032", "system time wrong", "pc forgets settings", "bios defaults"],
  err: ["CMOS checksum error", "CMOS battery low", "CMOS read error", "Date and time not set", "Press F1 to continue, DEL to enter setup", "System CMOS checksum bad - Run Setup"],
  see: ["Date and time keep resetting.", "BIOS settings are lost.", "Boot order changes unexpectedly.", "The system fails to POST after incorrect BIOS configuration."],
  means: "The BIOS/UEFI is the small program built into the motherboard that starts the hardware before Windows. It stores settings (time, boot order, memory options) in a tiny memory kept alive by a coin-sized CMOS battery. When that battery is flat, the settings are forgotten each time the PC is unplugged. The fix for that is a new battery. A bad setting, on the other hand, can stop the PC from starting and needs a reset to defaults.",
  causes: ["Flat or failing CMOS battery (commonly a CR2032, often after several years).", "Incorrect BIOS configuration (for example a bad overclock or memory setting).", "A failed or interrupted BIOS update.", "A damaged or loose battery holder.", "Settings were deliberately reset by a BIOS update or by clearing CMOS."],
  extra: [
    { h: "Replace or reset: what is the difference?", p: ["Replace the battery when time and date reset repeatedly and you see CMOS errors. Reset BIOS to defaults when a setting you changed is causing trouble, for example a PC that will not start after an overclock."] },
    { h: "Avoid unnecessary BIOS updates", p: ["Do not update the BIOS unless you need a specific fix or CPU support. Never interrupt a BIOS update (do not switch off or unplug the PC), and use stable power, because an interrupted update can leave the motherboard unable to start."] }
  ],
  steps: [
    ["Note your current BIOS settings", "If you can get into BIOS, photograph each page. You will need to restore important items such as SATA mode, boot mode and memory (XMP/EXPO) profile after a reset."],
    ["Check whether the problem is the battery", "If date and time reset every time the PC is unplugged or left off for a while, the CMOS battery is the likely cause."],
    ["Replace the CMOS battery (desktop)", "Shut down, unplug and touch bare metal on the case. Release the clip next to the coin battery and remove it, noting which side faces up (+ usually up). Fit a new battery of the same type (often CR2032).", "Intermediate"],
    ["Set date, time and boot order", "Enter BIOS, set the correct date and time, check the boot order and save and exit."],
    ["Load default settings if a setting caused the problem", "In BIOS, choose 'Load Optimized Defaults' (or similar), save and exit. Re-apply only the changes you really need. Be careful: defaults may change SATA mode or boot mode, which can affect Windows.", "Intermediate"],
    ["Clear CMOS (desktop)", "If the PC will not start, the motherboard manual shows how to clear CMOS (a jumper or button; or removing the battery for several minutes with the PC unplugged).", "Advanced"],
    ["Laptop: ask a professional", "Laptop CMOS batteries are often cabled inside and need the laptop opened. A technician should do this.", "Technician Only"]
  ],
  dont: ["Do not update the BIOS unless it is needed, and never interrupt an update.", "Do not change settings at random in BIOS.", "Do not use a battery of a different type; match the size and voltage.", "Do not short or pry the battery with metal tools while the PC is on."],
  call: ["A new battery does not stop the resets.", "The PC will not start after a BIOS update or reset.", "Laptop battery replacement is needed.", "A BIOS password blocks access to the settings."],
  warn: { t: "Unplug before touching the battery", d: "Shut down and unplug the PC, and touch bare metal on the case to discharge static. Never swallow or puncture a coin battery, and keep spares away from children." },
  related: ["no-bootable", "uefi-legacy", "boot-loop"]
});

/* ---------------- SECTION D — DISPLAY AND POST PROBLEMS ---------------- */
PROBLEMS.push({
  id: "beep-codes", cat: "display", level: "Intermediate",
  title: "Beep Codes with No Display",
  blurb: "The PC powers on, the monitor stays black and the motherboard beeps. Count the pattern and look it up.",
  art: "beep", caption: "A black screen and a motherboard buzzer producing a pattern of short and long beeps (example pattern only).",
  scope: "Mostly desktops; some laptops use light patterns instead",
  kw: ["beeping", "beep codes", "pc beeps and no display", "computer beeping on startup", "motherboard beeps", "long beep short beep", "continuous beeping", "repeating beeps", "beep sounds", "pc making noise no screen", "bios beep"],
  err: ["1 long 2 short beeps", "continuous beeping", "repeating beeps"],
  see: ["The computer powers on.", "The monitor stays black.", "The motherboard produces beep sounds."],
  means: "When a PC starts, it runs a quick self-test called POST. If it finds a serious hardware problem before the screen is working, the motherboard can beep a pattern as a spoken 'error code'. The pattern is a clue to where the fault might be (such as memory, graphics or processor). But the meaning is not the same for every PC: it depends on the motherboard and BIOS manufacturer.",
  causes: ["RAM problem (not seated, incompatible or faulty).", "Graphics card problem (not seated, not powered or faulty).", "CPU or motherboard fault.", "Keyboard or other device fault on some systems.", "Other fault; the pattern's exact meaning depends on the manufacturer."],
  extra: [
    { h: "Important: beep meanings are not universal", p: ["One short beep at startup is normal on some PCs and means 'all OK'. Other patterns mean different things on different boards, so never trust a chart from an unrelated brand. Do not assume that a certain number of beeps always means a CMOS battery problem or any other specific fault."] }
  ],
  steps: [
    ["Stay calm and listen carefully", "Note whether beeps are short, long or continuous, and whether there are pauses between groups. Many boards repeat the pattern."],
    ["Count and record the pattern", "Write it down (for example 'long, short, short, pause, repeat'). Record it on your phone so you can listen again."],
    ["Identify the motherboard or PC maker", "For a built PC: the model is printed on the motherboard, on its box or invoice. For Dell, HP, Lenovo and other branded PCs, use the system's model or service tag."],
    ["Find the beep-code table in the manual", "Open the motherboard or system manual (search the model online on the maker's website). Match your recorded pattern to that table. The BIOS maker (such as AMI, Award or Phoenix) may also be named in it."],
    ["Check for other diagnostic indicators", "Look for POST LEDs or a small code display on the board (labelled CPU, DRAM, VGA, BOOT), or blink patterns on the front panel or caps-lock light on laptops.", "Intermediate"],
    ["Follow the fix suggested by the manual", "Typical actions are re-seating RAM, re-seating the graphics card, or disconnecting extra devices. Carry out only what the table points to. See 'RAM Not Seated Properly' and 'Graphics Card Failure'.", "Intermediate"],
    ["Escalate CPU and motherboard faults", "If the manual points to the CPU or motherboard, have a technician diagnose it.", "Technician Only"]
  ],
  dont: ["Do not rely on random beep-code charts from the internet for a different manufacturer.", "Do not replace parts based on a guess.", "Do not assume the number of beeps always means the same thing.", "Do not keep power-cycling the machine repeatedly while it is beeping."],
  call: ["The manual points to the CPU or motherboard.", "Re-seating RAM and the graphics card does not change the pattern.", "You cannot identify the board or find its manual."],
  warn: { t: "Safety when opening the PC", d: "Shut down, switch off the PSU and unplug before opening the case or re-seating any part." },
  related: ["ram-seated", "gpu-failure", "running-no-beeps", "blinking-light"]
});

PROBLEMS.push({
  id: "blinking-light", cat: "display", level: "Beginner",
  title: "Power Light Blinking but No Display",
  blurb: "The power light blinks (or flashes in a pattern) and nothing appears on screen. It might be sleep mode or an error code.",
  art: "blinking", caption: "A desktop whose power light blinks amber (magnified), with a black monitor.",
  scope: "Desktop and laptop",
  kw: ["power light blinking", "blinking led", "power light flashing", "orange light blinking", "amber light blinking", "pc blinks but doesn't start", "sleep light", "flashing power button", "light flashes and no screen", "laptop led blinking", "caps lock blinking", "battery light blinking"],
  err: [],
  see: ["The power light or button blinks or pulses.", "The screen stays black.", "The light may blink in a pattern (for example 3 blinks, a pause, then repeat), or in different colours (white, amber, red)."],
  means: "A blinking light can mean very different things. A slow, soft pulse is often sleep or standby mode (normal). A fast or patterned blink on many laptops and some branded desktops is a diagnostic code: the machine is telling you what it found wrong (memory, battery, graphics, board). Colour and number of blinks matter, and the meaning depends on the manufacturer.",
  causes: ["The computer is asleep or in hibernation.", "Low battery or a charging problem (laptop).", "Memory problem.", "Graphics or display fault.", "Motherboard, CPU or BIOS problem.", "Peripheral or dock fault."],
  steps: [
    ["Check if it is simply sleeping", "A slowly pulsing light usually means sleep. Move the mouse, press a key, or briefly press the power button to wake it."],
    ["Note the pattern and colour", "Count the blinks (for example 3 blinks, then a pause) and note the colour. Write it down or record a video."],
    ["Check power and the laptop charger", "Make sure the charger is firmly connected and the charge light behaves normally. Try another outlet. A flat battery can cause blinking."],
    ["Look up the manufacturer's blink-code table", "Search your laptop or PC maker's support site for 'LED diagnostic codes' or 'blink codes' with the exact model or service tag. Do not use codes from another brand."],
    ["Disconnect extras", "Unplug USB devices, docks, external drives and extra monitors, then restart."],
    ["Do a power drain", "Unplug the charger or power cable (and remove a removable laptop battery), hold the power button for 15-30 seconds, reconnect and try again."],
    ["Re-seat RAM (desktop)", "If the code points to memory, follow 'RAM Not Seated Properly' with the PC unplugged.", "Intermediate"],
    ["Try an external monitor", "If the laptop seems to run but the screen is black, connect an external display to see if only the screen is faulty."]
  ],
  dont: ["Do not assume every blink means a serious failure; check for sleep mode first.", "Do not use a charger that does not match your laptop's rating.", "Do not open a sealed laptop to look for a fault.", "Do not guess the meaning from a chart for a different brand."],
  call: ["The manufacturer's table points to the motherboard, CPU or graphics.", "The blinking continues after a power drain and with the RAM re-seated.", "There is a burning smell, swelling battery or hot casing.", "The laptop is still under warranty; contact the maker to avoid voiding it."],
  warn: { t: "Swollen batteries", d: "If a laptop's case is bulging or the trackpad is lifting, the battery may be swollen. Stop using it, unplug it and seek professional help." },
  related: ["beep-codes", "running-no-beeps", "ram-seated", "no-power"]
});

PROBLEMS.push({
  id: "running-no-beeps", cat: "display", level: "Intermediate",
  title: "System Running but No Display and No Beeps",
  blurb: "Fans and lights are on, the screen is black and the PC stays silent. Work out which part is stopping the picture.",
  art: "runningNoBeeps", caption: "A running desktop with a completely black monitor, and a crossed-out speaker meaning no beeps.",
  scope: "Mostly desktops",
  kw: ["no display and no beeps", "pc on no display no sound", "system running no screen", "no post no beep", "black screen no beeps", "computer starts but nothing on screen", "silent no display", "no beep codes", "pc runs but screen black", "no signal and no beeps", "no display"],
  err: ["No Signal", "No Input"],
  see: ["Fans and lights are running.", "The screen stays black, and may show no message at all.", "The motherboard does not beep."],
  means: "The computer has power but cannot get to the stage where it creates a picture, or the picture is not reaching the screen. Silence is not a clue by itself: most modern motherboards have no built-in speaker, so no beeps does not mean 'everything is fine' or 'something is broken'. You need to narrow it down: display path, memory, graphics, processor, BIOS or board.",
  causes: ["Monitor, cable or input source problem.", "Wrong video port used (graphics card vs motherboard).", "RAM problem.", "Graphics card problem.", "CPU not seated, unsupported by the BIOS version, or failed.", "Corrupt or wrongly configured BIOS.", "Motherboard fault.", "No speaker or buzzer installed, so errors cannot be heard."],
  steps: [
    ["Confirm the monitor works", "Check power, input source and cable. Test the monitor with another device. See 'Fans Spin but No Display'."],
    ["Use the correct video port", "If there is a dedicated graphics card, use its ports, not the motherboard's."],
    ["Look at the diagnostic lights", "Check for POST LEDs or a code display on the motherboard. Their meaning is in the manual.", "Intermediate"],
    ["Add a speaker to hear the codes", "Many boards have a small header for a case speaker or buzzer. A cheap case speaker lets you hear beep codes. Check the manual for its location.", "Intermediate"],
    ["Re-seat the RAM", "With the PC off and unplugged, re-seat the memory (see 'RAM Not Seated Properly'), then test sticks one at a time.", "Intermediate"],
    ["Re-seat the graphics card and its power cables", "Check the card, or try the integrated graphics if available.", "Intermediate"],
    ["Clear the CMOS", "A settings reset can help after changes. See 'BIOS / CMOS Problems' and the motherboard manual.", "Advanced"],
    ["Strip down to the minimum", "Experienced builders can remove extra drives and cards and start with only CPU, one RAM stick, a graphics source and the PSU. Add parts back one at a time.", "Advanced"],
    ["Check CPU compatibility", "If you have just installed a new CPU, the board may need a newer BIOS to support it. A technician can update or check this.", "Technician Only"]
  ],
  dont: ["Do not assume the lack of beeps means the motherboard is dead.", "Do not update or flash the BIOS blindly while troubleshooting.", "Do not open the PC or touch internal parts while it is plugged in.", "Do not swap multiple parts at once; change one thing at a time."],
  call: ["Monitor, cables, RAM and graphics all test fine.", "A new CPU may need a BIOS update.", "You suspect the CPU or motherboard is faulty.", "You are not comfortable opening the PC."],
  warn: { t: "Unplug before opening", d: "Always shut down, switch off the PSU and unplug the PC before touching RAM, cards or cables." },
  related: ["fans-no-display", "beep-codes", "ram-seated", "gpu-failure"]
});

/* ---------------- SECTION E — POWER SUPPLY TROUBLESHOOTING ---------------- */
PROBLEMS.push({
  id: "psu-failure", cat: "psu", level: "Advanced",
  title: "PSU Not Working / Power Supply Failure",
  blurb: "A completely dead PC, a burning smell or random shutdowns under load: is it the cable, the outlet or the power supply?",
  art: "psuFail", caption: "A dead desktop and a power supply with a stopped fan, a burn mark and rising smoke.",
  scope: "Desktop (laptops use an external charger)",
  kw: ["psu testing", "power supply failure", "pc dead", "burning smell", "random shutdowns under load", "pc shuts down when gaming", "psu not working", "power supply tester", "bad power supply", "no lights no fans", "psu replacement", "pc turns off randomly", "smoke from computer", "paperclip test"],
  err: ["Power supply failure", "PSU tester shows fail"],
  see: ["A completely dead PC with no lights or fans.", "No charging indicator where applicable (for example a laptop's adapter).", "A burning smell.", "Random shutdowns under load (for example while gaming)."],
  means: "The power supply unit (PSU) converts wall power into the lower, steady voltages every part of a desktop needs. If it fails, nothing works, or the PC shuts off whenever demand rises. Because it handles mains electricity, it is both the most common failure point and the most dangerous part to handle improperly.",
  causes: ["Faulty power cable.", "Faulty outlet or power strip.", "PSU rear switch set to off.", "Failed or aged PSU (worn capacitors, failed fan, tripped protection).", "PSU too weak for the parts installed (for example after a graphics card upgrade).", "Short circuit or other faulty component triggering the PSU's protection.", "Physical damage or heat."],
  extra: [
    { h: "Cable, outlet or PSU: how to tell the difference", p: ["Work from the outside in:"], ul: ["Faulty cable: a different, known-good cable (of the same type) makes the PC start.", "Faulty outlet: a lamp or phone charger does not work in the same outlet, but the PC works in another one.", "Faulty PSU: the cable and outlet are both fine, the PSU switch is on, and a PSU tester or technician shows a problem."] },
    { h: "Safe PSU testing", p: ["The safe way for most people is a dedicated plug-in PSU tester: a small device that you connect to the PSU's main cable (with the PSU disconnected from the PC and the wall). It lights or shows readings for the main voltage lines and the power-good signal. It is only a basic check, not a full test under load.", "A qualified technician can check voltage rails with appropriate equipment, and test under load, which finds faults that a simple tester misses."] },
    { h: "Advanced PSU Testing — Paperclip Test", tech: true, p: ["Some technicians use a 'paperclip test' to see whether a PSU will start by itself. It is a technician-only procedure, it is not a full PSU test, and it carries real risk when done wrongly. A spinning fan does not prove that a PSU is healthy.", "This site does not give a live step-by-step procedure for beginners. If you are inexperienced, use a dedicated PSU tester or ask a qualified technician."], link: ["paperclip-test", "Read the full Paperclip Test explanation"] },
    { h: "When PSU replacement is needed", ul: ["Burning smell, smoke, sparks, swollen or damaged parts.", "Dead PSU after the cable, outlet and switch have been ruled out.", "A tester or technician reports failed voltage lines.", "Repeated shutdowns under load that continue after other causes are ruled out.", "Replace with a quality unit of enough wattage and the correct connectors. Do not mix modular cables between different PSU models or brands."] }
  ],
  steps: [
    ["Check the wall outlet", "Test it with a lamp or phone charger. Try another outlet or power strip."],
    ["Check the power cable", "Re-seat both ends and inspect for damage. Try a known-good cable of the same type."],
    ["Check the PSU rear switch", "On a desktop, set the small switch on the PSU to I (on)."],
    ["Look for warning signs", "If you smell burning, see smoke, or notice scorch marks, unplug at once and stop using the PSU."],
    ["Use a dedicated PSU tester", "Follow the tester's instructions with the PSU unplugged from the wall and from the PC parts. A pass is only a basic check; it does not test performance under load.", "Advanced"],
    ["Consider the load", "If the PC shuts down under load (gaming), check that the PSU wattage suits your graphics card and CPU, and look for heat or dust problems too.", "Advanced"],
    ["Get a technician to test voltage rails", "A qualified technician can measure voltages and test under load with the right equipment.", "Technician Only"],
    ["Replace the PSU if it has failed", "Choose a quality replacement of adequate wattage with the connectors your parts need. If you are not experienced, let a technician fit it.", "Advanced"]
  ],
  dont: ["Never open a PSU casing.", "Do not touch exposed PSU circuitry.", "Do not keep using a PSU that smells burnt, smokes or is visibly damaged.", "Do not assume a spinning fan means the PSU is fine.", "Do not use a PSU with cables from a different model or brand."],
  call: ["The cable, outlet and PSU switch are fine and the PC is still dead.", "There is a burning smell, smoke or visible damage.", "Random shutdowns continue and you cannot find the cause.", "You need PSU voltage rails tested or the PSU replaced."],
  warn: { t: "Never open a PSU", d: ["Never open a PSU casing.", "Internal capacitors can retain dangerous electrical charge even after unplugging.", "Do not touch exposed PSU circuitry.", "Stop using a PSU if there is a burning smell, smoke or visible damage."] },
  related: ["paperclip-test", "no-power", "power-cable", "mb-short"]
});

PROBLEMS.push({
  id: "paperclip-test", cat: "psu", level: "Technician Only",
  title: "Advanced PSU Testing — Paperclip Test",
  blurb: "What the paperclip test is, why technicians use it, and why it is not recommended for beginners or a proof of a healthy PSU.",
  art: "paperclip", caption: "A PSU main connector with a crossed-out paperclip, and a dedicated PSU tester showing voltage readings.",
  scope: "Desktop power supplies",
  kw: ["paperclip test", "psu testing", "test power supply without computer", "jump start psu", "ps_on", "psu bypass", "power supply paper clip", "how to test psu", "psu tester", "psu spins but pc won't turn on", "psu fan spins", "24 pin jumper"],
  err: [],
  see: ["A desktop PC that will not start and you suspect the PSU.", "An online guide telling you to 'jump' a PSU with a paperclip.", "A PSU whose fan spins, but the PC still will not start."],
  means: "The paperclip test is a quick technician trick to see whether a PSU will switch on without a motherboard. It only answers a narrow question (does it start?). It does not tell you whether the PSU is healthy, and doing it wrongly can cause electrical hazards. For almost everyone, a dedicated PSU tester or a technician is the right choice.",
  causes: ["Used by technicians to separate 'PSU won't start' from 'motherboard is not telling the PSU to start'.", "Often suggested online without proper warnings.", "Not appropriate when the PSU shows damage, smells burnt or has been wet."],
  extra: [
    { h: "What is the paperclip test?", tech: true, p: ["It is a technician-only method of making a PSU turn on while it is disconnected from the computer's parts. A technician temporarily connects two specific contacts on the PSU's main cable so the PSU believes the motherboard has asked it to start. This guide intentionally gives no beginner step-by-step procedure."] },
    { h: "What does the PS_ON signal do?", p: ["PS_ON ('power supply on') is a control wire between the motherboard and the PSU. The PSU normally holds this wire at a 'standby' level. When you press the power button, the motherboard pulls the wire to ground and the PSU responds by turning on its main outputs. The paperclip test imitates that signal. Without it, the PSU stays in standby, even when plugged in."] },
    { h: "Why do technicians sometimes use it?", p: ["To check quickly whether a PSU can start on its own. If the PSU will not start by itself, it is likely faulty. If it does start, the motherboard, the power button or another component may be responsible. It is a diagnostic shortcut for people who understand the risks and who use proper equipment afterwards."] },
    { h: "A spinning fan does NOT prove a PSU is healthy", p: ["A PSU fan can spin, and the PSU can switch on, while the voltages are wrong, unsteady or collapse under load. A fan spinning only shows that some of the PSU's circuits work. Worn capacitors, unstable voltage lines or a missing 'power good' signal can still stop a PC from running properly."] },
    { h: "What the test does NOT verify", ul: ["Voltage regulation: whether each output stays within safe limits.", "Ripple and noise on the power lines.", "Performance under load, when the computer is actually drawing power.", "Correct timing of the 'power good' signal that tells the motherboard that power is stable.", "Safety protections working correctly."] },
    { h: "Why incorrect testing is dangerous", ul: ["A PSU contains mains-voltage circuitry and delivers high current: mistakes can cause sparks, burns, fire or damage to every connected part.", "A metal clip can touch the wrong contact and short a power line.", "Testing a damaged, wet or burnt PSU is hazardous.", "Connecting the PSU to drives or boards while experimenting can destroy them.", "Online instructions often skip safety checks and are not suitable for beginners."] },
    { h: "Safe alternatives", p: ["Use a dedicated plug-in PSU tester (it costs little and is made for this job) or take the PC to a qualified technician for voltage-rail and load testing. Never open the PSU case."], link: ["psu-failure", "Back to PSU troubleshooting"] }
  ],
  steps: [
    ["Decide honestly whether you are trained", "If you have never worked with PSUs, stop here. Do not attempt this test."],
    ["Rule out the simple causes first", "Check the outlet, power cable and PSU rear switch (see 'Power Cable Issue')."],
    ["Use a dedicated PSU tester instead", "Follow the tester's own instructions, with the PSU disconnected from the wall and from all PC parts."],
    ["Treat a 'pass' as a basic check only", "A pass does not prove the PSU performs correctly under load; if the PC is still unstable, get further testing."],
    ["Book a technician for voltage and load testing", "A qualified technician can measure voltage rails and test under load with proper equipment.", "Technician Only"],
    ["Replace the PSU when needed", "If the PSU has failed, replace it with a quality unit of enough wattage and correct connectors.", "Advanced"]
  ],
  dont: ["Do not copy step-by-step online guides if you are not trained.", "Do not run the test with the PSU still connected to the motherboard, drives or graphics card.", "Do not open the PSU casing for any reason.", "Do not test a PSU that is damaged, wet, burnt or has swollen parts.", "Do not treat a spinning fan as a pass."],
  call: ["You suspect the PSU is faulty and you are not trained to test it.", "A PSU tester shows a fail or unusual readings.", "There is a burning smell, smoke or damage.", "The PC shuts down under load and you need voltage-rail testing."],
  warn: { t: "Never open a PSU", d: ["Never open a PSU casing.", "Internal capacitors can retain dangerous electrical charge even after unplugging.", "Do not touch exposed PSU circuitry.", "Stop using a PSU if there is a burning smell, smoke or visible damage."] },
  banner: "TECHNICIAN ONLY — NOT RECOMMENDED FOR BEGINNERS",
  related: ["psu-failure", "no-power", "power-cable"]
});

/* end of content */

document.addEventListener("DOMContentLoaded", init);
