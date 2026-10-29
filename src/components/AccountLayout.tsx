import { Link } from '@tanstack/react-router'
import {
  Bell,
  Download,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { logout } from '@/features/auth/queries'

type Active = 'profile' | 'wallets' | 'favorites'

const items: { key: Active | null; label: string; icon: LucideIcon; to?: '/profile' | '/wallets' | '/favorites' }[] = [
  { key: 'profile', label: 'Dados do perfil', icon: User, to: '/profile' },
  { key: 'wallets', label: 'Carteiras', icon: MapPin, to: '/wallets' },
  { key: null, label: 'Atividade', icon: Wallet },
  { key: 'favorites', label: 'Lista de interesse', icon: Heart, to: '/favorites' },
  { key: null, label: 'Ofertas', icon: Bell },
  { key: null, label: 'Arquivos baixados', icon: Download },
  { key: null, label: 'Suporte', icon: LifeBuoy },
]

// menu lateral das telas de conta (Perfil, Carteiras e Lista de interesse), como no Figma
export function AccountLayout({ active, children }: { active: Active; children: ReactNode }) {
  return (
    <div className="grid gap-8 py-8 lg:grid-cols-[288px_1fr]">
      <nav aria-label="Meu perfil" className="h-fit self-start rounded-lg bg-card">
        <h2 className="px-4 pt-4 text-lg font-bold">Meu perfil</h2>
        <ul className="mt-2">
          {items.map(({ key, label, icon: Icon, to }) => {
            const isActive = key === active
            const row = `flex items-center gap-3 px-4 py-3 text-sm ${
              isActive ? 'border-l-[3px] border-primary bg-secondary text-primary' : 'border-l-[3px] border-transparent text-muted-foreground'
            }`
            return (
              <li key={label}>
                {to ? (
                  <Link to={to} aria-current={isActive ? 'page' : undefined} className={`${row} hover:text-primary`}>
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </Link>
                ) : (
                  // páginas fora do escopo da entrega
                  <span aria-disabled="true" title="Em breve" className={`${row} cursor-not-allowed opacity-60`}>
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </span>
                )}
              </li>
            )
          })}
          <li className="border-t border-border">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 border-l-[3px] border-transparent px-4 py-3 text-left text-sm font-bold text-primary"
            >
              <LogOut aria-hidden className="size-4" />
              Sair
            </button>
          </li>
        </ul>
      </nav>

      <div className="min-w-0">{children}</div>
    </div>
  )
}
