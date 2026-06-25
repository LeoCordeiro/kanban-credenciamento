import { Board } from '@/components/kanban/Board'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="h-screen flex flex-col">
      <Board />
    </main>
  )
}
