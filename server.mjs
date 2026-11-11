// TAMSAEK-H 서버: 정적 파일 제공 + AI 태깅(/api/tag) + RAG 튜터(/api/ask)
// API 키는 서버에만 둡니다. ANTHROPIC_API_KEY (또는 `ant auth login` 프로필)로 인증합니다.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { TERMS, TERM_BY_ID } from "./public/js/data.js";
import { retrieve, formatContext } from "./public/js/rag.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "public");
const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.TAMSAEK_MODEL || "claude-opus-5-5";
const MAX_BODY = 8 * 1024 * 1024;

// 인증 정보는 요청 시점에 확인됩니다 (없으면 /api/* 가 503을 반환하고 화면은 용어집 원문으로 대체).
const client = new Anthropic();

// 공통 요청 옵션: 거절(refusal) 시 서버측 대체 모델로 자동 재시도
const COMMON = {
  model: MODEL,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

// ───────── AI 태깅 ─────────
const ID_LIST = TERMS.map((t) => `${t.id}: ${t.name}${t.hanja ? `(${t.hanja})` : ""} — ${t.short}`).join("\n");
const TagSchema = z.object({
  scene: z.string().describe("이미지가 무엇인지 한 문장 (예: 다포식 팔작지붕 전각의 정면 사진)"),
  tags: z.array(
    z.object({
      term_id: z.enum(TERMS.map((t) => t.id)),
      confidence: z.enum(["high", "medium", "low"]),
      where: z.string().describe("이미지 안에서 해당 부재가 보이는 위치 (예: 왼쪽 위 처마 끝)"),
    }),
  ),
  unlisted: z.array(z.string()).describe("보이지만 용어 목록에 없는 부재 이름"),
});

const TAG_SYSTEM = `당신은 한국 전통 건축·석조물·불교미술 부재 판독 보조자입니다.
사용자가 올린 답사 사진, 도면, 보고서 캡처에서 실제로 보이는 부재만 골라 아래 용어 목록의 id로 태그합니다.

규칙:
- 이미지에서 확인되는 것만 태그합니다. 보이지 않는데 "있을 법한" 부재는 넣지 않습니다.
- 도면에 한글 라벨이 적혀 있으면 그 라벨을 근거로 삼고 confidence를 high로 둡니다.
- 형태만으로 판단해 애매하면 low로 둡니다.
- 목록에 없는 부재는 tags에 넣지 말고 unlisted에 이름만 적습니다.

용어 목록:
${ID_LIST}`;

async function handleTag(body) {
  const { image, mediaType } = body;
  if (!image || !/^image\/(jpeg|png|webp|gif)$/.test(mediaType || "")) {
    return [400, { error: "image(base64)와 mediaType(image/jpeg|png|webp|gif)이 필요합니다." }];
  }
  const res = await client.beta.messages.parse({
    ...COMMON,
    max_tokens: 16000,
    system: TAG_SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(TagSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: "이 이미지에 보이는 부재를 용어 목록 기준으로 태그해 주세요." },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") return [422, { error: "이 이미지는 분석할 수 없습니다." }];
  const out = res.parsed_output;
  if (!out) return [502, { error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요." }];
  const order = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  const tags = out.tags
    .filter((x) => TERM_BY_ID[x.term_id] && !seen.has(x.term_id) && seen.add(x.term_id))
    .sort((a, b) => order[a.confidence] - order[b.confidence]);
  return [200, { scene: out.scene, tags, unlisted: out.unlisted }];
}

// ───────── RAG 튜터 ─────────
const TUTOR_SYSTEM = `당신은 한국 전통 건축 용어 튜터입니다. 학부생의 질문에 한국어로 답합니다.

반드시 지킬 것:
- <context> 안의 <doc> 내용만 근거로 답합니다. 일반 지식으로 빈칸을 채우지 않습니다.
- 문장마다 근거가 된 문서를 [id] 형태로 표시합니다. 예: 고주는 종보 한쪽 끝을 받는다 [gooju].
- 문맥에 답이 없거나 일부만 있으면, 확인된 부분만 답하고 "제공된 용어집에서는 확인되지 않습니다"라고 분명히 말합니다.
- 용어집에 없는 용어(오탈자·비표준 표기 포함)를 묻는 경우 비슷한 표준 용어를 안내하되 단정하지 않습니다.
- 답변은 3~8문장, 필요하면 짧은 목록을 씁니다. 구조 질문은 아래에서 위로(기둥→보→도리) 순서로 설명합니다.`;

async function handleAsk(body) {
  const question = String(body.question || "").slice(0, 1000).trim();
  if (!question) return [400, { error: "질문이 비어 있습니다." }];
  const docs = retrieve(question);
  const sources = docs.map((d) => ({ id: d.id, name: d.name, source: d.source }));
  if (!docs.length) {
    return [200, { answer: "제공된 용어집에서 관련 용어를 찾지 못했습니다. 용어 이름을 넣어 다시 질문해 주세요.", sources }];
  }
  const res = await client.beta.messages.create({
    ...COMMON,
    max_tokens: 4000,
    system: TUTOR_SYSTEM,
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: `<context>\n${formatContext(docs)}\n</context>\n\n질문: ${question}` }],
  });
  if (res.stop_reason === "refusal") return [422, { error: "이 질문에는 답할 수 없습니다." }];
  const answer = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return [200, { answer, sources }];
}

// ───────── HTTP ─────────
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "POST" && (url.pathname === "/api/tag" || url.pathname === "/api/ask")) {
      const body = await readJson(req);
      const [code, out] = url.pathname === "/api/tag" ? await handleTag(body) : await handleAsk(body);
      return send(res, code, out);
    }
    // 정적 파일
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    const file = path.join(PUBLIC, path.normalize(p));
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: "forbidden" });
    const data = await fs.readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    if (e.code === "ENOENT") return send(res, 404, { error: "not found" });
    if (e.status === 413) return send(res, 413, { error: "이미지가 너무 큽니다." });
    if (e instanceof SyntaxError) return send(res, 400, { error: "잘못된 요청 형식입니다." });
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." });
    if (e instanceof Anthropic.AuthenticationError) return send(res, 503, { error: "AI 인증에 실패했습니다. API 키를 확인하세요." });
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: `AI 서버 오류 (${e.status ?? "연결"})` });
    if (/authentication method/i.test(e.message)) return send(res, 503, { error: "서버에 AI 인증 정보(ANTHROPIC_API_KEY)가 설정되지 않았습니다." });
    console.error(e);
    send(res, 500, { error: "서버 오류" });
  }
});

server.listen(PORT, () => console.log(`TAMSAEK-H → http://localhost:${PORT}  (AI 모델: ${MODEL})`));
