import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell, ShieldCheck, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/lib/api'
import { FacebookIcon, InstagramIcon, LinkedinIcon, XSocialIcon, YoutubeIcon } from './icons'

const features = [
  {
    icon: ShieldCheck,
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    icon: Sparkles,
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    icon: Bell,
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const link = 'hover:text-primary'
const soon = 'cursor-not-allowed opacity-60'

// itens que levam a páginas fora do escopo ficam desabilitados, não fingem navegar
function Soon({ children }: { children: string }) {
  return (
    <span aria-disabled="true" title="Em breve" className={soon}>
      {children}
    </span>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 text-sm">
      <div className="grid overflow-hidden rounded-t-lg bg-card md:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="space-y-3 border-b border-border p-6 lg:border-b-0 lg:border-r">
            <span aria-hidden className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
              <Icon className="size-5" />
            </span>
            <h2 className="font-bold">{title}</h2>
            <p className="text-xs leading-5 text-muted-foreground">{text}</p>
          </div>
        ))}
        <Newsletter />
      </div>

      <div className="grid gap-4 bg-band px-6 py-6 text-xs md:grid-cols-4 md:items-center">
        <p className="text-base font-bold tracking-[0.15em]">KURIO</p>
        <p className="text-muted-foreground">Feito para colecionadores, criadores e cultura</p>
        <p className="text-muted-foreground">contato@email.com</p>
        <p className="text-muted-foreground">+55 11 4002 8922</p>
      </div>

      <div className="grid gap-8 bg-card px-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-label="Meu perfil">
          <h2 className="mb-3 font-bold">Meu perfil</h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li><Link to="/profile" className={link}>Meu perfil</Link></li>
            <li><Soon>Minha coleção</Soon></li>
            <li><Soon>Atividade</Soon></li>
            <li><Soon>Estúdio do criador</Soon></li>
            <li><Link to="/favorites" className={link}>Lista de interesse</Link></li>
          </ul>
        </nav>

        <nav aria-label="Central de ajuda">
          <h2 className="mb-3 font-bold">Central de ajuda</h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li><Soon>Central de ajuda</Soon></li>
            <li><Soon>Como comprar NFTs</Soon></li>
            <li><Soon>Carteira e segurança</Soon></li>
            <li><Soon>Política do mercado</Soon></li>
            <li><Soon>Denunciar item</Soon></li>
          </ul>
        </nav>

        <nav aria-label="Coleções">
          <h2 className="mb-3 font-bold">Coleções</h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {['Arte digital', 'Fotografia', 'Música', 'Arte 3D'].map((name) => (
              <li key={name}>
                <Link to="/" search={{ collection: [name] }} hash="catalogo" className={link}>
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-bold">Redes sociais</h2>
            <ul className="flex gap-2">
              {[
                ['Facebook', FacebookIcon],
                ['Instagram', InstagramIcon],
                ['X', XSocialIcon],
                ['LinkedIn', LinkedinIcon],
                ['YouTube', YoutubeIcon],
              ].map(([name, Icon]) => {
                const SocialIcon = Icon as typeof FacebookIcon
                return (
                  <li key={name as string}>
                    <span
                      role="img"
                      aria-label={`${name} (indisponível)`}
                      title="Em breve"
                      className={`grid size-7 place-items-center rounded border border-primary text-primary ${soon}`}
                    >
                      <SocialIcon className="size-3.5" />
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-bold">Carteiras compatíveis</h2>
            <p className="inline-block rounded border border-primary px-2 py-1 text-[10px] tracking-wider text-primary">
              METAMASK · WALLETCONNECT · COINBASE
            </p>
          </div>
        </div>
      </div>

      <p className="bg-band px-6 py-3 text-center text-xs text-muted-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const subscribe = useMutation({
    mutationFn: async (value: string) => {
      await api.post('/newsletter', { email: value })
    },
    onSuccess: () => setEmail(''),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    subscribe.mutate(email)
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="newsletter-titulo" className="space-y-3 p-6">
      <h2 id="newsletter-titulo" className="font-bold leading-tight">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Receber novidades
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={subscribe.isError}
          className="w-full min-w-0 rounded border border-input bg-background px-3 py-2 text-xs"
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="rounded bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          Enviar
        </button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
      <div aria-live="polite" className="text-xs">
        {subscribe.isSuccess && (
          <p className="text-primary">Inscrição simulada: nenhum e-mail será enviado.</p>
        )}
        {subscribe.isError && (
          <p role="alert" className="text-destructive">
            {errorMessage(subscribe.error)}
          </p>
        )}
      </div>
    </form>
  )
}
