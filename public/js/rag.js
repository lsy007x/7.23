// 용어 검색 + RAG 문맥 검색 (브라우저와 서버가 같은 코드를 사용)
import { TERMS, TERM_BY_ID } from "./data.js";

const norm = (s) => (s || "").toLowerCase().replace(/[\s·()\-]/g, "");

function bigrams(s) {
  const n = norm(s);
  const out = new Set();
  for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
  return out;
}

// 용어 하나가 질의와 얼마나 맞는지 점수화
function score(term, q) {
  const nq = norm(q);
  if (!nq) return 0;
  let s = 0;
  const names = [term.name, term.hanja, ...term.aliases].filter(Boolean).map(norm);
  for (const n of names) {
    if (!n) continue;
    if (n === nq) s += 100;
    else if (nq.includes(n)) s += 30 + n.length * 4; // 질문 문장 안에 용어가 등장
    else if (n.includes(nq)) s += 20;
  }
  // 설명문 bigram 겹침 (약한 신호)
  const qb = bigrams(q);
  if (qb.size) {
    const db = bigrams(term.short + term.desc);
    let hit = 0;
    for (const b of qb) if (db.has(b)) hit++;
    s += (hit / qb.size) * 10;
  }
  return s;
}

// 검색창용: 이름/별칭/설명 매칭 결과
export function searchTerms(q, limit = 30) {
  return TERMS.map((t) => ({ t, s: score(t, q) }))
    .filter((x) => x.s >= 4)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

// RAG용: 질문에 직접 등장한 용어 + 그 관련 용어까지 문맥으로 확장
export function retrieve(question, k = 8) {
  const ranked = TERMS.map((t) => ({ t, s: score(t, question) }))
    .filter((x) => x.s >= 4)
    .sort((a, b) => b.s - a.s);
  const picked = new Map();
  for (const { t } of ranked.slice(0, k)) picked.set(t.id, t);
  // 강하게 매칭된 상위 용어의 관련 용어를 추가 (구조적 질문 대비)
  for (const { t, s } of ranked.slice(0, 3)) {
    if (s < 30) continue;
    for (const r of t.related) {
      if (picked.size >= k + 6) break;
      if (TERM_BY_ID[r]) picked.set(r, TERM_BY_ID[r]);
    }
  }
  return [...picked.values()];
}

export function formatContext(docs) {
  return docs
    .map(
      (d) =>
        `<doc id="${d.id}" name="${d.name}${d.hanja ? ` (${d.hanja})` : ""}" source="${d.source}">\n${d.desc}\n관련: ${d.related
          .map((r) => TERM_BY_ID[r]?.name)
          .filter(Boolean)
          .join(", ")}\n</doc>`,
    )
    .join("\n");
}
