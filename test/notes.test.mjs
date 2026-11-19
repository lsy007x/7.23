import test from "node:test";
import assert from "node:assert/strict";

// localStorage만 흉내 낸다(사진용 IndexedDB는 쓰지 않는 경로만 시험한다)
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const N = await import("../public/js/notes.js");
const { TERMS } = await import("../public/js/data.js");
const [t1, t2] = [TERMS[0].id, TERMS[1].id];
const reset = () => mem.clear();

test("메모 저장·수정·삭제와 용어별 조회", async () => {
  reset();
  const a = N.saveNote({ term: t1, text: "  현장에서 확인  ", photos: [] });
  assert.equal(a.text, "현장에서 확인");
  assert.equal(N.notesOf(t1).length, 1);
  assert.equal(N.notesOf(t2).length, 0);
  const b = N.saveNote({ id: a.id, term: t1, text: "고침", photos: [] });
  assert.equal(b.id, a.id); assert.equal(b.created, a.created);
  assert.equal(N.allNotes().length, 1);
  await N.deleteNote(a.id);
  assert.equal(N.allNotes().length, 0);
});

test("용어집에 없는 용어의 메모는 화면에 나오지 않지만 지워지지도 않는다", () => {
  reset();
  N.saveNote({ term: "nope-term", text: "x", photos: [] });
  assert.equal(N.allNotes().length, 0);
  assert.equal(JSON.parse(mem.get("tamsaek.notes")).length, 1);
});

test("메모 검색", () => {
  reset();
  N.saveNote({ term: t1, text: "치미가 크다", photos: [] });
  N.saveNote({ term: t2, text: "서까래 간격", photos: [] });
  assert.equal(N.searchNotes("치미").length, 1);
  assert.equal(N.searchNotes("  ").length, 0);
});

test("날짜별 묶음: 같은 날은 한 묶음, 최신 날짜가 먼저", () => {
  const d = (m, day, h) => new Date(2026, m - 1, day, h).getTime();
  const g = N.groupByDay([{ created: d(11, 22, 15) }, { created: d(11, 22, 9) }, { created: d(11, 21, 10) }]);
  assert.deepEqual(g.map((x) => x.notes.length), [2, 1]);
  assert.match(g[0].label, /11월 22일/);
});

test("합치기: 새 메모는 추가, 같은 id는 나중에 고친 쪽, 내 메모는 보존", () => {
  const mine = [{ id: "a", updated: 5, text: "내것" }, { id: "b", updated: 9, text: "내것2" }];
  const r = N.mergeNotes(mine, [{ id: "a", updated: 7, text: "조원이 고침" }, { id: "b", updated: 3, text: "옛것" }, { id: "c", updated: 1, text: "새것" }]);
  assert.equal(r.list.length, 3);
  assert.equal(r.list.find((n) => n.id === "a").text, "조원이 고침");
  assert.equal(r.list.find((n) => n.id === "b").text, "내것2");
  assert.equal(r.added, 1); assert.equal(r.taken.length, 2);
});

test("가져오기: 잘못된 파일은 거부하고, 정상 파일은 작성자와 함께 합친다", async () => {
  reset();
  await assert.rejects(N.importBackup("not json"), /읽을 수 없어요/);
  await assert.rejects(N.importBackup(JSON.stringify({ app: "other", notes: [] })), /백업 파일이 아니에요/);
  const file = JSON.stringify({ app: "tamsaek-h", version: 1, author: "민지", notes: [
    { id: "n1", term: t1, text: "조원 메모", photos: [], created: 1, updated: 1 },
    { id: 5, term: t1 }, null,
    { id: "n2", term: t2, text: "<script>x</script>", tag: "옛 분류", photos: [1, "p"], created: 2 },
  ] });
  const r = await N.importBackup(file);
  assert.deepEqual([r.added, r.updated, r.skipped], [2, 0, 0]);
  const list = N.allNotes();
  assert.equal(list.length, 2);
  assert.ok(list.every((n) => n.author === "민지"));
  assert.ok(list.every((n) => !("tag" in n)), "분류는 더 이상 저장하지 않는다");
  assert.deepEqual(list.find((n) => n.id === "n2").photos, ["p"]);
  const again = await N.importBackup(file);
  assert.equal(again.added, 0); assert.equal(again.skipped, 2);
});

test("답사 노트 HTML: 메모의 태그·스크립트는 글자로만 나온다", async () => {
  reset();
  N.saveNote({ term: t1, text: '<img src=x onerror=alert(1)> 안녕\n둘째 줄', photos: [] });
  N.setAuthorName("<b>나</b>");
  const html = await N.buildNoteHTML();
  assert.ok(!html.includes("<img src=x"), "메모의 태그가 그대로 들어감");
  assert.ok(html.includes("&lt;img src=x"));
  assert.ok(html.includes("<br>"));
  assert.ok(html.includes("&lt;b&gt;나&lt;/b&gt;"));
  assert.ok(html.includes(TERMS[0].name));
});

test("답사지: 만들기·용어 넣기·빼기·지우기(메모는 남는다)", () => {
  reset();
  assert.equal(N.saveVisit({ name: "   " }), null);
  const v = N.saveVisit({ name: "안동 봉정사 극락전", date: "2026-11-22", terms: [t1, t1, "nope"] });
  assert.deepEqual(v.terms, [t1]);
  assert.equal(N.saveVisit({ name: "x", date: "11/22" }).date, "");
  N.addTermsToVisit(v.id, [t2, t1]);
  assert.deepEqual(N.getVisit(v.id).terms, [t1, t2]);
  N.removeTermFromVisit(v.id, t1);
  assert.deepEqual(N.getVisit(v.id).terms, [t2]);
  const n = N.saveNote({ term: t2, text: "남는 메모", visit: v.id, photos: [] });
  N.deleteVisit(v.id);
  assert.equal(N.getVisit(v.id), null);
  assert.equal(N.allNotes().find((x) => x.id === n.id).text, "남는 메모");
});

test("답사지에 적은 메모는 그 답사지에서만 보이고, 고쳐도 답사지가 유지된다", () => {
  reset();
  const v1 = N.saveVisit({ name: "가 답사지", terms: [t2] }), v2 = N.saveVisit({ name: "나 답사지", terms: [t1] });
  const a = N.saveNote({ term: t1, text: "가에서", visit: v1.id, photos: [] });
  assert.deepEqual(N.getVisit(v1.id).terms.sort(), [t1, t2].sort(), "답사지를 골라 적으면 그 용어가 답사지에 들어간다");
  N.saveNote({ term: t1, text: "나에서", visit: v2.id, photos: [] });
  N.saveNote({ term: t1, text: "어디도 아님", photos: [] });
  assert.equal(N.notesOf(t1).length, 3);
  assert.deepEqual(N.notesOf(t1, v1.id).map((n) => n.text), ["가에서"]);
  assert.equal(N.saveNote({ id: a.id, term: t1, text: "고침", photos: [] }).visit, v1.id);
});

test("답사 노트 HTML(답사지): 담은 용어 순서대로, 그 답사지의 메모만", async () => {
  reset();
  const v = N.saveVisit({ name: "봉정사", date: "2026-11-22", terms: [t2, t1] });
  N.saveNote({ term: t1, text: "여기서 적음", visit: v.id, photos: [] });
  N.saveNote({ term: t2, text: "다른 곳에서 적음", photos: [] });
  const html = await N.buildNoteHTML({ visitId: v.id });
  assert.ok(html.includes("답사 노트: 봉정사") && html.includes("2026-11-22"));
  assert.ok(html.includes("여기서 적음") && !html.includes("다른 곳에서 적음"));
  assert.ok(html.indexOf(TERMS[1].name) < html.indexOf(TERMS[0].name), "넣은 순서");
  assert.ok(html.includes("메모 없음"));
});

test("백업 파일에 답사지가 들어 있고, 가져오면 새 답사지는 추가·같은 id는 나중에 고친 쪽", async () => {
  reset();
  const v = N.saveVisit({ name: "내 답사지", terms: [t1] });
  const file = JSON.parse(await N.buildBackup());
  assert.equal(file.visits.length, 1);
  reset();
  N.saveVisit({ id: v.id, name: "옛 이름", terms: [] });
  const r1 = await N.importBackup(JSON.stringify(file));
  assert.equal(r1.visits, 1);
  assert.equal(N.getVisit(v.id).name, "내 답사지");
  assert.equal((await N.importBackup(JSON.stringify(file))).visits, 0);
});
