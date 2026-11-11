import { CATEGORIES, TERMS, TERM_BY_ID, catName, subName } from "./data.js";
import { searchTerms, retrieve } from "./rag.js";
import { renderDiagram, highlight, idsInDiagram } from "./diagrams.js";
import { renderFigure, mountFigure, figureTermIds } from "./figview.js";
import { IDS_3D } from "./model3d.js";
import { FIGURES } from "./figures.js";

const view = document.getElementById("view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let cleanup = null; // 페이지 이탈 시 정리 (3D 렌더러 등)

// ─────────────────── 공통 조각 ───────────────────
function searchBox(id, placeholder = "용어를 입력하세요 (예: 고주, 보주)") {
  return `<div class="search-wrap"><form class="search" role="search" data-search>
    <label for="${id}">검색 :</label>
    <input id="${id}" type="search" enterkeyhint="search" autocomplete="off" placeholder="${placeholder}" />
  </form><ul class="suggest" data-suggest></ul></div>`;
}
function bindSearch(root) {
  const form = root.querySelector("[data-search]");
  if (!form) return;
  const input = form.querySelector("input");
  const list = root.querySelector("[data-suggest]");
  input.addEventListener("input", () => {
    const q = input.value.trim();
    list.innerHTML = q ? searchTerms(q, 6).map((t) => `<li><a href="#/t/${t.id}"><b>${esc(t.name)}</b><small>${esc(t.short)}</small></a></li>`).join("") : "";
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); location.hash = `#/s/${encodeURIComponent(input.value.trim())}`; });
}
function header(cat, here) {
  return `<header class="top">
    <div class="top-row"><a class="logo" href="#/">TAMSAEK – H</a></div>
    <nav class="cat-tabs" aria-label="대주제">
      <a href="#/" class="${!cat ? "on" : ""}">전체</a>
      ${CATEGORIES.map((c) => `<a href="#/c/${c.id}" class="${c.id === cat ? "on" : ""}">${c.name}</a>`).join("")}
    </nav>
    <div class="page-search">${here ? `<span class="here">${esc(here)}</span>` : ""}${searchBox("q-top")}</div>
  </header>`;
}
function termList(terms) {
  if (!terms.length) return `<p class="placeholder">해당하는 용어가 없습니다.</p>`;
  return `<ul class="term-list">${terms.map((t) => `<li class="c-${t.cat}"><a href="#/t/${t.id}"><b>${esc(t.name)}</b>${t.hanja ? `<span class="h">${esc(t.hanja)}</span>` : ""}<p>${esc(t.short)}</p></a></li>`).join("")}</ul>`;
}
// 용어 id → 그 용어가 표시된 도면(소주제) 경로
const ROUTES = {};
for (const c of CATEGORIES) for (const s of c.subs) {
  const ids = s.figs ? s.figs.flatMap(figureTermIds) : s.diagram === "model3d" ? IDS_3D : s.diagram ? idsInDiagram(renderDiagram(s.diagram)) : [];
  for (const id of ids) {
    if (c.id === "temple" && TERM_BY_ID[id]?.sub !== s.id) continue; // 사찰은 같은 배치도를 공유하므로 용어의 소주제 페이지로 연결
    ROUTES[id] ??= `#/c/${c.id}/${s.id}`;
  }
}
function diagramRoute(t) {
  return ROUTES[t.id] ? `${ROUTES[t.id]}?sel=${t.id}` : null;
}
// 국가유산 디지털(digital.khs.go.kr). 검색 주소 형식을 확인하지 못해 첫 화면으로 보내고, 용어를 복사해 붙여넣게 한다.
const PHOTO_SITE = "https://digital.khs.go.kr/";
const searchWord = (t) => t.name.replace(/\(.+\)$/, "");
let toastTimer;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-photo]");
  if (!a) return;
  const word = a.dataset.photo;
  try { navigator.clipboard?.writeText(word); } catch { /* 복사 실패해도 사이트는 열린다 */ }
  toast(`‘${word}’ 복사됨 — 국가유산 디지털 검색창에 붙여넣으세요`);
});
function detailHTML(t, { showMapLink = true } = {}) {
  const rel = t.related.map((r) => TERM_BY_ID[r]).filter(Boolean);
  const map = showMapLink ? diagramRoute(t) : null;
  return `<h2>${esc(t.name)}${t.hanja ? `<span class="h">${esc(t.hanja)}</span>` : ""}</h2>
    <p class="short">${esc(t.short)}</p>
    <p class="desc">${esc(t.desc)}</p>
    ${t.aliases.length ? `<p class="lead">다른 이름 · ${t.aliases.map(esc).join(", ")}</p>` : ""}
    ${rel.length ? `<div class="section-title">관련 용어</div><div class="chips">${rel.map((r) => `<a class="chip" href="#/t/${r.id}" data-pick="${r.id}">${esc(r.name)}</a>`).join("")}</div>` : ""}
    <div class="actions">
      ${map ? `<a class="btn primary" href="${map}">도면·3D에서 위치 보기</a>` : ""}
      <a class="btn" href="${PHOTO_SITE}" target="_blank" rel="noopener" data-photo="${esc(searchWord(t))}">실제 사진 보기 ↗</a>
      <a class="btn" href="#/ai/tutor?q=${encodeURIComponent(`${t.name}에 대해 설명해줘`)}">AI 튜터에게 묻기</a>
    </div>
    <p class="meta">${esc(catName(t.cat))} › ${esc(subName(t.cat, t.sub))} · 출처: ${esc(t.source)}</p>`;
}

// ─────────────────── 페이지 ───────────────────
const ICONS = {
  stone: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3v5M21 8h6l1 3h-8zM16 11h16l3 5H13zM18 16v7M30 16v7M11 23h26l3 6H8zM14 29v8M34 29v8M6 37h36v5H6z"/></svg>`,
  wood: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M3 19 24 7l21 12M8 19h32M12 19v20M36 19v20M20 39V27h8v12M5 39h38"/></svg>`,
  buddha: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="15" r="6"/><circle cx="24" cy="15" r="13" stroke-dasharray="2 3"/><path d="M13 41c0-9 4-15 11-15s11 6 11 15zM7 41h34M20 33c2 2 6 2 8 0"/></svg>`,
  temple: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 14h40M9 14l-3-6h36l-3 6M14 14v26M34 14v26M10 24h28M3 40h42"/></svg>`,
};
function pageHome() {
  view.innerHTML = `<section class="home">
    <header class="hero">
      <span class="seal" aria-hidden="true">探</span>
      <h1 class="brand">TAMSAEK – H</h1>
      <p class="tagline">문화유산의 단어를 쉽게 이해하다.</p>
    </header>
    ${searchBox("q-home")}
    <div class="cat-grid">
      ${CATEGORIES.map((c) => `<a class="cat-card c-${c.id}" href="#/c/${c.id}"><span class="ic">${ICONS[c.id] || ""}</span><b>${c.name}</b></a>`).join("")}
    </div>
    <div class="ai-entry">
      <a href="#/ai/tag"><span class="ai-ic">📷</span><span>사진·도면으로 용어 찾기<small>AI가 부재를 인식해 태그</small></span></a>
      <a href="#/ai/tutor"><span class="ai-ic">💬</span><span>AI 용어 튜터<small>용어집 근거로 답변·출처 표시</small></span></a>
    </div>
  </section>`;
  bindSearch(view);
}

function pageCategory(catId) {
  const c = CATEGORIES.find((x) => x.id === catId);
  if (!c) return pageNotFound();
  view.innerHTML = `${header(c.id, c.name)}
    <h1 class="page">${c.name}</h1>
    <p class="lead">소주제를 고르면 도면에서 부재 위치와 함께 용어를 볼 수 있습니다.</p>
    <nav class="sub-grid">${c.subs.map((s) => `<a href="#/c/${c.id}/${s.id}">${s.name}</a>`).join("")}</nav>
    <div class="section-title">${c.name} 전체 용어 (${TERMS.filter((t) => t.cat === c.id).length})</div>
    ${termList(TERMS.filter((t) => t.cat === c.id))}`;
  bindSearch(view);
}

async function pageDiagram(catId, subId, sel) {
  const c = CATEGORIES.find((x) => x.id === catId);
  const s = c?.subs.find((x) => x.id === subId);
  if (!s) return pageNotFound();
  const is3D = s.diagram === "model3d";
  const figs = s.figs || [];
  const hasFigure = is3D || figs.length || s.diagram;
  const subTerms = TERMS.filter((t) => t.cat === catId && t.sub === subId);
  const figLabel = (k) => FIGURES[k].title.match(/\((.+)\)/)?.[1] ?? FIGURES[k].title;

  let figureHTML = "";
  if (is3D) figureHTML = `<div class="stage" id="stage"><div class="loading" id="loading"><span><span class="spinner"></span><br/>3D 모델 불러오는 중…</span></div>
          <div class="tools"><button type="button" id="roof">지붕</button><button type="button" id="reset">해제</button></div></div>`;
  else if (figs.length) figureHTML = `${figs.length > 1 ? `<div class="seg" id="figtabs">${figs.map((k, i) => `<button type="button" data-fig="${k}" class="${i ? "" : "on"}">${esc(figLabel(k))}</button>`).join("")}</div>` : ""}<div id="figbox"></div>`;
  else if (s.diagram === "temple") figureHTML = `<span class="hint">건물을 탭하세요 · 좌우로 밀어 볼 수 있어요</span><div class="dgscroll">${renderDiagram("temple", { sub: s.id })}</div>`;
  else if (s.diagram) figureHTML = `<span class="hint">부재나 이름을 탭하세요</span>${renderDiagram(s.diagram)}`;

  view.innerHTML = `${header(c.id, c.name)}
    <nav class="sub-grid">${c.subs.map((x) => `<a href="#/c/${c.id}/${x.id}" class="${x.id === subId ? "on" : ""}">${x.name}</a>`).join("")}</nav>
    ${hasFigure ? `<div class="figure${figs.length ? " figure-photo" : ""}" id="fig">${figureHTML}</div>` : ""}
    ${hasFigure ? `<div class="chips" id="chips"></div>` : `<div id="chips" hidden></div>${termList(subTerms)}`}
    <article class="detail" id="detail" hidden aria-live="polite"></article>
    ${hasFigure ? `<p class="placeholder" id="ph">${is3D ? "모델을 돌려 보고(한 손가락 회전·두 손가락 확대) 부재를 탭하세요." : figs.length ? "도면의 부재나 이름을 탭하면 금색으로 강조되고 설명이 나타납니다. ＋/− 로 확대하고 손가락으로 움직여 보세요." : "도면에서 부재를 탭하면 금색으로 강조되고 설명이 나타납니다."}</p>` : `<p id="ph" hidden></p>`}`;
  bindSearch(view);

  const chips = view.querySelector("#chips");
  const detail = view.querySelector("#detail");
  const ph = view.querySelector("#ph");
  let ids = [];
  let selectFn = () => false;

  if (is3D) {
    const { mountModel } = await import("./model3d.js");
    ids = IDS_3D;
    const names = Object.fromEntries(ids.map((i) => [i, TERM_BY_ID[i]?.name]));
    try {
      const stage = view.querySelector("#stage");
      const model = await mountModel(stage, { onPick: (id) => choose(id), names });
      if (!stage.isConnected) return model.dispose(); // 로딩 중 다른 페이지로 이동한 경우
      view.querySelector("#loading")?.remove();
      selectFn = (id) => model.select(id);
      const roofBtn = view.querySelector("#roof");
      roofBtn.onclick = () => roofBtn.classList.toggle("on", model.toggleRoof());
      view.querySelector("#reset").onclick = () => choose(null);
      cleanup = () => model.dispose();
    } catch (e) {
      console.error(e);
      const ld = view.querySelector("#loading");
      if (ld) ld.textContent = "3D를 불러오지 못했습니다. 네트워크 연결(three.js CDN)과 WebGL 지원 여부를 확인하세요.";
    }
  } else if (figs.length) {
    // 원본 도면(사용자 제공 부록). 소주제에 도면이 여러 장이면 탭으로 전환
    const box = view.querySelector("#figbox");
    const tabs = view.querySelector("#figtabs");
    let cur, viewer;
    const show = (k) => {
      cur = k;
      box.innerHTML = renderFigure(k);
      viewer = mountFigure(box.firstElementChild, k, (id) => choose(id));
      tabs?.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.fig === k));
    };
    tabs?.addEventListener("click", (e) => { const b = e.target.closest("[data-fig]"); if (b && b.dataset.fig !== cur) { show(b.dataset.fig); choose(null); } });
    show(figs[0]);
    ids = [...new Set(figs.flatMap(figureTermIds))];
    selectFn = (id) => {
      if (id && !figureTermIds(cur).includes(id)) { const other = figs.find((k) => figureTermIds(k).includes(id)); if (other) show(other); }
      return viewer.select(id);
    };
  } else if (s.diagram) {
    const svg = view.querySelector("#fig svg");
    ids = idsInDiagram(svg.outerHTML);
    const scroller = s.diagram === "temple" ? svg.parentElement : null;
    selectFn = (id) => {
      const ok = highlight(svg, id);
      if (ok && scroller) {
        const r = svg.querySelector(".part.on").getBoundingClientRect(), sr = scroller.getBoundingClientRect();
        scroller.scrollTo({ left: scroller.scrollLeft + (r.left + r.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" });
      }
      return ok;
    };
    if (scroller && !sel) requestAnimationFrame(() => { scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2; });
    svg.addEventListener("click", (e) => {
      const el = e.target.closest("[data-id]");
      choose(el ? el.dataset.id : null);
    });
  }
  // 이 페이지의 용어 칩: 도면에 있는 용어 + 소주제 용어(사찰은 소주제 필터)
  const chipIds = catId === "temple" ? subTerms.map((t) => t.id) : [...new Set([...ids, ...subTerms.map((t) => t.id)])];
  chips.innerHTML = chipIds.filter((i) => TERM_BY_ID[i]).map((i) => `<button type="button" class="chip" data-pick="${i}">${esc(TERM_BY_ID[i].name)}</button>`).join("");
  chips.addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) choose(b.dataset.pick); });
  detail.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-pick]");
    if (a && chipIds.includes(a.dataset.pick)) { e.preventDefault(); choose(a.dataset.pick, true); }
  });

  function choose(id, scroll = false) {
    const t = id && TERM_BY_ID[id];
    const shown = t ? selectFn(id) : selectFn(null);
    chips.querySelectorAll(".chip").forEach((b) => b.classList.toggle("on", b.dataset.pick === id));
    if (!t) { detail.hidden = true; ph.hidden = !hasFigure; return; }
    detail.innerHTML = detailHTML(t, { showMapLink: !hasFigure }) + (hasFigure && shown === false ? `<p class="notice">이 도면에는 해당 부재가 따로 표시되어 있지 않습니다.</p>` : "");
    detail.hidden = false; ph.hidden = true;
    history.replaceState(null, "", `#/c/${catId}/${subId}?sel=${id}`);
    if (scroll) view.querySelector(hasFigure ? "#fig" : "#detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (sel) {
    choose(sel);
    if (hasFigure) setTimeout(() => view.querySelector("#fig")?.scrollIntoView({ block: "start" }), 60);
  }
}

function pageTerm(id) {
  const t = TERM_BY_ID[id];
  if (!t) return pageNotFound();
  view.innerHTML = `${header(t.cat, catName(t.cat))}<article class="detail">${detailHTML(t)}</article>`;
  bindSearch(view);
}

function pageSearch(q) {
  const res = q ? searchTerms(q) : [];
  view.innerHTML = `${header(null, null)}
    <h1 class="page">${q ? `‘${esc(q)}’ 검색 결과` : "용어 검색"}</h1>
    ${q ? termList(res) : `<p class="lead">총 ${TERMS.length}개 용어 · 이름, 한자, 다른 이름, 설명으로 찾을 수 있습니다.</p>${termList(TERMS)}`}
    ${q && !res.length ? `<p class="notice">용어집에 없는 표기일 수 있습니다. <a href="#/ai/tutor?q=${encodeURIComponent(`${q}이(가) 뭐야?`)}">AI 튜터에게 물어보기</a></p>` : ""}`;
  bindSearch(view);
  const input = view.querySelector("#q-top");
  input.value = q;
  if (!q) input.focus();
}

// ─────────────────── AI 태깅 ───────────────────
function pageTag() {
  view.innerHTML = `${header(null, "AI 태깅")}
    <h1 class="page">사진·도면으로 용어 찾기</h1>
    <p class="lead">답사 사진(예: 봉정사 덕휘루, 궁궐 부재)이나 도면·보고서 캡처를 올리면 AI가 부재를 인식해 용어 태그를 붙입니다. 태그를 탭하면 정의와 도면 위치를 확인할 수 있습니다.</p>
    <div class="uploader">
      <label>📷 사진 촬영<small>현장에서 바로</small><input type="file" accept="image/*" capture="environment" data-file /></label>
      <label>🖼 앨범·캡처<small>사진 / 도면 / 보고서</small><input type="file" accept="image/*" data-file /></label>
    </div>
    <div id="out"></div>
    <p class="notice">AI 판독은 보조 수단입니다. 신뢰도 ‘낮음’ 태그는 반드시 도면·문헌으로 다시 확인하세요.</p>`;
  bindSearch(view);
  view.querySelectorAll("[data-file]").forEach((inp) => inp.addEventListener("change", () => inp.files[0] && runTag(inp.files[0])));
}

async function downscale(file, max = 1568) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { url, base64: url.split(",")[1], mediaType: "image/jpeg" };
}

async function runTag(file) {
  const out = view.querySelector("#out");
  let img;
  try { img = await downscale(file); } catch { out.innerHTML = `<p class="notice err">이미지를 읽을 수 없습니다.</p>`; return; }
  out.innerHTML = `<img class="preview" src="${img.url}" alt="올린 이미지" /><div class="result-card"><span class="spinner"></span> 부재를 인식하는 중… (10~30초)</div>`;
  const card = out.querySelector(".result-card");
  try {
    const r = await fetch("api/tag", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: img.base64, mediaType: img.mediaType }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `오류 ${r.status}`);
    const label = { high: "높음", medium: "보통", low: "낮음" };
    card.innerHTML = `<p><b>판독 결과</b> · ${esc(data.scene)}</p>
      ${data.tags.length ? data.tags.map((tg) => {
        const t = TERM_BY_ID[tg.term_id];
        return `<div class="tag-row"><span class="badge ${tg.confidence}">${label[tg.confidence]}</span><div>
          <a href="#/t/${t.id}">${esc(t.name)}</a> <small class="where">${esc(t.short)}</small><div class="where">📍 ${esc(tg.where)}</div></div></div>`;
      }).join("") : `<p class="notice">용어집에 있는 부재를 찾지 못했습니다.</p>`}
      ${data.unlisted?.length ? `<p class="where">용어집에 없는 부재: ${data.unlisted.map(esc).join(", ")}</p>` : ""}`;
  } catch (e) {
    card.innerHTML = `<p class="notice err">${esc(e.message)}</p><p class="where">AI 기능은 서버(<code>npm start</code>)와 API 키가 있어야 동작합니다. 그동안 <a href="#/s/">용어 검색</a>이나 도면에서 직접 확인할 수 있습니다.</p>`;
  }
}

// ─────────────────── RAG 튜터 ───────────────────
const chatLog = []; // 세션 동안 유지
function renderAnswer(text) {
  // [id] 인용을 용어 링크로 변환
  return esc(text).replace(/\[([a-z0-9_]+)\]/g, (m, id) => (TERM_BY_ID[id] ? `<a class="cite" href="#/t/${id}">${esc(TERM_BY_ID[id].name)}</a>` : m));
}
function msgHTML(m) {
  if (m.role === "user") return `<div class="msg user">${esc(m.text)}</div>`;
  const srcs = m.sources?.length ? `<div class="srcs">근거 용어: ${m.sources.map((s) => `<a class="cite" href="#/t/${s.id}">${esc(s.name)}</a>`).join(" ")}<br/>출처: ${esc(m.sources[0].source)}</div>` : "";
  return `<div class="msg bot">${m.html ?? renderAnswer(m.text)}${srcs}</div>`;
}
function pageTutor(prefill) {
  view.innerHTML = `${header(null, "AI 튜터")}
    <h1 class="page">AI 용어 튜터</h1>
    <p class="lead">TAMSAEK-H 용어집에서 관련 항목을 먼저 찾고(RAG), 그 내용만 근거로 답합니다. 답변 속 용어를 탭하면 원문 정의로 이동합니다.</p>
    <div class="chips" id="examples">
      ${["1고주 5량가 구조에서 고주와 종보는 어떻게 연결돼?", "어칸과 협칸의 규모 차이 기준이 뭐야?", "석탑 상륜부를 아래부터 순서대로 알려줘", "주심포와 다포의 차이는?"].map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}
    </div>
    <div class="chat" id="chat">${chatLog.map(msgHTML).join("")}</div>
    <form class="composer" id="composer">
      <textarea id="ask" rows="1" placeholder="전통 건축 용어를 질문하세요" aria-label="질문"></textarea>
      <button class="btn primary" type="submit">묻기</button>
    </form>`;
  const form = view.querySelector("#composer");
  const ta = view.querySelector("#ask");
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  view.querySelector("#examples").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { ta.value = b.dataset.q; form.requestSubmit(); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); const q = ta.value.trim(); if (q) { ta.value = ""; ask(q); } });
  if (prefill) { ta.value = prefill; form.requestSubmit(); }
}

async function ask(q) {
  const chat = view.querySelector("#chat");
  chatLog.push({ role: "user", text: q });
  chat.insertAdjacentHTML("beforeend", msgHTML(chatLog.at(-1)) + `<div class="msg bot" id="pending"><span class="spinner"></span> 용어집을 찾는 중…</div>`);
  chat.lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
  let m;
  try {
    const r = await fetch("api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `오류 ${r.status}`), { status: r.status });
    m = { role: "bot", text: data.answer, sources: data.sources };
  } catch (e) {
    // AI 서버가 없을 때: 검색된 용어집 원문을 그대로 보여 줌 (환각 없는 대체 답변)
    const docs = retrieve(q, 5);
    m = { role: "bot", sources: docs.map((d) => ({ id: d.id, name: d.name, source: d.source })),
      html: `<span class="notice err" style="display:block">AI 답변을 받지 못했습니다 (${esc(e.message)}). 대신 용어집에서 찾은 원문입니다.</span>` +
        (docs.length ? docs.map((d) => `<b>${esc(d.name)}</b> — ${esc(d.desc)}`).join("\n\n") : "관련 용어를 찾지 못했습니다.") };
  }
  chatLog.push(m);
  view.querySelector("#pending")?.remove();
  view.querySelector("#chat")?.insertAdjacentHTML("beforeend", msgHTML(m));
}

function pageNotFound() {
  view.innerHTML = `${header(null, null)}<p class="placeholder">페이지를 찾을 수 없습니다. <a href="#/">홈으로</a></p>`;
  bindSearch(view);
}

// ─────────────────── 라우터 ───────────────────
function route() {
  cleanup?.(); cleanup = null;
  const [path, qs] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(qs || "");
  const seg = (path || "/").split("/").filter(Boolean).map(decodeURIComponent);
  let nav = "home";
  if (!seg.length) pageHome();
  else if (seg[0] === "c" && seg.length === 2) pageCategory(seg[1]);
  else if (seg[0] === "c" && seg.length === 3) pageDiagram(seg[1], seg[2], params.get("sel"));
  else if (seg[0] === "t") pageTerm(seg[1]);
  else if (seg[0] === "s") { nav = "search"; pageSearch(seg[1] || ""); }
  else if (seg[0] === "ai" && seg[1] === "tag") { nav = "tag"; pageTag(); }
  else if (seg[0] === "ai" && seg[1] === "tutor") { nav = "tutor"; pageTutor(params.get("q")); }
  else pageNotFound();
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();
