'use client';

import { useEffect, useState } from 'react';

type RankingCategory = 'GENERAL' | 'BLACK' | 'PCD' | 'OTHER_QUOTA';

type RankingEstimate = {
  targetId: string;
  contest: { id: string; name: string; year: number };
  position: { id: string; name: string; area: string | null; vacancies: number | null };
  category: RankingCategory;
  targetScore: number;
  estimate: {
    estimatedRank: number;
    percentile: number;
    lowerRank: number;
    upperRank: number;
    confidence: 'high' | 'medium' | 'low';
    sampleSize: number;
  };
  disclaimer: string;
};

const confidenceLabel = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
} as const;

const categoryLabel: Record<RankingCategory, string> = {
  GENERAL: 'Ampla concorrência',
  BLACK: 'Negros',
  PCD: 'PcD',
  OTHER_QUOTA: 'Outras cotas',
};

export function RankingEstimatePanel() {
  const [category, setCategory] = useState<RankingCategory>('GENERAL');
  const [estimate, setEstimate] = useState<RankingEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    fetch(`/api/ranking/estimate?category=${encodeURIComponent(category)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ranking estimate request failed');
        const payload = await response.json() as { estimates?: RankingEstimate[] };
        if (active) setEstimate(payload.estimates?.[0] ?? null);
      })
      .catch(() => {
        if (active) {
          setEstimate(null);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category]);

  return (
    <>
      <label style={{ display: 'grid', gap: 6, maxWidth: 300, marginBottom: 14 }}>
        <span style={{ color: '#64748b', fontWeight: 700 }}>Modalidade do ranking</span>
        <select
          aria-label="Modalidade do ranking"
          value={category}
          onChange={(event) => setCategory(event.target.value as RankingCategory)}
          style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff' }}
        >
          {Object.entries(categoryLabel).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      {loading ? (
        <p style={{ color: '#64748b' }}>Calculando sua estimativa com os rankings oficiais disponíveis...</p>
      ) : error ? (
        <p style={{ color: '#b45309' }}>Não foi possível carregar a estimativa agora. Seu preparatório continua salvo.</p>
      ) : estimate ? (
        <EstimateContent estimate={estimate} />
      ) : (
        <p style={{ color: '#64748b' }}>Salve um preparatório com concurso, cargo e nota-alvo. A estimativa aparecerá quando houver ranking oficial importado para esta modalidade.</p>
      )}
    </>
  );
}

function EstimateContent({ estimate }: { estimate: RankingEstimate }) {
  const { lowerRank, upperRank, percentile, confidence, sampleSize } = estimate.estimate;
  const positionRange = lowerRank === upperRank ? `${lowerRank}º` : `${lowerRank}º–${upperRank}º`;
  const percentileLabel = `${Math.round(percentile * 1000) / 10}%`;

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <strong>{estimate.contest.name} · {estimate.position.name}</strong>
        <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>
          {categoryLabel[estimate.category]} · nota-alvo {estimate.targetScore} · amostra oficial de {sampleSize} candidatos
        </small>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <Metric label="Faixa estimada" value={positionRange} />
        <Metric label="Percentil" value={percentileLabel} />
        <Metric label="Confiança" value={confidenceLabel[confidence]} />
      </div>
      <small style={{ display: 'block', marginTop: 14, color: '#64748b' }}>{estimate.disclaimer}</small>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <strong style={{ display: 'block', marginTop: 8 }}>{value}</strong>
    </div>
  );
}
