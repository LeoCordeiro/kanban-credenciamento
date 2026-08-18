import { redirect } from 'next/navigation'

/** A tela virou /tarefas; link antigo continua funcionando. */
export default function ChecklistRedirect() {
  redirect('/tarefas')
}
