import { canRelay, chatBody, chatRequestSchema, chatText, completionUrl, limitedText, statusError } from "@/lib/ai-connection";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
 const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
 const origin = request.headers.get("origin");
 if (origin && origin !== new URL(request.url).origin) return fail("请从学习机页面发起请求。", 403);
 if (!request.headers.get("content-type")?.includes("application/json")) return fail("请求格式不正确。", 415);
 let input;
 try {
  const raw = await limitedText(new Response(request.body), 240000);
  input = chatRequestSchema.parse(JSON.parse(raw));
 } catch { return fail("请求内容或连接配置不正确。", 400); }
 const endpoint = completionUrl(input.connection.baseUrl);
 if (!canRelay(endpoint)) return fail("自定义接口请使用浏览器直连。", 400);
 try {
  const response = await fetch(endpoint, {
   method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.connection.apiKey}` },
   body: JSON.stringify(chatBody(input)), redirect: "error", credentials: "omit",
   signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
  });
  if (!response.ok) { await response.body?.cancel(); return fail(statusError(response.status), 502); }
  return Response.json({ text: chatText(await limitedText(response)) }, { headers });
 } catch (e) {
  if (request.signal.aborted) return fail("请求已取消。", 499);
  return fail((e as Error).name === "TimeoutError" ? "AI 响应超时，请稍后重试。" : "AI 服务响应失败或内容不完整，请检查设置后重试。", 502);
 }
}
