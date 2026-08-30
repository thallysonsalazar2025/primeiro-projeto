'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProfileForm({ email, initialName }: { email: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    const response = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(body.error ?? 'Não foi possível atualizar o perfil.');
      return;
    }

    setName(body.user.name ?? '');
    setMessage('Perfil atualizado.');
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 700 }}>Nome</span>
        <input
          aria-label="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={80}
          required
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 700 }}>E-mail</span>
        <input aria-label="E-mail" value={email} disabled style={{ ...inputStyle, background: '#f8fafc' }} />
      </label>
      {error && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
      {message && <p role="status" style={{ margin: 0, color: '#166534' }}>{message}</p>}
      <button disabled={loading} style={buttonStyle}>{loading ? 'Salvando...' : 'Salvar perfil'}</button>
    </form>
  );
}

const inputStyle = { padding: 14, borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 16 };
const buttonStyle = { padding: 14, borderRadius: 12, border: 0, background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' };
