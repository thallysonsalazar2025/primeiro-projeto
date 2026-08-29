import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(process.cwd(), "..");

function loadLegacyQuestions() {
  const sandbox = { window: {} as Record<string, unknown> };
  vm.createContext(sandbox);

  for (let part = 1; part <= 7; part += 1) {
    const source = readFileSync(path.join(repoRoot, `questions-${part}.js`), "utf8");
    vm.runInContext(source, sandbox, { filename: `questions-${part}.js` });
  }

  return Object.values(sandbox.window).flat() as Array<{
    n: number;
    stem: string;
    options: Array<[string, string]>;
  }>;
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
      question.options.map(([label]) => label),
      ["A", "B", "C", "D", "E"],
      `question ${question.n} must keep A-E labels`,
    );
    for (const [, text] of question.options) {
      assert.ok(text.trim().length > 0, `question ${question.n} has an empty choice`);
    }
  }
});

test("legacy GitHub Pages entrypoint still loads all seven question bundles", () => {
  const html = readFileSync(path.join(repoRoot, "index.html"), "utf8");
  for (let part = 1; part <= 7; part += 1) {
    assert.match(html, new RegExp(`questions-${part}\\.js`));
  }
});
