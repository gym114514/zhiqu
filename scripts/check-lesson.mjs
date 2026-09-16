import { readFileSync } from 'node:fs';
import { parseLesson } from '../lib/lesson.ts';

const path = process.argv[2] ?? new URL('../liberalism-basics-1.json', import.meta.url);
const raw = readFileSync(path, 'utf8');
try {
  const lesson = parseLesson(raw);
  console.log('OK  校验通过');
  console.log('id        =', lesson.id);
  console.log('title     =', lesson.title);
  console.log('minutes   =', lesson.minutes);
  console.log('concepts  =', lesson.concepts.length);
  console.log('cards     =', lesson.experiment.cards.length, '/ type =', lesson.experiment.type);
  console.log('explanation 段 =', lesson.explanation.length);
  console.log('prediction 正确项 =', lesson.prediction.options.filter(o => o.correct).length, '/ 选项数 =', lesson.prediction.options.length);
  console.log('transfer   正确项 =', lesson.transfer.options.filter(o => o.correct).length, '/ 选项数 =', lesson.transfer.options.length);
  console.log('rubric    =', lesson.recall.rubric.length, '/ followups =', lesson.followups.length, '/ sources =', lesson.sources.length);
  console.log('来源均为 HTTPS =', lesson.sources.every(s => s.url.startsWith('https://')));
  console.log('预测题 ≠ 迁移题 =', lesson.prediction.question !== lesson.transfer.question);
} catch (error) {
  console.log('FAIL 校验未通过');
  console.log(error.message);
  process.exitCode = 1;
}
