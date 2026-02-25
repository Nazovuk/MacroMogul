import { GameWorld } from '../world'
import i18n from '@/i18n'

/**
 * EventSystem — Narrative and Simulation Event Pipeline
 * 
 * Logic:
 * 1. Listen for technology milestones, obsolescence alerts, and market shifts.
 * 2. Generate narrative events (News) that inform the player.
 * 3. Apply temporary global or company-specific modifiers.
 */

export interface GameEvent {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'danger' | 'success'
  timestamp: number
  companyId?: number
  productId?: number
}

const EVENT_QUEUE: GameEvent[] = []

export const eventSystem = (world: GameWorld) => {
  // --- 1. Detect Technology Breakthroughs (Global or Company) ---
  // (In a future update, we can track who hit a new tech level first)

  // --- 2. Process Monthly Global Tech News ---
  if (world.tick % 900 === 0 && world.tick > 0) {
    generateMonthlyMarketNews(world)
  }

  // --- 3. Process Obsolescence Crisis News ---
  if (world.tick % 450 === 0) {
     checkObsolescenceCrises(world)
  }

  return world
}

function generateMonthlyMarketNews(world: GameWorld) {
    // Pick the highest tech product to feature
    let leadingProduct = -1
    let maxTech = 0
    
    for (const [pid, level] of world.globalProductTech) {
        if (level > maxTech) {
            maxTech = level
            leadingProduct = pid
        }
    }

    if (leadingProduct !== -1) {
        const pData = world.dataStore.getProduct(leadingProduct)
        if (pData) {
            pushEvent({
                id: `tech-summit-${world.tick}`,
                title: i18n.t('events.tech_summit_title'),
                message: i18n.t('events.tech_summit_msg', { product: pData.name, level: maxTech }),
                type: 'info',
                timestamp: Date.now()
            })
        }
    }
}

function checkObsolescenceCrises(world: GameWorld) {
    // Check player's alerts
    const playerAlerts = world.techAlerts.get(world.playerEntityId)
    if (playerAlerts && playerAlerts.size > 0) {
        // Find one product to warn about
        const alertArray = Array.from(playerAlerts)
        const warningProductId = alertArray.length > 0 ? alertArray[0] : -1

        const pData = world.dataStore.getProduct(warningProductId)
        if (pData) {
            pushEvent({
                id: `obsolescence-warning-${world.tick}`,
                title: i18n.t('events.obsolescence_warning_title'),
                message: i18n.t('events.obsolescence_warning_msg', { product: pData.name }),
                type: 'danger',
                timestamp: Date.now(),
                companyId: world.playerEntityId,
                productId: warningProductId
            })
        }
    }
}

export function pushEvent(event: GameEvent) {
    EVENT_QUEUE.push(event)
    if (EVENT_QUEUE.length > 50) EVENT_QUEUE.shift() // Keep only recent 50

    // Dispatch for UI
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-notification', {
            detail: event
        }))
    }
}

export function getRecentEvents(): GameEvent[] {
    return [...EVENT_QUEUE].reverse()
}
