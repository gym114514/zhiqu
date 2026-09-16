import test from "node:test";
import assert from "node:assert/strict";
import { completionUrl, canRelay, chatBody, chatText, emptyConnection, persistConnection, readConnection, STORAGE_KEY, limitedText, REDIRECT_MODE } from "../lib/ai-connection";
import { generateWithConnection, parseModelLesson, requestChat, MODEL_WORKFLOW } from "../lib/ai-client";
import { POST } from "../app/api/ai/chat/route";
import { validExample, adaptiveLessonSchema } from "../lib/adaptive";

const config = { ...emptyConnection(), apiKey: "test-secret-not-real" };
const signal = () => new AbortController().signal;
const input = { connection: config, messages: [{ role: "user" as const, content: "Return JSON" }], json: true, maxTokens: 64 };

test("normalizes endpoints and only relays exact official routes", () => {
 assert.equal(completionUrl("https://api.deepseek.com/"), "https://api.deepseek.com/chat/completions");
 assert.equal(completionUrl("https://x.example/v1/chat/completions/"), "https://x.example/v1/chat/completions");
 for (const url of ["http://localhost:3000/v1", "https://user:pass@x.example/v1", "https://x.example?key=secret", "https://x.example/#a"]) assert.throws(() => completionUrl(url));
 for (const url of ["https://api.deepseek.com.evil.example/chat/completions", "https://127.0.0.1/chat/completions", "https://api.deepseek.com/other/chat/completions", "https://api.openai.com:444/v1/chat/completions"]) assert.equal(canRelay(url), false);
 assert.equal(canRelay(completionUrl(config.baseUrl)), true);
});
test("keys persist only with opt-in and can be removed", () => {
 const map = new Map<string, string>(); const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
 persistConnection(storage, config, false); assert.equal(map.size, 0);
 persistConnection(storage, config, true); assert.deepEqual(readConnection(storage), config);
 persistConnection(storage, config, false); assert.equal(readConnection(storage), null);
 storage.setItem(STORAGE_KEY, "broken"); assert.equal(readConnection(storage), null); assert.equal(map.size, 0);
});
test("request protocol uses provider token fields and optional JSON mode", () => {
 const deepseekBody = chatBody(input); assert.ok("max_tokens" in deepseekBody); assert.equal(deepseekBody.max_tokens, 64);
 assert.deepEqual(chatBody(input).response_format, { type: "json_object" });
 assert.equal(chatBody({ ...input, connection: { ...config, jsonMode: false } }).response_format, undefined);
 const body = chatBody({ ...input, connection: { ...config, baseUrl: "https://api.openai.com/v1" } });
 assert.ok("max_completion_tokens" in body); assert.equal(body.max_completion_tokens, 64); assert.equal(body.store, false);
 assert.ok(!JSON.stringify(body).includes(config.apiKey));
 assert.throws(() => chatText('{"choices":[{"finish_reason":"length","message":{"content":"partial"}}]}'), /截断/);
 assert.throws(() => chatText('{"choices":[{"message":{"content":""}}]}'), /可用文本/);
});
test("custom endpoints use direct requests without cookies or redirects; keys not in URLs", async () => {
 let called = false;
 const fetcher: typeof fetch = async (url, init) => {
  called = true; assert.equal(url, "https://ai.example/v1/chat/completions");
  assert.equal(init?.credentials, "omit"); assert.equal(init?.redirect, REDIRECT_MODE); assert.equal(init?.referrerPolicy, "no-referrer");
  assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer " + config.apiKey);
  return Response.json({ choices: [{ message: { content: "ok" } }] });
 };
 assert.equal(await requestChat({ ...input, connection: { ...config, provider: "custom", baseUrl: "https://ai.example/v1" } }, signal(), fetcher), "ok"); assert.ok(called);
 await assert.rejects(requestChat({ ...input, connection: { ...config, baseUrl: "https://ai.example" } }, signal(), async () => { throw new TypeError("Failed to fetch"); }), /CORS/);
});
test("official relay rejects arbitrary targets and cross-origin calls before fetch", async () => {
 const original = globalThis.fetch; let calls = 0;
 globalThis.fetch = async () => { calls++; throw new Error("Unexpected fetch"); };
 try {
  const response = await POST(new Request("https://learning.example/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, connection: { ...config, baseUrl: "https://127.0.0.1" } }) }));
  assert.equal(response.status, 400);
  const cross = await POST(new Request("https://learning.example/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify(input) }));
  assert.equal(cross.status, 403); assert.equal(calls, 0);
 } finally { globalThis.fetch = original; }
});
test("relay forwards key only to official endpoint and sanitizes upstream errors", async () => {
 const original = globalThis.fetch;
 const req = () => new Request("https://learning.example/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://learning.example" }, body: JSON.stringify(input) });
 try {
  globalThis.fetch = async (url, init) => { assert.equal(url, "https://api.deepseek.com/chat/completions"); assert.equal(init?.redirect, REDIRECT_MODE); assert.notEqual(init?.redirect, "error"); assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer " + config.apiKey); return Response.json({ choices: [{ message: { content: "ok" } }] }); };
  const success = await POST(req()); assert.deepEqual(await success.json(), { text: "ok" }); assert.equal(success.headers.get("cache-control"), "no-store");
  globalThis.fetch = async () => new Response(config.apiKey, { status: 401 });
  const failure = await POST(req()); const text = await failure.text(); assert.match(text, /密钥无效/); assert.ok(!text.includes(config.apiKey));
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://evil.example/collect" } });
  const redirected = await POST(req()); assert.match(await redirected.text(), /跳转/);
 } finally { globalThis.fetch = original; }
});
test("model provenance survives export/import; empty sources need explicit status", () => {
 const lesson = parseModelLesson(JSON.stringify(validExample));
 assert.equal(lesson.sourceStatus, "model_knowledge"); assert.deepEqual(lesson.sources, []);
 assert.ok(adaptiveLessonSchema.safeParse(JSON.parse(JSON.stringify(lesson))).success);
 assert.equal(adaptiveLessonSchema.safeParse({ ...validExample, sources: [] }).success, false);
 assert.ok(!MODEL_WORKFLOW.includes("先联网核对")); assert.ok(MODEL_WORKFLOW.includes("sources必须为空数组"));
});
test("workflow repairs omitted correct fields once, without guessing answers locally", async () => {
 const broken = structuredClone(validExample); for (const step of broken.steps) if (step.type === "choice") for (const option of step.options) delete (option as { correct?: boolean }).correct;
 let calls = 0; const phases: string[] = [];
 const chat: typeof requestChat = async request => { calls++; if (calls === 1) return "计划：通过分类辨清概念"; if (calls === 4) { assert.match(request.messages[1].content, /correct/); return JSON.stringify(validExample); } return JSON.stringify(broken); };
 const result = await generateWithConnection(config, "认识光年", signal(), s => phases.push(s), chat);
 assert.equal(calls, 4); assert.equal(result.approach.type, "concept"); assert.equal(result.sourceStatus, "model_knowledge"); assert.match(phases.at(-1)!, /自动修复/);
 calls = 0;
 await assert.rejects(generateWithConnection(config, "认识光年", signal(), () => {}, async () => { calls++; return calls === 1 ? "计划" : JSON.stringify(broken); }), /自动修复后/);
 assert.equal(calls, 4);
});
test("normal workflow uses three calls, and cancellation stops subsequent calls", async () => {
 let calls = 0;
 await generateWithConnection(config, "认识光年", signal(), () => {}, async () => { calls++; return calls === 1 ? "计划" : JSON.stringify(validExample); }); assert.equal(calls, 3);
 const task = new AbortController(); calls = 0;
 await assert.rejects(generateWithConnection(config, "认识光年", task.signal, () => {}, async () => { calls++; task.abort(); return "计划"; }), { name: "AbortError" }); assert.equal(calls, 1);
});
test("oversized responses are bounded", async () => { await assert.rejects(limitedText(new Response("123456"), 3), /过大/); });
