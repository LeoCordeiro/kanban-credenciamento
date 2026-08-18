'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { UserMenu } from '@/components/UserMenu'
import { LayoutGrid, AlarmClock, BookOpen, KeyRound, ListChecks } from 'lucide-react'

const ITENS = [
  { href: '/', titulo: 'Board', Icone: LayoutGrid },
  { href: '/atrasos', titulo: 'Atrasos', Icone: AlarmClock },
  { href: '/documentacoes', titulo: 'Documentações', Icone: BookOpen },
  { href: '/acessos', titulo: 'Acessos', Icone: KeyRound },
  { href: '/checklist', titulo: 'Checklist padrão', Icone: ListChecks },
]

/** Rail vertical de navegação — só aparece logado. */
export function AppNav() {
  const { usuario } = useAuth()
  const pathname = usePathname()

  if (!usuario) return null

  return (
    <nav className="w-14 shrink-0 flex flex-col items-center gap-1 py-3 bg-[#0d1b3e] z-40">
      {ITENS.map(({ href, titulo, Icone }) => {
        const ativo = href === '/' ? pathname === '/' || pathname.startsWith('/empresa') : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={titulo}
            aria-label={titulo}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
              ativo ? 'bg-white/20 text-white' : 'text-white/55 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icone className="w-5 h-5" />
            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-[#172b4d] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {titulo}
            </span>
          </Link>
        )
      })}
      <div className="mt-auto">
        <UserMenu />
      </div>
    </nav>
  )
}
