'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
      router.replace('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      aria-label="Sair da conta"
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        background: '#fff',
        padding: '10px 14px',
        color: '#334155',
        fontWeight: 700,
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {pending ? 'Saindo…' : 'Sair'}
    </button>
  );
}
