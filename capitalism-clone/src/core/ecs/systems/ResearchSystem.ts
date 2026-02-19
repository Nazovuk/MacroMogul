import { defineQuery, addEntity, addComponent } from 'bitecs'
import { 
  Building, 
  ResearchCenter, 
  Company, 
  CompanyTechnology,
  Finances,
  CityEconomicData,
  Position,
} from '../components'
import { GameWorld } from '../world'

/**
 * ResearchSystem — Technology Advancement Engine
 *
 * Handles product-specific R&D with:
 *   1. Scaling costs: Higher tech levels cost exponentially more
 *   2. Innovation speed: Based on spending, efficiency, and city talent pool
 *   3. Breakthrough tiers: Each tier unlocks quality/production bonuses
 *   4. Diminishing returns: Late-stage research progresses slower
 *   5. Spillover effects: Adjacent product research provides small bonus
 *
 * Tech Level Scale (per product per company):
 *   0-30   = Basic (commodity quality)
 *   31-60  = Standard (average quality)
 *   61-90  = Advanced (premium quality)
 *   91-120 = Cutting Edge (best-in-class)
 *   121+   = Revolutionary (market disruption potential)
 *
 * Data Flow:
 *   ResearchCenter.efficiency → innovation speed
 *   CompanyTechnology.techLevel → ProductionSystem quality
 *   CompanyTechnology.techLevel → StockMarketSystem PE premium
 *   CityEconomicData.unemployment → talent availability bonus
 */

// Innovation points required per breakthrough tier
const BREAKTHROUGH_THRESHOLDS = [
  800,   // Tier 1: Basic → Standard
  1200,  // Tier 2: Standard improvements
  1800,  // Tier 3: Advanced
  2500,  // Tier 4: Cutting edge
  4000,  // Tier 5+: Revolutionary (repeating)
]

// Monthly base research cost (in cents) per tier
const BASE_RESEARCH_COSTS = [
  500_000,    // $5K/month (Basic R&D)
  800_000,    // $8K/month
  1_500_000,  // $15K/month
  3_000_000,  // $30K/month
  5_000_000,  // $50K/month (Revolutionary)
]

export const researchSystem = (world: GameWorld) => {
  const rdQuery = defineQuery([Building, ResearchCenter, Company, Position])
  const entities = rdQuery(world.ecsWorld)

  // Cache city data for talent pool bonus
  const cityQuery = defineQuery([CityEconomicData, Position])
  const cityEntities = cityQuery(world.ecsWorld)
  const cityTalent = new Map<number, number>()
  for (const cid of cityEntities) {
    const unemployment = CityEconomicData.unemployment[cid] || 6
    const pop = CityEconomicData.population[cid] || 500000
    // High unemployment with large population = larger talent pool = easier hiring for R&D
    // Large cities with moderate unemployment are best for R&D
    const talentScore = Math.min(1.5, (pop / 1_000_000) * 0.3 + (unemployment > 3 ? 0.1 : 0) + 0.7)
    cityTalent.set(Position.cityId[cid], talentScore)
  }

  // Count active research projects per company (for spillover calc)
  const projectsPerCompany = new Map<number, Set<number>>()
  for (const id of entities) {
    if (Building.isOperational[id] === 0) continue
    const productId = ResearchCenter.researchingProductId[id]
    if (productId === 0) continue

    const companyId = Company.companyId[id]
    if (!projectsPerCompany.has(companyId)) projectsPerCompany.set(companyId, new Set())
    projectsPerCompany.get(companyId)!.add(productId)
  }

  for (const id of entities) {
    if (Building.isOperational[id] === 0) continue

    const productId = ResearchCenter.researchingProductId[id]
    if (productId === 0) continue // Idle

    const companyId = Company.companyId[id]
    
    // Get current tech level for this company+product
    const techEntity = findOrCreateCompanyTech(world, companyId, productId)
    const currentTechLevel = CompanyTechnology.techLevel[techEntity]

    // Determine current tier (0-4+)
    const tier = Math.min(4, Math.floor(currentTechLevel / 30))

    // ─── Financial Deduction (prorated daily) ───
    const monthlyCost = BASE_RESEARCH_COSTS[tier] || BASE_RESEARCH_COSTS[4]
    if (world.tick % 30 === 0) {
      const dailyCost = Math.floor(monthlyCost / 30)
      Finances.cash[companyId] -= dailyCost
      
      // Track as expense
      Company.expensesLastMonth[companyId] = (Company.expensesLastMonth[companyId] || 0) + dailyCost

      if (companyId === world.playerEntityId) {
        world.cash -= dailyCost
      }
    }

    // ─── Innovation Speed Calculation ───
    // Base speed from ResearchCenter efficiency
    const baseSpeed = 3 + (ResearchCenter.efficiency[id] / 10) // 3-13 base

    // Talent pool bonus from city
    const cityId = Position.cityId[id]
    const talentMult = cityTalent.get(cityId) || 1.0

    // Spillover bonus: having multiple products researched gives 5% per extra project
    const activeProjects = projectsPerCompany.get(companyId)?.size || 1
    const spilloverMult = 1 + Math.min(0.25, (activeProjects - 1) * 0.05) // Max 25% bonus

    // Diminishing returns at high tech levels
    // Speed inversely proportional to sqrt of current level
    const diminishingFactor = Math.max(0.3, 1 / Math.sqrt(Math.max(1, currentTechLevel / 40)))

    // Final innovation speed
    const speed = baseSpeed * talentMult * spilloverMult * diminishingFactor

    ResearchCenter.innovationPoints[id] += speed

    // ─── Breakthrough Logic ───
    const threshold = BREAKTHROUGH_THRESHOLDS[tier] || BREAKTHROUGH_THRESHOLDS[4]

    if (ResearchCenter.innovationPoints[id] >= threshold) {
      ResearchCenter.innovationPoints[id] = 0
      
      // Tech level increase varies by tier (harder tiers give bigger jumps)
      const levelGain = tier < 3 ? 10 : (tier < 4 ? 8 : 5) // Smaller gains at top
      CompanyTechnology.techLevel[techEntity] += levelGain
      
      // Reputation boost for breakthroughs (visible company innovation)
      const currentRep = Company.reputation[companyId] || 50
      if (currentRep < 95) {
        Company.reputation[companyId] = Math.min(100, currentRep + 2)
      }
      
      console.log(
        `[Research] Breakthrough! Company ${companyId} → Tech Level ${CompanyTechnology.techLevel[techEntity]} ` +
        `for Product ${productId} (Tier ${tier + 1}, +${levelGain}pts)`
      )
    }
    
    // ─── UI Progress (0-100) ───
    ResearchCenter.progress[id] = Math.floor((ResearchCenter.innovationPoints[id] / threshold) * 100)
  }

  return world
}

// ═══════════════════════════════════════════════════════════════════════
//  TECH ENTITY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
const findOrCreateCompanyTech = (world: GameWorld, companyId: number, productId: number): number => {
  const techQuery = defineQuery([CompanyTechnology])
  const techEntities = techQuery(world.ecsWorld)

  for (const id of techEntities) {
    if (CompanyTechnology.companyId[id] === companyId && CompanyTechnology.productId[id] === productId) {
      return id
    }
  }

  const newEntity = addEntity(world.ecsWorld)
  addComponent(world.ecsWorld, CompanyTechnology, newEntity)
  CompanyTechnology.companyId[newEntity] = companyId
  CompanyTechnology.productId[newEntity] = productId
  CompanyTechnology.techLevel[newEntity] = 40 // Starting baseline
  
  return newEntity
}
