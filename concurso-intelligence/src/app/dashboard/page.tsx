import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [attempts, correct, recentLogins, subjects] = await Promise.all([
    prisma.questionAttempt.count({ where: { userId: user.id } }),
    prisma.questionAttempt.count({ where: { userId: user.id, correct: true } }),
    prisma.loginHistory.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 5 }),
    prisma.questionAttempt.groupBy({
      by: ['questionId'],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const accuracy = attempts ? Math.round((correct / attempts) * 1000) / 10 : 0;

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
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Preparatório inteligente</h2>
          <p style={{ color: '#64748b' }}>Selecione banca, concurso, cargo, disciplina e assunto para montar uma sessão. O próximo módulo usa seus acertos, dificuldade, tempo de resposta e o edital escolhido para priorizar questões.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {['Banca', 'Concurso', 'Cargo', 'Disciplina', 'Assunto'].map((label) => <button key={label} style={filterStyle}>{label} ▾</button>)}
          </div>
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

function Card({ title, value, hint }: { title: string; value: string; hint: string }) {
  return <article style={panelStyle}><span style={{ color: '#64748b' }}>{title}</span><strong style={{ display: 'block', fontSize: 30, marginTop: 8 }}>{value}</strong><small style={{ color: '#94a3b8' }}>{hint}</small></article>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}><span style={{ color: '#64748b' }}>{label}</span><strong style={{ display: 'block', marginTop: 8 }}>{value}</strong></div>;
}

const panelStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 22, marginTop: 18, boxShadow: '0 8px 30px rgba(15,23,42,.04)' };
const filterStyle = { textAlign: 'left' as const, padding: 14, border: '1px solid #cbd5e1', borderRadius: 12, background: '#fff', color: '#334155', cursor: 'pointer' };
