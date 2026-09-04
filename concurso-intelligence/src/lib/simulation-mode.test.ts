import assert from "node:assert/strict";
import test from "node:test";

import { selectSimulationQuestions } from "./simulation-mode.ts";

const candidates = [
  { id: "q3", number: 3, exam: { id: "exam-b", year: 2025, title: "Prova B" } },
  { id: "q2", number: 2, exam: { id: "exam-a", year: 2024, title: "Prova A" } },
  { id: "q1", number: 1, exam: { id: "exam-a", year: 2024, title: "Prova A" } },
];

test("keeps deterministic original exam order", () => {
  const selected = selectSimulationQuestions(candidates, 3, "ORIGINAL_ORDER");
  assert.deepEqual(selected.map((question) => question.id), ["q1", "q2", "q3"]);
});

test("random mode preserves the existing shuffled behavior", () => {
  const randomValues = [0, 0];
  const selected = selectSimulationQuestions(candidates, 2, "RANDOM", () => randomValues.shift() ?? 0);
  assert.deepEqual(selected.map((question) => question.id), ["q2", "q3"]);
});
