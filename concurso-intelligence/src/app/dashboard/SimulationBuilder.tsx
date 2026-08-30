'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoutButton } from './LogoutButton';
import { PerformanceByContext } from './PerformanceByContext';

type Catalog = {
  boards: Array<{ id: string; name: string; acronym: string | null }>;
  contests: Array<{
    id: string;
    name: string;
    year: number | null;
    positions: Array<{ id: string; name: string; area: string | null; vacancies: number | null }>;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    topics: Array<{ id: string; name: string; children: Array<{ id: string; name: string }> }>;
  }>;
};

export function SimulationBuilder() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [boardId, setBoardId] = useState('');
  const [contestId, setContestId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [quantity, setQuantity] = useState(10);

  useEffect(() => {
    let active = true;
    fetch('/api/catalog')
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar o catálogo.');
        return response.json() as Promise<Catalog>;
      })
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const positions = useMemo(
    () => catalog?.contests.find((contest) => contest.id === contestId)?.positions ?? [],
    [catalog, contestId],
  );
  const topics = useMemo(() => {
    const roots = catalog?.subjects.find((subject) => subject.id === subjectId)?.topics ?? [];
    return roots.flatMap((topic) => [
      { id: topic.id, name: topic.name },
      ...topic.children.map((child) => ({ id: child.id, name: `${topic.name} › ${child.name}` })),
    ]);
  }, [catalog, subjectId]);

  async function createSimulation() {
    setError('');
    setCreating(true);
    try {
      const response = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(boardId ? { boardId } : {}),
          ...(contestId ? { contestId } : {}),
          ...(positionId ? { positionId } : {}),
          ...(subjectId ? { subjectId } : {}),
          ...(topicId ? { topicId } : {}),
          quantity,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error === 'No questions found for the selected filters'
          ? 'Nenhuma questão encontrada para os filtros selecionados.'
          : data.error ?? 'Não foi possível criar o simulado.');
      }
      router.push(`/simulations/${data.session.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o simulado.');
      setCreating(false);
    }
  }

  if (loading) return <p style={{ color: '#64748b' }}>Carregando catálogo...</p>;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PerformanceByContext />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LogoutButton />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Select label="Banca" value={boardId} onChange={setBoardId} options={catalog?.boards.map((item) => ({ value: item.id, label: item.acronym ? `${item.acronym} · ${item.name}` : item.name })) ?? []} />
        <Select label="Concurso" value={contestId} onChange={(value) => { setContestId(value); setPositionId(''); }} options={catalog?.contests.map((item) => ({ value: item.id, label: `${item.name}${item.year ? ` · ${item.year}` : ''}` })) ?? []} />
        <Select label="Cargo" value={positionId} onChange={setPositionId} disabled={!contestId} options={positions.map((item) => ({ value: item.id, label: `${item.name}${item.area ? ` · ${item.area}` : ''}` }))} />
        <Select label="Disciplina" value={subjectId} onChange={(value) => { setSubjectId(value); setTopicId(''); }} options={catalog?.subjects.map((item) => ({ value: item.id, label: item.name })) ?? []} />
        <Select label="Assunto" value={topicId} onChange={setTopicId} disabled={!subjectId} options={topics.map((item) => ({ value: item.id, label: item.name }))} />
        <label style={fieldStyle}>
          <span style={labelStyle}>Quantidade</span>
          <input type="number" min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(100, Math.trunc(Number(event.target.value) || 1))))} style={inputStyle} />
        </label>
      </div>
      {error && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
      <div>
        <button type="button" onClick={createSimulation} disabled={creating} style={{ ...primaryStyle, opacity: creating ? 0.65 : 1 }}>
          {creating ? 'Montando simulado...' : 'Começar simulado'}
        </button>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} style={inputStyle}>
        <option value="">Todos</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

const fieldStyle = { display: 'grid', gap: 6 };
const labelStyle = { color: '#475569', fontSize: 14, fontWeight: 700 };
const inputStyle = { minHeight: 44, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', color: '#0f172a' };
const primaryStyle = { minHeight: 44, padding: '10px 16px', border: 0, borderRadius: 10, background: '#4f46e5', color: '#fff', fontWeight: 800, cursor: 'pointer' };
