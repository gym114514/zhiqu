"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Download, Lightbulb, Plus, Sparkles } from "lucide-react";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RadioGroup,RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { approachLabel,approachLabels,SUPPLY_MAX_DEPTH,type AdaptiveLesson,type LearningNode,type Supply } from "@/lib/adaptive";

const verdictLabels={supported:"材料支持",contradicted:"材料反驳",uncertain:"信息不足"};
const nodeLabels={explain:"建立理解",choice:"检验想法",cards:"比较观察",classify:"辨认边界",worked_example:"示范与尝试",investigate:"评估证据",reflect:"表达与反思",supply:"按需补给",synthesis:"回答最初的问题"};
const supplyKindLabels={term:"解释这个词",example:"换个例子",skip:"这部分我知道"};

function SelfCheck({rubric,example}:{rubric:string[];example:string}){const [checked,setChecked]=useState<number[]>([]);return <div className="self-check"><p className="small-label">对照要点，自行检查；这里没有 AI 自动评分</p>{rubric.map((r,i)=><label className="check-row" key={i}><Checkbox checked={checked.includes(i)} onCheckedChange={v=>setChecked(c=>v===true?[...c,i]:c.filter(x=>x!==i))}/>{r}</label>)}<details><summary>展开一种可能的思路</summary><p>{example}</p></details></div>}

/** 主线活动。补给由外层就地展开，因此这里只负责"这一段活动"本身。 */
function Activity({node,onNext,note,onNote}:{node:LearningNode;onNext:()=>void;note:string;onNote:(s:string)=>void}){
 const [opened,setOpened]=useState<number[]>([]);const [selected,setSelected]=useState<Record<number,string>>({});const [answer,setAnswer]=useState("");const [submitted,setSubmitted]=useState(false);const [hint,setHint]=useState(false);const [visibleSteps,setVisibleSteps]=useState(1);const [practice,setPractice]=useState(false);const [hints,setHints]=useState(0);const [review,setReview]=useState(false);
 const reveal=(i:number)=>setOpened(v=>v.includes(i)?v.filter(x=>x!==i):[...v,i]);
 let ready=true;
 if(node.type==="choice")ready=submitted;
 if(node.type==="classify")ready=node.items.every((_,i)=>selected[i]!==undefined);
 if(node.type==="investigate")ready=node.claims.every((_,i)=>selected[i]!==undefined);
 if(node.type==="worked_example"||node.type==="reflect")ready=review;
 return <div className="adaptive-activity">
 {node.type==="explain"&&<div className="explanation">{node.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</div>}
 {node.type==="choice"&&<><h3 className="question-title">{node.question}</h3><RadioGroup aria-label="选择你的判断" value={answer} onValueChange={v=>{setAnswer(v);setSubmitted(false)}} className="answer-options">{node.options.map((o,i)=><label className={"answer-option "+(answer===String(i)?"selected":"")} key={i}><RadioGroupItem value={String(i)}/><span>{o.label}</span></label>)}</RadioGroup>{hint&&<div className="hint-box"><Lightbulb size={17}/><p>{node.hint}</p></div>}{submitted&&<div className={"feedback "+(node.options[+answer].correct?"correct":"")} role="status"><strong>{node.options[+answer].correct?"你抓住了关键。":"这正好是一个值得辨清的地方。"}</strong><p>{node.options[+answer].feedback}</p></div>}{!submitted&&<div className="stage-actions"><button className="primary" disabled={answer===""} onClick={()=>setSubmitted(true)}>看看这个判断 <ArrowRight size={17}/></button><button className="text-button" onClick={()=>setHint(v=>!v)}><Lightbulb size={16}/>{hint?"收起提示":"给我一点提示"}</button></div>}</>}
 {node.type==="cards"&&<><p className="stage-lead">{node.instruction}</p><div className="evidence-grid">{node.cards.map((c,i)=><button className="evidence-card" aria-expanded={opened.includes(i)} key={i} onClick={()=>reveal(i)}><span className="small-label">{c.title}</span><p>{c.text}</p>{opened.includes(i)?<div className="evidence-detail">{c.reveal}</div>:<span className="reveal-label">展开线索 <Plus size={16}/></span>}</button>)}</div></>}
 {node.type==="classify"&&<><p className="stage-lead">{node.instruction}</p><div className="classification-list">{node.items.map((item,i)=><section className="classification-item" key={i}><span className="small-label">例子 {i+1}</span><p>{item.text}</p><RadioGroup aria-label={`例子 ${i+1} 的分类`} value={selected[i]||""} onValueChange={v=>setSelected(s=>({...s,[i]:v}))} className="category-options">{node.categories.map(c=><label key={c.id} className={"radio-chip category-chip "+(selected[i]===c.id?"selected":"")}><RadioGroupItem value={c.id}/>{c.label}</label>)}</RadioGroup>{selected[i]!==undefined&&<div className={"classification-feedback "+(selected[i]===item.categoryId?"matched":"")} role="status"><span>{selected[i]===item.categoryId?"分类有依据":"再看一眼概念边界"}</span><p>{item.feedback}</p></div>}</section>)}</div></>}
 {node.type==="worked_example"&&<><p className="small-label">先看一个完整示范</p><h3 className="question-title">{node.task}</h3><div className="worked-steps">{node.walkthrough.slice(0,visibleSteps).map((s,i)=><div key={i}><span>{i+1}</span><div><h4>{s.title}</h4><p>{s.detail}</p></div></div>)}</div>{visibleSteps<node.walkthrough.length&&<button className="secondary" onClick={()=>setVisibleSteps(v=>v+1)}>看下一步 <ChevronDown size={16}/></button>}{!practice?<div className="stage-actions"><button className="primary" onClick={()=>setPractice(true)}>{visibleSteps<node.walkthrough.length?"我想先自己试试":"换个任务，自己试试"}<ArrowRight size={17}/></button></div>:<section className="practice-task"><span className="eyebrow">现在把支持撤掉一点</span><h3>{node.practicePrompt}</h3><textarea className="reflection-input" aria-label="我的尝试" placeholder="按自己的思路完成这个新任务……" value={note} maxLength={2000} onChange={e=>onNote(e.target.value)}/>{hints>0&&<div className="hint-box"><Lightbulb size={17}/><div>{node.hints.slice(0,hints).map((h,i)=><p key={i}>{h}</p>)}</div></div>}<div className="stage-actions">{!review&&<button className="secondary" disabled={!note.trim()} onClick={()=>setReview(true)}>对照关键步骤</button>}{hints<node.hints.length&&<button className="text-button" onClick={()=>setHints(h=>h+1)}>给我第 {hints+1} 个提示</button>}{!review&&<button className="text-button" onClick={()=>setReview(true)}>暂时卡住，看看思路</button>}</div>{review&&<SelfCheck rubric={node.rubric} example={node.example}/>}</section>}</>}
 {node.type==="investigate"&&<><p className="stage-lead">{node.context}</p><div className="evidence-grid">{node.materials.map((m,i)=><button className="evidence-card" key={i} aria-expanded={opened.includes(i)} onClick={()=>reveal(i)}><span className="small-label">{m.title}</span><p>{m.text}</p>{opened.includes(i)?<div className="evidence-detail">{m.context}</div>:<span className="reveal-label">查看材料背景 <Plus size={16}/></span>}</button>)}</div><div className="evidence-claims"><p className="small-label">只根据这些材料，哪些话有依据？</p>{node.claims.map((c,i)=><section className="classification-item" key={i}><p>{c.text}</p><RadioGroup aria-label={`判断陈述 ${i+1}`} value={selected[i]||""} onValueChange={v=>setSelected(s=>({...s,[i]:v}))} className="category-options">{Object.entries(verdictLabels).map(([v,label])=><label className={"radio-chip category-chip "+(selected[i]===v?"selected":"")} key={v}><RadioGroupItem value={v}/>{label}</label>)}</RadioGroup>{selected[i]!==undefined&&<div className={"classification-feedback "+(selected[i]===c.verdict?"matched":"")} role="status"><span>这份材料能支持的判断：{verdictLabels[c.verdict]}</span><p>{c.feedback}</p></div>}</section>)}</div>{ready&&<div className="inquiry-note"><label className="field-label" htmlFor={node.id+"-note"}>{node.reflectionPrompt}</label><textarea id={node.id+"-note"} className="reflection-input" placeholder="可以提出不同的调查方向，也可以保留不确定性……" maxLength={2000} value={note} onChange={e=>onNote(e.target.value)}/><p className="small-label">这是开放问题，不设唯一措辞，也不会自动评分。</p></div>}</>}
 {node.type==="reflect"&&<><p className="stage-lead">{node.prompt}</p><textarea aria-label="我的想法" className="reflection-input" placeholder="写下你现在的理解或仍然没想通的地方……" value={note} maxLength={2000} onChange={e=>onNote(e.target.value)}/>{!review?<div className="stage-actions"><button className="secondary" disabled={!note.trim()} onClick={()=>setReview(true)}>对照要点</button><button className="text-button" onClick={()=>setReview(true)}>先看看一种思路</button></div>:<SelfCheck rubric={node.rubric} example={node.example}/>}</>}
 {ready&&node.type!=="synthesis"&&<div className="stage-actions"><button className="primary" onClick={onNext}>带着这个发现继续 <ArrowRight size={18}/></button></div>}
 </div>
}

/** 综合收尾：先请读者自己回答最初的问题，再对照脚本给出的完整回答。 */
function Synthesis({node,mainQuestion,note,onNote,onNext}:{node:Extract<LearningNode,{type:"synthesis"}>;mainQuestion:string;note:string;onNote:(s:string)=>void;onNext:()=>void}){
 const [revealed,setRevealed]=useState(false);
 return <div className="adaptive-activity synthesis-step">
  <div className="origin-question"><span className="small-label">你最初的问题</span><p>{mainQuestion}</p></div>
  <label className="field-label" htmlFor={node.id+"-answer"}>现在把前面的发现连起来，你会怎么回答它？</label>
  <textarea id={node.id+"-answer"} className="reflection-input" placeholder="用你自己的话回答最初的问题；说不完整也没关系。" value={note} maxLength={2000} onChange={e=>onNote(e.target.value)}/>
  {!revealed?<div className="stage-actions"><button className="primary" disabled={!note.trim()} onClick={()=>setRevealed(true)}>对照一份完整回答 <ArrowRight size={18}/></button><button className="text-button" onClick={()=>setRevealed(true)}>先直接看完整回答</button></div>
  :<div className="synthesis-reveal">
   <section><span className="small-label">一份完整回答</span><p>{node.answer}</p></section>
   <section><span className="small-label">它在什么条件下成立</span><p>{node.conditions}</p></section>
   <section><span className="small-label">还没有弄清的地方</span><ul>{node.openQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul></section>
   <button className="primary" onClick={onNext}>带走这次发现 <ArrowRight size={18}/></button>
  </div>}
 </div>
}

/** 补给：就地展开，不离开当前活动；关闭后回到原位，笔记与选择都还在。
 *  traversed 是当前展开路径（[第一层id, 第二层id...]），因此两层都能真正打开。 */
function SupplyPanel({items,traversed,onOpen,onClose}:{items:Supply[];traversed:string[];onOpen:(path:string[])=>void;onClose:()=>void}){
 const path:Supply[]=[];
 let list=items;
 for(const id of traversed){
  const found=list.find(s=>s.id===id);
  if(!found)break;
  path.push(found);
  list=found.supply??[];
 }
 const open=path.at(-1);
 if(!open)return <div className="supply-list">{items.map(s=><button className="supply-chip" key={s.id} onClick={()=>onOpen([s.id])}>{supplyKindLabels[s.kind??"term"]}：{s.label}</button>)}</div>;
 const nested=open.supply??[];
 const atLimit=path.length>=SUPPLY_MAX_DEPTH;
 return <section className="supply-panel">
  <div className="supply-head">
   <span className="eyebrow">{path.length>1?`第二层补给 · ${supplyKindLabels[open.kind??"term"]}`:supplyKindLabels[open.kind??"term"]}</span>
   <button className="text-button" onClick={()=>onOpen(traversed.slice(0,-1))}>返回上一步</button>
  </div>
  <p className="small-label">它帮助你理解：{open.helpsWith}</p>
  {open.body.map(node=><Activity key={node.id} node={node} onNext={()=>{}} note="" onNote={()=>{}}/>)}
  {nested.length>0&&(atLimit
   ?<p className="small-label">这一层已经是最简版本；如果仍然不清楚，可以把这个问题拆成另一次探索。</p>
   :<div className="supply-list">{nested.map(s=><button className="supply-chip" key={s.id} onClick={()=>onOpen([...traversed,s.id])}>{supplyKindLabels[s.kind??"term"]}：{s.label}</button>)}</div>)}
  <button className="primary" onClick={onClose}>{open.backLabel}</button>
 </section>;
}

export default function AdaptivePlayer({lesson,origin,onExit,onCustom}:{lesson:AdaptiveLesson;origin:"sample"|"ai"|"import";onExit:()=>void;onCustom:(t:string)=>void}){
 const [index,setIndex]=useState(0);const [notes,setNotes]=useState<Record<string,string>>({});const [sources,setSources]=useState(false);
 const [openSupply,setOpenSupply]=useState<{index:number;path:string[]}|null>(null);
 const heading=useRef<HTMLHeadingElement>(null);const done=index>=lesson.steps.length;const step=lesson.steps[index];
 const supplyItems=step&&"supply" in step?(step.supply??[]):[];
 const currentModule=lesson.plan?.modules.find(m=>m.id===step?.module);
 // 补给只在"当前这一步"有效：记住它属于哪一步，换步后自然收起，无需在 effect 里重置状态。
 const supplyPath=openSupply?.index===index?openSupply.path:[];
 useEffect(()=>{heading.current?.focus();window.scrollTo({top:0,behavior:"instant"})},[index]);
 const exportScript=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(lesson,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=u;a.download=lesson.id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 return <main className="player-shell"><div className="player-top"><button className="text-button" onClick={onExit}><ArrowLeft size={17}/>返回探索</button><span>{approachLabel(lesson)} · 约 {lesson.minutes} 分钟</span><button className="text-button" onClick={()=>setSources(true)}><BookOpen size={16}/>资料与边界</button></div>
 <div className="player-layout"><aside className="journey">
  {lesson.mainQuestion?<div className="journey-question"><span className="eyebrow">你最初的问题</span><p>{lesson.mainQuestion}</p></div>:<p className="eyebrow">{approachLabel(lesson)}</p>}
  <h1>{lesson.title}</h1>
  {lesson.plan?<>
   <ol className="module-list">{lesson.plan.modules.map(m=>{
    const owned=lesson.steps.map((s,i)=>({s,i})).filter(x=>x.s.module===m.id);
    const doneAll=owned.length>0&&owned.every(x=>x.i<index);
    return <li key={m.id} className={(currentModule?.id===m.id?"current ":"")+(doneAll?"complete":"")}>
     <span>{doneAll?<Check size={14}/>:approachLabels[m.approachType].slice(0,2)}</span>
     <div><h3>{m.title}</h3><p className="small-label">它给最终回答提供的：{m.contributes}</p>
      <ul className="module-steps">{owned.map(x=><li key={x.s.id} className={index===x.i?"current":index>x.i?"complete":""}>{x.s.title}</li>)}</ul>
     </div></li>;
   })}</ol>
   <div className="journey-goal"><span>这一趟要回答什么</span><p>{lesson.plan.objective}</p></div>
  </>:<>
   <ol>{lesson.steps.map((s,i)=><li key={s.id} className={index===i?"current":index>i?"complete":""}><span>{index>i?<Check size={14}/>:i+1}</span>{s.title}</li>)}</ol>
   <div className="journey-goal"><span>为什么这样学</span><p>{lesson.approach?.reason}</p></div>
  </>}
  <span className="origin-label">{lesson.sourceStatus==="model_knowledge"?"AI 知识草稿 · 未联网核验":origin==="sample"?"示例探索 · 差异化学习路径":origin==="ai"?"AI 编排 · 请核对资料":"导入探索 · 内容与来源待核对"}</span>
 </aside>
 <section className="stage-panel">
  <div className="stage-top"><span>{done?"EXPLORATION COMPLETE":nodeLabels[step.type]}</span><span>{done?"":`${Math.min(index+1,lesson.steps.length)} / ${lesson.steps.length} 个活动${lesson.plan?` · ${lesson.plan.modules.length} 个模块`:""}`}</span></div>
  <Progress aria-label="探索进度" value={index/lesson.steps.length*100} className="journey-progress"/>
  <h2 className="stage-title" ref={heading} tabIndex={-1}>{done?"给好奇心，留一点余地。":step.title}</h2>
  {!done&&currentModule&&<p className="module-context"><span className="small-label">当前模块 · {currentModule.title}</span>{currentModule.purpose}</p>}
  {index===0&&lesson.sourceStatus==="model_knowledge"&&<p className="source-unverified">这段探索基于模型知识生成，未联网核验；遇到关键事实，请继续查证。</p>}
  {index===0&&!lesson.plan&&<details className="path-reason"><summary>这次为什么采用“{approachLabel(lesson)}”？</summary><p>{lesson.approach?.reason}</p></details>}
  {!done?(step.type==="synthesis"
   ?<Synthesis node={step} mainQuestion={lesson.mainQuestion??lesson.title} note={notes[step.id]||""} onNote={s=>setNotes(n=>({...n,[step.id]:s}))} onNext={()=>setIndex(i=>i+1)}/>
   :<>
    <Activity key={step.id} node={step} onNext={()=>setIndex(i=>i+1)} note={notes[step.id]||""} onNote={s=>setNotes(n=>({...n,[step.id]:s}))}/>
    {supplyItems.length>0&&<section className="supply-zone">
     {supplyPath.length===0&&<p className="small-label">这一步卡住了？可以就地补一小块，补完回到这里。</p>}
     <SupplyPanel items={supplyItems} traversed={supplyPath} onOpen={path=>setOpenSupply(path.length?{index,path}:null)} onClose={()=>setOpenSupply(null)}/>
    </section>}
   </>)
  :<div className="completion"><div className="completion-mark"><Sparkles size={29}/></div>
   <p className="completion-status">{lesson.mainQuestion?`这次你围绕最初的问题，走过了 ${lesson.steps.length} 个活动${lesson.plan?`、${lesson.plan.modules.length} 个模块`:""}。`:`这次你围绕一个小问题，经历了 ${lesson.steps.length} 个不同目的的活动。`}</p>
   <div className="takeaway"><span className="eyebrow">你的口袋知识</span><h3>{lesson.objective}</h3><p>{notes[lesson.steps.at(-1)!.id]?.trim()||"这次先带走一个问题。下次再见到它时，试着用自己的话解释。"}</p></div>
   <div className="next-questions"><p className="small-label">好奇心还想走远一点？</p>{lesson.followups.map(q=><button key={q} onClick={()=>onCustom(q)}>{q}<ArrowUpRight size={17}/></button>)}</div>
   <div className="stage-actions"><button className="primary" onClick={onExit}>再打开一扇门 <ArrowRight size={18}/></button><button className="text-button" onClick={exportScript}><Download size={16}/>下载学习脚本</button></div>
  </div>}
 </section></div>
 <Dialog open={sources} onOpenChange={setSources}><DialogContent><DialogTitle>这次探索的资料</DialogTitle><DialogDescription>{origin==="sample"?"示例中的核心事实与方法可从以下资料继续了解。":"这些是脚本提供的来源。格式通过检查，不代表所有论断已获事实核验。"}</DialogDescription><div className="source-list">{lesson.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ArrowUpRight size={17}/></a>)}</div><p className="muted">{lesson.boundary}</p></DialogContent></Dialog></main>;
}
