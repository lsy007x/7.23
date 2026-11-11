// 인터랙티브 도면 (SVG). 부재마다 data-id(용어 id)를 달아 클릭 시 하이라이트한다.
import { TERM_BY_ID } from "./data.js";

const R = (x, y, w, h, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
const Poly = (pts, extra = "") => `<polygon points="${pts.map((p) => p.map((v) => +v.toFixed(1)).join(",")).join(" ")}" ${extra}/>`;
const nameOf = (id) => TERM_BY_ID[id]?.name.replace(/\(.+\)$/, "") ?? id;

/**
 * spec: { viewBox:[w,h], parts:[{id, svg, anchor:[x,y], cls, label, side:"L"|"R"}], labelX, labelXL, labelTop, labelBottom, labelGap }
 * 라벨은 왼쪽(side:"L", labelXL 기준)·오른쪽(labelX 기준)에 나눠 배치한다.
 */
function build(spec) {
  const [W, H] = spec.viewBox;
  let out = `<svg class="dg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${spec.title}">`;
  out += `<title>${spec.title}</title>`;
  for (const p of spec.parts) out += `<g class="part ${p.cls || ""}" data-id="${p.id}">${p.svg}</g>`;

  const seen = new Set();
  const labels = spec.parts
    .filter((p) => p.anchor && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ id: p.id, side: p.side || "R", ax: p.anchor[0], ay: p.anchor[1], text: p.label || nameOf(p.id) }));
  const gap = spec.labelGap || 19;
  for (const side of ["L", "R"]) {
    const col = labels.filter((l) => l.side === side).sort((a, b) => a.ay - b.ay);
    let prev = spec.labelTop - gap;
    for (const l of col) { l.y = Math.max(l.ay, prev + gap); prev = l.y; }
    let next = spec.labelBottom + gap;
    if (prev > spec.labelBottom) for (let i = col.length - 1; i >= 0; i--) { col[i].y = Math.min(col[i].y, next - gap); next = col[i].y; }
    for (const l of col) {
      if (side === "L") {
        const lx = spec.labelXL;
        out += `<polyline class="lead-line" data-id="${l.id}" points="${l.ax},${l.ay} ${lx + 18},${l.y} ${lx + 4},${l.y}"/>`;
        out += `<rect class="hit" data-id="${l.id}" x="0" y="${l.y - 10}" width="${lx + 4}" height="20"/>`;
        out += `<text class="lbl" data-id="${l.id}" x="${lx}" y="${l.y + 4.5}" text-anchor="end">${l.text}</text>`;
      } else {
        const lx = spec.labelX;
        out += `<polyline class="lead-line" data-id="${l.id}" points="${l.ax},${l.ay} ${lx - 18},${l.y} ${lx - 4},${l.y}"/>`;
        out += `<rect class="hit" data-id="${l.id}" x="${lx - 4}" y="${l.y - 10}" width="${W - lx + 4}" height="20"/>`;
        out += `<text class="lbl" data-id="${l.id}" x="${lx}" y="${l.y + 4.5}">${l.text}</text>`;
      }
    }
  }
  return out + "</svg>";
}

// ─────────────────────────── 석등 (팔각 석등 부재도) ───────────────────────────
function lantern() {
  const cx = 230, parts = [];
  const add = (id, svg, anchor, side = "R", extra = {}) => parts.push({ id, svg, anchor, side, ...extra });
  // 보주
  add("boju", `<ellipse cx="${cx}" cy="52" rx="12" ry="19"/><path d="M${cx - 8} 44 q8 8 16 0 M${cx - 9} 54 q9 8 18 0 M${cx - 7} 64 q7 6 14 0" fill="none"/>` + R(cx - 7, 70, 14, 8), [cx + 11, 46]);
  // 옥개석(지붕돌)과 그 위의 우동·처마
  add("lt_okgae", Poly([[cx - 106, 130], [cx - 56, 146], [cx + 56, 146], [cx + 106, 130], [cx + 36, 84], [cx - 36, 84]]), [cx - 84, 124], "L");
  add("udong", `<path d="M${cx + 36} 84 L${cx + 106} 130"/><path d="M${cx - 36} 84 L${cx - 106} 130"/>`, [cx + 74, 106], "R", { cls: "line" });
  add("cheoma", `<path d="M${cx - 106} 130 L${cx - 56} 146 L${cx + 56} 146 L${cx + 106} 130"/>`, [cx + 90, 138], "R", { cls: "line" });
  // 화사석과 화창
  add("hwasaseok", R(cx - 52, 146, 104, 98) + `<path d="M${cx - 18} 146 V244 M${cx + 18} 146 V244" fill="none"/>`, [cx - 50, 200], "L");
  add("hwachang", R(cx - 42, 168, 18, 56, `rx="2"`) + R(cx + 24, 168, 18, 56, `rx="2"`), [cx + 33, 196], "R", { cls: "dark" });
  // 상대석 (연꽃 받침)
  add("lt_sangdae", R(cx - 78, 244, 156, 12) + Poly([[cx - 76, 256], [cx + 76, 256], [cx + 58, 300], [cx - 58, 300]]) +
    `<path d="M${cx - 52} 264 q10 20 20 0 M${cx - 20} 264 q10 20 20 0 M${cx + 12} 264 q10 20 20 0 M${cx + 36} 264 q8 16 16 0" fill="none"/>`, [cx - 70, 270], "L");
  // 간주석(중대석)
  add("ganjuseok", R(cx - 28, 300, 56, 140) + `<path d="M${cx - 9} 300 V440 M${cx + 9} 300 V440" fill="none"/>`, [cx - 28, 372], "L", { label: "중대석(간주석)" });
  // 하대석 (엎어 놓은 연꽃)
  add("lt_hadae", Poly([[cx - 36, 440], [cx + 36, 440], [cx + 96, 492], [cx - 96, 492]]) +
    `<path d="M${cx - 70} 478 q12 -22 26 0 M${cx - 30} 478 q14 -26 30 0 M${cx + 6} 478 q14 -26 30 0 M${cx + 44} 478 q12 -22 26 0" fill="none"/>`, [cx - 66, 470], "L");
  // 지대석
  add("jidaeseok", R(cx - 112, 492, 224, 20), [cx + 100, 502], "R");
  return build({ title: "석등의 구조", viewBox: [460, 540], parts, labelX: 346, labelXL: 112, labelTop: 40, labelBottom: 520, labelGap: 24 });
}

// ─────────────────────────── 사찰 가람 배치 (입체 모식도) ───────────────────────────
// 좌표: a = 진입 방향(일주문→대웅전), l = 좌우, z = 높이. 화면에는 a가 오른쪽 위, l이 오른쪽 아래로 그려진다.
const U = 14;
const proj = (a, l, z = 0) => [(a + l) * 0.866 * U, (l - a) * 0.5 * U - z * U];

// [id, a0, a1, l0, l1, 벽높이, 지붕높이, 종류, 라벨 보정(dx, dy)]
const BUILDINGS = [
  ["iljumun", 0, 1.4, -1.0, 1.0, 1.0, 0.6, "gate"],
  ["geumgangmun", 3, 4.8, -1.3, 1.3, 1.1, 0.7, "gate"],
  ["cheonwangmun", 5.8, 7.6, -1.6, 1.6, 1.3, 0.8, "gate"],
  ["buimun", 9, 10.6, -1.3, 1.3, 1.2, 0.7, "gate"],
  ["nugak", 14.2, 16.8, -3.2, 3.2, 1.7, 0.9, "tower"],
  ["beomjonggak", 17.4, 19.2, 4.6, 6.4, 1.0, 0.7, "tower", 0, 6],
  ["yaksajeon", 17.6, 20.2, -8, -5.4, 1.2, 0.8, "hall"],
  ["geungnakjeon", 21.4, 24.6, -8.4, -5.2, 1.4, 0.9, "hall"],
  ["gwaneumjeon", 21.4, 24.6, 5.2, 8.4, 1.4, 0.9, "hall"],
  ["daeungjeon", 22.4, 27, -3.4, 3.4, 1.9, 1.3, "hall"],
  ["myeongbujeon", 27.4, 30.4, -8.4, -5.4, 1.3, 0.8, "hall"],
  ["eungjinjeon", 27.4, 30.4, 5.4, 8.4, 1.3, 0.8, "hall"],
  ["daejeokgwangjeon", 29, 32.2, -3, 3, 1.5, 1, "hall"],
  ["mireukjeon", 32.2, 35.4, -8.4, -5.4, 1.4, 0.9, "hall"],
  ["palsangjeon", 32.2, 35.2, 5.4, 8.4, 1.4, 0.9, "hall"],
  ["daejangjeon", 38, 41, -8.4, -5.4, 1.2, 0.8, "hall"],
  ["samseonggak", 38, 40.4, 5.8, 8.2, 1.1, 0.7, "hall"],
  ["yosachae", 16.5, 21.5, -14, -11, 1.0, 0.7, "hall"],
];

function iso(sub) {
  const pts = [];
  const track = (p) => { pts.push(p); return p; };
  const P = (a, l, z = 0) => track(proj(a, l, z));
  const poly = (arr, cls) => `<polygon class="${cls}" points="${arr.map((p) => p.map((v) => +v.toFixed(1)).join(",")).join(" ")}"/>`;

  // 바닥·진입로·담장
  const ground = [P(-2, -15, 0), P(42, -15, 0), P(42, 10, 0), P(-2, 10, 0)];
  const court = [P(13, -9.6, 0), P(36.6, -9.6, 0), P(36.6, 9.6, 0), P(13, 9.6, 0)];
  const lane = [P(-2, -0.9, 0), P(13, -0.9, 0), P(13, 0.9, 0), P(-2, 0.9, 0)];
  const lane2 = [P(13, -0.9, 0), P(22.4, -0.9, 0), P(22.4, 0.9, 0), P(13, 0.9, 0)];
  let out = "";
  out += poly(ground, "g-ground") + poly(court, "g-court") + poly(lane, "g-lane") + poly(lane2, "g-lane");
  // 담장 (낮은 벽)
  const wallSeg = (a0, l0, a1, l1) => {
    const t = 0.55;
    return poly([P(a0, l0, 0), P(a1, l1, 0), P(a1, l1, t), P(a0, l0, t)], "g-wall");
  };
  out += wallSeg(13, -9.6, 36.6, -9.6) + wallSeg(36.6, -9.6, 36.6, 9.6);
  out += wallSeg(13, 9.6, 36.6, 9.6) + wallSeg(13, -9.6, 13, -3.4) + wallSeg(13, 3.4, 13, 9.6);

  // 석탑 (장식)
  const pagoda = (a, l) => {
    let s = "";
    let z = 0;
    for (const [w, h, rh] of [[0.9, 0.5, 0.25], [0.7, 0.42, 0.22], [0.5, 0.36, 0.2]]) {
      s += building({ a0: a - w / 2, a1: a + w / 2, l0: l - w / 2, l1: l + w / 2, h, rh, z, e: 0.25, kind: "plain" });
      z += h + rh * 0.7;
    }
    s += `<polygon class="roof-a" points="${[P(a - 0.15, l + 0.15, z), P(a + 0.15, l + 0.15, z), P(a, l, z + 0.6)].map((p) => p.join(",")).join(" ")}"/>`;
    return `<g class="dec2">${s}</g>`;
  };

  // 건물 한 채: 벽 2면 + 지붕
  function building(b) {
    const { a0, a1, l0, l1, h, rh, z = 0, kind } = b;
    const e = b.e ?? 0.45;
    const ac = (a0 + a1) / 2;
    const zt = z + h;
    let s = "";
    // 벽: a0면(앞)과 l1면(옆)
    s += poly([P(a0, l0, z), P(a0, l1, z), P(a0, l1, zt), P(a0, l0, zt)], "wall-a");
    s += poly([P(a0, l1, z), P(a1, l1, z), P(a1, l1, zt), P(a0, l1, zt)], "wall-b");
    if (kind !== "plain") {
      // 기둥선
      const n = Math.max(2, Math.round((l1 - l0) / 1.0));
      let cols = "";
      for (let i = 1; i < n; i++) { const l = l0 + ((l1 - l0) * i) / n; const p = P(a0, l, z), q = P(a0, l, zt); cols += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }
      s += `<path class="cols" d="${cols}"/>`;
      // 문
      const dl0 = l0 + (l1 - l0) * (kind === "gate" ? 0.3 : 0.34), dl1 = l0 + (l1 - l0) * (kind === "gate" ? 0.7 : 0.66);
      s += poly([P(a0, dl0, z), P(a0, dl1, z), P(a0, dl1, z + h * 0.78), P(a0, dl0, z + h * 0.78)], "door");
      if (kind === "tower") {
        const q0 = P(a0, l0, z + h * 0.5), q1 = P(a0, l1, z + h * 0.5);
        s += `<path class="cols" d="M${q0[0].toFixed(1)} ${q0[1].toFixed(1)}L${q1[0].toFixed(1)} ${q1[1].toFixed(1)}"/>`;
      }
    }
    // 지붕 (맞배 느낌의 팔작): 처마 사각형 + 용마루
    const A0 = a0 - e, A1 = a1 + e, L0 = l0 - e, L1 = l1 + e;
    const k = (a1 - a0) / 2 + e * 0.2;
    const r0 = P(ac, l0 + k * 0.7, zt + rh), r1 = P(ac, l1 - k * 0.7, zt + rh);
    const c00 = P(A0, L0, zt), c01 = P(A0, L1, zt), c10 = P(A1, L0, zt), c11 = P(A1, L1, zt);
    s += poly([c10, c00, r0], "roof-c");                       // 뒤쪽 측면 (거의 안 보임)
    s += poly([c10, c11, r1, r0], "roof-c");                   // 뒤쪽 면
    s += poly([c00, c01, r1, r0], "roof-a");                   // 앞쪽 면
    s += poly([c01, c11, r1], "roof-b");                       // 옆 면
    // 처마 끝선
    s += `<path class="eave" d="M${c00[0].toFixed(1)} ${c00[1].toFixed(1)}L${c01[0].toFixed(1)} ${c01[1].toFixed(1)}L${c11[0].toFixed(1)} ${c11[1].toFixed(1)}"/>`;
    s += `<path class="ridge" d="M${r0[0].toFixed(1)} ${r0[1].toFixed(1)}L${r1[0].toFixed(1)} ${r1[1].toFixed(1)}"/>`;
    return s;
  }

  // 그리는 순서: 먼 것(화면 위)부터
  const order = BUILDINGS.map((b) => ({ b, d: (b[3] + b[4]) / 2 - (b[1] + b[2]) / 2 })).sort((x, y) => x.d - y.d);
  const labels = [];
  const items = [];
  for (const { b } of order) {
    const [id, a0, a1, l0, l1, h, rh, kind, dx = 0, dy = 0] = b;
    const t = TERM_BY_ID[id];
    const muted = sub && t && t.sub !== sub ? " muted" : "";
    items.push({ key: (l0 + l1) / 2 - (a0 + a1) / 2, svg: `<g class="part bld${muted}" data-id="${id}">${building({ a0, a1, l0, l1, h, rh, kind })}</g>` });
    const top = proj((a0 + a1) / 2, (l0 + l1) / 2, h + rh + 0.25);
    labels.push(`<text class="tlbl${muted}" data-id="${id}" x="${(top[0] + dx).toFixed(1)}" y="${(top[1] - 5 + dy).toFixed(1)}" text-anchor="middle">${nameOf(id)}</text>`);
  }
  // 석탑은 대웅전 앞마당 중앙
  items.push({ key: 0 - 20.2, svg: pagoda(19.2, 0) });
  items.sort((x, y) => x.key - y.key);
  out += items.map((i) => i.svg).join("") + labels.join("");

  // 뷰박스 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  for (const b of BUILDINGS) { const top = proj((b[1] + b[2]) / 2, (b[3] + b[4]) / 2, b[5] + b[6] + 1.5); minY = Math.min(minY, top[1] - 10); }
  const pad = 14;
  const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map((v) => Math.round(v));
  return `<svg class="dg dg-iso" viewBox="${vb.join(" ")}" role="img" aria-label="사찰 가람 배치 입체 모식도"><title>사찰 가람 배치 입체 모식도</title>${out}</svg>`;
}

const BUILDERS = { lantern, temple: iso };

export function renderDiagram(key, opts = {}) {
  return key === "temple" ? iso(opts.sub) : BUILDERS[key]?.() ?? "";
}

// svg 안에서 용어 하이라이트 (금색 엣지 + 나머지 반투명)
export function highlight(svg, id) {
  svg.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
  if (!id) { svg.classList.remove("focus"); return false; }
  let found = false;
  svg.querySelectorAll(`[data-id="${id}"]`).forEach((el) => { el.classList.add("on"); found = true; });
  svg.classList.toggle("focus", found);
  return found;
}

// 도면에 등장하는 용어 id 목록
export function idsInDiagram(svgText) {
  return [...new Set([...svgText.matchAll(/data-id="([^"_][^"]*)"/g)].map((m) => m[1]))];
}
