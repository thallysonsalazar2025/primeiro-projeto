'use client';

import { useEffect, useState } from 'react';

type RankingEstimate = {
  targetId: string;
  contest: { id: string; name: string; year: number };
  position: { id: string; name: string; area: string | null; vacancies: number | null };
  category: 'GENERAL' | 'BLACK' | 'PCD' | 'OTHER_QUOTA';
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

const categoryLabel = {
  GENERAL: 'Ampla concorrência',
  BLACK: 'Negros',
  PCD: 'PcD',
  OTHER_QUOTA: 'Outras cotas',
} as const;

export function RankingEstimatePanel() {
  const [estimate, setEstimate] = useState<RankingEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/ranking/estimate', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ranking estimate request failed');
        const payload = await response.json() as { estimates?: RankingEstimate[] };
        if (active) setEstimate(payload.estimates?.[0] ?? null);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p style={{ color: '#64748b' }}>Calculando sua estimativa com os rankings oficiais disponíveis...</p>;
  }

  if (error) {
    return <p style={{ color: '#b45309' }}>Não foi possível carregar a estimativa agora. Seu preparatório continua salvo.</p>;
  }

  if (!estimate) {
    return <p style={{ color: '#64748b' }}>Salve um preparatório com concurso, cargo e nota-alvo. A estimativa aparecerá quando houver ranking oficial importado para esse recorte.</p>;
  }

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
