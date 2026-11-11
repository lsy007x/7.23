import { test } from "node:test";
import assert from "node:assert/strict";
import { STRUCTURES, layout, termIdOf, STRUCT_MEMBERS } from "../public/js/structures.js";
import { TERM_BY_ID, TERM_BY_NAME } from "../public/js/data.js";
import { IDS_3D } from "../public/js/model3d.js";

test("구조 12종: 용어집에 연결되고 이름이 겹치지 않는다", () => {
  assert.equal(STRUCTURES.length, 12);
  for (const st of STRUCTURES) {
    assert.ok(TERM_BY_ID[termIdOf(st)], `${st.key}: 용어 없음`);
    assert.equal(TERM_BY_NAME[st.name]?.id, termIdOf(st), `${st.key}: 이름 충돌`);
  }
});

for (const st of STRUCTURES) {
  test(`${st.label}: 단면이 올바르게 만들어진다`, () => {
    const L = layout(st.key);
    assert.equal(L.purlins.length, st.count, "도리 수");
    assert.equal(L.purlins.filter((p) => p.id === "jongdori").length, 1);
    const ridge = Math.max(...L.purlins.map((p) => p.y));
    assert.equal(L.purlins.find((p) => p.id === "jongdori").y, ridge, "종도리가 가장 높다");
    for (const b of L.beams) assert.ok(b.z1 > b.z0 && b.z0 >= 0 && b.z1 <= L.D + 1e-9, `보 범위 ${b.id}`);
    for (const p of L.posts) assert.ok(p.y1 > p.y0, `${p.id} 높이`);
    for (const c of L.cols) assert.ok(c.h > 0 && c.z >= 0 && c.z <= L.D + 1e-9);
    for (const el of [...L.cols, ...L.beams, ...L.posts, ...L.purlins, ...L.braces]) {
      assert.ok(TERM_BY_ID[el.id], `${st.key}: ${el.id}`);
      assert.ok(STRUCT_MEMBERS.includes(el.id) || ["pyeongju", "jongdori"].includes(el.id), `${el.id}`);
    }
    // 앞쪽 서까래는 종도리에서 앞 처마로(z 감소), 뒤쪽은 뒤 처마로(z 증가) 이어진다
    L.rafters.forEach((pf, idx) => { for (let i = 1; i < pf.length; i++) assert.ok(idx === 0 ? pf[i][0] < pf[i - 1][0] : pf[i][0] > pf[i - 1][0], "서까래 방향"); });
    const goju = L.cols.filter((c) => c.id === "gooju").length;
    const mode = st.build.mode ?? "none";
    assert.equal(goju, { none: st.key === "banoryang" ? 1 : 0, front: 1, both: 2, center: 1 }[mode], "고주 수");
  });
}

test("3D 부재 id가 모두 용어집에 있다", () => {
  for (const id of IDS_3D) assert.ok(TERM_BY_ID[id], id);
});

test("검수본 정의: 모든 키가 용어집에 있고 설명이 반영된다", async () => {
  const { DEFINITIONS } = await import("../public/js/definitions.js");
  const { TERM_BY_NAME } = await import("../public/js/data.js");
  assert.ok(Object.keys(DEFINITIONS).length >= 264);
  for (const [name, d] of Object.entries(DEFINITIONS)) {
    const t = TERM_BY_NAME[name];
    assert.ok(t, `용어집에 없음: ${name}`);
    assert.equal(t.desc, d.desc, `${name} 설명 미반영`);
    assert.ok(t.source.startsWith("사용자 검수본"), `${name} 출처`);
    if (d.hanja) assert.equal(t.hanja, d.hanja);
    assert.ok(!/[:：]\s*$/.test(d.desc) && d.desc.length > 5, `${name} 설명 형식`);
  }
});
