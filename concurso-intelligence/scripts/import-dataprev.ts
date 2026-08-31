import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnswerKeyKind, PrismaClient, QuestionStatus, SourceType } from "@prisma/client";
import { dataprevFingerprint, type DataprevLegacyQuestion } from "../src/lib/dataprev-fingerprint.ts";

const prisma = new PrismaClient();
const LEGACY_ROOT = path.resolve(process.cwd(), "..");
const BOARD = { acronym: "FGV", name: "Fundação Getulio Vargas" };
const CONTEST = { name: "DATAPREV", year: 2024 };
const POSITION = { name: "ATI - Desenvolvimento de Software", area: "Tecnologia da Informação" };
const EXAM = { title: "DATAPREV 2024 - ATI - Desenvolvimento de Software - Tipo 1 Branca", year: 2024 };

const SUBJECTS = [
  { from: 1, to: 10, name: "Língua Portuguesa" },
  { from: 11, to: 20, name: "Raciocínio Lógico e Matemático" },
  { from: 21, to: 30, name: "Noções de Direito e Legislação" },
  { from: 31, to: 70, name: "Conhecimentos Específicos" },
] as const;

type LegacyQuestion = DataprevLegacyQuestion;

async function loadLegacyQuestions() {
  const questions: LegacyQuestion[] = [];
  for (let part = 1; part <= 7; part++) {
    const source = await readFile(path.join(LEGACY_ROOT, `questions-${part}.js`), "utf8");
    const match = source.match(/window\.Q\d+=(\[.*\]);?\s*$/s);
    if (!match) throw new Error(`Formato inesperado em questions-${part}.js`);
    questions.push(...(JSON.parse(match[1]) as LegacyQuestion[]));
  }

  const html = await readFile(path.join(LEGACY_ROOT, "index.html"), "utf8");
  const keyMatch = html.match(/const KEY=(\[[^;]+\]);/s);
  if (!keyMatch) throw new Error("Gabarito KEY não encontrado no index.html legado");
  const key = JSON.parse(keyMatch[1]) as string[];

  if (questions.length !== 70 || key.length !== 70) {
    throw new Error(`Carga DATAPREV inválida: ${questions.length} questões e ${key.length} respostas`);
  }

  const numbers = questions.map((q) => q.n);
  if (new Set(numbers).size !== 70 || Math.min(...numbers) !== 1 || Math.max(...numbers) !== 70) {
    throw new Error("Numeração das questões DATAPREV não é uma sequência única de 1 a 70");
  }

  return { questions: questions.sort((a, b) => a.n - b.n), key };
}

function subjectFor(questionNumber: number) {
  return SUBJECTS.find((subject) => questionNumber >= subject.from && questionNumber <= subject.to)!;
}

async function validatePersistedImport(examId: string, expectedKey: string[]) {
  const persisted = await prisma.question.findMany({
    where: { examId },
    orderBy: { number: "asc" },
    include: {
      choices: { orderBy: { label: "asc" } },
      provenance: true,
      answerKeys: { orderBy: { version: "asc" } },
    },
  });

  if (persisted.length !== 70) {
    throw new Error(`Validação pós-import falhou: esperadas 70 questões, persistidas ${persisted.length}`);
  }

  const numbers = persisted.map((question) => question.number);
  if (numbers.some((number) => number === null) || new Set(numbers).size !== 70 || numbers[0] !== 1 || numbers[69] !== 70) {
    throw new Error("Validação pós-import falhou: numeração persistida não corresponde à sequência 1..70");
  }

  for (const question of persisted) {
    const number = question.number!;
    const expectedAnswer = expectedKey[number - 1];
    const correctChoices = question.choices.filter((choice) => choice.isCorrect);
    const finalKey = question.answerKeys.find((entry) => entry.kind === AnswerKeyKind.FINAL && entry.version === 1);

    if (question.choices.length === 0) {
      throw new Error(`Validação pós-import falhou: questão ${number} sem alternativas persistidas`);
    }

    if (!finalKey) {
      throw new Error(`Validação pós-import falhou: questão ${number} sem gabarito final versionado`);
    }

    if (expectedAnswer === "*") {
      if (
        question.status !== QuestionStatus.ANNULLED ||
        correctChoices.length !== 0 ||
        !finalKey.isAnnulled ||
        finalKey.answer !== null
      ) {
        throw new Error(`Validação pós-import falhou: questão anulada ${number} inconsistente`);
      }
    } else if (
      correctChoices.length !== 1 ||
      correctChoices[0].label !== expectedAnswer ||
      finalKey.isAnnulled ||
      finalKey.answer !== expectedAnswer
    ) {
      throw new Error(`Validação pós-import falhou: gabarito da questão ${number} inconsistente`);
    }

    const hasLegacyProvenance = question.provenance.some(
      (source) => source.sourceType === SourceType.GITHUB_REPOSITORY && source.sourceUrl === "legacy://primeiro-projeto",
    );
    if (!hasLegacyProvenance) {
      throw new Error(`Validação pós-import falhou: questão ${number} sem proveniência do legado`);
    }
  }
}

async function main() {
  const { questions, key } = await loadLegacyQuestions();

  const board = await prisma.examBoard.upsert({
    where: { acronym: BOARD.acronym },
    update: { name: BOARD.name },
    create: BOARD,
  });

  const organization = await prisma.organization.findFirst({
    where: { acronym: "DATAPREV" },
  }) ?? await prisma.organization.create({
    data: { name: "Empresa de Tecnologia e Informações da Previdência - DATAPREV", acronym: "DATAPREV" },
  });

  const contest = await prisma.contest.upsert({
    where: { name_year: { name: CONTEST.name, year: CONTEST.year } },
    update: { organizationId: organization.id },
    create: { ...CONTEST, organizationId: organization.id },
  });

  const position = await prisma.contestPosition.upsert({
    where: {
      contestId_name_area: { contestId: contest.id, name: POSITION.name, area: POSITION.area },
    },
    update: {},
    create: { ...POSITION, contestId: contest.id },
  });

  const exam = await prisma.exam.findFirst({
    where: { contestId: contest.id, positionId: position.id, title: EXAM.title, year: EXAM.year },
  }) ?? await prisma.exam.create({
    data: {
      ...EXAM,
      contestId: contest.id,
      positionId: position.id,
      boardId: board.id,
      organizationId: organization.id,
      sourceDocument: "Legado Simulado DATAPREV 2024",
    },
  });

  const subjectIds = new Map<string, string>();
  for (const subject of SUBJECTS) {
    const row = await prisma.subject.upsert({
      where: { name: subject.name },
      update: {},
      create: { name: subject.name },
    });
    subjectIds.set(subject.name, row.id);
  }

  let imported = 0;
  for (const question of questions) {
    const answer = key[question.n - 1];
    const subject = subjectFor(question.n);
    const contentFingerprint = dataprevFingerprint(question);
    const status = answer === "*" ? QuestionStatus.ANNULLED : QuestionStatus.ACTIVE;

    const saved = await prisma.question.upsert({
      where: { contentFingerprint },
      update: {
        status,
        subjectId: subjectIds.get(subject.name),
        lastVerifiedAt: new Date(),
      },
      create: {
        examId: exam.id,
        boardId: board.id,
        subjectId: subjectIds.get(subject.name),
        number: question.n,
        statement: question.stem.trim(),
        status,
        sourceLabel: "Simulado DATAPREV 2024 legado",
        contentFingerprint,
        lastVerifiedAt: new Date(),
      },
    });

    for (const [label, text] of question.options) {
      const isCorrect = answer !== "*" && answer === label;
      await prisma.questionChoice.upsert({
        where: { questionId_label: { questionId: saved.id, label } },
        update: { text, isCorrect },
        create: { questionId: saved.id, label, text, isCorrect },
      });
    }

    await prisma.questionAnswerKey.upsert({
      where: { questionId_version: { questionId: saved.id, version: 1 } },
      update: {
        kind: AnswerKeyKind.FINAL,
        answer: answer === "*" ? null : answer,
        isAnnulled: answer === "*",
        sourceUrl: "legacy://primeiro-projeto/index.html",
      },
      create: {
        questionId: saved.id,
        version: 1,
        kind: AnswerKeyKind.FINAL,
        answer: answer === "*" ? null : answer,
        isAnnulled: answer === "*",
        sourceUrl: "legacy://primeiro-projeto/index.html",
      },
    });

    const existingProvenance = await prisma.questionProvenance.findFirst({
      where: { questionId: saved.id, sourceType: SourceType.GITHUB_REPOSITORY, sourceUrl: "legacy://primeiro-projeto" },
    });
    if (!existingProvenance) {
      await prisma.questionProvenance.create({
        data: {
          questionId: saved.id,
          sourceType: SourceType.GITHUB_REPOSITORY,
          sourceUrl: "legacy://primeiro-projeto",
          notes: "Migrado do simulador DATAPREV preservado na raiz do repositório.",
        },
      });
    }
    imported++;
  }

  await validatePersistedImport(exam.id, key);
  console.log(`DATAPREV importado/atualizado e validado com sucesso: ${imported} questões.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
