import test from "node:test";
import assert from "node:assert/strict";

import { REVIEW_NOTICE, buildPublishingDates } from "../worker/domain.js";
import { buildSchedulePrompt, generateSchedule, regeneratePost } from "../worker/ai.js";
import { createWorker } from "../worker/index.js";

const now = new Date("2026-10-18T09:00:00+09:00");
const input = { duration: "week", frequency: "three", emphasis: "balanced", brands: "오쏘몰", events: "10월 25일 휴무" };

function rawSchedule(suffix = "") {
  const dates = buildPublishingDates(input, now);
  return {
    id: `schedule${suffix || "-1"}`,
    createdAt: "2026-10-18T00:00:00.000Z",
    input,
    pharmacy: { name: "메디박스 약국", region: "", address: "", hours: "" },
    posts: dates.map((date, index) => ({
      id: `post-${index + 1}`,
      date,
      title: `게시물 ${index + 1}${suffix}`,
      contentType: ["health", "pharmacy", "visit"][index],
      slides: ["첫 장", "둘째 장", "셋째 장", "넷째 장"],
      caption: `본문 ${index + 1}`,
      hashtags: ["#메디박스", "#동네약국"],
      photoGuide: "약국 내부 사진",
      reviewFlags: [],
      reviewNotice: REVIEW_NOTICE,
    })),
  };
}

test("buildSchedulePrompt carries content mix, dates, context, and medical safety rules", () => {
  const prompt = buildSchedulePrompt(input, buildPublishingDates(input, now));
  assert.match(prompt, /50%/);
  assert.match(prompt, /20%/);
  assert.match(prompt, /4~6장/);
  assert.match(prompt, /진단|치료/);
  assert.match(prompt, new RegExp(REVIEW_NOTICE));
  assert.match(prompt, /2026-10-18/);
  assert.match(prompt, /오쏘몰/);
  assert.match(prompt, /10월 25일 휴무/);
});

test("generateSchedule retries one malformed model response then succeeds", async () => {
  const responses = [{ posts: [] }, rawSchedule()];
  let calls = 0;
  const result = await generateSchedule(input, {
    now,
    request: async () => responses[calls++],
  });
  assert.equal(calls, 2);
  assert.equal(result.posts.length, 3);
});

test("generateSchedule fails after the second malformed response", async () => {
  let calls = 0;
  await assert.rejects(
    generateSchedule(input, { now, request: async () => { calls += 1; return { posts: [] }; } }),
    /AI 응답을 검증하지 못했습니다/,
  );
  assert.equal(calls, 2);
});

test("regeneratePost preserves every non-target post", async () => {
  const current = rawSchedule();
  const generated = rawSchedule(" 새로 생성");
  generated.posts[1].id = "replacement-id";
  const result = await regeneratePost(input, current, "post-2", { now, request: async () => generated });
  assert.deepEqual(result.posts[0], current.posts[0]);
  assert.equal(result.posts[1].title, generated.posts[1].title);
  assert.equal(result.posts[1].id, "post-2");
  assert.equal(result.posts[1].date, current.posts[1].date);
  assert.deepEqual(result.posts[2], current.posts[2]);
});

test("generate route maps invalid input, missing config, and malformed provider output", async () => {
  const invalidWorker = createWorker({ now: () => now });
  const invalidResponse = await invalidWorker.fetch(new Request("https://example.com/api/generate", { method: "POST", body: "{}" }), {}, {});
  assert.equal(invalidResponse.status, 400);

  const missingConfig = await invalidWorker.fetch(new Request("https://example.com/api/generate", { method: "POST", body: JSON.stringify(input) }), {}, {});
  assert.equal(missingConfig.status, 503);

  const malformedWorker = createWorker({ now: () => now, request: async () => ({ posts: [] }) });
  const malformed = await malformedWorker.fetch(new Request("https://example.com/api/generate", { method: "POST", body: JSON.stringify(input) }), { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" }, {});
  assert.equal(malformed.status, 502);
});
