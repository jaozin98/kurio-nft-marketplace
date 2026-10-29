import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { favoriteHandlers } from './favorites'
import { newsletterHandlers } from './newsletter'
import { nftHandlers } from './nfts'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'
import { socketHandlers } from '../realtime'
import { walletHandlers } from './wallets'

export const handlers = [
  ...nftHandlers,
  ...authHandlers,
  ...profileHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...walletHandlers,
  ...orderHandlers,
  ...newsletterHandlers,
  ...socketHandlers,
]
