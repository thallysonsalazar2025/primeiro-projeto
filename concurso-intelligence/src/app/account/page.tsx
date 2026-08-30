import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProfileForm } from './ProfileForm';

function formatAccessDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const recentLogins = await prisma.loginHistory.findMany({
    where: { userId: user.id },
    orderBy: { loggedAt: 'desc' },
    take: 5,
    select: { id: true, loggedAt: true, userAgent: true },
  });

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 640, margin: '48px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 28 }}>
        <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
        <h1>Meu perfil</h1>
        <p style={{ color: '#64748b' }}>Atualize como seu nome aparece na área autenticada. O e-mail da conta permanece protegido nesta etapa.</p>
        <ProfileForm email={user.email} initialName={user.name ?? ''} />

        <section aria-labelledby="access-history-title" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
          <h2 id="access-history-title" style={{ marginBottom: 8 }}>Acessos recentes</h2>
          <p style={{ color: '#64748b', marginTop: 0 }}>
            Últimos acessos registrados na sua conta. Por privacidade, o endereço IP não é exibido.
          </p>

          {recentLogins.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhum acesso registrado ainda.</p>
          ) : (
            <ol aria-label="Histórico de acessos" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {recentLogins.map((login, index) => (
                <li key={login.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                  <strong>{index === 0 ? 'Acesso mais recente' : formatAccessDate(login.loggedAt)}</strong>
                  {index === 0 && <div style={{ color: '#475569', marginTop: 4 }}>{formatAccessDate(login.loggedAt)}</div>}
                  <div style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
                    {login.userAgent ? 'Dispositivo/navegador registrado' : 'Dispositivo não identificado'}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <Link href="/dashboard" style={{ display: 'inline-block', marginTop: 20, color: '#4f46e5', fontWeight: 700 }}>Voltar ao dashboard</Link>
      </section>
    </main>
  );
}
