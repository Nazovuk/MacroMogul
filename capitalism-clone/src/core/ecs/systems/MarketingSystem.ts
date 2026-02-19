import { defineQuery, addEntity, addComponent } from 'bitecs'
import { Building, MarketingOffice, Company, ProductBrand, Finances } from '../components'
import { GameWorld } from '../world'

/**
 * MarketingSystem — Brand Awareness & Campaign Engine
 *
 * Simulates multi-channel marketing campaigns that build brand awareness,
 * customer loyalty, and market share over time.
 *
 * Campaign Types:
 *   0 = Mass Media    → High reach, moderate cost, broad demographic
 *   1 = Digital       → Targeted, cost-effective, strong ROI tracking
 *   2 = Premium       → Low reach but high loyalty conversion (luxury brands)
 *   3 = Guerilla      → Cheap, viral potential, random effectiveness
 *
 * Data Flow:
 *   MarketingOffice.spending → brand awareness growth
 *   ProductBrand.awareness → RetailSystem demand multiplier
 *   ProductBrand.loyalty → customer retention & premium pricing power
 *   ProductBrand.marketShare → competitive positioning
 *
 * Cadence:
 *   - Daily (every tick): Awareness decay, loyalty maintenance
 *   - Monthly (30 ticks): Campaign effects, ROI calculation, market share update
 */

const TICKS_PER_MONTH = 30

// Campaign effectiveness multipliers: [awarenessGrowth, loyaltyGrowth, costEfficiency, reachMultiplier]
const CAMPAIGN_PROFILES: Record<number, { awareness: number; loyalty: number; cost: number; reach: number }> = {
  0: { awareness: 1.0, loyalty: 0.3, cost: 1.0, reach: 2.0 },  // Mass Media
  1: { awareness: 0.8, loyalty: 0.5, cost: 0.6, reach: 1.2 },  // Digital
  2: { awareness: 0.4, loyalty: 1.5, cost: 2.0, reach: 0.3 },  // Premium
  3: { awareness: 0.6, loyalty: 0.2, cost: 0.3, reach: 0.5 },  // Guerilla
}

// Demographic targeting bonuses (when campaign matches target)
const DEMOGRAPHIC_BONUSES: Record<number, { awarenessBoost: number; loyaltyBoost: number }> = {
  0: { awarenessBoost: 1.0, loyaltyBoost: 1.0 },  // All (no bonus, no penalty)
  1: { awarenessBoost: 1.3, loyaltyBoost: 0.8 },  // Youth (viral, less loyal)
  2: { awarenessBoost: 1.1, loyaltyBoost: 1.2 },  // Adults (balanced)
  3: { awarenessBoost: 0.6, loyaltyBoost: 1.8 },  // Premium (small but devoted)
  4: { awarenessBoost: 1.4, loyaltyBoost: 0.6 },  // Budget (wide, less loyal)
}

export const marketingSystem = (world: GameWorld) => {
  const marketingQuery = defineQuery([Building, MarketingOffice, Company])
  const entities = marketingQuery(world.ecsWorld)

  const isMonthEnd = world.tick % TICKS_PER_MONTH === 0 && world.tick > 0

  // Track total ad spend per product+company for market share calculation
  const adSpendByProduct = new Map<string, { entityId: number; spend: number; awareness: number }[]>()

  for (const id of entities) {
    if (Building.isOperational[id] === 0) continue

    const productId = MarketingOffice.productId[id]
    if (productId === 0) continue

    const companyId = Company.companyId[id]
    const spending = MarketingOffice.spending[id]
    const campaignType = MarketingOffice.campaignType[id] || 0
    const demographic = MarketingOffice.targetDemographic[id] || 0
    const efficiency = MarketingOffice.efficiency[id] || 50

    const campaign = CAMPAIGN_PROFILES[campaignType] || CAMPAIGN_PROFILES[0]
    const demBonus = DEMOGRAPHIC_BONUSES[demographic] || DEMOGRAPHIC_BONUSES[0]

    // ─── Financial Deduction (prorated daily) ───
    if (spending > 0 && isMonthEnd) {
      const monthlyCost = Math.floor(spending * campaign.cost)
      Finances.cash[companyId] -= monthlyCost
      if (companyId === world.playerEntityId) {
        world.cash -= monthlyCost
      }
    }

    // Find or create the brand entity
    const brandEntity = findOrCreateProductBrand(world, companyId, productId)

    // ─── Campaign Effects (monthly) ───
    if (isMonthEnd && spending > 0) {
      // Growth scales: $10K monthly = 1.0 base factor, diminishing returns above
      const spendFactor = Math.sqrt(spending / 1_000_000) // Diminishing returns
      const efficiencyMult = (efficiency / 100) * 1.5 // 0 eff → 0, 100 eff → 1.5x

      // 1. Awareness Growth
      const rawAwarenessGrowth = spendFactor * campaign.awareness * demBonus.awarenessBoost * efficiencyMult
      const currentAwareness = ProductBrand.awareness[brandEntity]

      // Harder to gain awareness when already high (diminishing returns)
      const diminishingFactor = 1 - (currentAwareness / 120) // At 100, only 17% effective
      const finalAwarenessGrowth = Math.max(0, rawAwarenessGrowth * diminishingFactor)

      ProductBrand.awareness[brandEntity] = Math.min(100, currentAwareness + finalAwarenessGrowth)

      // 2. Loyalty Growth (slower, requires sustained campaigns)
      const rawLoyaltyGrowth = spendFactor * campaign.loyalty * demBonus.loyaltyBoost * efficiencyMult * 0.5
      const currentLoyalty = ProductBrand.loyalty[brandEntity]
      const loyaltyDiminishing = 1 - (currentLoyalty / 130) // Even harder to max
      const finalLoyaltyGrowth = Math.max(0, rawLoyaltyGrowth * loyaltyDiminishing)

      ProductBrand.loyalty[brandEntity] = Math.min(100, currentLoyalty + finalLoyaltyGrowth)

      // 3. Reach Tracking (cumulative impressions)
      const reachGrowth = spendFactor * campaign.reach * 1000 // In thousands
      MarketingOffice.reach[id] = (MarketingOffice.reach[id] || 0) + reachGrowth

      // 4. Track ad spend for market share
      ProductBrand.adSpendThisMonth[brandEntity] = (ProductBrand.adSpendThisMonth[brandEntity] || 0) + spending

      // 5. Company reputation bonus
      const reputation = Company.reputation[companyId] || 50
      ProductBrand.reputationBonus[brandEntity] = Math.floor(reputation / 5) // 0-20 bonus
    }

    // Track for market share calculation
    const key = `${productId}`
    if (!adSpendByProduct.has(key)) adSpendByProduct.set(key, [])
    adSpendByProduct.get(key)!.push({
      entityId: brandEntity,
      spend: spending,
      awareness: ProductBrand.awareness[brandEntity],
    })
  }

  // ─── Brand Decay (every tick, for ALL brands) ───
  const brandQuery = defineQuery([ProductBrand])
  const allBrands = brandQuery(world.ecsWorld)

  for (const brandId of allBrands) {
    // Awareness decays naturally (faster if no spending, slower if loyal)
    const loyalty = ProductBrand.loyalty[brandId] || 0
    const decayRate = 0.02 * (1 - loyalty / 200) // High loyalty slows decay

    if (ProductBrand.awareness[brandId] > 0) {
      ProductBrand.awareness[brandId] = Math.max(0, ProductBrand.awareness[brandId] - decayRate)
    }

    // Loyalty decays very slowly
    if (ProductBrand.loyalty[brandId] > 0) {
      ProductBrand.loyalty[brandId] = Math.max(0, ProductBrand.loyalty[brandId] - 0.003)
    }
  }

  // ─── Market Share Calculation (monthly) ───
  if (isMonthEnd) {
    for (const [, brands] of adSpendByProduct) {
      const totalAwareness = brands.reduce((sum, b) => sum + b.awareness, 0)
      if (totalAwareness <= 0) continue

      for (const brand of brands) {
        // Market share is a weighted function of awareness and spend
        const shareByAwareness = (brand.awareness / totalAwareness) * 100
        ProductBrand.marketShare[brand.entityId] = Math.round(shareByAwareness * 10) / 10
      }
    }

    // Reset monthly ad spend tracking
    for (const brandId of allBrands) {
      ProductBrand.adSpendThisMonth[brandId] = 0
    }
  }

  return world
}

// ═══════════════════════════════════════════════════════════════════════
//  BRAND ENTITY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
const findOrCreateProductBrand = (world: GameWorld, companyId: number, productId: number): number => {
  const brandQuery = defineQuery([ProductBrand])
  const brands = brandQuery(world.ecsWorld)

  for (const id of brands) {
    if (ProductBrand.companyId[id] === companyId && ProductBrand.productId[id] === productId) {
      return id
    }
  }

  const newEntity = addEntity(world.ecsWorld)
  addComponent(world.ecsWorld, ProductBrand, newEntity)
  ProductBrand.companyId[newEntity] = companyId
  ProductBrand.productId[newEntity] = productId
  ProductBrand.awareness[newEntity] = 5  // Base awareness
  ProductBrand.loyalty[newEntity] = 10   // Base loyalty
  ProductBrand.marketShare[newEntity] = 0
  ProductBrand.adSpendThisMonth[newEntity] = 0
  ProductBrand.reputationBonus[newEntity] = 0

  return newEntity
}
