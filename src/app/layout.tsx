import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { Guard } from '@/components/Guard'

export const metadata: Metadata = {
  title: 'Kanban Credenciamento',
  description: 'Gerenciamento de credenciamento de empresas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-board-bg text-text-primary min-h-screen antialiased">
        <AuthProvider>
          <Guard>{children}</Guard>
        </AuthProvider>
      </body>
    </html>
  )
}
