import test from "node:test";
import assert from "node:assert/strict";

import { clientScript, renderScheduleMarkup } from "../worker/client.js";
import { REVIEW_NOTICE } from "../worker/domain.js";

const schedule = {
  id: "schedule-1", createdAt: "2026-10-18T00:00:00.000Z", input: {}, pharmacy: { name: "메디박스 약국" },
  posts: [{
    id: "post-1", date: "2026-10-19", title: "감기약 복용 전 확인할 점", contentType: "health",
    slides: ["첫 장", "둘째 장", "셋째 장", "넷째 장"], caption: "친근한 본문", hashtags: ["#메디박스"],
    photoGuide: "약 봉투 사진", reviewFlags: ["용량 확인"], reviewNotice: REVIEW_NOTICE,
    trendReason: "최근 환절기 관심이 높아진 주제", sourceTitle: "질병관리청 안내", sourceUrl: "https://example.com/source",
  }],
};

test("renderScheduleMarkup includes calendar navigation and every post detail field", () => {
  const html = renderScheduleMarkup(schedule, "post-1");
  assert.match(html, /2026-10-19/);
  assert.match(html, /감기약 복용 전 확인할 점/);
  assert.match(html, /첫 장/);
  assert.match(html, /친근한 본문/);
  assert.match(html, /#메디박스/);
  assert.match(html, /약 봉투 사진/);
  assert.match(html, /용량 확인/);
  assert.match(html, /왜 지금 이 주제인가/);
  assert.match(html, /최근 환절기 관심이 높아진 주제/);
  assert.match(html, /질병관리청 안내/);
  assert.match(html, /https:\/\/example.com\/source/);
  assert.match(html, /이 게시물 다시 생성/);
  assert.match(html, /data-copy="caption"/);
});

test("browser client aborts stale generation and guards response ordering", () => {
  assert.doesNotThrow(() => new Function(clientScript));
  assert.match(clientScript, /new AbortController/);
  assert.match(clientScript, /requestId/);
  assert.match(clientScript, /controller\.abort/);
  assert.match(clientScript, /\/api\/generate/);
  assert.match(clientScript, /\/api\/regenerate/);
});
