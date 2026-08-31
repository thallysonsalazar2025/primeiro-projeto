'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const endpoint = mode === 'forgot' ? '/api/auth/password/forgot' : `/api/auth/${mode}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? 'Não foi possível concluir a solicitação.');
        return;
      }

      if (mode === 'forgot') {
        setMessage(body.message ?? 'Confira as instruções para redefinir sua senha.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Recuperar senha';

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 430, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 24, padding: 32, boxShadow: '0 18px 50px rgba(15,23,42,.08)' }}>
        <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
        <h1 style={{ marginBottom: 8 }}>{title}</h1>
        <p style={{ color: '#64748b', marginTop: 0 }}>
          {mode === 'forgot'
            ? 'Informe seu e-mail. Se houver uma conta, enviaremos um link de redefinição válido por 30 minutos.'
            : 'Seu histórico de questões, desempenho e estimativas em uma única conta.'}
        </p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          {mode === 'register' && <input name="name" placeholder="Nome" required style={inputStyle} />}
          <input name="email" type="email" placeholder="E-mail" required style={inputStyle} />
          {mode !== 'forgot' && <input name="password" type="password" placeholder="Senha" minLength={8} required style={inputStyle} />}
          {error && <div style={{ color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 12 }}>{error}</div>}
          {message && <div style={{ color: '#166534', background: '#f0fdf4', padding: 12, borderRadius: 12 }}>{message}</div>}
          <button disabled={loading} style={buttonStyle}>
            {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar instruções'}
          </button>
        </form>

        {mode === 'login' && (
          <button onClick={() => setMode('forgot')} style={linkButtonStyle}>Esqueci minha senha</button>
        )}
        <button
          onClick={() => setMode(mode === 'register' ? 'login' : mode === 'login' ? 'register' : 'login')}
          style={linkButtonStyle}
        >
          {mode === 'login' ? 'Ainda não tenho conta' : mode === 'register' ? 'Já tenho conta' : 'Voltar para entrar'}
        </button>
      </section>
    </main>
  );
}

const inputStyle = { padding: 14, borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 16 };
const buttonStyle = { padding: 14, borderRadius: 12, border: 0, background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' };
const linkButtonStyle = { width: '100%', marginTop: 14, border: 0, background: 'transparent', color: '#4f46e5', cursor: 'pointer' };
