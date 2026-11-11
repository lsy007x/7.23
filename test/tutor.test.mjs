import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve } from "../public/js/rag.js";
import { TERM_BY_ID } from "../public/js/data.js";
import { answerQuestion, cleanCitations } from "../tutor.mjs";

// 화면의 예시 질문: 검색된 문서에 답에 필요한 용어가 들어 있고, 문서 본문이 그 답을 뒷받침하는지 확인
const EXAMPLES = [
  { q: "1고주 5량가 구조에서 고주와 종보는 어떻게 연결돼?", ids: ["il_goju_5ryang", "gooju", "jongbo", "dongjaju"], says: [["il_goju_5ryang", "고주 머리가"], ["il_goju_5ryang", "종보 끝을 직접 받고"]] },
  { q: "어칸과 협칸의 규모 차이 기준이 뭐야?", ids: ["eokan", "hyeopkan"], says: [["eokan", "고정된 비례 규칙은 없으며"]] },
  { q: "5량가와 7량가는 뭐가 달라?", ids: ["ryang5", "st_chilryang", "jungjongbo"], says: [["st_chilryang", "중종보"], ["ryang5", "도리"]] },
  { q: "석탑 상륜부를 아래부터 순서대로 알려줘", ids: ["noban", "bokbal", "anghwa", "boryun", "bogae", "suyeon", "yongcha", "boju"], says: [["sangryunbu", "복발·앙화·보륜·보개·수연·용차·보주"]] },
  { q: "주심포와 다포의 차이는?", ids: ["jusimpo", "dapo"], says: [["jusimpo", "기둥 머리 위에만"], ["dapo", "기둥 사이"]] },
];

for (const ex of EXAMPLES) {
  test(`예시 질문 검증: ${ex.q}`, () => {
    const got = retrieve(ex.q).map((t) => t.id);
    for (const id of ex.ids) assert.ok(got.includes(id), `검색 누락: ${id}`);
    for (const [id, phrase] of ex.says) assert.ok(TERM_BY_ID[id].desc.includes(phrase), `${id} 본문에 '${phrase}' 없음`);
  });
}

test("수사 표기가 달라도 같은 용어를 찾는다 (일고주오량 = 1고주 5량가)", () => {
  assert.ok(retrieve("일고주오량이 뭐야?").some((t) => t.id === "il_goju_5ryang"));
  assert.ok(retrieve("칠량가는?").some((t) => t.id === "st_chilryang"));
  assert.ok(retrieve("이고주구량").some((t) => t.id === "st_igo9"));
});

// 가짜 클라이언트: parse 호출 순서대로 준비된 결과를 돌려준다
function fake(outs, stop = "end_turn") {
  const calls = [];
  return { calls, beta: { messages: { parse: async (p) => { calls.push(p); return { stop_reason: stop, parsed_output: outs.shift() }; } } } };
}
const draft = (answer, cited = [], none = []) => ({ answer, cited_ids: cited, not_in_glossary: none });
const check = (supported, corrected, issues = []) => ({ supported, issues, corrected_answer: corrected });

test("인용 정리: 문맥에 없는 id는 지운다", () => {
  const docs = [{ id: "gooju" }];
  const { text, used } = cleanCitations("고주는 높다 [gooju]. 근거 없음 [nope].", docs);
  assert.equal(text, "고주는 높다 [gooju]. 근거 없음.");
  assert.deepEqual([...used], ["gooju"]);
});

test("튜터: 초안과 검증 2번 호출, 가짜 인용 제거, 실제 인용만 출처로", async () => {
  const c = fake([draft("고주는 평주보다 높다 [gooju] [fake_id].", ["gooju", "fake_id"]), check(true, "고주는 평주보다 높다 [gooju] [fake_id].")]);
  const r = await answerQuestion(c, "고주가 뭐야?", { model: "m" });
  assert.equal(c.calls.length, 2);
  assert.ok(!r.answer.includes("fake_id"));
  assert.deepEqual(r.sources.map((s) => s.id), ["gooju"]);
  assert.equal(r.checked, true);
  assert.equal(r.corrected, false);
  assert.ok(r.related.every((x) => x.id !== "gooju"));
});

test("튜터: 검증에서 근거 없음이 나오면 수정된 답으로 바꾼다", async () => {
  const c = fake([draft("어칸은 정확히 3.6m이다 [eokan].", ["eokan"]), check(false, "어칸의 너비를 정하는 고정된 기준은 확인되지 않습니다 [eokan].", ["3.6m 근거 없음"])]);
  const r = await answerQuestion(c, "어칸 규모 기준이 뭐야?", {});
  assert.equal(r.corrected, true);
  assert.ok(!r.answer.includes("3.6m"));
  assert.deepEqual(r.issues, ["3.6m 근거 없음"]);
});

test("튜터: 인용이 하나도 없으면 출처가 비어 있다", async () => {
  const c = fake([draft("고주는 높은 기둥입니다.", []), check(true, "고주는 높은 기둥입니다.")]);
  const r = await answerQuestion(c, "고주가 뭐야?", {});
  assert.equal(r.sources.length, 0);
});

test("튜터: verify=false면 1번만 호출, 용어집에 없는 질문은 호출하지 않는다", async () => {
  const c = fake([draft("고주 [gooju]", ["gooju"])]);
  await answerQuestion(c, "고주가 뭐야?", { verify: false });
  assert.equal(c.calls.length, 1);
  const c2 = fake([]);
  const r = await answerQuestion(c2, "zzzz qqqq", {});
  assert.equal(c2.calls.length, 0);
  assert.equal(r.sources.length, 0);
  await assert.rejects(() => answerQuestion(c2, "   ", {}), (e) => e.status === 400);
});

test("튜터: 거절 응답은 422", async () => {
  const c = fake([draft("x")], "refusal");
  await assert.rejects(() => answerQuestion(c, "고주가 뭐야?", {}), (e) => e.status === 422);
});
