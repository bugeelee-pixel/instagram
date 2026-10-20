import { page } from "./page.js";
import { clientScript } from "./client.js";
import { generateSchedule, regeneratePost, requestStructuredContent } from "./ai.js";
import { validatePlannerInput } from "./domain.js";

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function readJson(request) {
  try { return await request.json(); } catch { throw new Error("INVALID_REQUEST"); }
}

export function createWorker(dependencies = {}) {
  return {
  async fetch(request, env, ctx) {
    void env;
    void ctx;
    const { pathname } = new URL(request.url);
    if (pathname === "/") return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (pathname === "/client.js") return new Response(clientScript, { headers: { "content-type": "text/javascript; charset=utf-8" } });
    if (request.method === "POST" && (pathname === "/api/generate" || pathname === "/api/regenerate")) {
      try {
        const body = await readJson(request);
        const rawInput = pathname === "/api/generate" ? body : body.input;
        const input = validatePlannerInput(rawInput);
        if (!env?.OPENAI_API_KEY || !env?.OPENAI_MODEL) return json({ error: "AI 설정이 필요합니다." }, 503);
        const now = dependencies.now ? dependencies.now() : new Date();
        const requestFn = dependencies.request || ((prompt) => requestStructuredContent(prompt, env));
        const schedule = pathname === "/api/generate"
          ? await generateSchedule(input, { now, request: requestFn })
          : await regeneratePost(input, body.schedule, body.postId, { now, request: requestFn });
        return json({ schedule });
      } catch (error) {
        const validationMessage = String(error?.message || "");
        if (/입력값|생성 기간|게시 횟수|중점 주제|INVALID_REQUEST/.test(validationMessage)) return json({ error: "입력값을 확인해주세요." }, 400);
        return json({ error: "AI 결과를 생성하지 못했습니다." }, 502);
      }
    }
    return new Response("Not found", { status: 404 });
  },
  };
}

export default createWorker();
