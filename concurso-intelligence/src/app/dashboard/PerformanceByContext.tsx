'use client';

import { useEffect, useState } from 'react';

type Performance = {
  boards: Array<{ boardId: string; boardName: string; acronym: string; attempts: number; correct: number; accuracy: number }>;
  contests: Array<{ contestId: string; contestName: string; year: number; attempts: number; correct: number; accuracy: number }>;
};

export function PerformanceByContext() {
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/performance')
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar o desempenho por banca e concurso.');
        return response.json() as Promise<Performance>;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>;
  if (!data) return <p style={{ color: '#64748b' }}>Carregando desempenho por banca e concurso...</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
      <PerformanceList
        title="Desempenho por banca"
        empty="Responda questões vinculadas a uma banca para gerar este diagnóstico."
        items={data.boards.map((item) => ({
          id: item.boardId,
          name: item.acronym ? `${item.acronym} · ${item.boardName}` : item.boardName,
          attempts: item.attempts,
          correct: item.correct,
          accuracy: item.accuracy,
        }))}
      />
      <PerformanceList
        title="Desempenho por concurso"
        empty="Responda questões vinculadas a um concurso para gerar este diagnóstico."
        items={data.contests.map((item) => ({
          id: item.contestId,
          name: `${item.contestName} · ${item.year}`,
          attempts: item.attempts,
          correct: item.correct,
          accuracy: item.accuracy,
        }))}
      />
    </div>
  );
}

function PerformanceList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; name: string; attempts: number; correct: number; accuracy: number }> }) {
  return (
    <section aria-label={title} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {items.length === 0 ? <p style={{ color: '#64748b' }}>{empty}</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <article key={item.id} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{item.name}</strong>
                <span style={{ fontWeight: 800 }}>{item.accuracy}%</span>
              </div>
              <small style={{ color: '#64748b' }}>{item.correct}/{item.attempts} acertos</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
