'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type Choice = { id: string; label: string; text: string };
type Question = { id: string; number: number | null; statement: string; choices: Choice[]; subject: { name: string } | null };
type Result = { totalQuestions: number; answered: number; correct: number; incorrect: number; blank: number; accuracy: number; elapsedMs: number };
type ReviewDetail = { selected: string | null; correct: boolean | null; correctLabels: string[] };
type SessionPayload = {
  session: { id: string; questionCount: number; answeredCount: number; reviewQuestionIds: string[]; canResume: boolean; positionName: string | null };
  questions: Question[];
  attemptsByQuestionId: Record<string, { selected: string | null; elapsedMs: number | null }>;
  result: Result | null;
  reviewByQuestionId: Record<string, ReviewDetail> | null;
};

export default function SimulationPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [data, setData] = useState<SessionPayload | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [markingReview, setMarkingReview] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const activeQuestionStartedAt = useRef(Date.now());

  useEffect(() => {
    fetch(`/api/simulations/${sessionId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar simulado');
        return response.json();
      })
      .then((payload: SessionPayload) => {
        activeQuestionStartedAt.current = Date.now();
        setData(payload);
        setResult(payload.result);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [sessionId]);

  const answeredQuestionIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      Object.entries(data.attemptsByQuestionId)
        .filter(([, attempt]) => Boolean(attempt.selected))
        .map(([questionId]) => questionId),
    );
  }, [data]);

  const reviewQuestionIds = useMemo(() => new Set(data?.session.reviewQuestionIds ?? []), [data]);

  function activateQuestion(index: number) {
    if (!data) return 0;
    const boundedIndex = Math.max(0, Math.min(index, data.questions.length - 1));
    if (boundedIndex !== currentQuestionIndex) {
      activeQuestionStartedAt.current = Date.now();
      setCurrentQuestionIndex(boundedIndex);
    }
    return boundedIndex;
  }

  function goToQuestion(index: number) {
    if (!data) return;
    const boundedIndex = activateQuestion(index);
    document.getElementById(`question-${data.questions[boundedIndex].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function answer(questionId: string, selected: string) {
    if (!data?.session.canResume) return;
    const startedAt = activeQuestionStartedAt.current;
    const previousElapsedMs = data.attemptsByQuestionId[questionId]?.elapsedMs ?? 0;
    const elapsedMs = previousElapsedMs + Math.max(0, Date.now() - startedAt);
    setSaving(questionId);
    setError('');
    const response = await fetch(`/api/simulations/${sessionId}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, selected, elapsedMs }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? 'Falha ao salvar resposta');
      setSaving(null);
      return;
    }
    setData((current) => current ? {
      ...current,
      session: { ...current.session, answeredCount: current.attemptsByQuestionId[questionId]?.selected ? current.session.answeredCount : current.session.answeredCount + 1 },
      attemptsByQuestionId: { ...current.attemptsByQuestionId, [questionId]: { selected, elapsedMs: body?.attempt?.elapsedMs ?? elapsedMs } },
    } : current);
    if (activeQuestionStartedAt.current === startedAt) {
      activeQuestionStartedAt.current = Date.now();
    }
    setSaving(null);
  }

  async function toggleReview(questionId: string) {
    if (!data?.session.canResume || markingReview) return;
    const markedForReview = !reviewQuestionIds.has(questionId);
    setMarkingReview(questionId);
    setError('');

    try {
      const response = await fetch(`/api/simulations/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, markedForReview }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? 'Falha ao atualizar marcação para revisão');
      }

      setData((current) => current ? {
        ...current,
        session: { ...current.session, reviewQuestionIds: body.reviewQuestionIds },
      } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao atualizar marcação para revisão');
    } finally {
      setMarkingReview(null);
    }
  }

  async function finish() {
    if (!data?.session.canResume || finishing || saving || markingReview) return;
    setFinishing(true);
    setError('');

    try {
      const response = await fetch(`/api/simulations/${sessionId}/finish`, { method: 'POST' });
      const body = await response.json().catch(() => null) as { result?: Result; error?: string } | null;
      if (!response.ok || !body?.result) {
        throw new Error(body?.error ?? 'Falha ao finalizar simulado');
      }

      try {
        const refreshedResponse = await fetch(`/api/simulations/${sessionId}`);
        const refreshed = await refreshedResponse.json().catch(() => null) as SessionPayload | null;
        if (!refreshedResponse.ok || !refreshed) {
          throw new Error('Falha ao carregar correção detalhada');
        }
        setData(refreshed);
        setResult(refreshed.result);
      } catch {
        setResult(body.result);
        setData((current) => current ? { ...current, result: body.result ?? null, session: { ...current.session, canResume: false } } : current);
        setError('Simulado finalizado. A correção detalhada poderá ser carregada ao reabrir o resultado.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao finalizar simulado');
    } finally {
      setFinishing(false);
    }
  }

  if (error && !data) return <main style={pageStyle}><p>{error}</p><Link href="/dashboard">Voltar ao painel</Link></main>;
  if (!data) return <main style={pageStyle}><p>Carregando simulado...</p></main>;

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/dashboard">← Voltar ao painel</Link>
        <h1>{data.session.positionName ?? 'Simulado'}</h1>
        <p style={{ color: '#64748b' }}>{data.session.answeredCount}/{data.session.questionCount} respondidas · {data.session.reviewQuestionIds.length} para revisão {data.session.canResume ? '· em andamento' : '· finalizado'}</p>
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

        <nav aria-label="Navegação entre questões" style={navigatorStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong>Questão {currentQuestionIndex + 1} de {data.questions.length}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => goToQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0} style={navButtonStyle}>Anterior</button>
              <button type="button" onClick={() => goToQuestion(currentQuestionIndex + 1)} disabled={currentQuestionIndex === data.questions.length - 1} style={navButtonStyle}>Próxima</button>
            </div>
          </div>
          <div style={questionGridStyle}>
            {data.questions.map((question, index) => {
              const answered = answeredQuestionIds.has(question.id);
              const markedForReview = reviewQuestionIds.has(question.id);
              const active = index === currentQuestionIndex;
              return (
                <button
                  key={question.id}
                  type="button"
                  aria-label={`Ir para questão ${question.number ?? index + 1}${answered ? ', respondida' : ', em branco'}${markedForReview ? ', marcada para revisão' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => goToQuestion(index)}
                  style={{ ...questionButtonStyle, border: active ? '2px solid #4f46e5' : markedForReview ? '2px solid #d97706' : '1px solid #cbd5e1', background: answered ? '#eef2ff' : '#fff', fontWeight: active || answered || markedForReview ? 800 : 600 }}
                >
                  {markedForReview ? '★ ' : ''}{question.number ?? index + 1}
                </button>
              );
            })}
          </div>
          <small style={{ color: '#64748b' }}>Fundo destacado: respondida. ★: marcada para revisão e salva na sessão.</small>
        </nav>

        {result && (
          <section style={resultStyle} aria-live="polite">
            <h2 style={{ marginTop: 0 }}>Resultado</h2>
            <strong style={{ fontSize: 32 }}>{Math.round(result.accuracy * 100)}% de acerto</strong>
            <p>{result.correct} corretas · {result.incorrect} incorretas · {result.blank} em branco · {result.answered}/{result.totalQuestions} respondidas</p>
          </section>
        )}
        <div style={{ display: 'grid', gap: 18 }}>
          {data.questions.map((question, index) => {
            const markedForReview = reviewQuestionIds.has(question.id);
            const correction = data.reviewByQuestionId?.[question.id];
            return (
              <article
                id={`question-${question.id}`}
                key={question.id}
                style={cardStyle}
                onPointerDown={() => activateQuestion(index)}
                onFocusCapture={() => activateQuestion(index)}
                onClick={() => activateQuestion(index)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Questão {question.number ?? index + 1}{question.subject ? ` · ${question.subject.name}` : ''}</p>
                  <button
                    type="button"
                    onClick={() => toggleReview(question.id)}
                    disabled={!data.session.canResume || Boolean(markingReview) || finishing}
                    aria-pressed={markedForReview}
                    style={reviewButtonStyle}
                  >
                    {markingReview === question.id ? 'Salvando...' : markedForReview ? '★ Marcada para revisão' : '☆ Marcar para revisão'}
                  </button>
                </div>
                <p style={{ lineHeight: 1.6 }}>{question.statement}</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {question.choices.map((choice) => {
                    const selected = data.attemptsByQuestionId[question.id]?.selected === choice.label;
                    return (
                      <label key={choice.id} style={{ border: selected ? '2px solid #4f46e5' : '1px solid #cbd5e1', borderRadius: 12, padding: 12, cursor: data.session.canResume ? 'pointer' : 'default' }}>
                        <input type="radio" name={question.id} checked={selected} disabled={!data.session.canResume || saving === question.id || finishing} onChange={() => answer(question.id, choice.label)} />{' '}
                        <strong>{choice.label}.</strong> {choice.text}
                      </label>
                    );
                  })}
                </div>
                {saving === question.id && <small>Salvando...</small>}
                {!data.session.canResume && correction && (
                  <div style={correctionStyle}>
                    <strong>{correction.correct === true ? '✓ Correta' : correction.correct === false ? '✕ Incorreta' : 'Em branco'}</strong>
                    <span>Sua resposta: {correction.selected ?? 'nenhuma'}</span>
                    <span>Gabarito: {correction.correctLabels.length > 0 ? correction.correctLabels.join(', ') : 'indisponível'}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {data.session.canResume && (
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={finish} disabled={finishing || Boolean(saving) || Boolean(markingReview)} style={finishStyle}>
              {finishing ? 'Finalizando...' : `Finalizar prova${data.session.answeredCount < data.session.questionCount ? ` (${data.session.questionCount - data.session.answeredCount} em branco)` : ''}`}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

const pageStyle = { minHeight: '100vh', background: '#f8fafc', padding: 24 };
const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20, scrollMarginTop: 16 };
const resultStyle = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 18, padding: 20, marginBottom: 18 };
const correctionStyle = { display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginTop: 14, padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid #cbd5e1' };
const navigatorStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 18 };
const questionGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(44px, 1fr))', gap: 8, margin: '12px 0 8px' };
const questionButtonStyle = { minHeight: 44, borderRadius: 10, cursor: 'pointer' };
const navButtonStyle = { minHeight: 40, padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', fontWeight: 700, cursor: 'pointer' };
const reviewButtonStyle = { minHeight: 40, padding: '8px 12px', border: '1px solid #d97706', borderRadius: 10, background: '#fff7ed', color: '#92400e', fontWeight: 700, cursor: 'pointer' };
const finishStyle = { width: '100%', padding: 16, border: 0, borderRadius: 12, background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' };
