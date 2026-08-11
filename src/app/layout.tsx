import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { Guard } from '@/components/Guard'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})

// Mono com função: CNPJ, CPF, CEP, conta bancária, senha e data — o conteúdo
// que o operador copia para colar no portal da plataforma.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kanban Credenciamento',
  description: 'Gerenciamento de credenciamento de empresas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-board-bg text-text-primary min-h-screen antialiased">
        <AuthProvider>
          <Guard>{children}</Guard>
        </AuthProvider>
      </body>
    </html>
  )
}
