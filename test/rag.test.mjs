import { test } from "node:test";
import assert from "node:assert/strict";
import { TERMS, TERM_BY_ID } from "../public/js/data.js";
import { retrieve, searchTerms } from "../public/js/rag.js";
import { renderDiagram, idsInDiagram, MEMBERS } from "../public/js/diagrams.js";
import { IDS_3D } from "../public/js/model3d.js";

test("모든 용어 id가 고유하고 관련 용어가 실재한다", () => {
  assert.equal(new Set(TERMS.map((t) => t.id)).size, TERMS.length);
  for (const t of TERMS) for (const r of t.related) assert.ok(TERM_BY_ID[r], `${t.id} → ${r}`);
});

test("도면·3D에 쓰인 id가 모두 용어집에 있다", () => {
  for (const k of ["pagoda", "lantern", "budo", "stele", "buddha", "bracket", "temple"])
    for (const id of idsInDiagram(renderDiagram(k))) assert.ok(TERM_BY_ID[id], `${k}: ${id}`);
  for (const id of [...IDS_3D, ...Object.values(MEMBERS).flat()]) assert.ok(TERM_BY_ID[id], id);
});

test("RAG 검색이 예시 질문의 핵심 용어를 찾는다", () => {
  const ids = retrieve("1고주 5량가 구조에서 고주와 종보는 어떻게 연결돼?").map((t) => t.id);
  for (const need of ["il_goju_5ryang", "gooju", "jongbo", "dongjaju"]) assert.ok(ids.includes(need), need);
  const ids2 = retrieve("어칸과 협칸의 규모 차이 기준이 뭐야?").map((t) => t.id);
  assert.ok(ids2.includes("eokan") && ids2.includes("hyeopkan"));
});

test("별칭으로도 검색된다", () => {
  assert.equal(searchTerms("지붕돌")[0].id, "okgaeseok");
  assert.equal(searchTerms("승탑")[0].id, "budo");
});
