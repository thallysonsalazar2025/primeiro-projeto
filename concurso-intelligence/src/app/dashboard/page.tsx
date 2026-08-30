import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SimulationBuilder } from './SimulationBuilder';

type SubjectPerformance = {
  name: string;
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

type TopicPerformance = {
  topicId: string;
  subjectName: string;
  topicName: string;
  parentName: string | null;
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

type DailyPerformance = {
  day: Date;
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [attempts, correct, recentLogins, subjects, recentSessions, elapsed, subjectPerformanceRows, topicPerformanceRows, dailyPerformanceRows] = await Promise.all([
    prisma.questionAttempt.count({ where: { userId: user.id } }),
    prisma.questionAttempt.count({ where: { userId: user.id, correct: true } }),
    prisma.loginHistory.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 5 }),
    prisma.questionAttempt.groupBy({
      by: ['questionId'],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        positionName: true,
        startedAt: true,
        finishedAt: true,
        questionIds: true,
        _count: { select: { attempts: true } },
      },
    }),
    prisma.questionAttempt.aggregate({
      where: { userId: user.id, selected: { not: null }, elapsedMs: { not: null } },
      _avg: { elapsedMs: true },
    }),
    prisma.$queryRaw<SubjectPerformance[]>`
      SELECT
        s."name" AS "name",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      INNER JOIN "Question" q ON q."id" = qa."questionId"
      INNER JOIN "Subject" s ON s."id" = q."subjectId"
      WHERE qa."userId" = ${user.id}
        AND qa."selected" IS NOT NULL
      GROUP BY s."id", s."name"
      ORDER BY "accuracy" ASC, "attempts" DESC, s."name" ASC
      LIMIT 6
    `,
    prisma.$queryRaw<TopicPerformance[]>`
      SELECT
        t."id" AS "topicId",
        s."name" AS "subjectName",
        t."name" AS "topicName",
        parent."name" AS "parentName",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      INNER JOIN "Question" q ON q."id" = qa."questionId"
      INNER JOIN "Topic" t ON t."id" = q."topicId"
      INNER JOIN "Subject" s ON s."id" = t."subjectId"
      LEFT JOIN "Topic" parent ON parent."id" = t."parentId"
      WHERE qa."userId" = ${user.id}
        AND qa."selected" IS NOT NULL
      GROUP BY s."id", s."name", t."id", t."name", parent."name"
      ORDER BY "accuracy" ASC, "attempts" DESC, s."name" ASC, t."name" ASC
      LIMIT 6
    `,
    prisma.$queryRaw<DailyPerformance[]>`
      SELECT
        DATE_TRUNC(
          'day',
          (qa."answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'
        ) AS "day",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      WHERE qa."userId" = ${user.id}
        AND qa."selected" IS NOT NULL
        AND ((qa."answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo') >=
          DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '6 days'
      GROUP BY 1
      ORDER BY "day" ASC
    `,
  ]);

  const accuracy = attempts ? Math.round((correct / attempts) * 1000) / 10 : 0;
  const averageAnswerTime = formatElapsedTime(elapsed._avg.elapsedMs);
  const subjectPerformance = subjectPerformanceRows.map((subject) => ({
    name: subject.name,
    attempts: Number(subject.attempts),
    correct: Number(subject.correct),
    accuracy: subject.accuracy,
  }));
  const topicPerformance = topicPerformanceRows.map((topic) => ({
    topicId: topic.topicId,
    subjectName: topic.subjectName,
    topicName: topic.topicName,
    parentName: topic.parentName,
    attempts: Number(topic.attempts),
    correct: Number(topic.correct),
    accuracy: topic.accuracy,
  }));
  const dailyPerformance = dailyPerformanceRows.map((day) => ({
    day: day.day,
    attempts: Number(day.attempts),
    correct: Number(day.correct),
    accuracy: day.accuracy,
  }));

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 28 }}>
          <div>
            <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
            <h1 style={{ margin: '6px 0' }}>Olá, {user.name ?? user.email}</h1>
            <p style={{ margin: 0, color: '#64748b' }}>Seu painel transforma respostas em direção de estudo e estimativa de competitividade.</p>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16 }}>
          <Card title="Questões respondidas" value={String(attempts)} hint="Histórico acumulado" />
          <Card title="Taxa de acerto" value={`${accuracy}%`} hint="Todas as sessões" />
          <Card title="Acertos" value={String(correct)} hint="Questões corretas" />
          <Card title="Questões únicas" value={String(subjects.length)} hint="Cobertura efetiva" />
          <Card title="Tempo médio" value={averageAnswerTime} hint="Por questão respondida" />
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Evolução nos últimos 7 dias</h2>
          <p style={{ color: '#64748b' }}>Acompanhe volume e taxa de acerto por dia para perceber tendência sem misturar períodos antigos.</p>
          {dailyPerformance.length === 0 ? (
            <p style={{ color: '#64748b' }}>Responda questões para começar a formar seu histórico recente.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {dailyPerformance.map((day) => (
                <article key={day.day.toISOString()} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{day.day.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                    <span style={{ fontWeight: 800 }}>{day.accuracy}%</span>
                  </div>
                  <small style={{ color: '#64748b' }}>
                    {day.correct}/{day.attempts} acertos · {day.attempts} {day.attempts === 1 ? 'questão respondida' : 'questões respondidas'}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Desempenho por disciplina</h2>
          <p style={{ color: '#64748b' }}>Disciplinas com menor taxa de acerto aparecem primeiro para orientar a próxima sessão de estudo.</p>
          {subjectPerformance.length === 0 ? (
            <p style={{ color: '#64748b' }}>Responda questões classificadas por disciplina para gerar este diagnóstico.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {subjectPerformance.map((subject) => (
                <article key={subject.name} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{subject.name}</strong>
                    <span style={{ fontWeight: 800 }}>{subject.accuracy}%</span>
                  </div>
                  <small style={{ color: '#64748b' }}>{subject.correct}/{subject.attempts} acertos</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Desempenho por assunto</h2>
          <p style={{ color: '#64748b' }}>Os assuntos com menor taxa de acerto aparecem primeiro para mostrar onde uma revisão focada tende a render mais.</p>
          {topicPerformance.length === 0 ? (
            <p style={{ color: '#64748b' }}>Responda questões classificadas por assunto para gerar este diagnóstico.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {topicPerformance.map((topic) => (
                <article key={topic.topicId} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{topic.parentName ? `${topic.parentName} › ${topic.topicName}` : topic.topicName}</strong>
                      <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>{topic.subjectName}</small>
                    </div>
                    <span style={{ fontWeight: 800 }}>{topic.accuracy}%</span>
                  </div>
                  <small style={{ color: '#64748b' }}>{topic.correct}/{topic.attempts} acertos</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Sessões recentes</h2>
          {recentSessions.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhum simulado iniciado ainda.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {recentSessions.map((session) => {
                const resumable = session.finishedAt === null;
                return (
                  <article key={session.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <strong>{session.positionName ?? 'Simulado personalizado'}</strong>
                        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
                          {session._count.attempts}/{session.questionIds.length} respostas · iniciado em {session.startedAt.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: resumable ? '#047857' : '#64748b', fontWeight: 700 }}>
                          {resumable ? 'Em andamento' : 'Finalizado'}
                        </span>
                        <Link href={`/simulations/${session.id}`} style={resumeStyle}>
                          {resumable ? 'Retomar prova' : 'Ver resultado'}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Preparatório inteligente</h2>
          <p style={{ color: '#64748b' }}>Monte uma sessão com os filtros disponíveis no banco de questões. Você pode deixar campos em “Todos” para ampliar a seleção.</p>
          <SimulationBuilder />
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Estimativa de classificação</h2>
          <p style={{ color: '#64748b' }}>Quando houver resultado oficial, sua nota simulada será comparada à distribuição real do cargo e modalidade. Para concursos futuros, o sistema mostrará uma faixa estimada baseada em provas anteriores da banca e cargos semelhantes, sempre exibindo o nível de confiança.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <Metric label="Posição estimada" value="Aguardando preparatório" />
            <Metric label="Percentil" value="—" />
            <Metric label="Confiança" value="—" />
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Acessos recentes</h2>
          {recentLogins.length === 0 ? <p style={{ color: '#64748b' }}>Nenhum acesso registrado.</p> : (
            <ul>{recentLogins.map((login) => <li key={login.id}>{login.loggedAt.toLocaleString('pt-BR')}</li>)}</ul>
          )}
        </section>
      </div>
    </main>
  );
}

function formatElapsedTime(elapsedMs: number | null) {
  if (elapsedMs === null) return '—';

  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function Card({ title, value, hint }: { title: string; value: string; hint: string }) {
  return <article style={panelStyle}><span style={{ color: '#64748b' }}>{title}</span><strong style={{ display: 'block', fontSize: 30, marginTop: 8 }}>{value}</strong><small style={{ color: '#94a3b8' }}>{hint}</small></article>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}><span style={{ color: '#64748b' }}>{label}</span><strong style={{ display: 'block', marginTop: 8 }}>{value}</strong></div>;
}

const panelStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 22, marginTop: 18, boxShadow: '0 8px 30px rgba(15,23,42,.04)' };
const resumeStyle = { padding: '10px 14px', borderRadius: 10, background: '#4f46e5', color: '#fff', fontWeight: 700, textDecoration: 'none' };