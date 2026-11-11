// AI 튜터: 용어집 검색(RAG) → 초안 → 근거 검증·수정 → 인용 id 검사
// 서버(server.mjs)와 테스트가 함께 쓰도록 client를 인자로 받는다.
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { retrieve, formatContext } from "./public/js/rag.js";

const DraftSchema = z.object({
  answer: z.string().describe("한국어 답변. 근거가 된 문서를 문장 끝에 [id] 형태로 표시"),
  cited_ids: z.array(z.string()).describe("답변에 실제로 쓴 문서 id"),
  not_in_glossary: z.array(z.string()).describe("질문 중 <context>에서 확인되지 않아 답하지 못한 부분 (없으면 빈 배열)"),
});
const CheckSchema = z.object({
  supported: z.boolean().describe("답변의 모든 주장이 <context>에서 직접 확인되면 true"),
  issues: z.array(z.string()).describe("근거를 찾을 수 없거나 문서와 어긋난 주장 (없으면 빈 배열)"),
  corrected_answer: z.string().describe("supported가 true이면 원래 답변 그대로, false이면 문제를 고친 답변"),
});

export const TUTOR_SYSTEM = `당신은 한국 전통 건축 용어 튜터입니다. 학부생의 질문에 한국어로 답합니다.

반드시 지킬 것:
- <context> 안의 <doc> 내용만 근거로 답합니다. 일반 지식으로 빈칸을 채우지 않습니다.
- 문장마다 근거가 된 문서를 [id] 형태로 표시합니다. 예: 고주는 종보 한쪽 끝을 받는다 [gooju]. <context>에 없는 id는 쓰지 않습니다.
- 문서가 "확인이 필요하다", "정해진 기준이 없다"고 밝힌 내용은 그대로 전달하고, 숫자·비율·기준을 새로 만들어 내지 않습니다.
- 두 가지를 비교하는 질문은 각각의 문서에서 확인되는 점만 나란히 정리합니다. 한쪽 문서에 없는 항목은 "확인되지 않음"으로 둡니다.
- 문맥에 답이 없거나 일부만 있으면 확인된 부분만 답하고, 확인되지 않은 부분은 not_in_glossary에 적습니다.
- 용어집에 없는 용어(오탈자·비표준 표기 포함)를 묻는 경우 비슷한 표준 용어를 안내하되 단정하지 않습니다.
- 답변은 3~8문장, 필요하면 짧은 목록을 씁니다. 구조 질문은 아래에서 위로(기둥→보→도리) 순서로 설명합니다.`;

export const CHECK_SYSTEM = `당신은 답변 검수자입니다. 질문, <context>(용어집 문서), 답변 초안이 주어집니다.
답변의 문장을 하나씩 <context>와 대조해, 문서에서 직접 확인되지 않거나 문서와 다른 주장을 찾습니다.
- 확인되지 않는 주장은 삭제하거나 "제공된 용어집에서는 확인되지 않습니다"로 고칩니다.
- 문서에서 확인되는 내용과 [id] 인용은 그대로 둡니다. 새 내용을 덧붙이지 않습니다.
- 인용한 [id]가 그 문장의 근거가 아니면 올바른 문서의 id로 바꾸거나 인용을 뺍니다.`;

// [id] 인용 중 <context>에 있는 것만 남기고, 실제로 쓰인 id를 돌려준다
export function cleanCitations(text, docs) {
  const ids = new Set(docs.map((d) => d.id));
  const used = new Set();
  const out = text
    .replace(/\[([a-z0-9_]+)\]/g, (m, id) => (ids.has(id) ? (used.add(id), m) : ""))
    .replace(/[ \t]+([.,!?。])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
  return { text: out, used };
}

const ctxMessage = (docs, question, extra = "") => `<context>\n${formatContext(docs)}\n</context>\n\n질문: ${question}${extra}`;

/**
 * @param client  Anthropic 클라이언트 (beta.messages.parse 사용)
 * @param opts    { model, betas, fallbacks, verify = true }
 */
export async function answerQuestion(client, rawQuestion, opts = {}) {
  const { verify = true, ...common } = opts;
  const question = String(rawQuestion || "").slice(0, 1000).trim();
  if (!question) throw Object.assign(new Error("질문이 비어 있습니다."), { status: 400 });
  const docs = retrieve(question);
  if (!docs.length) {
    return { answer: "제공된 용어집에서 관련 용어를 찾지 못했습니다. 용어 이름을 넣어 다시 질문해 주세요.", sources: [], related: [], checked: false };
  }

  // 1) 초안
  const draft = await client.beta.messages.parse({
    ...common, max_tokens: 4000, system: TUTOR_SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(DraftSchema) },
    messages: [{ role: "user", content: ctxMessage(docs, question) }],
  });
  if (draft.stop_reason === "refusal") throw Object.assign(new Error("이 질문에는 답할 수 없습니다."), { status: 422 });
  const d = draft.parsed_output;
  if (!d) throw Object.assign(new Error("AI 응답을 해석하지 못했습니다."), { status: 502 });

  // 2) 근거 검증: 초안을 문맥과 다시 대조해 근거 없는 내용을 고친다
  let answer = d.answer, issues = [], corrected = false, checked = false;
  if (verify) {
    const chk = await client.beta.messages.parse({
      ...common, max_tokens: 4000, system: CHECK_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(CheckSchema) },
      messages: [{ role: "user", content: ctxMessage(docs, question, `\n\n<answer>\n${d.answer}\n</answer>`) }],
    });
    const c = chk.parsed_output;
    if (chk.stop_reason !== "refusal" && c) {
      checked = true;
      issues = c.issues;
      if (!c.supported && c.corrected_answer?.trim()) { answer = c.corrected_answer; corrected = true; }
    }
  }

  // 3) 인용 id 검사: 문맥에 없는 id 제거, 실제 인용된 문서만 출처로 표시
  const { text, used } = cleanCitations(answer, docs);
  for (const id of d.cited_ids) if (docs.some((x) => x.id === id) && text.includes(`[${id}]`)) used.add(id);
  const sources = docs.filter((x) => used.has(x.id)).map((x) => ({ id: x.id, name: x.name, source: x.source }));
  const related = docs.filter((x) => !used.has(x.id)).slice(0, 6).map((x) => ({ id: x.id, name: x.name }));
  return { answer: text, sources, related, notInGlossary: d.not_in_glossary, issues, corrected, checked };
}
