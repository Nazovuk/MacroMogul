import { defineQuery } from 'bitecs'
import { Factory, ProductionOutput, Company } from '../components'
import { GameWorld, getGlobalTechLevel, getCompetitorAvgTechLevel } from '../world'

/**
 * TechSystem handles product obsolescence and tech alerts.
 * 
 * Logic:
 * 1. Calculate global tech leader per product (world's highest)
 * 2. Apply obsolescence penalties to factories behind global tech
 * 3. Apply market attractiveness penalties when behind competitors
 * 4. Set tech alerts for UI feedback
 */

const OBSOLESCENCE_PENALTY_PER_LEVEL = 2 // % efficiency loss per tech level behind
const MARKET_ATTRACTIVENESS_PENALTY_PER_LEVEL = 1.5 // % penalty per level behind competitors
const TECH_ALERT_THRESHOLD = 15 // Tech levels behind triggers alert

export const techSystem = (world: GameWorld) => {
  // --- Reset tech alerts for this tick ---
  world.techAlerts.clear()

  const factoryQuery = defineQuery([Factory, ProductionOutput, Company])
  const factories = factoryQuery(world.ecsWorld)

  for (const fid of factories) {
    const ownerId = Company.companyId[fid]
    const recipeId = Factory.recipeId[fid]
    
    if (ownerId === 0 || recipeId === 0) continue
    
    // Get company tech level for this product
    const companyTech = world.techLookup.get(ownerId)?.get(recipeId) || 40
    
    // Get global highest tech for this product
    const globalTech = getGlobalTechLevel(world, recipeId)
    
    // Get competitor average for this product
    const competitorAvg = getCompetitorAvgTechLevel(world, recipeId, ownerId)

    // --- Global Obsolescence Penalty ---
    // If company tech is below global leader, apply efficiency penalty
    if (globalTech > companyTech) {
      const diff = globalTech - companyTech
      const penalty = diff * OBSOLESCENCE_PENALTY_PER_LEVEL
      
      const currentEff = Factory.efficiency[fid] || 100
      Factory.efficiency[fid] = Math.max(10, currentEff - penalty)
      
      // Quality ceiling based on tech level
      const qualityCap = Math.min(100, Math.floor(companyTech / 10 + 20))
      const currentQuality = Factory.quality[fid] || 50
      Factory.quality[fid] = Math.min(currentQuality, qualityCap)
      
      // Debug log
      if (ownerId === world.playerEntityId && penalty > 0) {
        console.log(`[TechSystem] ⚠️ Factory ${fid} obsolescence! Company: ${companyTech}, Global: ${globalTech}, Penalty: -${penalty.toFixed(1)}%`)
      }
    }

    // --- Competitor-Based Market Attractiveness Penalty ---
    // If company tech is significantly behind competitors, apply market penalty
    const competitorDiff = competitorAvg - companyTech
    if (competitorDiff > 5) {
      const marketPenalty = Math.floor(competitorDiff * MARKET_ATTRACTIVENESS_PENALTY_PER_LEVEL)
      // Apply to efficiency (represents reduced demand for outdated products)
      const currentEff = Factory.efficiency[fid] || 100
      Factory.efficiency[fid] = Math.max(5, currentEff - marketPenalty)
      
      if (ownerId === world.playerEntityId) {
        console.log(`[TechSystem] 📉 Factory ${fid} behind competitors! CompAvg: ${competitorAvg}, Your: ${companyTech}, Penalty: -${marketPenalty}%`)
      }
    }

    // --- Tech Alert System ---
    // Flag products that need R&D investment
    const alertDiff = globalTech - companyTech
    if (alertDiff >= TECH_ALERT_THRESHOLD) {
      // Set alert for this company's product - use Map<companyId, Set<productId>>
      let alertSet = world.techAlerts.get(ownerId)
      if (!alertSet) {
        alertSet = new Set<number>()
        world.techAlerts.set(ownerId, alertSet)
      }
      alertSet.add(recipeId)
      
      if (ownerId === world.playerEntityId) {
        console.log(`[TechSystem] 🚨 ALERT: Product ${recipeId} needs R&D! Gap: ${alertDiff} levels`)
      }
    }
  }

  return world
}

/**
 * Get all products needing R&D for a company
 */
export function getTechAlertsForCompany(world: GameWorld, companyId: number): number[] {
  const alertSet = world.techAlerts.get(companyId)
  if (!alertSet) return []
  return Array.from(alertSet)
}

/**
 * Check if a specific product needs R&D investment for a company
 */
export function hasTechAlert(world: GameWorld, companyId: number, productId: number): boolean {
  return world.techAlerts.get(companyId)?.has(productId) || false
}

/**
 * Get tech gap information for UI display
 */
export function getTechGapInfo(world: GameWorld, companyId: number, productId: number) {
  const companyLevel = world.techLookup.get(companyId)?.get(productId) || 40
  const globalLevel = getGlobalTechLevel(world, productId)
  const competitorAvg = getCompetitorAvgTechLevel(world, productId, companyId)
  
  return {
    hasAlert: globalLevel - companyLevel >= TECH_ALERT_THRESHOLD,
    companyLevel,
    globalLevel,
    competitorAvg,
    gap: globalLevel - companyLevel
  }
}
