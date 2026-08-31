import { readFile } from 'node:fs/promises';
import { AnswerKeyKind, PrismaClient, QuestionStatus, SourceType } from '@prisma/client';
import { questionFingerprint } from '../src/lib/question-fingerprint.ts';
import {
  validateQuestionImportBatch,
  type QuestionImportBatch,
} from '../src/lib/question-import.ts';

const prisma = new PrismaClient();

async function appendFinalAnswerKey(questionId: string, answer: string | null, isAnnulled: boolean, sourceUrl: string) {
  const latest = await prisma.questionAnswerKey.findFirst({
    where: { questionId },
    orderBy: { version: 'desc' },
  });

  if (
    latest &&
    latest.kind === AnswerKeyKind.FINAL &&
    latest.answer === answer &&
    latest.isAnnulled === isAnnulled
  ) {
    return latest;
  }

  return prisma.questionAnswerKey.create({
    data: {
      questionId,
      version: (latest?.version ?? 0) + 1,
      kind: AnswerKeyKind.FINAL,
      answer,
      isAnnulled,
      sourceUrl,
    },
  });
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Uso: npm run db:import:questions -- <arquivo.json>');
  }

  const raw = await readFile(inputPath, 'utf8');
  const batch = validateQuestionImportBatch(JSON.parse(raw) as QuestionImportBatch);
  const verifiedAt = new Date();

  const board = await prisma.examBoard.upsert({
    where: { acronym: batch.board.acronym.trim().toUpperCase() },
    update: {
      name: batch.board.name.trim(),
      website: batch.board.website?.trim() || null,
    },
    create: {
      acronym: batch.board.acronym.trim().toUpperCase(),
      name: batch.board.name.trim(),
      website: batch.board.website?.trim() || null,
    },
  });

  const existingExam = await prisma.exam.findFirst({
    where: {
      boardId: board.id,
      title: batch.exam.title.trim(),
      year: batch.exam.year,
    },
  });

  const exam = existingExam
    ? await prisma.exam.update({
        where: { id: existingExam.id },
        data: {
          sourceUrl: batch.source.url,
          sourceDocument: batch.exam.sourceDocument?.trim() || null,
          sourceSha256: batch.exam.sourceSha256?.trim() || null,
        },
      })
    : await prisma.exam.create({
        data: {
          boardId: board.id,
          title: batch.exam.title.trim(),
          year: batch.exam.year,
          sourceUrl: batch.source.url,
          sourceDocument: batch.exam.sourceDocument?.trim() || null,
          sourceSha256: batch.exam.sourceSha256?.trim() || null,
        },
      });

  const sourceType = SourceType[batch.source.type];
  let created = 0;
  let updated = 0;

  for (const question of batch.questions) {
    const hasSubject = Object.prototype.hasOwnProperty.call(question, 'subject');
    const hasTopic = Object.prototype.hasOwnProperty.call(question, 'topic');
    const hasExplanation = Object.prototype.hasOwnProperty.call(question, 'explanation');

    const subject = question.subject?.trim()
      ? await prisma.subject.upsert({
          where: { name: question.subject.trim() },
          update: {},
          create: { name: question.subject.trim() },
        })
      : null;

    const topic = question.topic?.trim() && subject
      ? await prisma.topic.findFirst({
          where: { subjectId: subject.id, name: question.topic.trim(), parentId: null },
        }) ?? await prisma.topic.create({
          data: { subjectId: subject.id, name: question.topic.trim() },
        })
      : null;

    const fingerprint = questionFingerprint({
      board: board.acronym,
      year: batch.exam.year,
      examTitle: batch.exam.title,
      number: question.number,
      statement: question.statement,
      choices: question.choices.map(({ label, text }) => ({
        label: label.trim().toUpperCase(),
        text,
      })),
    });

    const existing = await prisma.question.findUnique({
      where: { contentFingerprint: fingerprint },
      select: { id: true },
    });

    const status = QuestionStatus[question.status ?? 'ACTIVE'];
    const saved = await prisma.question.upsert({
      where: { contentFingerprint: fingerprint },
      update: {
        status,
        ...(hasSubject ? { subjectId: subject?.id ?? null } : {}),
        ...(hasTopic ? { topicId: topic?.id ?? null } : {}),
        ...(hasExplanation ? { explanation: question.explanation?.trim() || null } : {}),
        sourceUrl: batch.source.url,
        sourcePage: question.sourcePage ?? null,
        sourceLabel: question.sourceLabel?.trim() || null,
        lastVerifiedAt: verifiedAt,
      },
      create: {
        examId: exam.id,
        boardId: board.id,
        subjectId: subject?.id ?? null,
        topicId: topic?.id ?? null,
        number: question.number ?? null,
        statement: question.statement.trim(),
        explanation: question.explanation?.trim() || null,
        status,
        sourceUrl: batch.source.url,
        sourcePage: question.sourcePage ?? null,
        sourceLabel: question.sourceLabel?.trim() || null,
        contentFingerprint: fingerprint,
        lastVerifiedAt: verifiedAt,
      },
    });

    const currentLabels = question.choices.map((choice) => choice.label.trim().toUpperCase());
    for (const choice of question.choices) {
      const label = choice.label.trim().toUpperCase();
      await prisma.questionChoice.upsert({
        where: { questionId_label: { questionId: saved.id, label } },
        update: { text: choice.text.trim(), isCorrect: choice.isCorrect },
        create: {
          questionId: saved.id,
          label,
          text: choice.text.trim(),
          isCorrect: choice.isCorrect,
        },
      });
    }

    await prisma.questionChoice.deleteMany({
      where: {
        questionId: saved.id,
        label: { notIn: currentLabels },
      },
    });

    const correctChoices = question.choices
      .filter((choice) => choice.isCorrect)
      .map((choice) => choice.label.trim().toUpperCase());
    const isAnnulled = status === QuestionStatus.ANNULLED;
    if (!isAnnulled && correctChoices.length !== 1) {
      throw new Error(`Questão ${question.number ?? saved.id} precisa ter exatamente uma alternativa correta para versionar o gabarito.`);
    }
    if (isAnnulled && correctChoices.length !== 0) {
      throw new Error(`Questão anulada ${question.number ?? saved.id} não pode ter alternativa correta.`);
    }
    await appendFinalAnswerKey(
      saved.id,
      isAnnulled ? null : correctChoices[0],
      isAnnulled,
      batch.source.url,
    );

    const provenance = await prisma.questionProvenance.findFirst({
      where: {
        questionId: saved.id,
        sourceType,
        sourceUrl: batch.source.url,
      },
    });

    if (provenance) {
      await prisma.questionProvenance.update({
        where: { id: provenance.id },
        data: {
          license: batch.source.license?.trim() || null,
          sourceHash: batch.source.sourceHash?.trim() || null,
          notes: batch.source.notes?.trim() || null,
          retrievedAt: verifiedAt,
        },
      });
    } else {
      await prisma.questionProvenance.create({
        data: {
          questionId: saved.id,
          sourceType,
          sourceUrl: batch.source.url,
          license: batch.source.license?.trim() || null,
          sourceHash: batch.source.sourceHash?.trim() || null,
          notes: batch.source.notes?.trim() || null,
          retrievedAt: verifiedAt,
        },
      });
    }

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`Importação concluída: ${created} novas, ${updated} atualizadas, ${batch.questions.length} verificadas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
