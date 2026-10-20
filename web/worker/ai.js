import { REVIEW_NOTICE, buildPublishingDates, normalizeSchedule, validatePlannerInput } from "./domain.js";

const stringField = { type: "string" };
const postSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: stringField, date: stringField, title: stringField, hookKeyword: stringField,
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
  required: ["id", "date", "title", "hookKeyword", "contentType", "slides", "caption", "hashtags", "photoGuide", "reviewFlags", "reviewNotice", "trendReason", "sourceTitle", "sourceUrl"],
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
    "모든 게시물의 hookKeyword에는 제목의 핵심 약명·성분명·제품군을 적고 title에 그 문구를 정확히 포함하세요. 전체 게시물의 3분의 2 이상은 구체적인 약명 또는 성분명을 사용하세요. '환절기 건강관리', '건강한 습관'처럼 두루뭉술한 일반론 제목은 금지합니다.",
    "제목은 '화제 키워드 + 궁금증·비교·반전' 구조로 만들고, 첫 장은 제목보다 한 단계 더 강한 질문이나 결론으로 시작하세요. 선정적 공포나 과장은 금지합니다.",
    "'요즘 자주 보이는데 실제로는 어떨까?', '함께 먹어도 될까?', '광고 문구와 근거는 같을까?'처럼 화제성을 안전한 팩트체크·복용 주의·성분 비교로 전환하세요.",
    "카드 흐름은 강한 첫 문장 → 왜 지금 화제인지 → 핵심 사실 → 오해와 주의점 → 저장할 결론 순서를 기본으로 하세요.",
    "모든 게시물은 trendReason에 왜 지금 화제인지 적고 sourceTitle과 sourceUrl에 사실 확인에 사용한 공식 1차 출처를 반드시 넣으세요.",
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
  const researchPrompt = "오늘을 기준으로 최근 14일 사이 한국 뉴스와 공개적으로 검색 가능한 인스타그램·SNS에서 반복적으로 언급된 구체적인 약명, 성분명, 건강기능식품 제품군을 우선 찾으세요. 특히 최신 검색 결과가 있으면 한미약품 에페(에페글레나타이드) 허가·출시 이슈와 위고비·마운자로의 차이, 그리고 마그네슘·유산균·오메가3·혈당·수면·다이어트 관련 영양제처럼 SNS에서 바이럴되는 성분을 후보로 검토하세요. 검색 결과가 없거나 최신성이 떨어지는 사례는 억지로 포함하지 마세요. 약물 40%, 건강기능식품 35%, 일반 건강정보 25% 비중으로 활용하고, 최소 2개 게시물은 구체적인 약명 또는 성분명을 제목에 넣으세요. SNS의 인기 주장 자체를 근거로 쓰지 말고 식약처, 질병관리청, 보건복지부, 의약품안전나라와 제조사 허가자료 등 1차 자료로 사실 확인 또는 교차 확인하세요. 최근 화제가 된 이유와 실제 출처 URL을 반영하고 광고성·과장성 주장, 구매 유도, 개인 맞춤 복용 단정은 제외하세요.";
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
