import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav
        aria-label="Navegação do dashboard"
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          overflowX: 'auto',
        }}
      >
        <Link href="/dashboard" style={linkStyle}>Visão geral</Link>
        <Link href="/dashboard/weekly" style={linkStyle}>Evolução semanal</Link>
      </nav>
      {children}
    </>
  );
}

const linkStyle = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  color: '#334155',
  fontWeight: 700,
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
};
