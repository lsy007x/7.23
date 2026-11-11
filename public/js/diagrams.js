// 인터랙티브 도면 (SVG). 부재마다 data-id(용어 id)를 달아 클릭 시 하이라이트한다.
import { TERM_BY_ID } from "./data.js";

const nameOf = (id) => TERM_BY_ID[id]?.name.replace(/\(.+\)$/, "") ?? id;

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

export function renderDiagram(key, opts = {}) {
  return key === "temple" ? iso(opts.sub) : "";
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
