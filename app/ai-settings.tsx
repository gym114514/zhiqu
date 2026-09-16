"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, LoaderCircle, Plug, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { canRelay, completionUrl, emptyConnection, persistConnection, presets, validateConnection, type AIConnection, type Provider } from "@/lib/ai-connection";
import { testConnection } from "@/lib/ai-client";

export default function AISettings({ open, onOpenChange, connection, remembered, onSave }: {
 open: boolean; onOpenChange: (v: boolean) => void; connection: AIConnection | null; remembered: boolean;
 onSave: (config: AIConnection | null, remember: boolean) => void;
}) {
 const [draft, setDraft] = useState<AIConnection>(emptyConnection);
 const [remember, setRemember] = useState(false); const [visible, setVisible] = useState(false);
 const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [tested, setTested] = useState(false);
 const controller = useRef<AbortController | null>(null);
 useEffect(() => {
  if (open) { setDraft(connection || emptyConnection()); setRemember(remembered); setMessage(""); setTested(false); setVisible(false); }
  else { controller.current?.abort(); controller.current = null; setBusy(false); setDraft(emptyConnection()); setVisible(false); }
 // Take a fresh snapshot when opening; editing/clearing should keep its own feedback.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [open]);
 useEffect(() => () => controller.current?.abort(), []);
 function change(patch: Partial<AIConnection>) { setDraft(d => ({ ...d, ...patch })); setTested(false); setMessage(""); }
 function provider(value: string) { const p = value as Provider; const { baseUrl, model, jsonMode } = presets[p]; change({ provider: p, baseUrl, model, jsonMode, apiKey: "" }); }
 let relay = false; try { relay = canRelay(completionUrl(draft.baseUrl)); } catch {}
 async function test() {
  setMessage(""); setTested(false); let config: AIConnection;
  try { config = validateConnection(draft); } catch (e) { setMessage((e as Error).message); return; }
  setBusy(true); const task = new AbortController(); controller.current = task;
  try { await testConnection(config, task.signal); if (!task.signal.aborted) { setTested(true); setMessage("连接成功，模型已返回响应。可以保存并开始探索。"); } }
  catch (e) { if (!task.signal.aborted) setMessage((e as Error).message); }
  finally { if (controller.current === task) { setBusy(false); controller.current = null; } }
 }
 function save() {
  try {
   const config = validateConnection(draft);
   try { persistConnection(window.localStorage, config, remember); }
   catch (e) { if (remember || remembered) throw e; }
   onSave(config, remember); onOpenChange(false);
  } catch (e) { setMessage((e as Error).name === "SecurityError" || (e as Error).name === "QuotaExceededError" ? "浏览器阻止了保存配置，请允许本站存储后重试。" : (e as Error).message); }
 }
 function clear() {
  controller.current?.abort();
  try { persistConnection(window.localStorage, null, false); } catch { setMessage("浏览器阻止清除存储，请在浏览器的站点设置中清除本站数据。"); onSave(null, false); setDraft(emptyConnection()); setRemember(false); return; }
  onSave(null, false); setDraft(emptyConnection()); setRemember(false); setTested(false); setVisible(false); setMessage("已清除本页与此浏览器保存的连接配置。");
 }
 return <Dialog open={open} onOpenChange={v => { if (!v) controller.current?.abort(); onOpenChange(v); }}><DialogContent className="ai-settings-dialog">
  <div className="ai-settings-heading"><span className="ai-settings-icon"><Plug size={23}/></span><div><DialogTitle>接上你的 AI</DialogTitle><DialogDescription>选一个服务，让你的问题直接变成一段探索。</DialogDescription></div></div>
  <div><p id="ai-provider-label" className="field-label">API 服务</p><RadioGroup aria-labelledby="ai-provider-label" className="ai-providers" value={draft.provider} onValueChange={provider} disabled={busy}>{Object.entries(presets).map(([id, preset]) => <label className={"radio-chip " + (draft.provider === id ? "selected" : "")} key={id}><RadioGroupItem value={id}/>{preset.label}</label>)}</RadioGroup></div>
  <div className="ai-fields"><label className="field-label" htmlFor="ai-base">API 地址（Base URL）</label><input className="topic-input" id="ai-base" type="url" autoComplete="off" spellCheck={false} placeholder="https://api.example.com/v1" value={draft.baseUrl} maxLength={2048} disabled={busy} onChange={e => change({ baseUrl: e.target.value, apiKey: "" })}/><p className="small-label">支持基础地址或完整的 /chat/completions 地址。更换服务或地址后请重新填写密钥。</p>
  <label className="field-label" htmlFor="ai-key">API 密钥</label><div className="ai-secret"><input className="topic-input" id="ai-key" type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="粘贴该服务的 API Key" maxLength={4096} value={draft.apiKey} disabled={busy} onChange={e => change({ apiKey: e.target.value })}/><button className="icon-button" type="button" aria-label={visible ? "隐藏密钥" : "显示密钥"} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
  <label className="field-label" htmlFor="ai-model">模型名称</label><input className="topic-input" id="ai-model" autoComplete="off" spellCheck={false} placeholder="填写服务商提供的模型 ID" maxLength={200} value={draft.model} disabled={busy} onChange={e => change({ model: e.target.value })}/></div>
  <label className="check-row"><Checkbox checked={draft.jsonMode} disabled={busy} onCheckedChange={v => change({ jsonMode: v === true })}/><span>启用 JSON 模式<span className="ai-inline-help">服务不支持时可关闭</span></span></label>
  <label className="check-row"><Checkbox checked={remember} disabled={busy} onCheckedChange={v => setRemember(v === true)}/><span>在此浏览器记住配置（包括密钥）<span className="ai-inline-help">默认仅在当前页面保留；勾选后以明文存入本站浏览器存储。</span></span></label>
  <div className="ai-connection-note"><span>{relay ? "通过本站转发至所选服务" : "浏览器直接连接自定义服务"}</span><p>{relay ? "密钥仅随请求转发，不写入本站服务器存储。" : "自定义服务需允许浏览器跨域请求（CORS）；密钥直接发给你填写的地址。"}测试会产生一次少量 API 调用。一次探索通常调用 3 次，格式修复最多追加 1 次，费用由你的服务商计算。</p></div>
  {message && <p className={"form-message " + (tested ? "ai-test-success" : "")} role="status">{tested && <Check size={16}/>} {message}</p>}
  <div className="ai-actions"><button className="secondary" disabled={busy} onClick={test}>{busy ? <LoaderCircle className="spin" size={17}/> : <Plug size={17}/>}测试连接</button><button className="primary" disabled={busy} onClick={save}>保存配置</button><button className="text-button" onClick={clear} disabled={busy}><Trash2 size={15}/>清除配置</button></div>
 </DialogContent></Dialog>;
}
