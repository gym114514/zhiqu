import test from "node:test";
import assert from "node:assert/strict";
import { adaptiveLessonSchema, validExample, SUPPLY_MAX_DEPTH, type AdaptiveLesson } from "../lib/adaptive";
import { parseAnyLesson, ScriptImportError } from "../lib/script";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** 断言脚本被拒绝，并返回全部问题（用于核对"报错要指向真正的毛病"）。 */
function issuesOf(lesson: unknown) {
  try {
    parseAnyLesson(JSON.stringify(lesson));
  } catch (error) {
    assert.ok(error instanceof ScriptImportError, `期望 ScriptImportError，实际是 ${String(error)}`);
    return error.issues;
  }
  throw new Error("脚本本应被拒绝，却通过了校验");
}

/** 只保留第一层补给，去掉第二层，便于构造"超深"用例。 */
function stripNestedSupplies(lesson: AdaptiveLesson) {
  for (const step of lesson.steps) {
    if (!("supply" in step) || !step.supply) continue;
    for (const item of step.supply) delete (item as { supply?: unknown }).supply;
  }
  return lesson;
}

test("示例脚本本身携带导航结构：原问题、模块、综合收尾三者齐备", () => {
  const parsed = adaptiveLessonSchema.parse(clone(validExample));
  assert.equal(parsed.mainQuestion, "神经网络为什么能从例子中学会分类？");
  assert.ok((parsed.plan?.modules.length ?? 0) >= 2, "复杂问题应组织成多个模块");
  assert.ok(parsed.plan?.modules.every(m => m.contributes.trim().length > 0), "每个模块都要说明它对原问题的作用");
  const last = parsed.steps.at(-1);
  assert.equal(last?.type, "synthesis", "综合收尾必须在最后");
  assert.equal(last?.type === "synthesis" && last.openQuestions.length > 0, true, "要保留还没弄清的部分");
  // 每个步骤都归属某个模块，且每个模块都有主线活动
  for (const step of parsed.steps) assert.ok(step.module, `步骤 ${step.id} 未标明模块`);
  for (const m of parsed.plan!.modules) {
    assert.ok(parsed.steps.some(s => s.module === m.id), `模块 ${m.id} 没有步骤`);
  }
});

test("验收：简单问题不会被强制拆成多模块", () => {
  const simple: AdaptiveLesson = {
    version: 2, id: "simple-one-module", title: "为什么会有回声？", category: "日常物理",
    hook: "喊一声，声音会自己回来一次。", minutes: 4, objective: "用声音的反射解释一次回声。",
    mainQuestion: "为什么喊一声会有回声？",
    plan: { objective: "看懂声音遇到硬表面会反射回来。", modules: [{ id: "only", title: "声音撞上墙面", approachType: "mechanism", purpose: "只需要一个机制就够。", contributes: "它直接回答了原问题。" }] },
    steps: [
      { id: "echo", module: "only", title: "声音也会弹回来", type: "explain", paragraphs: ["声音是空气的振动，撞到又大又硬的表面会被反射回来，再传到耳朵里就成了回声。"] },
      { id: "check", module: "only", title: "换个地方还听得到吗", type: "choice", question: "在铺满软垫的房间里，回声通常会怎样？", options: [{ label: "更明显", correct: false, feedback: "软垫会吸收声能，反射更弱。" }, { label: "更弱甚至听不到", correct: true, feedback: "对，吸收多、反射少，回声就弱。" }], hint: "回声需要声音被反射回来。" },
      { id: "wrap", module: "only", title: "回到最初的问题", type: "synthesis", answer: "回声是声音撞到硬表面后反射回来、再次进入耳朵的结果。", conditions: "在空旷、有硬质大表面的地方最容易听到。", openQuestions: ["为什么有的回声和原声几乎叠在一起？"] }
    ],
    boundary: "只讨论反射；不涉及多普勒效应与声速随温度变化。",
    followups: ["山谷里的回声为什么能重复很多次？"],
    sources: [{ title: "NASA · 声音与回声", url: "https://spaceplace.nasa.gov/echo/en/" }]
  };
  const parsed = adaptiveLessonSchema.parse(clone(simple));
  assert.equal(parsed.plan?.modules.length, 1, "简单问题应保持单模块");
  assert.equal(parsed.steps.length, 3, "单模块版本不应被强行拆长");
});

test("验收：缺基础的用户可以补一小块再继续，且补给不会无限递归", () => {
  const lesson = adaptiveLessonSchema.parse(clone(validExample));
  const withSupply = lesson.steps.find(s => "supply" in s && s.supply?.length);
  assert.ok(withSupply, "示例里应有可展开的补给");
  const first = withSupply.supply![0];
  assert.ok(first.helpsWith.trim().length > 0, "补给要说明它帮助理解原问题的哪一部分");
  assert.ok(first.backLabel.trim().length > 0, "补给要有返回原位的出口");
  assert.ok(first.body.length >= 1, "补给里的活动至少一个");
  assert.ok(first.supply?.length, "两层补给是允许的（第一层之内再展开一层）");

  // 第二层补给再挂补给即超出上限
  const tooDeep = clone(validExample);
  const step = tooDeep.steps.find(s => "supply" in s && (s as { supply?: { supply?: unknown[] }[] }).supply?.length) as { supply: { supply?: unknown[] }[] };
  step.supply[0].supply = [{ ...(step.supply[0].supply as unknown[])[0] as object }];
  const nested = (step.supply[0].supply as { supply?: unknown[] }[])[0];
  nested.supply = [{ ...(nested.supply as unknown as object[])?.[0] ?? {} }];
  const issues = issuesOf(tooDeep);
  assert.ok(issues.some(i => /补给|supply/.test(i.path) || /层/.test(i.message)), `应指出补给超深：${issues.map(i => i.path + " " + i.message).join(" / ")}`);
  assert.equal(SUPPLY_MAX_DEPTH, 2);
});

test("验收：熟悉基础的用户可以跳过，跳过后主线照旧推进", () => {
  const lesson = adaptiveLessonSchema.parse(clone(validExample));
  const withSupply = lesson.steps.find(s => "supply" in s && s.supply?.length);
  const kinds = withSupply!.supply!.map(s => s.kind);
  assert.ok(kinds.length > 0);
  // 补给是可选字段：不含任何补给的同一条主线必须仍然合法（跳过即等于不展开）
  const withoutSupply = clone(validExample);
  for (const step of withoutSupply.steps) delete (step as { supply?: unknown }).supply;
  const skipped = adaptiveLessonSchema.parse(withoutSupply);
  assert.equal(skipped.steps.length, lesson.steps.length, "跳过补给不应改变主线步骤数");
});

test("验收：有争议的问题不会被强行导向唯一答案", () => {
  const contested: AdaptiveLesson = {
    version: 2, id: "contested-claim", title: "那句记载能说明什么？", category: "历史与证据",
    hook: "同一个广场，两段记录说法不同。", minutes: 6, objective: "分清材料支持的事实、被反驳的说法和仍不确定的部分。",
    mainQuestion: "两段记载互相矛盾时，能断定有人在说谎吗？",
    plan: { objective: "先看材料各自记录了什么，再判断哪些说法有依据。", modules: [{ id: "read", title: "材料说了什么", approachType: "evidence", purpose: "先确认材料的范围，再谈真假。", contributes: "它说明矛盾可能来自时间、地点不同，而不是说谎。" }] },
    steps: [
      { id: "material", module: "read", title: "先读材料", type: "investigate", context: "以下材料为虚构练习。", materials: [{ title: "材料 A", text: "“上午街上几乎没人。”", context: "上午 7 时，码头街。" }, { title: "材料 B", text: "“晚间广场挤满人。”", context: "晚 8 时，中心广场。" }], claims: [{ text: "两段材料描述的是不同时间与地点。", verdict: "supported", feedback: "背景分别指向上午码头街与晚间广场。" }, { text: "两位作者中一定有人故意说谎。", verdict: "uncertain", feedback: "材料只说明场景不同，无法推出动机。" }], reflectionPrompt: "要判断态度，还需要什么材料？" },
      { id: "wrap", module: "read", title: "回到最初的问题", type: "synthesis", answer: "仅凭这两段材料不能断定有人说谎：它们记录的时间与地点不同，因此可以同时为真。", conditions: "这个结论只对给出的材料成立；若两份材料确实针对同一时刻同一地点，就需要其他证据来判断。", openQuestions: ["有没有第三份材料能同时约束时间与地点？"] }
    ],
    boundary: "材料为虚构练习；不宣称唯一的历史解释。",
    followups: ["回忆录里的生动细节一定可靠吗？"],
    sources: [{ title: "美国国家档案馆 · Analyze a Written Document", url: "https://www.archives.gov/education/lessons/worksheets/analyze-a-written-document-intermediate" }]
  };
  const parsed = adaptiveLessonSchema.parse(clone(contested));
  const last = parsed.steps.at(-1);
  assert.equal(last?.type, "synthesis");
  assert.ok(last?.type === "synthesis" && last.answer.length > 0, "争议问题也要给出有条件的回答，而不是回避");
  assert.ok(last?.type === "synthesis" && last.openQuestions.length >= 1, "必须留下未解决的问题");
  assert.ok(!parsed.steps.some(s => s.type === "choice"), "证据类争议不应被压成唯一答案的选择题");
});

test("最终回答必须对应最初的问题：综合收尾与模块规则", () => {
  // 综合收尾不在最后
  const notLast = clone(validExample);
  const [moved] = notLast.steps.splice(notLast.steps.length - 1, 1);
  notLast.steps.splice(0, 0, moved as (typeof notLast.steps)[number]);
  assert.match(issuesOf(notLast).map(i => i.message).join(" "), /综合收尾必须放在最后/);

  // 有收尾却没有原问题
  const noQuestion = clone(validExample);
  delete (noQuestion as { mainQuestion?: string }).mainQuestion;
  assert.match(issuesOf(noQuestion).map(i => i.message).join(" "), /保留原问题/);

  // 模块声明了却没有步骤为它服务
  const unusedModule = clone(validExample);
  unusedModule.plan!.modules.push({ id: "orphan", title: "无人服务的模块", approachType: "mechanism", purpose: "多余的一步。", contributes: "没有作用。" });
  assert.match(issuesOf(unusedModule).map(i => i.message).join(" "), /没有任何步骤/);

  // 使用了模块 id，但步骤没标注归属
  const unlabeled = clone(validExample);
  delete (unlabeled.steps[0] as { module?: string }).module;
  assert.match(issuesOf(unlabeled).map(i => i.message).join(" "), /标明所属模块/);

  // 模块只有补给、没有主线活动
  const supplyOnly = clone(validExample);
  supplyOnly.plan!.modules.push({ id: "supply-only", title: "只有补给", approachType: "mechanism", purpose: "不应成立。", contributes: "没有主线。" });
  supplyOnly.steps.push({ id: "only-supply", module: "supply-only", title: "只有补给", type: "supply", supply: [{ id: "s1", label: "看看这个词", kind: "term", helpsWith: "帮助理解判断。", backLabel: "返回", body: [{ id: "b1", title: "解释", type: "explain", paragraphs: ["一句话解释。"] }] }] } as never);
  assert.match(issuesOf(supplyOnly).map(i => i.message).join(" "), /只有补给/);

  // 引用不存在的模块
  const badRef = clone(validExample);
  (badRef.steps[0] as { module: string }).module = "missing-module";
  assert.match(issuesOf(badRef).map(i => i.message).join(" "), /不存在的模块/);
});

test("旧版 v2 脚本（无 plan、无补给）继续可用，不会被导航层规则误伤", () => {
  const legacy: AdaptiveLesson = {
    version: 2, id: "legacy-single", title: "旧版单课脚本", category: "概念辨析", hook: "旧格式也要能播。", minutes: 5,
    objective: "确认旧脚本仍然通过校验。",
    approach: { type: "concept", reason: "旧版用单一学法描述这节课。" },
    steps: [
      { id: "sort", title: "分类", type: "classify", instruction: "判断例子属于哪类。", categories: [{ id: "a", label: "甲" }, { id: "b", label: "乙" }], items: [{ text: "例子一", categoryId: "a", feedback: "属于甲。" }, { text: "例子二", categoryId: "b", feedback: "属于乙。" }] },
      { id: "wrap", title: "说说看", type: "reflect", prompt: "用自己的话说说区别。", rubric: ["说出了区别"], example: "参考说法。" }
    ],
    boundary: "仅用于兼容性检查。", followups: ["还有别的例子吗？"],
    sources: [{ title: "NASA · What Is a Light-Year?", url: "https://spaceplace.nasa.gov/light-year/en/" }]
  };
  const parsed = adaptiveLessonSchema.parse(clone(legacy));
  assert.equal(parsed.approach?.type, "concept");
  assert.equal(parsed.plan, undefined);
  assert.equal(parsed.mainQuestion, undefined);

  // 既没有 approach 也没有 plan 才应被拒绝
  const neither = clone(legacy);
  delete (neither as { approach?: unknown }).approach;
  assert.match(issuesOf(neither).map(i => i.message).join(" "), /approach|plan/);
});

test("stripNestedSupplies 只影响补给，不影响主线（供后续 UI 复用）", () => {
  const lesson = stripNestedSupplies(clone(validExample));
  assert.equal(adaptiveLessonSchema.parse(lesson).steps.length, validExample.steps.length);
});
