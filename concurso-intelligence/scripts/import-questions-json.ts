import { createHash } from 'node:crypto';
import { open, readFile, writeFile } from 'node:fs/promises';
import { AnswerKeyKind, Prisma, PrismaClient, QuestionStatus, SourceType } from '@prisma/client';
import { serializeIngestionReport, type IngestionReport } from '../src/lib/ingestion-report.ts';
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

async function validateReportDestination(reportPath: string | undefined) {
  if (!reportPath) return;

  const handle = await open(reportPath, 'a');
  await handle.close();
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Uso: npm run db:import:questions -- <arquivo.json> [--report <relatorio.json>]');
  }

  const reportFlagIndex = process.argv.indexOf('--report');
  const reportPath = reportFlagIndex >= 0 ? process.argv[reportFlagIndex + 1] : undefined;
  if (reportFlagIndex >= 0 && !reportPath) {
    throw new Error('--report requer um caminho de arquivo.');
  }

  await validateReportDestination(reportPath);

  const raw = await readFile(inputPath, 'utf8');
  const inputSha256 = createHash('sha256').update(raw, 'utf8').digest('hex');
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
  let duplicates = 0;
  const seenFingerprints = new Set<string>();

  for (const question of batch.questions) {
    const hasSubject = Object.prototype.hasOwnProperty.call(question, 'subject');
    const hasTopic = Object.prototype.hasOwnProperty.call(question, 'topic');
    const hasExplanation = Object.prototype.hasOwnProperty.call(question, 'explanation');

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

    const duplicateInBatch = seenFingerprints.has(fingerprint);
    if (duplicateInBatch) duplicates += 1;
    else seenFingerprints.add(fingerprint);

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

    const status = QuestionStatus[question.status ?? 'ACTIVE'];
    const updateData = {
      status,
      ...(hasSubject ? { subjectId: subject?.id ?? null } : {}),
      ...(hasTopic ? { topicId: topic?.id ?? null } : {}),
      ...(hasExplanation ? { explanation: question.explanation?.trim() || null } : {}),
      sourceUrl: batch.source.url,
      sourcePage: question.sourcePage ?? null,
      sourceLabel: question.sourceLabel?.trim() || null,
      lastVerifiedAt: verifiedAt,
    };
    const createData = {
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
    };

    let saved;
    let wasCreated = false;
    try {
      saved = await prisma.question.create({ data: createData });
      wasCreated = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      saved = await prisma.question.update({
        where: { contentFingerprint: fingerprint },
        data: updateData,
      });
    }

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

    if (!duplicateInBatch) {
      if (wasCreated) created += 1;
      else updated += 1;
    }
  }

  const report: IngestionReport = {
    created,
    updated,
    duplicates,
    rejected: 0,
    verified: batch.questions.length,
    batch: {
      generatedAt: verifiedAt.toISOString(),
      inputSha256,
      sourceType: batch.source.type,
      sourceUrl: batch.source.url,
      examTitle: batch.exam.title.trim(),
      examYear: batch.exam.year,
    },
  };

  console.log(
    `Importação concluída: ${created} novas, ${updated} atualizadas, ${duplicates} duplicadas no lote, ${batch.questions.length} verificadas.`,
  );
  if (reportPath) {
    await writeFile(reportPath, serializeIngestionReport(report), 'utf8');
    console.log(`Relatório de ingestão gravado em ${reportPath}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
