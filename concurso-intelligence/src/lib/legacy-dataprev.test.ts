import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(process.cwd(), "..");
const expectedLabels = ["A", "B", "C", "D", "E"];
const expectedAnswerKey = [
  "E", "D", "C", "C", "A", "D", "C", "D", "A", "D",
  "E", "A", "*", "B", "E", "C", "D", "E", "D", "A",
  "B", "E", "B", "C", "C", "B", "B", "D", "C", "A",
  "B", "A", "D", "C", "E", "D", "A", "B", "E", "C",
  "A", "C", "D", "E", "A", "B", "A", "B", "C", "B",
  "B", "D", "A", "B", "B", "C", "E", "B", "D", "D",
  "C", "B", "A", "C", "C", "C", "D", "B", "B", "B",
];

type LegacyQuestion = {
  n: number;
  stem: string;
  options: Array<[string, string]>;
};

function loadLegacyQuestions(): LegacyQuestion[] {
  const sandbox = { window: {} as Record<string, unknown> };
  vm.createContext(sandbox);
  const questions: LegacyQuestion[] = [];

  for (let part = 1; part <= 7; part += 1) {
    const source = readFileSync(path.join(repoRoot, `questions-${part}.js`), "utf8");
    vm.runInContext(source, sandbox, { filename: `questions-${part}.js` });

    const exported = sandbox.window[`Q${part}`];
    assert.ok(Array.isArray(exported), `questions-${part}.js must export window.Q${part}`);
    assert.equal(exported.length, 10, `window.Q${part} must keep exactly 10 questions`);
    questions.push(...(Array.from(exported) as LegacyQuestion[]));
  }

  return questions;
}

function loadLegacyHtml() {
  return readFileSync(path.join(repoRoot, "index.html"), "utf8");
}

test("legacy DATAPREV keeps exactly 70 sequential questions", () => {
  const questions = loadLegacyQuestions();
  assert.equal(questions.length, 70);
  assert.deepEqual(
    questions.map((question) => question.n),
    Array.from({ length: 70 }, (_, index) => index + 1),
  );
});

test("legacy DATAPREV questions keep usable stems and five A-E choices", () => {
  for (const question of loadLegacyQuestions()) {
    assert.ok(question.stem.trim().length > 0, `question ${question.n} has an empty stem`);
    assert.equal(question.options.length, 5, `question ${question.n} must keep five choices`);
    assert.deepEqual(
      Array.from(question.options, ([label]) => label),
      expectedLabels,
      `question ${question.n} must keep A-E labels`,
    );
    for (const [, text] of Array.from(question.options)) {
      assert.ok(text.trim().length > 0, `question ${question.n} has an empty choice`);
    }
  }
});

test("legacy GitHub Pages entrypoint still loads all seven active question bundles", () => {
  const htmlWithoutComments = loadLegacyHtml().replace(/<!--[\s\S]*?-->/g, "");
  const scriptTags = htmlWithoutComments.match(/<script\b[^>]*>/gi) ?? [];
  const loadedSources = scriptTags.flatMap((tag) => {
    const match = tag.match(/(?:^|\s)src\s*=\s*["']([^"']+)["']/i);
    return match ? [match[1]] : [];
  });

  assert.deepEqual(
    loadedSources.filter((source) => /^questions-\d+\.js$/.test(source)),
    Array.from({ length: 7 }, (_, index) => `questions-${index + 1}.js`),
  );
});

test("legacy DATAPREV answer key keeps all 70 expected entries", () => {
  const keyMatch = loadLegacyHtml().match(/const\s+KEY\s*=\s*(\[[^;]+\]);/);
  assert.ok(keyMatch, "legacy index.html must keep the KEY array");

  const key = JSON.parse(keyMatch[1]) as string[];
  assert.equal(key.length, 70);
  assert.ok(key.every((entry) => /^[A-E*]$/.test(entry)), "answer key entries must be A-E or *");
  assert.deepEqual(key, expectedAnswerKey);
});
