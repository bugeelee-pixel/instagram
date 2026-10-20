export const REVIEW_NOTICE = "게시 전 약사가 내용을 검토하세요";

const DURATIONS = new Set(["week", "twoWeeks", "month"]);
const FREQUENCIES = new Set(["three", "five", "daily"]);
const EMPHASES = new Set(["visit", "health", "brand", "balanced"]);
const CONTENT_TYPES = new Set(["health", "pharmacy", "brand", "visit"]);

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateAtUtcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function durationDays(duration, start) {
  if (duration === "week") return 7;
  if (duration === "twoWeeks") return 14;
  const nextMonth = new Date(start);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return Math.round((nextMonth - start) / 86_400_000);
}

export function validatePlannerInput(input) {
  if (!input || typeof input !== "object") throw new Error("입력값이 필요합니다.");
  if (!DURATIONS.has(input.duration)) throw new Error("생성 기간이 올바르지 않습니다.");
  if (!FREQUENCIES.has(input.frequency)) throw new Error("게시 횟수가 올바르지 않습니다.");
  if (!EMPHASES.has(input.emphasis)) throw new Error("중점 주제가 올바르지 않습니다.");
  return {
    duration: input.duration,
    frequency: input.frequency,
    emphasis: input.emphasis,
    brands: typeof input.brands === "string" ? input.brands.trim() : "",
    events: typeof input.events === "string" ? input.events.trim() : "",
  };
}

export function buildPublishingDates(rawInput, now = new Date()) {
  const input = validatePlannerInput(rawInput);
  const start = dateAtUtcMidnight(now);
  const days = durationDays(input.duration, start);
  const weekly = input.frequency === "three" ? 3 : input.frequency === "five" ? 5 : 7;
  const count = input.frequency === "daily" ? days : weekly * (input.duration === "week" ? 1 : input.duration === "twoWeeks" ? 2 : 4);
  if (count === 1) return [isoDate(start)];
  return Array.from({ length: count }, (_, index) => {
    const offset = Math.round((index * (days - 1)) / (count - 1));
    return isoDate(addUtcDays(start, offset));
  });
}

function cleanRequired(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}이(가) 필요합니다.`);
  return value.trim();
}

function cleanOptional(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanSourceUrl(value) {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}

export function normalizePost(raw, expectedDate) {
  if (!raw || typeof raw !== "object") throw new Error("게시물 형식이 올바르지 않습니다.");
  const slides = Array.isArray(raw.slides) ? raw.slides.map((value) => cleanRequired(value, "카드 문구")) : [];
  if (slides.length < 4 || slides.length > 6) throw new Error("카드뉴스는 4~6장이어야 합니다.");
  if (!CONTENT_TYPES.has(raw.contentType)) throw new Error("콘텐츠 유형이 올바르지 않습니다.");
  if (raw.reviewNotice !== REVIEW_NOTICE) throw new Error("약사 검토 안내가 필요합니다.");
  const date = cleanRequired(raw.date, "게시 날짜");
  if (expectedDate && date !== expectedDate) throw new Error("요청한 게시 날짜와 일치하지 않습니다.");
  const title = cleanRequired(raw.title, "제목");
  const hookKeyword = cleanRequired(raw.hookKeyword, "후킹 키워드");
  if (!title.toLocaleLowerCase("ko-KR").includes(hookKeyword.toLocaleLowerCase("ko-KR"))) throw new Error("제목에 후킹 키워드가 포함되어야 합니다.");
  const trendReason = cleanRequired(raw.trendReason, "화제 이유");
  const sourceTitle = cleanRequired(raw.sourceTitle, "공식 출처명");
  const sourceUrl = cleanSourceUrl(raw.sourceUrl);
  if (!sourceUrl) throw new Error("공식 출처 URL이 필요합니다.");
  const normalized = {
    id: cleanRequired(raw.id, "게시물 ID"),
    date,
    title,
    hookKeyword,
    contentType: raw.contentType,
    slides,
    caption: cleanRequired(raw.caption, "본문"),
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.map((value) => cleanRequired(value, "해시태그")) : [],
    photoGuide: cleanRequired(raw.photoGuide, "사진 안내"),
    reviewFlags: Array.isArray(raw.reviewFlags) ? raw.reviewFlags.map((value) => String(value).trim()).filter(Boolean) : [],
    reviewNotice: REVIEW_NOTICE,
    trendReason,
    sourceTitle,
    sourceUrl,
  };
  return normalized;
}

export function normalizeSchedule(raw, rawInput, now = new Date()) {
  const input = validatePlannerInput(rawInput);
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.posts)) throw new Error("일정 형식이 올바르지 않습니다.");
  const dates = buildPublishingDates(input, now);
  if (raw.posts.length !== dates.length) throw new Error("요청한 게시물 수와 일치하지 않습니다.");
  const posts = raw.posts.map((post, index) => normalizePost(post, dates[index]));
  if (new Set(posts.map((post) => post.date)).size !== posts.length) throw new Error("게시 날짜가 중복되었습니다.");
  if (new Set(posts.map((post) => post.title)).size !== posts.length) throw new Error("게시물 제목이 중복되었습니다.");
  const pharmacySource = raw.pharmacy && typeof raw.pharmacy === "object" ? raw.pharmacy : {};
  const pharmacy = { name: cleanOptional(pharmacySource.name) || "메디박스 약국" };
  for (const key of ["region", "address", "hours"]) {
    const value = cleanOptional(pharmacySource[key]);
    if (value) pharmacy[key] = value;
  }
  return {
    id: cleanRequired(raw.id, "일정 ID"),
    createdAt: cleanRequired(raw.createdAt, "생성 시각"),
    input,
    posts,
    pharmacy,
  };
}
