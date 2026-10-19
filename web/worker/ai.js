import { REVIEW_NOTICE, buildPublishingDates, normalizeSchedule, validatePlannerInput } from "./domain.js";

const stringField = { type: "string" };
const postSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: stringField, date: stringField, title: stringField,
    contentType: { type: "string", enum: ["health", "pharmacy", "brand", "visit"] },
    slides: { type: "array", minItems: 4, maxItems: 6, items: stringField },
    caption: stringField,
    hashtags: { type: "array", items: stringField },
    photoGuide: stringField,
    reviewFlags: { type: "array", items: stringField },
    reviewNotice: { type: "string", const: REVIEW_NOTICE },
  },
  required: ["id", "date", "title", "contentType", "slides", "caption", "hashtags", "photoGuide", "reviewFlags", "reviewNotice"],
};

export const SCHEDULE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: stringField,
    createdAt: stringField,
    input: {
      type: "object", additionalProperties: false,
      properties: { duration: stringField, frequency: stringField, emphasis: stringField, brands: stringField, events: stringField },
      required: ["duration", "frequency", "emphasis", "brands", "events"],
    },
    pharmacy: {
      type: "object", additionalProperties: false,
      properties: { name: stringField, region: stringField, address: stringField, hours: stringField },
      required: ["name", "region", "address", "hours"],
    },
    posts: { type: "array", items: postSchema },
  },
  required: ["id", "createdAt", "input", "pharmacy", "posts"],
};

export function buildSchedulePrompt(rawInput, dates) {
  const input = validatePlannerInput(rawInput);
  return [
    "메디박스 약국 전용 인스타그램 사진 게시 일정과 문구를 JSON으로 작성하세요.",
    `게시 날짜는 정확히 다음 순서로 사용하세요: ${dates.join(", ")}`,
    "기본 비율은 건강정보 50%, 약국·동네 이야기 20%, 브랜드·제품 20%, 방문 안내 10%입니다.",
    `중점 주제: ${input.emphasis}`,
    `브랜드·제품 맥락: ${input.brands || "없음"}`,
    `휴무·행사·특별 일정: ${input.events || "없음"}`,
    "각 게시물은 카드뉴스 4~6장, 본문, 해시태그, 준비할 사진 안내를 포함하세요.",
    "쉽고 친근한 약사 말투를 사용하고 같은 제목이나 주제를 반복하지 마세요.",
    "질환을 진단하거나 치료 효과·효능을 보장하거나 단정하지 마세요. 개인 상황에 따라 달라지는 내용은 약사 상담을 권하세요.",
    `모든 게시물의 reviewNotice는 정확히 '${REVIEW_NOTICE}'여야 합니다. 사실 확인이 필요한 내용은 reviewFlags에 적으세요.`,
    "약국명은 메디박스 약국입니다. 알 수 없는 지역, 주소, 운영시간은 빈 문자열로 두세요.",
  ].join("\n");
}

function outputText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI 응답에 출력 텍스트가 없습니다.");
}

export async function requestStructuredContent(prompt, env, fetchImpl = fetch) {
  if (!env?.OPENAI_API_KEY || !env?.OPENAI_MODEL) throw new Error("OPENAI_CONFIG_MISSING");
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "authorization": `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: [{ role: "system", content: "당신은 약국의 안전한 소셜 콘텐츠 편집자입니다." }, { role: "user", content: prompt }],
      text: { format: { type: "json_schema", name: "medibox_schedule", strict: true, schema: SCHEDULE_JSON_SCHEMA } },
    }),
  });
  if (!response.ok) throw new Error(`OPENAI_PROVIDER_${response.status}`);
  return JSON.parse(outputText(await response.json()));
}

export async function generateSchedule(rawInput, options = {}) {
  const input = validatePlannerInput(rawInput);
  const now = options.now || new Date();
  const dates = buildPublishingDates(input, now);
  const prompt = buildSchedulePrompt(input, dates);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await options.request(prompt);
      return normalizeSchedule(raw, input, now);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("AI 응답을 검증하지 못했습니다.", { cause: lastError });
}

export async function regeneratePost(rawInput, currentSchedule, postId, options = {}) {
  const targetIndex = currentSchedule.posts.findIndex((post) => post.id === postId);
  if (targetIndex < 0) throw new Error("다시 만들 게시물을 찾지 못했습니다.");
  const input = validatePlannerInput(rawInput);
  const dates = buildPublishingDates(input, options.now || new Date());
  const prompt = `${buildSchedulePrompt(input, dates)}\n현재 일정 JSON: ${JSON.stringify(currentSchedule)}\nID가 ${postId}인 게시물만 새로운 주제로 바꾸고 전체 일정 JSON을 반환하세요.`;
  const generated = normalizeSchedule(await options.request(prompt), input, options.now || new Date());
  const posts = currentSchedule.posts.map((post, index) => index === targetIndex
    ? { ...generated.posts[index], id: post.id, date: post.date }
    : post);
  return normalizeSchedule({ ...currentSchedule, posts }, input, options.now || new Date());
}
