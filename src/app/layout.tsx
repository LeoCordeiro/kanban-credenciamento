import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kanban Credenciamento',
  description: 'Gerenciamento de credenciamento de empresas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-board-bg text-text-primary min-h-screen antialiased">{children}</body>
    </html>
  )
}
