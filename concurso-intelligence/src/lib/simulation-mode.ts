export const simulationModes = ["RANDOM", "ORIGINAL_ORDER"] as const;

export type SimulationMode = (typeof simulationModes)[number];

type OrderedQuestion = {
  id: string;
  number: number | null;
  exam: { id: string; year: number; title: string };
};

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function selectSimulationQuestions<T extends OrderedQuestion>(
  candidates: T[],
  quantity: number,
  mode: SimulationMode,
  random: () => number = Math.random,
) {
  if (mode === "RANDOM") {
    return shuffle(candidates, random).slice(0, quantity);
  }

  return [...candidates]
    .sort((left, right) =>
      left.exam.year - right.exam.year ||
      left.exam.id.localeCompare(right.exam.id) ||
      (left.number ?? Number.MAX_SAFE_INTEGER) - (right.number ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
    )
    .slice(0, quantity);
}
