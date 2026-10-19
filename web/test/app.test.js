import test from "node:test";
import assert from "node:assert/strict";

import worker from "../worker/index.js";

test("renders the Medibox planner shell", async () => {
  const response = await worker.fetch(new Request("https://example.com/"), {}, {});
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /메디박스 인스타 콘텐츠 플래너/);
  assert.match(html, /일정 만들기/);
  assert.match(html, /게시 전 약사가 내용을 검토하세요/);
});
