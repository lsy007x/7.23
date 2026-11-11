// 전통 건축 구조(량가) 12종: 참고 도식(문서 첨부 '량가 구조 도식')을 바탕으로 한 개략 모델 데이터.
// 단면(앞→뒤 = z, 높이 = y)을 이 파일에서 계산하고, model3d.js가 그 단면을 정면 3칸으로 늘려 3D로 만든다.
// ⚠ 치수는 개략 비례이며 실제 건물의 실측이 아님. 설명 문구는 편집 초안(표준 용어집 검수 필요).

const H_COL = 3.0; // 평주 높이
const Y0 = 3.3; // 주심도리 높이

export const STRUCT_SOURCE = "참고 도식(문서 첨부 '량가 구조 도식') 기반 개략 모델 — 정의는 편집 초안(검수 필요)";

// build: m = 한쪽 지붕면의 도리 간격 수(삼량 1, 오량 2, 칠량 3, 구량 4), step = 도리 간격, slope = 지붕 물매
//        mode = 고주 위치(none | front | both | center), g = 고주가 서는 도리 번호
export const STRUCTURES = [
  {
    key: "samryang", label: "삼량", termId: "ryang3", name: "3량가", count: 3, goju: "없음",
    build: { m: 1, step: 3, slope: 0.85 },
    summary: "가장 단순한 가구",
    desc: "도리가 3개(앞뒤 주심도리 2개와 종도리 1개)인 가장 단순한 가구. 앞뒤 기둥 위에 대들보를 걸고, 그 가운데에 대공을 세워 종도리를 받는다.",
    use: "규모가 작은 건물에 쓰인다.",
  },
  {
    key: "pyeongsaryang", label: "평사량", name: "평사량", count: 3, goju: "없음",
    aliases: [], build: { m: 1, step: 3, slope: 0.85, special: "pyeongsa" },
    summary: "삼량 계열, 합장으로 종도리를 받음",
    desc: "참고 도식에서는 삼량과 같이 도리가 3개이되, 종도리를 대공 대신 ㅅ자로 세운 경사재(합장)가 받는 모양으로 그려져 있다. 도식의 표시만 옮긴 것이어서 정확한 정의는 표준 용어집으로 확인이 필요하다.",
    use: "확인 필요",
    unsure: true,
  },
  {
    key: "oryang", label: "오량", termId: "ryang5", name: "5량가", count: 5, goju: "없음",
    build: { m: 2, step: 1.5, slope: 0.8 },
    summary: "대들보-동자주-종보-대공",
    desc: "도리가 5개(주심도리 2, 중도리 2, 종도리 1)인 가구. 대들보 위에 동자주를 세워 종보를 받치고, 종보 가운데 대공이 종도리를 받는다. 고주 없이 앞뒤 평주만 쓰는 형식이다.",
    use: "가장 널리 쓰이는 규모의 가구로, 불전 등에 많이 쓰인다.",
  },
  {
    key: "banoryang", label: "반오량", name: "반오량", count: 3, goju: "고주 1열(뒤)",
    build: { special: "banoryang" },
    summary: "오량의 한쪽 지붕면만 있는 구조",
    desc: "참고 도식에서는 오량을 반으로 나눈 것처럼, 지붕면이 한쪽(앞쪽)에만 있고 높은 고주가 종도리를 받는 모양으로 그려져 있다. 도식의 표시만 옮긴 것이어서 정확한 정의는 표준 용어집으로 확인이 필요하다.",
    use: "확인 필요",
    unsure: true,
  },
  {
    key: "iljugo5", label: "일고주오량", termId: "il_goju_5ryang", name: "1고주 5량가", count: 5, goju: "1열(앞)",
    build: { m: 2, step: 1.5, slope: 0.8, mode: "front", g: 1 },
    summary: "고주 한 줄을 둔 5량가",
    desc: "건물 안쪽에 고주를 한 줄 세운 5량가. 평주와 고주 사이에는 퇴보를, 고주와 반대편 평주 사이에는 대들보를 건너지른다. 고주 머리가 한쪽 중도리와 종보 끝을 직접 받고, 종보 반대쪽 끝은 대들보 위 동자주가 받는다.",
    use: "앞쪽에 퇴칸을 두는 건물에 쓰인다.",
  },
  {
    key: "chilryang", label: "칠량", name: "7량가", count: 7, goju: "없음",
    aliases: ["칠량", "칠량가"], build: { m: 3, step: 1.5, slope: 0.72 },
    summary: "5량가에 중종보가 한 단 더",
    desc: "도리가 7개인 가구. 대들보 위에 동자주를 세워 중종보를 올리고, 그 위에 다시 동자주와 종보, 대공을 차례로 올려 종도리를 받는다. 5량가보다 깊은 건물을 지을 수 있다.",
    use: "규모가 큰 건물에 쓰인다.",
  },
  {
    key: "iljugo7", label: "일고주칠량", name: "1고주 7량가", count: 7, goju: "1열(앞)",
    aliases: ["일고주칠량"], build: { m: 3, step: 1.5, slope: 0.72, mode: "front", g: 1 },
    summary: "고주 한 줄을 둔 7량가",
    desc: "7량가에서 앞쪽에 고주 한 줄을 세운 가구. 평주와 고주 사이에 퇴보를 걸고, 고주 머리가 안쪽 보를 받는다.",
    use: "앞쪽에 퇴칸을 두는 큰 건물에 쓰인다.",
  },
  {
    key: "igo7", label: "이고주칠량", name: "2고주 7량가", count: 7, goju: "2열(앞뒤)",
    aliases: ["이고주칠량"], build: { m: 3, step: 1.5, slope: 0.72, mode: "both", g: 1 },
    summary: "앞뒤로 고주 두 줄을 둔 7량가",
    desc: "7량가에서 앞뒤로 고주를 한 줄씩, 모두 두 줄 세운 가구. 안쪽의 대들보를 두 고주가 받고, 바깥쪽에는 앞뒤로 퇴보가 걸린다.",
    use: "앞뒤로 퇴칸을 두는 큰 건물에 쓰인다.",
  },
  {
    key: "simgo7", label: "심고주칠량", name: "심고주 7량가", count: 7, goju: "가운데 1열",
    aliases: ["심고주칠량"], build: { m: 3, step: 1.5, slope: 0.72, mode: "center" },
    summary: "가운데 높은 고주가 종도리를 받음",
    desc: "건물 한가운데에 종도리까지 닿는 높은 고주(심고주)를 세운 7량가. 대공 없이 고주가 종도리를 직접 받는다.",
    use: "확인 필요",
    unsure: true,
  },
  {
    key: "guryang", label: "구량", name: "9량가", count: 9, goju: "없음",
    aliases: ["구량", "구량가"], build: { m: 4, step: 1.5, slope: 0.62 },
    summary: "보가 세 단으로 쌓인 가구",
    desc: "도리가 9개인 가구. 대들보 위에 중종보를 두 단 올리고 맨 위에 종보와 대공을 얹는다. 지붕 물매가 낮고 건물이 깊다.",
    use: "규모가 아주 큰 건물에 쓰인다.",
  },
  {
    key: "iljugo9", label: "일고주구량", name: "1고주 9량가", count: 9, goju: "1열(앞)",
    aliases: ["일고주구량"], build: { m: 4, step: 1.5, slope: 0.62, mode: "front", g: 2 },
    summary: "고주 한 줄을 둔 9량가",
    desc: "9량가에서 앞쪽에 고주를 한 줄 세운 가구. 평주와 고주 사이에 퇴보를 걸고 동자주로 중도리를 받는다.",
    use: "앞쪽에 넓은 퇴칸을 두는 아주 큰 건물에 쓰인다.",
  },
  {
    key: "igo9", label: "이고주구량", name: "2고주 9량가", count: 9, goju: "2열(앞뒤)",
    aliases: ["이고주구량"], build: { m: 4, step: 1.5, slope: 0.62, mode: "both", g: 2 },
    summary: "앞뒤로 고주 두 줄을 둔 9량가",
    desc: "9량가에서 앞뒤로 고주를 한 줄씩, 모두 두 줄 세운 가구. 안쪽의 대들보를 두 고주가 받고, 바깥쪽에는 앞뒤로 퇴보가 걸린다.",
    use: "앞뒤로 넓은 퇴칸을 두는 아주 큰 건물에 쓰인다.",
  },
];

export const STRUCT_BY_KEY = Object.fromEntries(STRUCTURES.map((s) => [s.key, s]));
// 이미 용어집에 있는 구조 용어(id) → 구조 key
export const STRUCT_BY_TERM = Object.fromEntries(STRUCTURES.filter((s) => s.termId).map((s) => [s.termId, s.key]));
export const termIdOf = (s) => s.termId ?? `st_${s.key}`;
export const DEFAULT_STRUCT = "iljugo5";
// 구조 모델에 쓰이는 부재 id (그룹 용어를 고르면 이것들이 함께 강조됨)
export const STRUCT_MEMBERS = ["jusimdori", "jungdori", "jongdori", "daedulbo", "jungjongbo", "jongbo", "dongjaju", "daegong", "toebo", "gooju", "soseulhapjang"];

const beamId = (k, m) => (k === 0 ? "daedulbo" : k === m - 1 ? "jongbo" : "jungjongbo");
const purlinId = (k) => (k === 0 ? "jusimdori" : "jungdori");

// 한쪽 지붕면만 있는 반오량
function banoryang() {
  const D = 3;
  const yP = [Y0, Y0 + 0.8 * 1.5, Y0 + 0.8 * 3];
  return {
    D,
    cols: [{ z: 0, h: H_COL, id: "pyeongju" }, { z: D, h: yP[2] - 0.05, id: "gooju" }],
    beams: [{ z0: 0, z1: D, y: yP[0] - 0.3, id: "toebo" }],
    posts: [{ z: 1.5, y0: yP[0] - 0.3 + 0.22, y1: yP[1] - 0.15, id: "dongjaju" }],
    purlins: [{ z: 0, y: yP[0], id: "jusimdori" }, { z: 1.5, y: yP[1], id: "jungdori" }, { z: 3, y: yP[2], id: "jongdori" }],
    braces: [],
    rafters: [rafterProfile([[3, yP[2]], [1.5, yP[1]], [0, yP[0]]])],
    toe: [{ z0: 0, z1: D }],
    ridgeY: yP[2],
  };
}

// 처마 끝(앞으로 1.3 내민 곳)까지 이어지는 서까래 단면
function rafterProfile(pts) {
  const last = pts[pts.length - 1];
  return [...pts, [-1.3, last[1] - 0.55]].map(([z, y]) => [z, y + 0.15]);
}
const mirror = (prof, D) => prof.map(([z, y]) => [D - z, y]);

export function layout(key) {
  const st = STRUCT_BY_KEY[key];
  if (st.build.special === "banoryang") return banoryang();
  const { m, step, slope, mode = "none", g = 1, special } = st.build;
  const D = 2 * m * step;
  const zs = Array.from({ length: m + 1 }, (_, i) => i * step);
  const yP = zs.map((z) => Y0 + slope * z);
  const yB = zs.map((_, k) => yP[k] - 0.3);
  const cols = [{ z: 0, h: H_COL, id: "pyeongju" }, { z: D, h: H_COL, id: "pyeongju" }];
  const beams = [], posts = [], purlins = [], braces = [], toe = [];
  const front = mode === "front" || mode === "both";
  const back = mode === "both";
  const zg = zs[g], zgb = D - zs[g];

  // 보: 아래층부터. 고주가 있으면 퇴보와 (짧아진) 대들보로 나눈다
  for (let k = 0; k < m; k++) {
    let z0 = zs[k], z1 = D - zs[k];
    if (front && k < g) z0 = zg;
    if (back && k < g) z1 = zgb;
    beams.push({ z0, z1, y: yB[k], id: beamId(k, m) });
  }
  if (front) { beams.push({ z0: 0, z1: zg, y: yB[0], id: "toebo" }); toe.push({ z0: 0, z1: zg }); cols.push({ z: zg, h: yP[g] - 0.1, id: "gooju" }); }
  if (back) { beams.push({ z0: zgb, z1: D, y: yB[0], id: "toebo" }); toe.push({ z0: zgb, z1: D }); cols.push({ z: zgb, h: yP[g] - 0.1, id: "gooju" }); }
  if (mode === "center") cols.push({ z: D / 2, h: yP[m] - 0.05, id: "gooju" });

  // 동자주·대공
  for (let k = 0; k < m - 1; k++) {
    for (const [z, isFront] of [[zs[k + 1], true], [D - zs[k + 1], false]]) {
      const covered = isFront ? front && k + 1 <= g : back && k + 1 <= g;
      if (covered) continue; // 고주가 그 자리를 대신한다
      posts.push({ z, y0: yB[k] + 0.22, y1: yB[k + 1] - 0.2, id: "dongjaju" });
    }
  }
  // 고주 바깥쪽 중도리는 퇴보 위 동자주가 받는다 (고주가 2번째 도리보다 안쪽에 설 때)
  for (let k = 1; k < g; k++) {
    if (front) posts.push({ z: zs[k], y0: yB[0] + 0.22, y1: yP[k] - 0.15, id: "dongjaju" });
    if (back) posts.push({ z: D - zs[k], y0: yB[0] + 0.22, y1: yP[k] - 0.15, id: "dongjaju" });
  }
  if (special === "pyeongsa") {
    braces.push({ z0: 1.2, y0: yB[0] + 0.2, z1: D / 2, y1: yP[m] - 0.15, id: "soseulhapjang" });
    braces.push({ z0: D - 1.2, y0: yB[0] + 0.2, z1: D / 2, y1: yP[m] - 0.15, id: "soseulhapjang" });
  } else if (mode !== "center") {
    posts.push({ z: D / 2, y0: yB[m - 1] + 0.2, y1: yP[m], id: "daegong" });
  }

  // 도리
  for (let k = 0; k < m; k++) { purlins.push({ z: zs[k], y: yP[k], id: purlinId(k) }); purlins.push({ z: D - zs[k], y: yP[k], id: purlinId(k) }); }
  purlins.push({ z: D / 2, y: yP[m], id: "jongdori" });

  // 서까래 단면 (앞쪽 / 뒤쪽)
  const prof = rafterProfile([...zs.map((z, i) => [z, yP[i]])].reverse().map(([z, y]) => [z, y]));
  return { D, cols, beams, posts, purlins, braces, rafters: [prof, mirror(prof, D)], toe, ridgeY: yP[m] };
}
