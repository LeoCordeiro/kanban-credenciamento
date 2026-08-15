import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Este erro estoura no BUILD, não em runtime: o layout carrega este módulo,
  // então até a página 404 estática falha — e a mensagem original do supabase-js
  // ("supabaseUrl is required") aponta para /_not-found, que não tem nada a ver.
  //
  // `NEXT_PUBLIC_*` é embutida no bundle na hora do build, então não basta
  // existir em runtime: tem que estar configurada no painel do host antes de
  // buildar (Netlify: Site configuration > Environment variables).
  throw new Error(
    'Faltam as variáveis do Supabase no ambiente de build: ' +
      [!url && 'NEXT_PUBLIC_SUPABASE_URL', !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
        .filter(Boolean)
        .join(' e ') +
      '. Configure no host e rode o deploy de novo.',
  )
}

export const supabase = createClient(url, anonKey)
