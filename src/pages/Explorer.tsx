import { Link, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'

// "Etherscan" simulado: a transação existe só nesta simulação, então não há link externo real
export function Explorer() {
  const { hash } = useParams({ from: '/tx/$hash' })

  useEffect(() => {
    document.title = 'Explorador simulado | Kurio'
  }, [])

  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-2xl font-bold">Explorador de blocos (simulado)</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Esta transação existe apenas na simulação. Nenhum explorador real é aberto, e nenhuma
        operação aconteceu em uma rede de verdade.
      </p>
      <dl className="mt-6 rounded-lg bg-card p-4 text-sm">
        <dt className="text-muted-foreground">Hash da transação</dt>
        <dd className="mt-1 break-all font-mono">{hash}</dd>
        <dt className="mt-4 text-muted-foreground">Status</dt>
        <dd className="mt-1 font-bold text-primary">Confirmada (simulada)</dd>
      </dl>
      <Link to="/" className="mt-8 inline-block text-primary underline">
        Voltar para o início
      </Link>
    </div>
  )
}
