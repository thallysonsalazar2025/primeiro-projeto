import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './layout.module.css';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.dashboardShell}>
      <nav
        aria-label="Navegação do dashboard"
        className={styles.dashboardNav}
      >
        <Link href="/dashboard" style={linkStyle}>Visão geral</Link>
        <Link href="/dashboard/weekly" style={linkStyle}>Evolução semanal</Link>
        <Link href="/ranking" style={linkStyle}>Estimador</Link>
        <Link href="/account" style={linkStyle}>Meu perfil</Link>
      </nav>
      {children}
    </div>
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
