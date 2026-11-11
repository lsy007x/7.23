// 인터랙티브 도면 (SVG). 부재마다 data-id(용어 id)를 달아 클릭 시 하이라이트한다.
import { TERM_BY_ID } from "./data.js";

const R = (x, y, w, h, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
const Poly = (pts) => `<polygon points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const nameOf = (id) => TERM_BY_ID[id]?.name.replace(/\(.+\)$/, "") ?? id;

/**
 * spec: { viewBox:[w,h], parts:[{id, svg, anchor:[x,y], cls, label}], labelX, labelTop, labelBottom,
 *         decorBefore, inline:true(라벨을 도형 안에) }
 */
function build(spec) {
  const [W, H] = spec.viewBox;
  let out = `<svg class="dg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${spec.title}">`;
  out += `<title>${spec.title}</title>`;
  if (spec.decorBefore) out += spec.decorBefore;
  for (const p of spec.parts) out += `<g class="part ${p.cls || ""}" data-id="${p.id}">${p.svg}</g>`;

  if (spec.inline) {
    for (const p of spec.parts) {
      if (!p.anchor) continue;
      out += `<text class="lbl-in" data-id="${p.id}" x="${p.anchor[0]}" y="${p.anchor[1]}">${p.label || nameOf(p.id)}</text>`;
    }
  } else {
    // 라벨: 같은 id는 한 번만, 앵커 y 순서로 정렬해 겹치지 않게 배치
    const seen = new Set();
    const labels = spec.parts
      .filter((p) => p.anchor && !seen.has(p.id) && seen.add(p.id))
      .map((p) => ({ id: p.id, ax: p.anchor[0], ay: p.anchor[1], text: p.label || nameOf(p.id) }))
      .sort((a, b) => a.ay - b.ay);
    const gap = spec.labelGap || 19;
    let prev = spec.labelTop - gap;
    for (const l of labels) { l.y = Math.max(l.ay, prev + gap); prev = l.y; }
    const over = prev - spec.labelBottom;
    if (over > 0) {
      // 아래로 넘치면 뒤에서부터 위로 밀어 올림
      let next = spec.labelBottom + gap;
      for (let i = labels.length - 1; i >= 0; i--) { labels[i].y = Math.min(labels[i].y, next - gap); next = labels[i].y; }
    }
    const lx = spec.labelX;
    for (const l of labels) {
      out += `<polyline class="lead-line" data-id="${l.id}" points="${l.ax},${l.ay} ${lx - 18},${l.y} ${lx - 4},${l.y}"/>`;
      out += `<rect class="hit" data-id="${l.id}" x="${lx - 4}" y="${l.y - 10}" width="${W - lx + 4}" height="20"/>`;
      out += `<text class="lbl" data-id="${l.id}" x="${lx}" y="${l.y + 4.5}">${l.text}</text>`;
    }
  }
  return out + "</svg>";
}

// ─────────────────────────── 석등 (팔각 석등) ───────────────────────────
function lantern() {
  const cx = 140, parts = [];
  const add = (id, svg, anchor) => parts.push({ id, svg, anchor });
  add("lt_hadae", R(cx - 64, 446, 128, 14) + Poly([[cx - 54, 446], [cx - 44, 424], [cx + 44, 424], [cx + 54, 446]]), [cx + 50, 438]);
  add("ganjuseok", R(cx - 12, 300, 24, 124), [cx + 12, 362]);
  add("lt_sangdae", Poly([[cx - 40, 300], [cx + 40, 300], [cx + 52, 280], [cx - 52, 280]]), [cx + 46, 290]);
  add("hwasaseok", R(cx - 32, 196, 64, 84), [cx + 30, 266]);
  add("hwachang", R(cx - 10, 212, 20, 44, `rx="2"`), [cx + 8, 230]);
  add("lt_okgae", Poly([[cx - 64, 196], [cx + 64, 196], [cx + 70, 186], [cx + 20, 164], [cx - 20, 164], [cx - 70, 186]]), [cx + 60, 186]);
  add("lt_sangryun", R(cx - 9, 150, 18, 14) + C(cx, 138, 9), [cx + 8, 140]);
  return build({ title: "석등의 구조", viewBox: [380, 480], parts, labelX: 250, labelTop: 120, labelBottom: 460, labelGap: 26 });
}

// ─────────────────────────── 사찰 가람 배치 (모식도) ───────────────────────────
function temple() {
  const parts = [];
  const box = (id, x, y, w, h) => parts.push({ id, svg: R(x, y, w, h, `rx="6"`), anchor: [x + w / 2, y + h / 2] });
  box("dangganjiju", 40, 560, 70, 26);
  box("iljumun", 140, 556, 80, 30);
  box("geumgangmun", 140, 494, 80, 30);
  box("cheonwangmun", 140, 432, 80, 30);
  box("buimun", 140, 370, 80, 30);
  box("nugak", 116, 300, 128, 40);
  box("beomjonggak", 20, 296, 76, 34);
  box("daeungjeon", 110, 150, 140, 60);
  box("myeongbujeon", 16, 160, 80, 40);
  box("eungjinjeon", 264, 160, 80, 40);
  box("geungnakjeon", 16, 90, 80, 34);
  box("daejeokgwangjeon", 264, 90, 80, 34);
  box("yaksajeon", 16, 40, 80, 34);
  box("mireukjeon", 264, 40, 80, 34);
  box("samseonggak", 140, 30, 80, 34);
  return build({
    title: "사찰 가람 배치 모식도", viewBox: [360, 600], parts, inline: true,
    decorBefore: `<path class="axis" d="M180 590 V214"/><rect x="110" y="218" width="140" height="74" rx="8" fill="none" stroke="var(--line)" stroke-dasharray="4 4"/><text x="180" y="260" text-anchor="middle" font-size="12" fill="var(--ink-2)">마당</text>`,
  });
}

const BUILDERS = { lantern, temple };

export function renderDiagram(key) {
  return BUILDERS[key]?.() ?? "";
}

// svg 안에서 용어 하이라이트 (금색 엣지 + 나머지 반투명)
export function highlight(svg, id) {
  svg.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
  if (!id) { svg.classList.remove("focus"); return false; }
  const ids = [id];
  let found = false;
  for (const x of ids) svg.querySelectorAll(`[data-id="${x}"]`).forEach((el) => { el.classList.add("on"); found = true; });
  svg.classList.toggle("focus", found);
  return found;
}

// 도면에 등장하는 용어 id 목록
export function idsInDiagram(svgText) {
  return [...new Set([...svgText.matchAll(/data-id="([^"_][^"]*)"/g)].map((m) => m[1]))];
}
