# Medibox Instagram Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and privately deploy a mobile-first Medibox pharmacy web tool that generates, reviews, stores, and copies AI-authored Instagram photo-post schedules.

**Architecture:** Use the Sites Vinext starter for a React 19 interface and Cloudflare Worker-backed server routes. Keep schedule rules, validation, prompt construction, browser persistence, and UI components isolated behind typed interfaces; call the OpenAI API only from the server and keep all generated schedules in browser local storage.

**Tech Stack:** TypeScript 5.9, React 19, Next 16/Vinext, Tailwind CSS 4, Zod 3, date-fns 4, Vitest, Testing Library, OpenAI Responses API, OpenAI Sites/Cloudflare Workers

**Spec:** `docs/superpowers/specs/2026-10-18-medibox-instagram-planner-design.md`

## Global Constraints

- The product is a private, Medibox-only web application.
- Generate 1-week, 2-week, or 1-month schedules at 3 posts/week, 5 posts/week, or daily.
- Every post includes a date, title, content type, 4–6 card-news slides, caption, hashtags, photo guidance, and review flags.
- Default content mix is health information 50%, pharmacy/neighborhood 20%, brand/product 20%, and visit guidance 10%; the selected emphasis may adjust the mix.
- Do not diagnose, promise efficacy, or make definitive treatment claims; always display `게시 전 약사가 내용을 검토하세요`.
- Do not accept or store customer personal or sensitive health information.
- Store at most 10 schedules in browser local storage; use no database.
- Keep `OPENAI_API_KEY` server-only. Read the model from `OPENAI_MODEL`; never expose either value to the browser bundle.
- Instagram connection, scheduled posting, and image/video generation are out of scope.
- The initial release must be responsive and usable on phone and desktop.

## Review Focus

- Invalid combinations or boundary dates must never create duplicate or out-of-range publishing dates; Task 2 tests all duration/frequency combinations and month boundaries.
- Malformed, partial, or medically unsafe AI output must be rejected before reaching the UI; Task 3 tests schema failures, safety flags, and the single retry.
- Empty optional pharmacy settings must be omitted cleanly rather than appearing as blank labels; Task 2 and Task 4 test empty configuration.
- Corrupt or quota-exceeded local storage must not prevent viewing and copying the current schedule; Task 5 tests both conditions.
- Rapid repeated generation or per-post regeneration must not overwrite a newer result with an older response; Task 4 tests request cancellation and stale-response handling.

---

## File Structure

- `app/page.tsx`: server entry that renders the planner shell.
- `app/layout.tsx`: metadata, fonts, and global shell.
- `app/globals.css`: Medibox color tokens and responsive layout styles.
- `app/api/generate/route.ts`: authenticated server-only schedule generation endpoint.
- `app/api/regenerate/route.ts`: server-only single-post regeneration endpoint.
- `components/planner/planner-app.tsx`: client orchestration and request state.
- `components/planner/planner-form.tsx`: generation inputs.
- `components/planner/schedule-calendar.tsx`: date navigation and post selection.
- `components/planner/post-detail.tsx`: generated copy and copy actions.
- `components/planner/recent-schedules.tsx`: saved schedule list.
- `lib/content/types.ts`: shared Zod schemas and inferred types.
- `lib/content/dates.ts`: deterministic publication-date generation.
- `lib/content/prompt.ts`: Medibox prompt and mix instructions.
- `lib/content/normalize.ts`: AI response validation and normalization.
- `lib/content/openai.ts`: server-only OpenAI request adapter.
- `lib/content/api.ts`: browser request client with abort handling.
- `lib/storage/schedules.ts`: bounded local-storage repository.
- `tests/`: unit and component tests mirroring the modules above.

### Task 1: Scaffold the Sites Application and Test Harness

**Files:**
- Create: Vinext starter files at repository root via the Sites setup helper
- Modify: `package.json`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/app/page.test.tsx`

**Interfaces:**
- Consumes: approved visual direction and Sites Vinext starter
- Produces: `npm test`, Medibox design tokens, and a renderable planner shell used by all later tasks

- [ ] **Step 1: Run the Sites project setup helper in the repository root**

Run: `node C:/Users/samsung/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/project-setup.mjs`

Expected: Vinext starter files exist without overwriting `docs/`.

- [ ] **Step 2: Add Vitest and Testing Library dependencies plus the `test` script**

Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event`; define `test` as `vitest run`.

- [ ] **Step 3: Write the failing shell test**

In `tests/app/page.test.tsx`, assert that rendering the page exposes `메디박스 인스타 콘텐츠 플래너`, `일정 만들기`, and the pharmacist-review notice.

- [ ] **Step 4: Run the shell test and verify failure**

Run: `npm test -- tests/app/page.test.tsx`

Expected: FAIL because the starter page does not contain Medibox content.

- [ ] **Step 5: Implement the Medibox shell and visual tokens**

Set metadata in `app/layout.tsx`; replace starter content in `app/page.tsx`; define white, deep-green, and pale-mint tokens plus mobile-first spacing and focus styles in `app/globals.css`.

- [ ] **Step 6: Run the shell test and build**

Run: `npm test -- tests/app/page.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: successful Vinext build.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app vitest.config.ts tests/setup.ts tests/app/page.test.tsx
git commit -m "feat: scaffold Medibox planner"
```

### Task 2: Define Schedule Types, Dates, and Content Rules

**Files:**
- Create: `lib/content/types.ts`
- Create: `lib/content/dates.ts`
- Create: `lib/content/normalize.ts`
- Create: `tests/lib/content/dates.test.ts`
- Create: `tests/lib/content/normalize.test.ts`

**Interfaces:**
- Consumes: `date-fns` from the starter
- Produces: `PlannerInputSchema`, `GeneratedPostSchema`, `ScheduleSchema`, `ScheduleJsonSchema`, `PlannerInput`, `GeneratedPost`, `Schedule`, `buildPublishingDates(input, now)`, and `normalizeSchedule(raw, input)`

- [ ] **Step 1: Write failing schema and date tests**

Cover all 9 duration/frequency combinations; assert unique, ascending dates within the selected range, correct month-boundary behavior, rejection of fewer than 4 or more than 6 slides, rejection of missing review notice, and omission of blank region/address/hours values.

- [ ] **Step 2: Run the domain tests and verify failure**

Run: `npm test -- tests/lib/content/dates.test.ts tests/lib/content/normalize.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement shared Zod types**

Define exact enums for duration (`week`, `twoWeeks`, `month`), frequency (`three`, `five`, `daily`), emphasis (`visit`, `health`, `brand`, `balanced`), and content type (`health`, `pharmacy`, `brand`, `visit`). Export a matching `ScheduleJsonSchema` constant for structured model output and pin both representations with the normalization tests.

- [ ] **Step 4: Implement `buildPublishingDates(input: PlannerInput, now: Date): string[]`**

Return local-calendar ISO dates, spread non-daily posts evenly, and de-duplicate after rounding.

- [ ] **Step 5: Implement `normalizeSchedule(raw: unknown, input: PlannerInput): Schedule`**

Parse with Zod, verify exact requested dates and post count, trim strings, remove blank optional pharmacy fields, and reject duplicate titles or dates.

- [ ] **Step 6: Run the domain tests**

Run: `npm test -- tests/lib/content/dates.test.ts tests/lib/content/normalize.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/content tests/lib/content
git commit -m "feat: define planner schedule domain"
```

### Task 3: Implement Server-Side AI Generation

**Files:**
- Create: `lib/content/prompt.ts`
- Create: `lib/content/openai.ts`
- Create: `app/api/generate/route.ts`
- Create: `app/api/regenerate/route.ts`
- Create: `tests/lib/content/prompt.test.ts`
- Create: `tests/app/api/generate.test.ts`
- Create: `tests/app/api/regenerate.test.ts`
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: `PlannerInput`, `Schedule`, `GeneratedPost`, `buildPublishingDates`, and `normalizeSchedule` from Task 2
- Produces: `buildSchedulePrompt(input, dates)`, `generateSchedule(input)`, `regeneratePost(input, schedule, postId)`, `POST /api/generate`, and `POST /api/regenerate`

- [ ] **Step 1: Write failing prompt and route tests**

Assert the prompt contains the 50/20/20/10 default mix, 4–6 slide rule, prohibited medical claims, required pharmacist-review notice, exact dates, and optional brand/event context without blank pharmacy fields.

- [ ] **Step 2: Add API failure tests**

Mock the OpenAI adapter and assert: invalid request returns 400; missing server configuration returns 503; malformed first response retries once; malformed second response returns 502; regeneration preserves all non-target posts; unsafe/missing review output is rejected.

- [ ] **Step 3: Run the server tests and verify failure**

Run: `npm test -- tests/lib/content/prompt.test.ts tests/app/api/generate.test.ts tests/app/api/regenerate.test.ts`

Expected: FAIL because prompt, adapter, and routes do not exist.

- [ ] **Step 4: Implement `buildSchedulePrompt(input: PlannerInput, dates: string[]): string`**

Keep Medibox voice, content mix, response schema, medical-safety constraints, and requested dates explicit; instruct the model to return JSON only.

- [ ] **Step 5: Implement the server-only OpenAI adapter**

Implement `requestStructuredContent(prompt: string, signal?: AbortSignal): Promise<unknown>` in `lib/content/openai.ts`, read `OPENAI_API_KEY` and `OPENAI_MODEL` only at request time, and use the Responses API with `ScheduleJsonSchema` from Task 2.

- [ ] **Step 6: Implement generation and regeneration routes**

Validate input, call the adapter, normalize output, retry exactly once on response-shape failure, return `{ schedule }`, and map validation/configuration/provider errors to 400/503/502 without leaking secrets.

- [ ] **Step 7: Run the server tests**

Run: `npm test -- tests/lib/content/prompt.test.ts tests/app/api/generate.test.ts tests/app/api/regenerate.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/content app/api tests/lib/content tests/app/api .dev.vars.example
git commit -m "feat: generate Medibox content with AI"
```

### Task 4: Build the Planner Form, Calendar, and Detail Experience

**Files:**
- Create: `lib/content/api.ts`
- Create: `components/planner/planner-app.tsx`
- Create: `components/planner/planner-form.tsx`
- Create: `components/planner/schedule-calendar.tsx`
- Create: `components/planner/post-detail.tsx`
- Modify: `app/page.tsx`
- Create: `tests/components/planner/planner-app.test.tsx`
- Create: `tests/components/planner/planner-form.test.tsx`
- Create: `tests/components/planner/post-detail.test.tsx`

**Interfaces:**
- Consumes: Task 2 types and Task 3 HTTP routes
- Produces: `generateSchedule(input, signal)`, `regeneratePost(payload, signal)`, and the complete interactive planner UI

- [ ] **Step 1: Write failing form and orchestration tests**

Assert defaults, optional inputs, loading/disabled states, successful calendar rendering, date selection, empty optional settings, visible error/retry state, and persistent pharmacist-review notice.

- [ ] **Step 2: Write stale-response and regeneration tests**

Assert a second generation aborts the first; a late first response cannot replace the second; per-post regeneration changes only the selected post and preserves the selected date.

- [ ] **Step 3: Run component tests and verify failure**

Run: `npm test -- tests/components/planner`

Expected: FAIL because the components and client API do not exist.

- [ ] **Step 4: Implement the abort-aware browser API client**

Expose typed `generateSchedule` and `regeneratePost` functions, propagate `AbortSignal`, and convert non-2xx responses to user-safe Korean errors.

- [ ] **Step 5: Implement `PlannerForm` and `PlannerApp`**

Use controlled inputs for duration, frequency, emphasis, brand/product context, and special dates; keep one active `AbortController`; ignore responses whose request ID is no longer current.

- [ ] **Step 6: Implement the calendar and post detail**

Render date cards with content-type badges, select the first post by default, show all generated fields, expose per-section and whole-post copy controls, and make regeneration available only for the selected post.

- [ ] **Step 7: Run component tests and build**

Run: `npm test -- tests/components/planner`

Expected: PASS.

Run: `npm run build`

Expected: successful build without client references to `OPENAI_API_KEY` or `OPENAI_MODEL`.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx components/planner lib/content/api.ts tests/components/planner
git commit -m "feat: add interactive content planner"
```

### Task 5: Add Copying and Resilient Recent-Schedule Storage

**Files:**
- Create: `lib/storage/schedules.ts`
- Create: `components/planner/recent-schedules.tsx`
- Modify: `components/planner/planner-app.tsx`
- Modify: `components/planner/post-detail.tsx`
- Create: `tests/lib/storage/schedules.test.ts`
- Create: `tests/components/planner/recent-schedules.test.tsx`

**Interfaces:**
- Consumes: `Schedule` from Task 2 and planner state from Task 4
- Produces: `listSchedules()`, `saveSchedule(schedule)`, `removeSchedule(id)`, `formatPostForClipboard(post)`, and `formatScheduleForClipboard(schedule)`

- [ ] **Step 1: Write failing storage and formatting tests**

Assert newest-first ordering, replacement by ID, maximum 10 records, corrupt JSON recovery, storage-quota failure returning a non-fatal result, full schedule formatting, and post formatting with slides/caption/hashtags/photo guidance.

- [ ] **Step 2: Run storage tests and verify failure**

Run: `npm test -- tests/lib/storage/schedules.test.ts tests/components/planner/recent-schedules.test.tsx`

Expected: FAIL because storage and recent-list modules do not exist.

- [ ] **Step 3: Implement the local-storage repository**

Use key `medibox.instagramPlanner.schedules.v1`; parse stored values with `ScheduleSchema`; discard invalid entries; cap to 10; return `{ ok: false, reason }` rather than throwing on unavailable/quota storage.

- [ ] **Step 4: Implement copy formatting and feedback**

Format Korean headings in a deterministic order; use `navigator.clipboard.writeText`; display a short success toast or accessible failure message without modifying the content.

- [ ] **Step 5: Implement recent schedule UI**

Show creation date, range, post count, open, and delete; require an in-app delete confirmation; leave current unsaved/generated content usable if persistence fails.

- [ ] **Step 6: Run storage and component tests**

Run: `npm test -- tests/lib/storage/schedules.test.ts tests/components/planner/recent-schedules.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/storage components/planner tests/lib/storage tests/components/planner
git commit -m "feat: save and copy generated schedules"
```

### Task 6: Validate, Document, Package, and Privately Deploy

**Files:**
- Modify: `README.md`
- Create: `.openai/hosting.json` via Sites registration helper
- Modify: `.gitignore`
- Modify: deployment configuration returned by Sites setup as required

**Interfaces:**
- Consumes: complete application and Sites workflow
- Produces: verified private deployment URL and operator instructions

- [ ] **Step 1: Document local and deployed configuration**

In `README.md`, document Node requirement, install/test/build commands, `OPENAI_API_KEY`, `OPENAI_MODEL`, private deployment, browser-only history, content review responsibility, and the prohibition on customer health data.

- [ ] **Step 2: Run the full automated verification**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: successful production build.

Run: `rg -n "OPENAI_API_KEY|OPENAI_MODEL" dist/client .next/static`

Expected: no secret value or server environment access in client assets.

- [ ] **Step 3: Run responsive browser QA**

Verify at phone and desktop widths: form completion, schedule generation with a mocked/local response, date selection, copy actions, individual regeneration, recent schedule open/delete, loading, API error, and storage failure states.

- [ ] **Step 4: Register and configure the private Site**

Create the Site, persist its `project_id`, keep the owner-private audience, declare the Vinext worker build, and add `OPENAI_API_KEY` as a server secret plus `OPENAI_MODEL` as server configuration.

- [ ] **Step 5: Package and deploy through the Sites source workflow**

Run the Sites workflow helper with the verified project ID, source credential, build command, and archive path; save and deploy the resulting version privately.

- [ ] **Step 6: Verify the deployment**

Confirm the deployment reaches a successful terminal state and its URL opens the Medibox planner; run one generated-schedule smoke test without entering customer information.

- [ ] **Step 7: Commit deployment metadata and documentation**

```bash
git add README.md .gitignore .openai/hosting.json
git commit -m "docs: add private deployment workflow"
```

- [ ] **Step 8: Push the completed branch**

Run: `git push origin main`

Expected: GitHub `main` contains the verified application and documentation.
