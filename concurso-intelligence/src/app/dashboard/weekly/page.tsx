import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { getDashboardWeeklyPerformance } from '@/lib/dashboardWeeklyPerformance';

export default async function WeeklyPerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const weeks = await getDashboardWeeklyPerformance(user.id);
  const latest = weeks.at(-1);
  const previous = weeks.at(-2);
  const delta = latest && previous ? Math.round((latest.accuracy - previous.accuracy) * 10) / 10 : null;

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href="/dashboard" style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>
          ← Voltar ao dashboard
        </Link>

        <header style={{ margin: '24px 0' }}>
          <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
          <h1 style={{ margin: '6px 0' }}>Evolução semanal</h1>
          <p style={{ margin: 0, color: '#64748b' }}>
            Compare até oito semanas de volume e acurácia para enxergar tendência sem confundir oscilações de um único dia.
          </p>
        </header>

        {latest ? (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginBottom: 18 }}>
            <Metric label="Acurácia atual" value={`${latest.accuracy}%`} />
            <Metric label="Questões na semana" value={String(latest.attempts)} />
            <Metric
              label="Variação semanal"
              value={delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta} p.p.`}
            />
          </section>
        ) : null}

        <section style={panelStyle} aria-label="Histórico semanal de desempenho">
          {weeks.length === 0 ? (
            <p style={{ color: '#64748b', margin: 0 }}>Responda questões para começar a formar seu histórico semanal.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {weeks.map((week) => (
                <article key={week.weekStart} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>Semana de {formatWeek(week.weekStart)}</strong>
                    <span style={{ fontWeight: 800 }}>{week.accuracy}%</span>
                  </div>
                  <div
                    aria-label={`Acurácia ${week.accuracy}%`}
                    style={{ height: 8, background: '#e2e8f0', borderRadius: 999, margin: '10px 0 8px', overflow: 'hidden' }}
                  >
                    <div style={{ width: `${Math.max(0, Math.min(100, week.accuracy))}%`, height: '100%', background: '#4f46e5' }} />
                  </div>
                  <small style={{ color: '#64748b' }}>
                    {week.correct}/{week.attempts} acertos · {week.attempts} {week.attempts === 1 ? 'questão respondida' : 'questões respondidas'}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatWeek(weekStart: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${weekStart}T00:00:00Z`));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article style={panelStyle}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <strong style={{ display: 'block', fontSize: 26, marginTop: 8 }}>{value}</strong>
    </article>
  );
}

const panelStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  padding: 22,
  boxShadow: '0 8px 30px rgba(15,23,42,.04)',
};
