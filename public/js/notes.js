// 답사 메모 저장소. 글은 localStorage, 사진은 IndexedDB(크기를 줄인 JPEG)에 둔다.
// 모두 이 기기에만 남고 서버로 보내지 않는다. 저장이 막힌 환경에서는 조용히 실패하고 false/null을 돌려준다.
import { TERM_BY_ID } from "./data.js";

const NOTES_KEY = "tamsaek.notes", ME_KEY = "tamsaek.me";
export const TAGS = ["확인함", "다시 볼 것", "질문"];
const MAX_PHOTOS = 6;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ───────── 글 메모 ─────────
const readNotes = () => { try { const v = JSON.parse(localStorage.getItem(NOTES_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeNotes = (list) => { try { localStorage.setItem(NOTES_KEY, JSON.stringify(list)); return true; } catch { return false; } };

export const authorName = () => { try { return localStorage.getItem(ME_KEY) || ""; } catch { return ""; } };
export const setAuthorName = (n) => { try { localStorage.setItem(ME_KEY, String(n).trim().slice(0, 20)); } catch { /* 무시 */ } };

// 화면에 보여 줄 메모(용어집에 있는 용어의 것만), 최신순
export const allNotes = () => readNotes().filter((n) => TERM_BY_ID[n.term]).sort((a, b) => b.created - a.created);
export const notesOf = (termId) => allNotes().filter((n) => n.term === termId);
export const searchNotes = (q) => { const s = String(q).trim().toLowerCase(); return s ? allNotes().filter((n) => n.text.toLowerCase().includes(s)) : []; };

// 즐겨찾기와 메모를 잇는 현황: 용어마다 메모·분류·최근 메모를 보여 주고,
// '확인함'을 붙인 메모가 하나라도 있으면 그 용어는 확인한 것으로 센다(답사 전에 담은 목록의 진행 상황)
export function favStatus(favIds) {
  const byTerm = new Map();
  for (const n of allNotes()) { if (!byTerm.has(n.term)) byTerm.set(n.term, []); byTerm.get(n.term).push(n); }
  const rows = favIds.filter((id) => TERM_BY_ID[id]).map((id) => {
    const notes = byTerm.get(id) ?? [], tags = new Set(notes.map((n) => n.tag).filter(Boolean));
    return { id, notes, tags, checked: tags.has("확인함"), latest: notes[0] ?? null };
  });
  return { rows, total: rows.length, checked: rows.filter((r) => r.checked).length };
}

// id가 있으면 고치고 없으면 새로 만든다. 저장하지 못하면 null
export function saveNote({ id, term, text, tag, photos }) {
  const list = readNotes(), now = Date.now();
  const i = list.findIndex((n) => n.id === id);
  const prev = i >= 0 ? list[i] : null;
  const note = {
    id: prev?.id ?? uid(), term, text: String(text ?? "").trim().slice(0, 2000), tag: TAGS.includes(tag) ? tag : "",
    photos: (photos ?? []).slice(0, MAX_PHOTOS), created: prev?.created ?? now, updated: now, author: prev?.author ?? authorName(),
  };
  if (i >= 0) list[i] = note; else list.push(note);
  return writeNotes(list) ? note : null;
}

export async function deleteNote(id) {
  const list = readNotes(), n = list.find((x) => x.id === id);
  if (!n) return;
  writeNotes(list.filter((x) => x.id !== id));
  for (const p of n.photos ?? []) await removePhoto(p).catch(() => {});
}

// ───────── 날짜별 묶음 ─────────
export const timeLabel = (ms) => new Date(ms).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
export function groupByDay(notes) {
  const groups = [], thisYear = new Date().getFullYear();
  for (const n of notes) {
    const d = new Date(n.created);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push(g = { key, label: `${d.getFullYear() !== thisYear ? `${d.getFullYear()}년 ` : ""}${d.getMonth() + 1}월 ${d.getDate()}일`, notes: [] });
    g.notes.push(n);
  }
  return groups;
}

// ───────── 사진 (IndexedDB) ─────────
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open("tamsaek", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("photos");
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function withStore(mode, run) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction("photos", mode);
    const req = run(t.objectStore("photos"));
    t.oncomplete = () => { db.close(); res(req?.result); };
    t.onerror = t.onabort = () => { db.close(); rej(t.error); };
  });
}
const putBlob = (id, blob) => withStore("readwrite", (s) => s.put(blob, id));
const getBlob = (id) => withStore("readonly", (s) => s.get(id));
export const removePhoto = (id) => withStore("readwrite", (s) => s.delete(id));
export const MAX_PHOTOS_PER_NOTE = MAX_PHOTOS;

// 긴 변 1280px, JPEG 80%로 줄여 저장한다. 다시 그리는 과정에서 사진에 들어 있던 촬영 위치(EXIF)는 사라진다.
export async function addPhoto(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("사진 변환 실패"))), "image/jpeg", 0.8));
  const id = uid();
  await putBlob(id, blob);
  return id;
}
const urls = new Map();
export async function photoURL(id) {
  if (urls.has(id)) return urls.get(id);
  const b = await getBlob(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urls.set(id, u);
  return u;
}
export const releasePhotoURLs = () => { for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); };
const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

// ───────── 내보내기 · 백업 · 가져오기 ─────────
const photoData = async (notes) => {
  const out = {};
  for (const n of notes) for (const p of n.photos ?? []) {
    if (out[p]) continue;
    const b = await getBlob(p).catch(() => null);
    if (b) out[p] = await blobToDataURL(b);
  }
  return out;
};

// 조원과 주고받을 수 있는 백업·공유 파일(JSON). 글과 사진이 모두 들어 있다.
export async function buildBackup() {
  const notes = readNotes();
  return JSON.stringify({ app: "tamsaek-h", version: 1, author: authorName(), exported: Date.now(), notes, photos: await photoData(notes) });
}

// 가져온 메모를 합친다: 새 id는 추가, 같은 id는 더 나중에 고친 쪽을 남긴다. 내 메모는 지우지 않는다.
export function mergeNotes(mine, incoming) {
  const list = [...mine], taken = [];
  for (const n of incoming) {
    const i = list.findIndex((x) => x.id === n.id);
    if (i < 0) { list.push(n); taken.push(n); }
    else if (n.updated > list[i].updated) { list[i] = n; taken.push(n); }
  }
  return { list, taken, added: taken.filter((n) => !mine.some((x) => x.id === n.id)).length };
}
const cleanNote = (n, fallbackAuthor) => {
  if (!n || typeof n.id !== "string" || typeof n.term !== "string") return null;
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const created = num(n.created, Date.now());
  return {
    id: n.id.slice(0, 64), term: n.term.slice(0, 64), text: typeof n.text === "string" ? n.text.slice(0, 2000) : "",
    tag: TAGS.includes(n.tag) ? n.tag : "", photos: Array.isArray(n.photos) ? n.photos.filter((p) => typeof p === "string").slice(0, MAX_PHOTOS) : [],
    created, updated: num(n.updated, created), author: typeof n.author === "string" && n.author ? n.author.slice(0, 20) : fallbackAuthor,
  };
};
export async function importBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("파일을 읽을 수 없어요."); }
  if (data?.app !== "tamsaek-h" || !Array.isArray(data.notes)) throw new Error("TAMSAEK-H 백업 파일이 아니에요.");
  const from = typeof data.author === "string" ? data.author.slice(0, 20) : "";
  const incoming = data.notes.map((n) => cleanNote(n, from)).filter(Boolean);
  const { list, taken, added } = mergeNotes(readNotes(), incoming);
  for (const n of taken) for (const p of n.photos) {
    const url = data.photos?.[p];
    if (typeof url === "string" && url.startsWith("data:image/")) await putBlob(p, await (await fetch(url)).blob()).catch(() => {});
  }
  if (!writeNotes(list)) throw new Error("저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
  return { added, updated: taken.length - added, skipped: incoming.length - taken.length };
}

// 답사 노트: 날짜별 → 용어별로 정의와 내 메모·사진을 묶은, 어디서나 열리는 한 장짜리 HTML 문서
export async function buildNoteHTML(favIds = []) {
  const notes = allNotes(), photos = await photoData(notes), author = authorName();
  const fav = favStatus(favIds), todo = fav.rows.filter((r) => !r.checked).map((r) => esc(TERM_BY_ID[r.id].name));
  const checklist = fav.total ? `<section><h2>답사 전에 챙긴 용어</h2><p>${fav.total}개 중 ${fav.checked}개를 확인했어요.</p>${todo.length ? `<p class="her">아직 확인 전: ${todo.join(", ")}</p>` : ""}</section>` : "";
  const body = groupByDay(notes).map((g) => {
    const byTerm = new Map();
    for (const n of [...g.notes].reverse()) { if (!byTerm.has(n.term)) byTerm.set(n.term, []); byTerm.get(n.term).push(n); }
    const items = [...byTerm].map(([id, list]) => {
      const t = TERM_BY_ID[id];
      return `<article><h3>${esc(t.name)}${t.hanja ? ` <small>${esc(t.hanja)}</small>` : ""}</h3><p class="short">${esc(t.short)}</p><p class="def">${esc(t.desc)}</p>
${t.heritage?.length ? `<p class="her">대표 문화유산: ${t.heritage.map((h) => esc(h.name)).join(", ")}</p>` : ""}
${list.map((n) => `<div class="note">${n.tag ? `<b>${esc(n.tag)}</b> ` : ""}${n.author ? `<i>${esc(n.author)}</i> ` : ""}<span>${esc(timeLabel(n.created))}</span>${n.text ? `<p>${esc(n.text).replace(/\n/g, "<br>")}</p>` : ""}${(n.photos ?? []).map((p) => (photos[p]?.startsWith("data:image/") ? `<img src="${photos[p]}" alt="메모 사진">` : "")).join("")}</div>`).join("")}</article>`;
    }).join("");
    return `<section><h2>${esc(g.label)}</h2>${items}</section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>답사 노트</title>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#12151a}h1{font-size:1.6rem}h2{margin-top:2rem;border-bottom:1px solid #ccc;padding-bottom:.3rem}h3{margin:1.4rem 0 .2rem;font-size:1.2rem}h3 small{color:#555;font-weight:400}.short{margin:0;font-weight:600;color:#555}.def{margin:.3rem 0}.her{margin:.3rem 0;color:#555;font-size:.9rem}.note{margin:.8rem 0;padding:.6rem .9rem;background:#f5f6f8;border-radius:10px}.note b{margin-right:.4rem}.note span{color:#666;font-size:.85rem}.note p{margin:.3rem 0 0}.note img{display:block;max-width:100%;margin-top:.6rem;border-radius:8px}footer{margin-top:3rem;color:#666;font-size:.85rem}@media print{.note{break-inside:avoid}}</style></head>
<body><h1>답사 노트</h1>${author ? `<p>작성 ${esc(author)}</p>` : ""}${checklist}${body || "<p>아직 메모가 없어요.</p>"}<footer>TAMSAEK-H에서 만든 답사 노트예요. 정의의 출처는 앱의 용어 화면에서 확인할 수 있어요.</footer></body></html>`;
}
