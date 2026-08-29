import assert from "node:assert/strict";
import test from "node:test";

import { serializeAttemptHistory } from "./attempt-history.ts";

test("serializes attempt history preserving order and metadata", () => {
  const answeredAt = new Date("2026-08-29T06:00:00.000Z");
  const attempts = serializeAttemptHistory([
    {
      id: "attempt-1",
      selected: "B",
      correct: false,
      answeredAt,
      elapsedMs: 42000,
      confidence: 3,
      question: {
        id: "question-1",
        number: 17,
        subject: { id: "subject-1", name: "Java" },
        topic: { id: "topic-1", name: "Concorrência" },
      },
    },
    {
      id: "attempt-2",
      selected: null,
      correct: null,
      answeredAt,
      elapsedMs: null,
      confidence: null,
      question: {
        id: "question-2",
        number: null,
        subject: null,
        topic: null,
      },
    },
  ]);

  assert.deepEqual(attempts, [
    {
      id: "attempt-1",
      sequence: 1,
      questionId: "question-1",
      questionNumber: 17,
      subject: { id: "subject-1", name: "Java" },
      topic: { id: "topic-1", name: "Concorrência" },
      selected: "B",
      correct: false,
      answeredAt,
      elapsedMs: 42000,
      confidence: 3,
    },
    {
      id: "attempt-2",
      sequence: 2,
      questionId: "question-2",
      questionNumber: null,
      subject: null,
      topic: null,
      selected: null,
      correct: null,
      answeredAt,
      elapsedMs: null,
      confidence: null,
    },
  ]);
});
