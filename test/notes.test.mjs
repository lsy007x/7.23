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
  const a = N.saveNote({ term: t1, text: "  현장에서 확인  ", tag: "확인함", photos: [] });
  assert.equal(a.text, "현장에서 확인");
  assert.equal(N.notesOf(t1).length, 1);
  assert.equal(N.notesOf(t2).length, 0);
  const b = N.saveNote({ id: a.id, term: t1, text: "고침", tag: "없는분류", photos: [] });
  assert.equal(b.id, a.id); assert.equal(b.created, a.created); assert.equal(b.tag, "");
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
    { id: "n1", term: t1, text: "조원 메모", tag: "질문", photos: [], created: 1, updated: 1 },
    { id: 5, term: t1 }, null,
    { id: "n2", term: t2, text: "<script>x</script>", tag: "해킹", photos: [1, "p"], created: 2 },
  ] });
  const r = await N.importBackup(file);
  assert.deepEqual([r.added, r.updated, r.skipped], [2, 0, 0]);
  const list = N.allNotes();
  assert.equal(list.length, 2);
  assert.ok(list.every((n) => n.author === "민지"));
  assert.equal(list.find((n) => n.id === "n2").tag, "");
  assert.deepEqual(list.find((n) => n.id === "n2").photos, ["p"]);
  const again = await N.importBackup(file);
  assert.equal(again.added, 0); assert.equal(again.skipped, 2);
});

test("답사 노트 HTML: 메모의 태그·스크립트는 글자로만 나온다", async () => {
  reset();
  N.saveNote({ term: t1, text: '<img src=x onerror=alert(1)> 안녕\n둘째 줄', tag: "확인함", photos: [] });
  N.setAuthorName("<b>나</b>");
  const html = await N.buildNoteHTML();
  assert.ok(!html.includes("<img src=x"), "메모의 태그가 그대로 들어감");
  assert.ok(html.includes("&lt;img src=x"));
  assert.ok(html.includes("<br>"));
  assert.ok(html.includes("&lt;b&gt;나&lt;/b&gt;"));
  assert.ok(html.includes(TERMS[0].name));
});

test("즐겨찾기 현황: 확인함 메모가 있으면 확인한 것으로 센다", () => {
  reset();
  const [a, b, c] = [TERMS[0].id, TERMS[1].id, TERMS[2].id];
  N.saveNote({ term: a, text: "봤음", tag: "확인함", photos: [] });
  N.saveNote({ term: b, text: "다시", tag: "다시 볼 것", photos: [] });
  N.saveNote({ term: a, text: "또", tag: "질문", photos: [] });
  const st = N.favStatus([a, b, c, "nope"]);
  assert.equal(st.total, 3); assert.equal(st.checked, 1);
  const ra = st.rows.find((r) => r.id === a);
  assert.equal(ra.notes.length, 2); assert.ok(ra.checked); assert.ok(ra.tags.has("질문"));
  assert.equal(st.rows.find((r) => r.id === c).latest, null);
  assert.ok(!st.rows.find((r) => r.id === b).checked);
});

test("답사 노트 HTML: 즐겨찾기 진행 상황과 아직 확인 전인 용어가 들어간다", async () => {
  reset();
  const [a, b] = [TERMS[0].id, TERMS[1].id];
  N.saveNote({ term: a, text: "봤음", tag: "확인함", photos: [] });
  const html = await N.buildNoteHTML([a, b]);
  assert.ok(html.includes("2개 중 1개를 확인했어요"));
  assert.ok(html.includes(`아직 확인 전: ${TERMS[1].name}`));
  assert.ok(!(await N.buildNoteHTML([])).includes("답사 전에 챙긴 용어"));
});
