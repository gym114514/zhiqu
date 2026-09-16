import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLesson } from '../lib/lesson.ts';

test('locally authored lesson scripts pass the runtime validator', () => {
  const raw = readFileSync(new URL('../liberalism-basics-1.json', import.meta.url), 'utf8');
  const lesson = parseLesson(raw);
  assert.equal(lesson.id, 'liberalism-basics-1');
  assert.notEqual(lesson.prediction.question, lesson.transfer.question);
  assert.equal(lesson.prediction.options.filter(o => o.correct).length, 1);
  assert.equal(lesson.transfer.options.filter(o => o.correct).length, 1);
  assert.ok(lesson.sources.every(s => s.url.startsWith('https://')));
  assert.ok(lesson.sources.length <= 6);
});
