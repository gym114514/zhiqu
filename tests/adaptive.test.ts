import test from "node:test";
import assert from "node:assert/strict";
import { lessons } from "../lib/lessons";
import { conceptLesson,evidenceLesson,procedureLesson } from "../lib/adaptive-lessons";
import { parseAnyLesson,makeRepairPrompt,makeAdaptivePrompt,ScriptImportError } from "../lib/script";

test("accepts legacy scripts and genuinely different adaptive activities",()=>{
 for(const lesson of [...lessons,conceptLesson,evidenceLesson,procedureLesson])assert.equal(parseAnyLesson(JSON.stringify(lesson)).id,lesson.id);
 assert.ok(evidenceLesson.steps.some(s=>s.type==="investigate"));
 assert.ok(!evidenceLesson.steps.some(s=>s.type==="choice"));
 assert.ok(procedureLesson.steps.some(s=>s.type==="worked_example"));
 // 概念路径至少一个 classify 活动：示例课本身就是这条路径的样本
 const classify=conceptLesson.steps.find(s=>s.type==="classify");
 assert.ok(classify,"概念路径需要 classify 活动");
 assert.ok(classify.type==="classify"&&classify.items.length>=2);
});
test("reports all eight omitted correct fields without guessing answers",()=>{
 const broken=JSON.parse(JSON.stringify(lessons[0]));
 for(const key of ["prediction","transfer"]){
  broken[key].options.push({label:"测试选项",feedback:"测试反馈",correct:false});
  for(const o of broken[key].options)delete o.correct;
 }
 assert.throws(()=>parseAnyLesson(JSON.stringify(broken)),(error:unknown)=>{
  assert.ok(error instanceof ScriptImportError);
  assert.equal(error.issues.length,8);
  assert.equal(error.issues[0].path,"prediction.options[0].correct");
  assert.equal(error.issues[7].path,"transfer.options[3].correct");
  return true;
 });
 const repair=makeRepairPrompt(JSON.stringify(broken));
 assert.ok(repair.includes("transfer.options[3].correct"));
 assert.ok(repair.includes("不要把缺失项一律补为false"));
 assert.ok(repair.includes("保留原来的主题、版本、教学内容和路径"));
});
test("v2 rejects omitted booleans, ambiguous keys and broken classifications",()=>{
 const broken=JSON.parse(JSON.stringify(conceptLesson));
 delete broken.steps[2].options[0].correct;
 assert.throws(()=>parseAnyLesson(JSON.stringify(broken)),/steps\[2\].options\[0\].correct/);
 const categories=JSON.parse(JSON.stringify(conceptLesson));
 categories.steps[0].items[0].categoryId="missing";
 assert.throws(()=>parseAnyLesson(JSON.stringify(categories)),/categoryId/);
 const duplicate=JSON.parse(JSON.stringify(conceptLesson));
 duplicate.steps[1].id=duplicate.steps[0].id;
 assert.throws(()=>parseAnyLesson(JSON.stringify(duplicate)),/唯一/);
});
test("strategy cannot be just a renamed common pipeline",()=>{
 const fake=JSON.parse(JSON.stringify(procedureLesson));
 fake.steps=fake.steps.filter((s:{type:string})=>s.type!=="worked_example");
 fake.steps.push({...fake.steps[0],id:"another-explanation"});
 assert.throws(()=>parseAnyLesson(JSON.stringify(fake)),/worked_example/);
});
test("new prompt contains an executable complete example and explicit field audit",()=>{
 const prompt=makeAdaptivePrompt("历史");
 assert.ok(prompt.includes('"correct": true'));
 assert.ok(prompt.includes('"correct": false'));
 assert.ok(prompt.includes("每一个选项都必须包含 label、correct、feedback"));
 assert.ok(prompt.includes("不强制"));
});
