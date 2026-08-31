'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';

type PositionOption = {
  id: string;
  name: string;
  area: string | null;
  categories: string[];
};

type ContestOption = {
  id: string;
  name: string;
  year: number;
  positions: PositionOption[];
};

type RankingResponse = {
  contestId: string;
  positionId: string;
  category: string;
  score: number;
  estimate: {
    estimatedRank: number;
    lowerRank: number;
    upperRank: number;
    percentile: number;
    confidence: string;
    sampleSize: number;
  };
  provenance: {
    sources: Array<{ url: string; page: number | null }>;
    lastImportedAt: string | null;
  };
  disclaimer: string;
};

type Props = { contests: ContestOption[] };

export function RankingEstimator({ contests }: Props) {
  const [contestId, setContestId] = useState(contests[0]?.id ?? '');
  const positions = useMemo(
    () => contests.find((contest) => contest.id === contestId)?.positions ?? [],
    [contestId, contests],
  );
  const [positionId, setPositionId] = useState(positions[0]?.id ?? '');
  const activePosition = positions.find((position) => position.id === positionId) ?? positions[0];
  const [category, setCategory] = useState(activePosition?.categories[0] ?? 'GENERAL');
  const [score, setScore] = useState('');
  const [result, setResult] = useState<RankingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  function invalidatePendingRequest() {
    requestIdRef.current += 1;
    setLoading(false);
    setResult(null);
    setError(null);
  }

  function changeContest(nextContestId: string) {
    const nextPositions = contests.find((contest) => contest.id === nextContestId)?.positions ?? [];
    const nextPosition = nextPositions[0];
    invalidatePendingRequest();
    setContestId(nextContestId);
    setPositionId(nextPosition?.id ?? '');
    setCategory(nextPosition?.categories[0] ?? 'GENERAL');
  }

  function changePosition(nextPositionId: string) {
    const nextPosition = positions.find((position) => position.id === nextPositionId);
    invalidatePendingRequest();
    setPositionId(nextPositionId);
    setCategory(nextPosition?.categories[0] ?? 'GENERAL');
  }

  function changeCategory(nextCategory: string) {
    invalidatePendingRequest();
    setCategory(nextCategory);
  }

  function changeScore(nextScore: string) {
    invalidatePendingRequest();
    setScore(nextScore);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = ++requestIdRef.current;
    const normalizedScore = score.trim().replace(',', '.');
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const query = new URLSearchParams({ contestId, positionId, category, score: normalizedScore });
      const response = await fetch(`/api/ranking/official?${query.toString()}`);
      const payload = await response.json().catch(() => null);
      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        setError(payload?.error ?? 'Não foi possível calcular a estimativa.');
        return;
      }
      setResult(payload as RankingResponse);
    } catch {
      if (requestId === requestIdRef.current) {
        setError('Falha de conexão ao calcular a estimativa.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  if (contests.length === 0) {
    return <p style={{ color: '#64748b' }}>Ainda não há resultados oficiais importados para gerar estimativas.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14, padding: 20, border: '1px solid #e2e8f0', borderRadius: 16, background: '#fff' }}>
        <label style={labelStyle}>
          Concurso
          <select value={contestId} onChange={(event) => changeContest(event.target.value)} style={inputStyle}>
            {contests.map((contest) => <option key={contest.id} value={contest.id}>{contest.name} · {contest.year}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Cargo / modalidade
          <select value={positionId} onChange={(event) => changePosition(event.target.value)} style={inputStyle} required>
            {positions.map((position) => <option key={position.id} value={position.id}>{position.name}{position.area ? ` · ${position.area}` : ''}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Categoria
          <select value={category} onChange={(event) => changeCategory(event.target.value)} style={inputStyle} required>
            {(activePosition?.categories ?? []).map((item) => <option key={item} value={item}>{formatCategory(item)}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Sua pontuação simulada
          <input value={score} onChange={(event) => changeScore(event.target.value)} inputMode="decimal" placeholder="Ex.: 72,5" style={inputStyle} required />
        </label>

        <button disabled={loading || !positionId || !category} type="submit" style={{ border: 0, borderRadius: 12, padding: '12px 16px', fontWeight: 800, background: '#4f46e5', color: '#fff', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Calculando…' : 'Estimar posição'}
        </button>
      </form>

      {error ? <div role="alert" style={{ padding: 14, borderRadius: 12, background: '#fff1f2', color: '#be123c' }}>{error}</div> : null}

      {result ? (
        <section aria-live="polite" style={{ padding: 20, border: '1px solid #c7d2fe', borderRadius: 16, background: '#eef2ff' }}>
          <p style={{ margin: 0, color: '#4338ca', fontWeight: 800 }}>Estimativa sobre distribuição oficial</p>
          <h2 style={{ margin: '8px 0 4px', fontSize: 34 }}>~ {result.estimate.estimatedRank}º lugar</h2>
          <p style={{ margin: 0 }}>Faixa estimada: <strong>{result.estimate.lowerRank}º a {result.estimate.upperRank}º</strong></p>
          <p style={{ margin: '8px 0 0' }}>Percentil: <strong>{Math.round(result.estimate.percentile * 1000) / 10}%</strong> · Amostra: <strong>{result.estimate.sampleSize}</strong> candidatos · Confiança: <strong>{formatConfidence(result.estimate.confidence)}</strong></p>
          <p style={{ margin: '14px 0 0', color: '#475569', fontSize: 14 }}>{result.disclaimer}</p>
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Fontes utilizadas</summary>
            <ul>
              {result.provenance.sources.map((source) => (
                <li key={`${source.url}-${source.page ?? 'na'}`}>
                  <a href={source.url} target="_blank" rel="noreferrer">Documento oficial</a>{source.page ? ` · pág. ${source.page}` : ''}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function formatCategory(value: string) {
  const labels: Record<string, string> = { GENERAL: 'Ampla concorrência', PCD: 'PcD', BLACK: 'Pessoas negras', INDIGENOUS: 'Pessoas indígenas' };
  return labels[value] ?? value.replaceAll('_', ' ');
}

function formatConfidence(value: string) {
  const labels: Record<string, string> = { high: 'alta', medium: 'média', low: 'baixa', HIGH: 'alta', MEDIUM: 'média', LOW: 'baixa' };
  return labels[value] ?? value;
}

const labelStyle = { display: 'grid', gap: 6, fontWeight: 700 } as const;
const inputStyle = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' } as const;
