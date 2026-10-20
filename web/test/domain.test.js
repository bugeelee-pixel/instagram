import test from "node:test";
import assert from "node:assert/strict";

import { buildPublishingDates, normalizeSchedule, REVIEW_NOTICE } from "../worker/domain.js";

const baseInput = { duration: "week", frequency: "three", emphasis: "balanced", brands: "", events: "" };

test("buildPublishingDates returns unique in-range dates for every duration and frequency", () => {
  const expected = {
    week: { three: 3, five: 5, daily: 7 },
    twoWeeks: { three: 6, five: 10, daily: 14 },
    month: { three: 12, five: 20, daily: 31 },
  };
  for (const [duration, frequencies] of Object.entries(expected)) {
    for (const [frequency, count] of Object.entries(frequencies)) {
      const dates = buildPublishingDates({ ...baseInput, duration, frequency }, new Date("2026-10-18T09:00:00+09:00"));
      assert.equal(dates.length, count, `${duration}/${frequency}`);
      assert.equal(new Set(dates).size, count);
      assert.deepEqual([...dates].sort(), dates);
      assert.ok(dates.every((date) => date >= "2026-10-18" && date <= "2026-11-17"));
    }
  }
});

test("buildPublishingDates keeps calendar dates stable across a month boundary", () => {
  assert.deepEqual(
    buildPublishingDates({ ...baseInput, duration: "week", frequency: "three" }, new Date("2026-01-29T12:00:00+09:00")),
    ["2026-01-29", "2026-02-01", "2026-02-04"],
  );
});

function validRawSchedule() {
  const input = { ...baseInput };
  const dates = buildPublishingDates(input, new Date("2026-10-18T09:00:00+09:00"));
  return {
    id: "schedule-1",
    createdAt: "2026-10-18T00:00:00.000Z",
    input,
    posts: dates.map((date, index) => ({
      id: `post-${index + 1}`,
      date,
      title: `오메가3 ${index + 1}, 같이 먹어도 될까요?`,
      hookKeyword: "오메가3",
      contentType: ["health", "pharmacy", "visit"][index],
      slides: ["첫 장", "둘째 장", "셋째 장", "넷째 장"],
      caption: "친근한 설명입니다.",
      hashtags: ["#메디박스", "#동네약국"],
      photoGuide: "약국 내부 사진",
      reviewFlags: [],
      reviewNotice: REVIEW_NOTICE,
      trendReason: "최근 SNS에서 관심이 높아진 주제",
      sourceTitle: "공식 안전정보",
      sourceUrl: "https://example.com/official",
    })),
    pharmacy: { name: "메디박스 약국", region: "  ", address: "", hours: "" },
  };
}

test("normalizeSchedule trims content and omits blank pharmacy settings", () => {
  const input = { ...baseInput };
  const normalized = normalizeSchedule(validRawSchedule(), input, new Date("2026-10-18T09:00:00+09:00"));
  assert.deepEqual(normalized.pharmacy, { name: "메디박스 약국" });
  assert.equal(normalized.posts.length, 3);
});

test("normalizeSchedule rejects slide counts outside four to six", () => {
  const raw = validRawSchedule();
  raw.posts[0].slides = ["1", "2", "3"];
  assert.throws(() => normalizeSchedule(raw, baseInput, new Date("2026-10-18T09:00:00+09:00")), /4~6장/);
});

test("normalizeSchedule rejects missing pharmacist review notice", () => {
  const raw = validRawSchedule();
  raw.posts[0].reviewNotice = "";
  assert.throws(() => normalizeSchedule(raw, baseInput, new Date("2026-10-18T09:00:00+09:00")), /검토 안내/);
});

test("normalizeSchedule rejects a title that omits its concrete hook keyword", () => {
  const raw = validRawSchedule();
  raw.posts[0].hookKeyword = "에페";
  raw.posts[0].title = "다이어트 치료제 최신 정보";
  assert.throws(() => normalizeSchedule(raw, baseInput, new Date("2026-10-18T09:00:00+09:00")), /후킹 키워드/);
});

test("normalizeSchedule rejects a viral topic without an official source URL", () => {
  const raw = validRawSchedule();
  raw.posts[0].sourceUrl = "";
  assert.throws(() => normalizeSchedule(raw, baseInput, new Date("2026-10-18T09:00:00+09:00")), /출처/);
});
