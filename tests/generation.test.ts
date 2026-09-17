import test from "node:test";
import assert from "node:assert/strict";
import { validExample, adaptiveLessonSchema, complete, draftOf, type AdaptiveLesson } from "../lib/adaptive";
import { appendModule, draftFromPlan, generatePlan, generateModule, parseModuleReply } from "../lib/ai-client";
import { emptyConnection } from "../lib/ai-connection";

const connection = { ...emptyConnection(), apiKey: "test-secret-not-real" };
const signal = () => new AbortController().signal;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** 造一个只含指定模块活动的合法脚本片段。 */
function moduleReply(moduleId: string, stepId: string, withSynthesis: boolean): string {
  const base: AdaptiveLesson = clone(validExample);
  const steps: AdaptiveLesson["steps"] = [
    { id: stepId, module: moduleId, title: "该模块的第一个活动", type: "explain", paragraphs: ["这是一段用于测试的简短解释。"] }
  ];
  if (withSynthesis) {
    steps.push({ id: stepId + "-wrap", module: moduleId, title: "回到最初的问题", type: "synthesis", answer: "这就是对最初问题的完整回答。", conditions: "仅在测试条件下成立。", openQuestions: ["还有一个没弄清的问题。"] });
  }
  return JSON.stringify({ ...base, steps });
}

test("按需生成：先生成计划，再按模块展开，收尾始终留在最后", async () => {
  const lesson0 = adaptiveLessonSchema.parse(clone(validExample));
  const phases: string[] = [];
  let calls = 0;
  // 第一次调用返回计划 JSON，之后返回"新增模块"的脚本片段
  const chat = async (request: { messages: { content: string }[] }) => {
    calls += 1;
    const system = request.messages[0].content;
    if (system.includes("本轮只输出探索计划")) {
      return JSON.stringify({
        mainQuestion: lesson0.mainQuestion,
        objective: lesson0.objective,
        plan: { objective: lesson0.plan!.objective, modules: lesson0.plan!.modules }
      });
    }
    // 关键：即使模型在非最后模块里擅自给出 synthesis，合并后也不能顶掉真正的收尾
    return moduleReply("correct", "extra-activity", calls === 2);
  };

  const plan = await generatePlan(connection, "神经网络为什么能从例子中学会分类？", signal(), s => phases.push(s), chat as never);
  assert.equal(plan.plan.modules.length, 2, "计划应带回两个模块");
  assert.ok(plan.mainQuestion.includes("神经网络"), "计划必须保留用户最初的问题");
  assert.ok(phases.some(p => p.includes("先决定要回答什么")), "应先说明在定计划");

  const grew = await generateModule(connection, "神经网络为什么能从例子中学会分类？", lesson0, "correct", signal(), s => phases.push(s), chat as never);
  assert.ok(grew.steps.length > lesson0.steps.length, "新模块的活动应被并回脚本");
  const synthesisIndexes = grew.steps.map((s, i) => (s.type === "synthesis" ? i : -1)).filter(i => i >= 0);
  assert.equal(synthesisIndexes.length, 1, "合并后仍只能有一个综合收尾");
  assert.equal(synthesisIndexes[0], grew.steps.length - 1, "综合收尾必须仍在最后");
  // 合并结果必须仍是合法脚本（模块归属、收尾位置等规则都会过一遍）
  assert.doesNotThrow(() => adaptiveLessonSchema.parse(clone(grew)));
  assert.ok(phases.some(p => p.includes("正在展开")), "展开模块时应给出阶段提示");
});

test("按需生成：模块不在计划里时明确拒绝", async () => {
  const lesson0 = adaptiveLessonSchema.parse(clone(validExample));
  await assert.rejects(
    generateModule(connection, "主题", lesson0, "not-in-plan", signal(), () => {}, (async () => "{}") as never),
    /不在探索计划里/
  );
});

test("按需生成：计划缺模块信息时要求重试，而不是产出半成品脚本", async () => {
  await assert.rejects(
    generatePlan(connection, "主题", signal(), () => {}, (async () => JSON.stringify({ objective: "只有目标" })) as never),
    /计划缺少必要的模块信息/
  );
  await assert.rejects(
    generatePlan(connection, "主题", signal(), () => {}, (async () => "这不是 JSON") as never),
    /不是完整的 JSON/
  );
});

test("草稿态只服务于生成过程：成品脚本不允许留着未展开的模块", () => {
  const lesson0 = adaptiveLessonSchema.parse(clone(validExample));
  // 造一个"计划已定、第二个模块还没展开"的中间态
  const partial: AdaptiveLesson = { ...clone(lesson0), steps: lesson0.steps.filter(s => s.module !== "correct") };
  assert.throws(() => adaptiveLessonSchema.parse(clone(partial)), /没有任何步骤/, "成品态必须拒绝空模块");
  const asDraft = draftOf(partial);
  assert.equal(asDraft.draft, true);
  assert.doesNotThrow(() => adaptiveLessonSchema.parse(clone(asDraft)), "草稿态应允许尚未展开的模块");
  // 合并结束时必须摘掉草稿标记
  const finished = complete(asDraft);
  assert.equal(finished.draft, undefined);
  assert.throws(() => adaptiveLessonSchema.parse(clone(finished)), /没有任何步骤/, "去掉草稿标记后仍应受成品规则约束");
});

test("草稿骨架：由计划搭出可继续展开的起点，逐个展开后成为可播放成品", () => {
  const lesson0 = adaptiveLessonSchema.parse(clone(validExample));
  const plan = { mainQuestion: lesson0.mainQuestion!, objective: lesson0.objective, plan: lesson0.plan! };
  const draft = draftFromPlan(plan, "on-demand-demo");
  assert.equal(draft.draft, true, "骨架必须是草稿态，否则空模块会被成品规则拒绝");
  assert.equal(draft.mainQuestion, plan.mainQuestion, "骨架必须保留原问题");
  assert.equal(draft.plan?.modules.length, 2);
  assert.doesNotThrow(() => adaptiveLessonSchema.parse(clone(draft)));

  // 逐个模块展开：第一次替换掉占位活动，第二次补上收尾
  const first = appendModule(draft, parseModuleReply(moduleReply("judge", "first-real", false)));
  assert.ok(first.steps.some(s => s.id === "first-real"), "第一个模块的活动应替换占位活动");
  assert.ok(!first.steps.some(s => s.id === "pending"), "占位活动应被移除");
  assert.equal(first.draft, true, "还有模块没展开时保持草稿态");
  const second = appendModule(first, parseModuleReply(moduleReply("correct", "second-real", true)));
  assert.equal(second.draft, undefined, "全部模块展开后才成为成品");
  assert.equal(second.steps.filter(s => s.type === "synthesis").length, 1, "收尾唯一");
  assert.equal(second.steps.at(-1)!.type, "synthesis", "收尾在最后");
  assert.ok(second.plan!.modules.every(m => second.steps.some(s => s.module === m.id)), "每个模块都有活动");
});

test("appendModule 不依赖模型自觉：非最后模块也给了收尾时以原有收尾为准", () => {
  const lesson0 = adaptiveLessonSchema.parse(clone(validExample));
  const incoming = parseModuleReply(moduleReply("correct", "another", true));
  const merged = appendModule(lesson0, incoming);
  const wrappers = merged.steps.filter(s => s.type === "synthesis");
  assert.equal(wrappers.length, 1, "只保留一个收尾");
  assert.equal(wrappers[0].id, lesson0.steps.at(-1)!.id, "保留原脚本里的收尾，而不是新来的");
  assert.equal(merged.steps.at(-1)!.type, "synthesis");
});
