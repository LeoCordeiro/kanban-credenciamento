import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { Guard } from '@/components/Guard'
import { AppNav } from '@/components/AppNav'

export const metadata: Metadata = {
  title: 'Kanban Credenciamento',
  description: 'Gerenciamento de credenciamento de empresas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-board-bg text-text-primary min-h-screen antialiased">
        <AuthProvider>
          <Guard>
            <div className="flex h-screen">
              <AppNav />
              <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
            </div>
          </Guard>
        </AuthProvider>
      </body>
    </html>
  )
}
