'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Choice = { id: string; label: string; text: string };
type Question = { id: string; number: number | null; statement: string; choices: Choice[]; subject: { name: string } | null };
type SessionPayload = {
  session: { id: string; questionCount: number; answeredCount: number; canResume: boolean; positionName: string | null };
  questions: Question[];
  attemptsByQuestionId: Record<string, { selected: string | null }>;
};

export default function SimulationPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [data, setData] = useState<SessionPayload | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/simulations/${sessionId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar simulado');
        return response.json();
      })
      .then(setData)
      .catch((cause: Error) => setError(cause.message));
  }, [sessionId]);

  async function answer(questionId: string, selected: string) {
    if (!data?.session.canResume) return;
    setSaving(questionId);
    setError('');
    const response = await fetch(`/api/simulations/${sessionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selected }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'Falha ao salvar resposta');
      setSaving(null);
      return;
    }
    setData((current) => current ? {
      ...current,
      session: { ...current.session, answeredCount: current.attemptsByQuestionId[questionId]?.selected ? current.session.answeredCount : current.session.answeredCount + 1 },
      attemptsByQuestionId: { ...current.attemptsByQuestionId, [questionId]: { selected } },
    } : current);
    setSaving(null);
  }

  if (error && !data) return <main style={pageStyle}><p>{error}</p><Link href="/dashboard">Voltar ao painel</Link></main>;
  if (!data) return <main style={pageStyle}><p>Carregando simulado...</p></main>;

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/dashboard">← Voltar ao painel</Link>
        <h1>{data.session.positionName ?? 'Simulado'}</h1>
        <p style={{ color: '#64748b' }}>{data.session.answeredCount}/{data.session.questionCount} respondidas {data.session.canResume ? '· em andamento' : '· finalizado'}</p>
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
        <div style={{ display: 'grid', gap: 18 }}>
          {data.questions.map((question, index) => (
            <article key={question.id} style={cardStyle}>
              <p style={{ color: '#4f46e5', fontWeight: 800 }}>Questão {question.number ?? index + 1}{question.subject ? ` · ${question.subject.name}` : ''}</p>
              <p style={{ lineHeight: 1.6 }}>{question.statement}</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {question.choices.map((choice) => {
                  const selected = data.attemptsByQuestionId[question.id]?.selected === choice.label;
                  return (
                    <label key={choice.id} style={{ border: selected ? '2px solid #4f46e5' : '1px solid #cbd5e1', borderRadius: 12, padding: 12, cursor: data.session.canResume ? 'pointer' : 'default' }}>
                      <input type="radio" name={question.id} checked={selected} disabled={!data.session.canResume || saving === question.id} onChange={() => answer(question.id, choice.label)} />{' '}
                      <strong>{choice.label}.</strong> {choice.text}
                    </label>
                  );
                })}
              </div>
              {saving === question.id && <small>Salvando...</small>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

const pageStyle = { minHeight: '100vh', background: '#f8fafc', padding: 24 };
const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 };
