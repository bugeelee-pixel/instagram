export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function formatPostForClipboard(post) {
  const slides = post.slides.map((text, index) => `${index + 1}장. ${text}`).join("\n");
  const source = post.trendReason ? ["", "왜 지금 이 주제인가", post.trendReason, post.sourceTitle || "", post.sourceUrl || ""].join("\n") : "";
  return [
    `${post.date} | ${post.title}`, "", slides, "", "캡션", post.caption, "",
    post.hashtags.join(" "), "", "사진 가이드", post.photoGuide, source, "", post.reviewNotice,
  ].join("\n");
}

export function formatScheduleForClipboard(schedule) {
  return schedule.posts.map(formatPostForClipboard).join("\n\n---\n\n");
}

export function createScheduleStore(storage, key = "medibox:schedules") {
  function list() {
    try {
      const value = JSON.parse(storage.getItem(key) || "[]");
      return Array.isArray(value) ? value.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10) : [];
    } catch { return []; }
  }
  function write(items) { try { storage.setItem(key, JSON.stringify(items)); } catch { /* Storage is optional. */ } }
  return {
    list,
    save(schedule) { write([schedule, ...list().filter((item) => item.id !== schedule.id)].slice(0, 10)); },
    remove(id) { write(list().filter((item) => item.id !== id)); },
  };
}

export function renderScheduleMarkup(schedule, selectedId) {
  const posts = Array.isArray(schedule?.posts) ? schedule.posts : [];
  if (!posts.length) return '<div class="empty"><div><h2>표시할 게시물이 없습니다</h2></div></div>';
  const selected = posts.find((post) => post.id === selectedId) || posts[0];
  const typeLabels = { health: "건강정보", pharmacy: "약국 이야기", brand: "브랜드·제품", visit: "방문 유도" };
  const postButtons = posts.map((post) => `<button class="calendar-item${post.id === selected.id ? " active" : ""}" type="button" data-post-id="${escapeHtml(post.id)}"><span>${escapeHtml(post.date)}</span><strong>${escapeHtml(post.title)}</strong></button>`).join("");
  const slides = selected.slides.map((slide, index) => `<li><span>${index + 1}</span><p>${escapeHtml(slide)}</p></li>`).join("");
  const flags = selected.reviewFlags?.length ? selected.reviewFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("") : "<li>특이 검토사항 없음</li>";
  const tags = selected.hashtags.map(escapeHtml).join(" ");
  const trend = selected.trendReason ? `<section class="trend-card"><h4>왜 지금 이 주제인가</h4><p>${escapeHtml(selected.trendReason)}</p>${selected.sourceUrl ? `<a href="${escapeHtml(selected.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(selected.sourceTitle || "참고 출처")}</a>` : ""}</section>` : "";
  return `<div class="schedule-head"><div><p class="eyebrow">CONTENT CALENDAR</p><h2>${posts.length}개 게시물 일정</h2></div><button class="ghost" type="button" data-copy="schedule">전체 일정 복사</button></div>
    <div class="planner-grid"><nav class="calendar" aria-label="게시물 날짜 선택">${postButtons}</nav>
    <article class="post-detail" data-selected-post="${escapeHtml(selected.id)}">
      <div class="post-title-row"><div><span class="type-badge">${escapeHtml(typeLabels[selected.contentType] || selected.contentType)}</span><p class="post-date">${escapeHtml(selected.date)}</p><h3>${escapeHtml(selected.title)}</h3></div><button class="secondary" type="button" data-regenerate>이 게시물 다시 생성</button></div>
      <section class="content-card"><div class="card-heading"><h4>카드뉴스 문구</h4><button type="button" data-copy="slides">복사</button></div><ol class="slides">${slides}</ol></section>
      <section class="content-card"><div class="card-heading"><h4>캡션</h4><button type="button" data-copy="caption">복사</button></div><p class="preserve">${escapeHtml(selected.caption)}</p></section>
      <section class="content-card"><div class="card-heading"><h4>해시태그</h4><button type="button" data-copy="hashtags">복사</button></div><p>${tags}</p></section>
      <section class="content-card"><div class="card-heading"><h4>사진 가이드</h4><button type="button" data-copy="photoGuide">복사</button></div><p class="preserve">${escapeHtml(selected.photoGuide)}</p></section>
      ${trend}
      <section class="review-card"><h4>약사 검토 포인트</h4><ul>${flags}</ul><p>${escapeHtml(selected.reviewNotice)}</p></section>
      <button class="primary copy-post" type="button" data-copy="post">이 게시물 전체 복사</button>
    </article></div>`;
}

export const clientScript = String.raw`
document.documentElement.classList.add("js");
const escapeHtml = ${escapeHtml.toString()};
const formatPostForClipboard = ${formatPostForClipboard.toString()};
const formatScheduleForClipboard = ${formatScheduleForClipboard.toString()};
const createScheduleStore = ${createScheduleStore.toString()};
const renderScheduleMarkup = ${renderScheduleMarkup.toString()};
const form = document.querySelector("#planner-form");
const workspace = document.querySelector("#workspace");
const recent = document.querySelector("#recent-schedules");
const store = createScheduleStore(localStorage);
let schedule = null; let selectedId = null; let controller = null; let requestId = 0;
function inputFromForm() { const values = Object.fromEntries(new FormData(form)); return { duration: values.duration, frequency: values.frequency, emphasis: values.emphasis, brands: values.brands || "", events: values.events || "" }; }
function setBusy(isBusy, message = "원고를 만들고 있습니다…") { form.querySelector("button[type=submit]").disabled = isBusy; if (isBusy) workspace.innerHTML = '<div class="loading"><span></span><h2>' + escapeHtml(message) + '</h2><p>잠시만 기다려주세요.</p></div>'; }
function showError(message) { workspace.innerHTML = '<div class="error-state"><h2>생성하지 못했어요</h2><p>' + escapeHtml(message) + '</p><button class="secondary" type="button" data-retry>다시 시도</button></div>'; }
function render() { workspace.innerHTML = renderScheduleMarkup(schedule, selectedId); }
function renderRecent() {
  const items = store.list();
  recent.innerHTML = items.length ? '<h3>최근 일정</h3><div class="recent-list">' + items.map((item) => '<div class="recent-item"><button type="button" data-load-schedule="' + escapeHtml(item.id) + '"><strong>' + escapeHtml(item.posts?.[0]?.date || item.createdAt.slice(0, 10)) + '</strong><span>' + escapeHtml((item.posts?.length || 0) + '개 게시물') + '</span></button><button class="delete-schedule" type="button" aria-label="일정 삭제" data-delete-schedule="' + escapeHtml(item.id) + '">×</button></div>').join("") + '</div>' : "";
}
async function requestSchedule(url, body, message) {
  if (controller) controller.abort(); controller = new AbortController(); const currentRequest = ++requestId; setBusy(true, message);
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "잠시 후 다시 시도해주세요."); if (currentRequest !== requestId) return;
    schedule = data.schedule; selectedId = url === "/api/regenerate" ? selectedId : schedule.posts[0]?.id; store.save(schedule); render(); renderRecent();
  } catch (error) { if (error.name !== "AbortError" && currentRequest === requestId) showError(error.message); }
  finally { if (currentRequest === requestId) form.querySelector("button[type=submit]").disabled = false; }
}
form.addEventListener("submit", (event) => { event.preventDefault(); requestSchedule("/api/generate", inputFromForm(), "게시 일정을 만들고 있습니다…"); });
workspace.addEventListener("click", async (event) => {
  const postButton = event.target.closest("[data-post-id]"); if (postButton) { selectedId = postButton.dataset.postId; render(); return; }
  if (event.target.closest("[data-retry]")) { requestSchedule("/api/generate", inputFromForm(), "게시 일정을 다시 만들고 있습니다…"); return; }
  if (event.target.closest("[data-regenerate]")) { requestSchedule("/api/regenerate", { input: schedule.input, schedule, postId: selectedId }, "선택한 게시물을 다시 쓰고 있습니다…"); return; }
  const copyButton = event.target.closest("[data-copy]"); if (!copyButton || !schedule) return; const post = schedule.posts.find((item) => item.id === selectedId) || schedule.posts[0];
  const parts = { caption: post.caption, slides: post.slides.map((text, i) => (i + 1) + "장. " + text).join("\n"), hashtags: post.hashtags.join(" "), photoGuide: post.photoGuide };
  await navigator.clipboard.writeText(copyButton.dataset.copy === "post" ? formatPostForClipboard(post) : copyButton.dataset.copy === "schedule" ? formatScheduleForClipboard(schedule) : parts[copyButton.dataset.copy]);
  const old = copyButton.textContent; copyButton.textContent = "복사됨"; setTimeout(() => { copyButton.textContent = old; }, 1200);
});
recent.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-schedule]");
  if (loadButton) { schedule = store.list().find((item) => item.id === loadButton.dataset.loadSchedule); if (schedule) { selectedId = schedule.posts[0]?.id; render(); } return; }
  const deleteButton = event.target.closest("[data-delete-schedule]");
  if (deleteButton && confirm("이 저장 일정을 삭제할까요?")) { store.remove(deleteButton.dataset.deleteSchedule); renderRecent(); }
});
renderRecent();
`;
