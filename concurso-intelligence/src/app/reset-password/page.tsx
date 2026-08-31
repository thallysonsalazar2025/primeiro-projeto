'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');

    if (password !== confirmation) {
      setLoading(false);
      setError('As senhas não conferem.');
      return;
    }

    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? 'Não foi possível redefinir a senha.');
        return;
      }

      router.push('/login');
      router.refresh();
    } catch {
      setError('Falha de comunicação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 430, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 24, padding: 32, boxShadow: '0 18px 50px rgba(15,23,42,.08)' }}>
        <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
        <h1 style={{ marginBottom: 8 }}>Definir nova senha</h1>
        <p style={{ color: '#64748b', marginTop: 0 }}>Escolha uma nova senha com pelo menos 8 caracteres.</p>

        {!token ? (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 12 }}>Link de recuperação inválido.</div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            <input name="password" type="password" placeholder="Nova senha" minLength={8} maxLength={128} required style={inputStyle} />
            <input name="confirmation" type="password" placeholder="Confirmar nova senha" minLength={8} maxLength={128} required style={inputStyle} />
            {error && <div style={{ color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 12 }}>{error}</div>}
            <button disabled={loading} style={buttonStyle}>{loading ? 'Processando...' : 'Redefinir senha'}</button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Carregando...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

const inputStyle = { padding: 14, borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 16 };
const buttonStyle = { padding: 14, borderRadius: 12, border: 0, background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' };
