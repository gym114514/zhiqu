import { z } from "zod";

export const presets = {
 deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-flash", jsonMode: true },
 openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", jsonMode: true },
 custom: { label: "自定义兼容接口", baseUrl: "", model: "", jsonMode: false },
};
export type Provider = keyof typeof presets;
export function completionUrl(base: string) {
 let url: URL;
 try { url = new URL(base.trim()); } catch { throw new Error("请输入完整的 HTTPS API 地址。"); }
 if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("API 地址必须使用 HTTPS，且不能包含账号、查询参数或片段。");
 const path = url.pathname.replace(/\/+$/, "");
 url.pathname = path.endsWith("/chat/completions") ? path : path + "/chat/completions";
 return url.href;
}
// Exact endpoints only: custom URLs never become a server-side arbitrary URL proxy.
const relayEndpoints = new Set(["https://api.deepseek.com/chat/completions", "https://api.deepseek.com/v1/chat/completions", "https://api.openai.com/v1/chat/completions"]);
export const canRelay = (url: string) => relayEndpoints.has(url);
export const connectionSchema = z.object({
 provider: z.enum(["deepseek", "openai", "custom"]),
 baseUrl: z.string().trim().min(1).max(2048).refine(s => { try { completionUrl(s); return true; } catch { return false; } }, "请输入有效的 HTTPS API 地址。"),
 apiKey: z.string().trim().min(1).max(4096).regex(/^[\x21-\x7e]+$/),
 model: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/),
 jsonMode: z.boolean(),
}).strict();
export type AIConnection = z.infer<typeof connectionSchema>;
export const emptyConnection = (): AIConnection => ({ provider: "deepseek", baseUrl: presets.deepseek.baseUrl, model: presets.deepseek.model, apiKey: "", jsonMode: true });
export function validateConnection(value: unknown): AIConnection {
 const result = connectionSchema.safeParse(value);
 if (!result.success) throw new Error("请检查 API 地址、密钥和模型名称；地址须为 HTTPS，密钥不能包含空白。");
 return result.data;
}
export const STORAGE_KEY = "curiosity.ai-connection.v1";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readConnection(storage: StorageLike): AIConnection | null {
 const raw = storage.getItem(STORAGE_KEY);
 if (!raw) return null;
 try { return validateConnection(JSON.parse(raw)); } catch { storage.removeItem(STORAGE_KEY); return null; }
}
export function persistConnection(storage: StorageLike, config: AIConnection | null, remember: boolean) {
 if (remember && config) storage.setItem(STORAGE_KEY, JSON.stringify(validateConnection(config)));
 else storage.removeItem(STORAGE_KEY);
}
export const chatRequestSchema = z.object({
 connection: connectionSchema,
 messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().min(1).max(120000) }).strict()).min(1).max(6),
 maxTokens: z.number().int().min(16).max(10000), json: z.boolean(),
}).strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export function chatBody(input: ChatRequest) {
 const endpoint = new URL(completionUrl(input.connection.baseUrl));
 return {
  model: input.connection.model, messages: input.messages, stream: false,
  ...(endpoint.hostname === "api.openai.com" ? { max_completion_tokens: input.maxTokens, store: false } : { max_tokens: input.maxTokens }),
  ...(endpoint.hostname === "api.deepseek.com" ? { thinking: { type: "disabled" } } : {}),
  ...(input.json && input.connection.jsonMode ? { response_format: { type: "json_object" } } : {}),
 };
}
export function statusError(status: number) {
 if (status === 401 || status === 403) return "API 密钥无效或没有此模型的权限，请检查连接设置。";
 if (status === 402 || status === 429) return "API 额度不足或请求过于频繁，请检查账户余额并稍后重试。";
 if (status === 400 || status === 404 || status === 422) return "服务未接受请求，请检查 API 地址、模型名称，或尝试关闭 JSON 模式。";
 return `AI 服务暂时不可用（HTTP ${status}），请稍后重试。`;
}
export async function limitedText(response: Response, maxBytes = 1000000) {
 if (!response.body) throw new Error("AI 服务没有返回内容。");
 const reader = response.body.getReader(); const decoder = new TextDecoder(); let result = ""; let size = 0;
 try {
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) throw new Error("返回内容过大，请缩小主题后重试。"); result += decoder.decode(value, { stream: true }); }
  return result + decoder.decode();
 } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function chatText(raw: string) {
 let data;
 try { data = JSON.parse(raw); } catch { throw new Error("服务返回了非 JSON 响应，请检查 API 地址是否正确。"); }
 const choice = data?.choices?.[0];
 if (choice?.finish_reason === "length") throw new Error("AI 输出被截断了，请缩小主题或换一个模型再试。");
 const text = choice?.message?.content;
 if (typeof text !== "string" || !text.trim()) throw new Error("AI 没有返回可用文本，请重试或更换模型。");
 if (text.length > 100000) throw new Error("AI 输出过长，请缩小主题后重试。");
 return text;
}
