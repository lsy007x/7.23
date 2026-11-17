// 원본 도면 이미지 뷰어: 라벨·부재 위치 핫스팟, 금색 하이라이트(나머지 어둡게), 확대/이동
import { FIGURES } from "./figures.js";
import { TERM_BY_NAME } from "./data.js";
import { REGIONS } from "./regions.js";
import { REGIONS_MANUAL } from "./regions_manual.js";
import { BRACKETS } from "./brackets.js";

const idOf = (name) => TERM_BY_NAME[name]?.id;

// 도면에 나오는 용어 id 목록
export function figureTermIds(key) {
  return [...new Set(FIGURES[key].spots.map(([n]) => idOf(n)).filter(Boolean))];
}

export function renderFigure(key) {
  const f = FIGURES[key];
  const hits = f.spots.map(([n, [x, y, w, h], pts]) => {
    const id = idOf(n);
    return `<rect class="fhit" data-id="${id}" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}"/>` +
      pts.map(([px, py]) => `<circle class="fhit" data-id="${id}" cx="${px}" cy="${py}" r="9"/>`).join("");
  }).join("");
  return `<div class="pfig" data-key="${key}">
    <div class="pfig-scroll"><div class="pfig-inner">
      <img src="${f.src}" width="${f.w}" height="${f.h}" alt="${f.title}" draggable="false" />
      <svg class="pfig-ov" data-kind="diagram" viewBox="0 0 ${f.w} ${f.h}" aria-hidden="true">
        <defs><mask id="mask-${key}" maskUnits="userSpaceOnUse"><rect width="${f.w}" height="${f.h}" fill="#fff"/><g class="holes"></g></mask></defs>
        <rect class="dim" width="${f.w}" height="${f.h}" mask="url(#mask-${key})"/>
        <g class="marks"></g><g class="hits">${hits}</g>
      </svg>
    </div></div>
    <div class="pfig-bar">
      <span class="pfig-cap">${f.title}</span>
      <span class="zoom"><button type="button" data-zoom="-1" aria-label="축소">−</button><button type="button" data-zoom="1" aria-label="확대">＋</button></span>
    </div>
  </div>`;
}

// 확대 단계: 처음에는 도면 전체가 보이고, ＋/−로 확대한다
export function mountFigure(root, key, onPick) {
  const f = FIGURES[key];
  const scroller = root.querySelector(".pfig-scroll");
  const inner = root.querySelector(".pfig-inner");
  const svg = root.querySelector(".pfig-ov");
  const img = root.querySelector("img");
  const ready = () => img.classList.add("ready");
  img.complete ? ready() : img.addEventListener("load", ready, { once: true });
  const steps = [1, 1.6, 2.4, 3.4];
  let z = 0;
  const apply = () => { inner.style.width = `${steps[z] * 100}%`; };
  apply();
  root.querySelector(".zoom").addEventListener("click", (e) => {
    const b = e.target.closest("[data-zoom]");
    if (!b) return;
    const cx = (scroller.scrollLeft + scroller.clientWidth / 2) / inner.clientWidth;
    const cy = (scroller.scrollTop + scroller.clientHeight / 2) / inner.clientHeight;
    z = Math.max(0, Math.min(steps.length - 1, z + Number(b.dataset.zoom)));
    apply();
    scroller.scrollTo(cx * inner.clientWidth - scroller.clientWidth / 2, cy * inner.clientHeight - scroller.clientHeight / 2);
  });
  // 탭한 곳에서 가장 가까운 부재를 찾는다. 이름표가 작고 촘촘해도(전체 보기) 고르고 풀 수 있도록
  // 1) 선택된 부재 근처를 다시 누르면 해제. 단, 화면에서 충분히 크게 보이는 다른 이름표를 정확히 눌렀으면 그 부재로 바꾼다
  // 2) 이름표를 정확히 누르면 그 부재, 3) 근처에 있는 가장 가까운 부재, 4) 빈 곳이면 해제
  let selId = null;
  svg.addEventListener("click", (e) => {
    const r = svg.getBoundingClientRect();
    const k = r.width / f.w; // 화면 배율
    const x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
    const reach = 18 / k; // 손가락 오차 18px(화면 기준)
    let best = null, bestD = Infinity, onLabel = false, bestH = 0, selD = Infinity;
    for (const [name, [bx, by, bw, bh], pts] of f.spots) {
      const id = idOf(name);
      if (!id) continue;
      const dBox = Math.hypot(Math.max(bx - x, 0, x - bx - bw), Math.max(by - y, 0, y - by - bh)); // 이름표까지
      const d = Math.min(dBox, ...pts.map(([px, py]) => Math.max(0, Math.hypot(px - x, py - y) - 9))); // 지시선 끝점 포함
      if (id === selId) selD = Math.min(selD, d);
      // 같은 거리면 이름표를 직접 누른 쪽이 우선 (옆 부재의 지시선 끝점과 겹칠 때)
      if (d < bestD || (d === bestD && dBox === 0 && !onLabel)) { bestD = d; best = id; onLabel = dBox === 0; bestH = bh * k; }
    }
    const deliberate = onLabel && best !== selId && bestH >= 7; // 크게 보이는 다른 이름표를 정확히 누름
    if (selD <= reach && !deliberate) return onPick(selId);
    onPick(bestD <= reach ? best : null);
  });

  function select(id) {
    selId = id || null;
    const holes = svg.querySelector(".holes");
    const marks = svg.querySelector(".marks");
    const groups = f.groups || {};
    const own = id ? f.spots.map((_, i) => i).filter((i) => idOf(f.spots[i][0]) === id) : [];
    // 괄호식 이름은 소속 부재를 함께 보여 준다 (소속 부재는 일반 부재처럼 지시선과 함께)
    const members = [...new Set(own.flatMap((i) => (i in groups ? groups[i] : [])))].filter((i) => !own.includes(i));
    const spots = [...own, ...members];
    svg.classList.toggle("focus", spots.length > 0);
    // 면적을 찾은 부재(regions.js)는 그 칸 전체를 빛나게 하고, 못 찾은 부재는 지시선 끝에 점으로 표시한다
    const regions = (id && (REGIONS_MANUAL[key]?.[id] || REGIONS[key]?.[id])) || [];
    let h = "", m = "";
    const pts = [];
    for (const d of regions) {
      h += `<path d="${d}" fill="#000" fill-rule="evenodd"/>`;
      m += `<path class="garea" d="${d}" fill-rule="evenodd"/>`;
    }
    const bracket = own.map((i) => BRACKETS[key]?.[i]).filter(Boolean);
    for (const d of bracket) {
      h += `<path d="${d}" fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="10"/>`;
      m += `<path class="gbracket" d="${d}" fill-rule="evenodd"/>`;
    }
    for (const i of spots) {
      const [, [x, y, w, hh], ps] = f.spots[i];
      const box = `x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${hh + 2}" rx="2"`;
      h += `<rect ${box} fill="#000"/>`;
      m += `<rect class="gbox" ${box}/>`;
      if (i in groups || (regions.length && own.includes(i)) || (own.length && !own.includes(i) && (own.some((o) => o in groups)))) { pts.push([x + w / 2, y + hh / 2]); continue; } // 지시선이 없는 괄호식 이름·그 소속 부재 이름·면적으로 표시한 부재: 선·점 없음
      for (const [px, py] of ps) {
        const ax = px < x ? x - 1 : px > x + w ? x + w + 1 : px;
        const ay = py < y ? y - 1 : py > y + hh ? y + hh + 1 : py;
        h += `<circle cx="${px}" cy="${py}" r="16" fill="#000"/>`;
        m += `<line class="gline" x1="${ax}" y1="${ay}" x2="${px}" y2="${py}"/><circle class="gpt" cx="${px}" cy="${py}" r="11"/>`;
        pts.push([px, py]);
      }
      if (!ps.length) pts.push([x + w / 2, y + hh / 2]);
    }
    holes.innerHTML = h;
    marks.innerHTML = m;
    if (spots.length) {
      // 선택한 부재가 화면 가운데 오도록 스크롤
      const [sx, sy] = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
      const k = inner.clientWidth / f.w;
      scroller.scrollTo({ left: sx * k - scroller.clientWidth / 2, top: sy * k - scroller.clientHeight / 2, behavior: "smooth" });
    }
    return spots.length > 0;
  }
  return { select };
}
