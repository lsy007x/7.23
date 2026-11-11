import { test } from "node:test";
import assert from "node:assert/strict";
import { TERMS, TERM_BY_ID } from "../public/js/data.js";
import { retrieve, searchTerms } from "../public/js/rag.js";
import { renderDiagram, idsInDiagram } from "../public/js/diagrams.js";
import { FIGURES } from "../public/js/figures.js";
import { TERM_BY_NAME } from "../public/js/data.js";
import { existsSync } from "node:fs";
import { IDS_3D } from "../public/js/model3d.js";

test("모든 용어 id가 고유하고 관련 용어가 실재한다", () => {
  assert.equal(new Set(TERMS.map((t) => t.id)).size, TERMS.length);
  for (const t of TERMS) for (const r of t.related) assert.ok(TERM_BY_ID[r], `${t.id} → ${r}`);
});

test("도면·3D에 쓰인 id가 모두 용어집에 있다", () => {
  for (const k of ["temple"])
    for (const id of idsInDiagram(renderDiagram(k))) assert.ok(TERM_BY_ID[id], `${k}: ${id}`);
  for (const id of IDS_3D) assert.ok(TERM_BY_ID[id], id);
});

test("원본 도면의 모든 라벨이 용어로 연결되고 좌표가 도면 안에 있다", () => {
  for (const [k, f] of Object.entries(FIGURES)) {
    assert.ok(existsSync(new URL(`../public/${f.src}`, import.meta.url)), f.src);
    for (const [name, [x, y, w, h], pts] of f.spots) {
      assert.ok(TERM_BY_NAME[name], `${k}: ${name}`);
      for (const [px, py] of [[x, y], [x + w, y + h], ...pts]) assert.ok(px >= 0 && py >= 0 && px <= f.w && py <= f.h, `${k}: ${name}`);
    }
  }
});

test("이름·별칭이 서로 다른 용어에 겹치지 않는다", () => {
  const seen = {};
  for (const t of TERMS) for (const n of [t.name, ...t.aliases]) {
    assert.ok(!seen[n] || seen[n] === t.id, `${n}: ${seen[n]} / ${t.id}`);
    seen[n] = t.id;
  }
});

test("RAG 검색이 예시 질문의 핵심 용어를 찾는다", () => {
  const ids = retrieve("1고주 5량가 구조에서 고주와 종보는 어떻게 연결돼?").map((t) => t.id);
  for (const need of ["il_goju_5ryang", "gooju", "jongbo", "dongjaju"]) assert.ok(ids.includes(need), need);
  const ids2 = retrieve("어칸과 협칸의 규모 차이 기준이 뭐야?").map((t) => t.id);
  assert.ok(ids2.includes("eokan") && ids2.includes("hyeopkan"));
});

test("부록 문서 내용이 검색·RAG에 반영된다", () => {
  assert.ok(retrieve("일주문은 무슨 의미야?").some((t) => t.id === "iljumun" && t.desc.includes("일심")));
  assert.ok(retrieve("갑석열극 위험도는 어떻게 기록해?").some((t) => t.id === "gapseokyeolgeuk"));
  assert.equal(searchTerms("귀두")[0].id, "gwidu");
});

test("별칭으로도 검색된다", () => {
  assert.equal(searchTerms("지붕돌")[0].id, "okgaeseok");
  assert.equal(searchTerms("승탑")[0].id, "budo");
});
