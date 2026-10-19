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
    trendReason: stringField,
    sourceTitle: stringField,
    sourceUrl: stringField,
  },
  required: ["id", "date", "title", "contentType", "slides", "caption", "hashtags", "photoGuide", "reviewFlags", "reviewNotice", "trendReason", "sourceTitle", "sourceUrl"],
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
    "콘텐츠 전략은 신뢰형 70%와 공감형 30%의 혼합형입니다.",
    "최근 뉴스와 공개된 인스타그램·SNS에서 많이 다뤄지는 주제를 우선하며, 분야 비율은 약물 40%, 건강기능식품 35%, 일반 건강정보 25%입니다.",
    "게시물 수가 적어 정확한 비율이 어렵다면 약물, 건강기능식품, 일반 건강정보를 가능한 한 고르게 포함하고 모든 주제에 최근 화제성을 반영하세요.",
    `중점 주제: ${input.emphasis}`,
    `메디박스 소식·입점 브랜드 맥락: ${input.brands || "없음"}`,
    `휴무·행사·특별 일정: ${input.events || "없음"}`,
    "각 게시물은 카드뉴스 4~6장, 본문, 해시태그, 준비할 사진 안내를 포함하세요.",
    "쉽고 친근한 약사 말투를 사용하고 같은 제목이나 주제를 반복하지 마세요.",
    "첫 장은 질문, 반전, 체크리스트, 즉시 쓸 수 있는 결론 중 하나로 시작해 저장·공유하고 싶게 만드세요. 선정적 공포나 과장은 금지합니다.",
    "'요즘 자주 보이는데 실제로는 어떨까?', '함께 먹어도 될까?', '광고 문구와 근거는 같을까?'처럼 화제성을 안전한 팩트체크·복용 주의·성분 비교로 전환하세요.",
    "최근 이슈 게시물은 trendReason에 왜 지금 다룰 주제인지 적고 sourceTitle과 sourceUrl에 실제 참고 출처를 넣으세요. 나머지는 세 필드를 빈 문자열로 두세요.",
    "사용자가 제공하지 않은 메디박스 입점, 행사, 재고, 서비스 등 없는 약국 소식은 절대 만들지 마세요.",
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
  const headers = { "authorization": `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" };
  const researchPrompt = "오늘을 기준으로 최근 2~4주 사이 한국 뉴스와 공개적으로 검색 가능한 인스타그램·SNS에서 많이 다뤄지는 약물, 건강기능식품, 일반 건강정보 주제를 찾으세요. 약물 40%, 건강기능식품 35%, 일반 건강정보 25% 비중으로 활용하세요. SNS의 인기 주장 자체를 근거로 쓰지 말고 식약처, 질병관리청, 보건복지부, 의약품안전나라 등 공신력 있는 1차 자료로 사실 확인 또는 교차 확인하세요. 최근 화제가 된 이유와 실제 출처 URL을 반영하고 광고성·과장성 주장이나 개인 맞춤 복용 단정은 제외하세요.";
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      input: `${researchPrompt}\n\n작성 요청:\n${prompt}`,
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
      const stamp = now.getTime();
      const withMetadata = {
        ...raw,
        id: `schedule-${stamp}`,
        createdAt: now.toISOString(),
        input,
        posts: Array.isArray(raw?.posts)
          ? raw.posts.map((post, index) => ({ ...post, id: `post-${stamp}-${index + 1}` }))
          : raw?.posts,
      };
      return normalizeSchedule(withMetadata, input, now);
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
