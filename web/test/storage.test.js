import test from "node:test";
import assert from "node:assert/strict";

import { createScheduleStore, formatPostForClipboard, formatScheduleForClipboard } from "../worker/client.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; }, removeItem: (key) => { delete data[key]; } };
}

const post = { id: "p1", date: "2026-10-19", title: "환절기 체크", slides: ["표지", "물 마시기", "상담하기", "마무리"], caption: "본문", hashtags: ["#메디박스", "#약국"], photoGuide: "진열대", reviewNotice: "게시 전 약사가 내용을 검토하세요." };
const schedule = (id, createdAt) => ({ id, createdAt, posts: [{ ...post, id: `${id}-p` }] });

test("schedule store returns newest first and keeps at most ten", () => {
  const store = createScheduleStore(memoryStorage());
  for (let index = 0; index < 12; index += 1) store.save(schedule(`s${index}`, `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`));
  assert.equal(store.list().length, 10);
  assert.equal(store.list()[0].id, "s11");
  store.remove("s11");
  assert.equal(store.list()[0].id, "s10");
});

test("schedule store survives corrupt JSON and quota errors", () => {
  assert.deepEqual(createScheduleStore(memoryStorage({ "medibox:schedules": "{" })).list(), []);
  const storage = memoryStorage(); storage.setItem = () => { throw new Error("quota"); };
  assert.doesNotThrow(() => createScheduleStore(storage).save(schedule("s1", "2026-10-18T00:00:00.000Z")));
});

test("clipboard formatters are deterministic and complete", () => {
  const formatted = formatPostForClipboard(post);
  assert.match(formatted, /2026-10-19 \| 환절기 체크/);
  assert.match(formatted, /1장\. 표지/);
  assert.match(formatted, /#메디박스 #약국/);
  assert.match(formatted, /진열대/);
  assert.equal(formatScheduleForClipboard({ posts: [post] }), formatted);
});
