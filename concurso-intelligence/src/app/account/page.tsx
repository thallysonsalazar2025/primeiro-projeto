import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileForm } from './ProfileForm';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 640, margin: '48px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 28 }}>
        <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
        <h1>Meu perfil</h1>
        <p style={{ color: '#64748b' }}>Atualize como seu nome aparece na área autenticada. O e-mail da conta permanece protegido nesta etapa.</p>
        <ProfileForm email={user.email} initialName={user.name ?? ''} />
        <Link href="/dashboard" style={{ display: 'inline-block', marginTop: 20, color: '#4f46e5', fontWeight: 700 }}>Voltar ao dashboard</Link>
      </section>
    </main>
  );
}
