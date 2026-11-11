// 인터랙티브 도면 (SVG). 부재마다 data-id(용어 id)를 달아 클릭 시 하이라이트한다.
import { TERM_BY_ID } from "./data.js";

const R = (x, y, w, h, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
const P = (d, extra = "") => `<path d="${d}" ${extra}/>`;
const Poly = (pts) => `<polygon points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const E = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;
const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const nameOf = (id) => TERM_BY_ID[id]?.name.replace(/\(.+\)$/, "") ?? id;

/**
 * spec: { viewBox:[w,h], parts:[{id, svg, anchor:[x,y], cls, label}], labelX, labelTop, labelBottom,
 *         groups:[{id, x, y1, y2}], decor, decorBefore, inline:true(라벨을 도형 안에) }
 */
function build(spec) {
  const [W, H] = spec.viewBox;
  let out = `<svg class="dg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${spec.title}">`;
  out += `<title>${spec.title}</title>`;
  if (spec.decorBefore) out += spec.decorBefore;
  for (const p of spec.parts) out += `<g class="part ${p.cls || ""}" data-id="${p.id}">${p.svg}</g>`;
  if (spec.decor) out += `<g class="deco">${spec.decor}</g>`;

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
  for (const g of spec.groups || []) {
    const mid = (g.y1 + g.y2) / 2;
    out += `<path class="grp-line" d="M${g.x + 8} ${g.y1} H${g.x} V${g.y2} H${g.x + 8}"/>`;
    out += `<rect class="hit" data-id="${g.id}" x="${g.x - 14}" y="${g.y1}" width="22" height="${g.y2 - g.y1}"/>`;
    out += `<text class="grp" data-id="${g.id}" transform="translate(${g.x - 5} ${mid}) rotate(-90)" text-anchor="middle">${nameOf(g.id)}</text>`;
  }
  return out + "</svg>";
}

// ─────────────────────────── 석탑 (신라 전형 3층 석탑) ───────────────────────────
function pagoda() {
  const cx = 150;
  const parts = [];
  const add = (id, svg, anchor, cls) => parts.push({ id, svg, anchor, cls });

  add("chalju", L(cx, 44, cx, 160), [cx + 1, 50], "line");
  // 기단부 (아래→위)
  add("hadaeseok", R(cx - 92, 520, 184, 14), [cx + 88, 527]);
  add("hacheunggidan", R(cx - 80, 488, 160, 32), [cx + 76, 504]);
  add("hacheunggapseok", R(cx - 86, 478, 172, 10), [cx + 82, 483]);
  add("gidanmyeonseok", R(cx - 66, 404, 132, 74), [cx + 34, 452]);
  add("uju", R(cx - 66, 404, 9, 74) + R(cx + 57, 404, 9, 74), [cx + 62, 420]);
  add("taengju", R(cx - 26, 404, 8, 74) + R(cx + 18, 404, 8, 74), [cx + 22, 436]);
  add("sangcheunggapseok", R(cx - 74, 394, 148, 10), [cx + 70, 399]);
  // 탑신부 3개 층
  const story = [ [72, 46], [62, 34], [54, 30] ];
  let y0 = 394;
  story.forEach(([w, h], i) => {
    const top = y0 - h;
    add("oksin", R(cx - w / 2, top, w, h), i === 0 ? [cx + w / 2 - 4, top + h / 2] : null);
    add("uju", R(cx - w / 2, top, 6, h) + R(cx + w / 2 - 6, top, 6, h), null);
    let st = "";
    for (let s = 0; s < 3; s++) st += R(cx - (w / 2 + 6 + s * 6), top - 4 * (s + 1), w + 12 + s * 12, 4);
    add("okgaebatchim", st, i === 0 ? [cx + w / 2 + 14, top - 6] : null);
    const yb = top - 12, Rr = w / 2 + 40, xL = cx - Rr, xR = cx + Rr;
    add("okgaeseok", Poly([[xL + 14, yb], [xR - 14, yb], [xR + 2, yb - 10], [xR - 6, yb - 15], [cx + w / 2 - 4, yb - 26], [cx - w / 2 + 4, yb - 26], [xL + 6, yb - 15], [xL - 2, yb - 10]]),
      i === 0 ? [cx + 30, yb - 8] : null);
    add("udong", L(xL + 2, yb - 13, cx - w / 2 + 4, yb - 26) + L(xR - 2, yb - 13, cx + w / 2 - 4, yb - 26), i === 1 ? [cx + w / 2 + 16, yb - 19] : null, "line");
    add("jeongak", Poly([[xL - 6, yb - 14], [xL + 12, yb - 1], [xL + 8, yb - 16]]) + Poly([[xR + 6, yb - 14], [xR - 12, yb - 1], [xR - 8, yb - 16]]),
      i === 1 ? [xR + 4, yb - 12] : null);
    y0 = yb - 26;
  });
  // 상륜부 (y0 = 170)
  add("noban", R(cx - 14, 160, 28, 10), [cx + 14, 165]);
  add("bokbal", P(`M${cx - 12} 160 A12 10 0 0 1 ${cx + 12} 160 Z`), [cx + 10, 154]);
  add("anghwa", Poly([[cx - 12, 150], [cx - 15, 140], [cx - 6, 145], [cx, 139], [cx + 6, 145], [cx + 15, 140], [cx + 12, 150]]), [cx + 14, 144]);
  let br = "";
  for (let k = 0; k < 5; k++) br += R(cx - 9, 132 - 7 * k, 18, 5, `rx="2"`);
  add("boryun", br, [cx + 9, 120]);
  add("bogae", Poly([[cx - 16, 100], [cx + 16, 100], [cx + 8, 92], [cx - 8, 92]]), [cx + 14, 97]);
  add("suyeon", P(`M${cx - 10} 90 C${cx - 15} 80 ${cx - 6} 78 ${cx - 4} 72 C${cx - 2} 78 ${cx + 2} 78 ${cx + 4} 72 C${cx + 6} 78 ${cx + 15} 80 ${cx + 10} 90 Z`), [cx + 11, 83]);
  add("boju", C(cx, 65, 5) + C(cx, 56, 4), [cx + 5, 64]);

  return build({
    title: "석탑의 구조와 각 부분의 명칭", viewBox: [380, 548], parts, labelX: 266, labelTop: 46, labelBottom: 530,
    groups: [ { id: "sangryunbu", x: 30, y1: 44, y2: 170 }, { id: "tapsinbu", x: 30, y1: 172, y2: 394 }, { id: "gidanbu", x: 30, y1: 396, y2: 534 } ],
  });
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

// ─────────────────────────── 부도 (팔각원당형 승탑) ───────────────────────────
function budo() {
  const cx = 140, parts = [];
  const add = (id, svg, anchor) => parts.push({ id, svg, anchor });
  add("bd_gidan", R(cx - 72, 432, 144, 20) + R(cx - 26, 382, 52, 50) + Poly([[cx - 56, 382], [cx + 56, 382], [cx + 62, 362], [cx - 62, 362]]), [cx + 56, 400]);
  add("bd_tapsin", R(cx - 34, 280, 68, 82) + R(cx - 12, 298, 24, 42, `fill="none"`), [cx + 32, 320]);
  add("bd_okgae", Poly([[cx - 82, 280], [cx + 82, 280], [cx + 88, 268], [cx + 30, 238], [cx - 30, 238], [cx - 88, 268]]), [cx + 70, 268]);
  add("boju", C(cx, 226, 11) + C(cx, 208, 7), [cx + 10, 222]);
  return build({
    title: "팔각원당형 부도의 구조", viewBox: [380, 470], parts, labelX: 250, labelTop: 160, labelBottom: 450, labelGap: 30,
    groups: [{ id: "palgakwondang", x: 34, y1: 200, y2: 452 }],
  });
}

// ─────────────────────────── 석비 (귀부·비신·이수) ───────────────────────────
function stele() {
  const cx = 150, parts = [];
  const add = (id, svg, anchor) => parts.push({ id, svg, anchor });
  add("gwibu", E(cx, 418, 112, 40) + E(cx - 128, 420, 24, 15) + E(cx - 84, 452, 16, 9) + E(cx + 84, 452, 16, 9), [cx + 96, 430]);
  add("bijwa", R(cx - 44, 368, 88, 14), [cx + 42, 375]);
  add("bisin", R(cx - 34, 150, 68, 218), [cx + 32, 280]);
  add("isu", R(cx - 52, 84, 104, 70, `rx="26"`) + R(cx - 12, 104, 24, 30, `fill="none"`), [cx + 46, 104]);
  return build({
    title: "석비의 구조", viewBox: [380, 480], parts, labelX: 280, labelTop: 90, labelBottom: 460, labelGap: 30,
    decor: P(`M${cx - 38} 98 q10 -12 20 0 q10 12 20 0 q10 -12 20 0 q10 12 16 0`),
  });
}

// ─────────────────────────── 불상 (좌상) ───────────────────────────
function buddha() {
  const cx = 150, parts = [];
  const add = (id, svg, anchor, cls) => parts.push({ id, svg, anchor, cls });
  add("singwang", E(cx, 300, 118, 170), [cx + 112, 250], "thin");
  add("dugwang", C(cx, 140, 66), [cx + 62, 120], "thin");
  add("daejwa", R(cx - 112, 472, 224, 26), [cx + 108, 488]);
  add("yeonhwajwa", P(`M${cx - 112} 472 Q${cx - 98} 440 ${cx - 78} 472 Q${cx - 60} 436 ${cx - 40} 472 Q${cx - 20} 434 ${cx} 472 Q${cx + 20} 434 ${cx + 40} 472 Q${cx + 60} 436 ${cx + 78} 472 Q${cx + 98} 440 ${cx + 112} 472 Z`), [cx + 96, 460]);
  add("beobui", P(`M${cx - 104} 446 Q${cx - 112} 330 ${cx - 64} 252 L${cx - 22} 214 L${cx + 22} 214 L${cx + 64} 252 Q${cx + 112} 330 ${cx + 104} 446 Z`), [cx + 80, 300]);
  add("gyeolga", E(cx, 424, 100, 24), [cx + 96, 418]);
  add("suin", E(cx, 376, 38, 16) + C(cx - 6, 374, 4) + C(cx + 6, 374, 4), [cx + 36, 376]);
  add("samdo", P(`M${cx - 16} 196 q16 6 32 0 M${cx - 16} 203 q16 6 32 0 M${cx - 16} 210 q16 6 32 0`), [cx + 16, 203], "line");
  add("nabal", P(`M${cx - 38} 140 A38 40 0 0 1 ${cx + 38} 140 Q${cx} 128 ${cx - 38} 140 Z`), [cx + 34, 124]);
  add("yukgye", E(cx, 98, 18, 14), [cx + 16, 96]);
  add("baekho", C(cx, 148, 3.5), [cx + 4, 148]);
  const face = `<ellipse cx="${cx}" cy="${155}" rx="34" ry="40" fill="var(--surface)"/>` +
    `<rect x="${cx - 18}" y="${186}" width="36" height="${30}" fill="var(--surface)"/>` +
    `<path d="M${cx - 18} 152 q8 -5 14 0 M${cx + 4} 152 q8 -5 14 0 M${cx - 8} 178 q8 4 16 0"/>`;
  // 얼굴·목은 장식(비대화형): 법의 위, 다른 부재 아래에 그리도록 순서 조정
  const order = ["singwang", "dugwang", "daejwa", "yeonhwajwa", "beobui", "gyeolga", "suin"];
  const back = parts.filter((p) => order.includes(p.id));
  const front = parts.filter((p) => !order.includes(p.id));
  const spec = { title: "불상 각 부의 명칭", viewBox: [400, 510], labelX: 290, labelTop: 70, labelBottom: 496, labelGap: 26 };
  // face를 back과 front 사이에 끼워 넣기 위해 두 번 빌드 대신 parts 순서에 장식 파트를 삽입
  spec.parts = [...back, { id: "_face", svg: face, cls: "deco-face" }, ...front];
  return build(spec).replace(`class="part deco-face" data-id="_face"`, `class="deco" style="stroke-width:1.2"`);
}

// ─────────────────────────── 공포 (다포식 정면) ───────────────────────────
function bracket() {
  const parts = [];
  const add = (id, svg, anchor) => parts.push({ id, svg, anchor });
  const xs = [52, 160, 268];
  add("pyeongju", R(34, 300, 36, 150) + R(250, 300, 36, 150), [68, 400]);
  add("changbang", R(14, 272, 292, 28), [200, 286]);
  add("pyeongbang", R(8, 254, 304, 18), [200, 263]);
  let judu = "", ch = "", so = "", sa = "";
  for (const x of xs) {
    judu += Poly([[x - 20, 236], [x + 20, 236], [x + 14, 254], [x - 14, 254]]);
    sa += Poly([[x - 7, 236], [x + 7, 236], [x + 7, 172], [x, 160], [x - 7, 172]]);
    ch += R(x - 48, 218, 96, 12, `rx="4"`) + R(x - 70, 192, 140, 12, `rx="4"`);
    so += R(x - 44, 206, 14, 12) + R(x + 30, 206, 14, 12) + R(x - 66, 180, 14, 12) + R(x + 52, 180, 14, 12);
  }
  add("salmi", sa, [xs[1] + 4, 168]);
  add("judu", judu, [xs[1] + 18, 244]);
  add("cheomcha", ch, [xs[1] + 46, 224]);
  add("soro", so, [xs[1] + 58, 186]);
  add("jangyeo", R(4, 144, 312, 16), [300, 152]);
  add("dori", R(4, 112, 312, 32, `rx="14"`), [300, 128]);
  return build({
    title: "다포식 공포 정면도", viewBox: [420, 470], parts, labelX: 336, labelTop: 110, labelBottom: 420, labelGap: 26,
    groups: [{ id: "gongpo", x: 0, y1: 160, y2: 254 }],
  });
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

const BUILDERS = { pagoda, lantern, budo, stele, buddha, bracket, temple };

export function renderDiagram(key) {
  return BUILDERS[key]?.() ?? "";
}

// 그룹 용어 → 구성 부재 (그룹을 고르면 구성 부재도 함께 빛남)
export const MEMBERS = {
  sangryunbu: ["chalju", "boju", "suyeon", "bogae", "boryun", "anghwa", "bokbal", "noban"],
  tapsinbu: ["oksin", "okgaeseok", "okgaebatchim", "udong", "jeongak"],
  gidanbu: ["sangcheunggapseok", "gidanmyeonseok", "taengju", "hacheunggapseok", "hacheunggidan", "hadaeseok"],
  palgakwondang: ["bd_gidan", "bd_tapsin", "bd_okgae", "boju"],
  budo: ["bd_gidan", "bd_tapsin", "bd_okgae", "boju"],
  gongpo: ["judu", "cheomcha", "soro", "salmi"],
  dapo: ["judu", "cheomcha", "soro", "salmi", "pyeongbang"],
  gwangbae: ["dugwang", "singwang"],
};

// svg 안에서 용어 하이라이트 (금색 엣지 + 나머지 반투명)
export function highlight(svg, id) {
  svg.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
  if (!id) { svg.classList.remove("focus"); return false; }
  const ids = [id, ...(MEMBERS[id] || [])];
  let found = false;
  for (const x of ids) svg.querySelectorAll(`[data-id="${x}"]`).forEach((el) => { el.classList.add("on"); found = true; });
  svg.classList.toggle("focus", found);
  return found;
}

// 도면에 등장하는 용어 id 목록
export function idsInDiagram(svgText) {
  return [...new Set([...svgText.matchAll(/data-id="([^"_][^"]*)"/g)].map((m) => m[1]))];
}
