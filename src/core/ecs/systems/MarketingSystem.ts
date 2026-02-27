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
 *   4 = PR Campaign   → Mitigates bad news, protects share price and reputation
 *
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

const TICKS_PER_DAY = 30
const TICKS_PER_MONTH = 900 // 30 days * 30 ticks

// Campaign effectiveness multipliers: [awarenessGrowth, loyaltyGrowth, costEfficiency, reachMultiplier]
const CAMPAIGN_PROFILES: Record<number, { awareness: number; loyalty: number; cost: number; reach: number }> = {
  0: { awareness: 1.0, loyalty: 0.3, cost: 1.0, reach: 2.0 },  // Mass Media
  1: { awareness: 0.8, loyalty: 0.5, cost: 0.6, reach: 1.2 },  // Digital
  2: { awareness: 0.4, loyalty: 1.5, cost: 2.0, reach: 0.3 },  // Premium
  3: { awareness: 0.6, loyalty: 0.2, cost: 0.3, reach: 0.5 },  // Guerilla
  4: { awareness: 0.2, loyalty: 0.8, cost: 1.5, reach: 0.4 },  // PR Campaign
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
  const isNewDay = world.tick % TICKS_PER_DAY === 0
  const isNewMonth = world.tick % TICKS_PER_MONTH === 0

  if (!isNewDay) return world

  const marketingQuery = defineQuery([Building, MarketingOffice, Company])
  const entities = marketingQuery(world.ecsWorld)

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

    // ─── Financial Deduction (prorated monthly) ───
    if (spending > 0 && isNewMonth) {
      const monthlyCost = Math.floor(spending * campaign.cost)
      Finances.cash[companyId] -= monthlyCost
      if (companyId === world.playerEntityId) {
        world.cash -= monthlyCost
      }
    }

    // Find or create the brand entity
    const brandEntity = findOrCreateProductBrand(world, companyId, productId)

    // ─── Awareness Growth (Daily) ───
    if (spending > 0) {
      // Growth scales: $10K monthly = 1.0 base factor, diminishing returns above
      const spendFactorDay = Math.sqrt(spending / 1_000_000) / 30 
      const efficiencyMult = (efficiency / 100) * 1.5 
      const directive = Company.strategicDirective[companyId] || 0
      let directiveAwarenessMult = 1.0
      if (directive === 2) directiveAwarenessMult = 1.1 // Market Aggression

      // Brand Equity Multiplier: Higher global reputation makes ads more effective
      const globalReputation = Company.reputation[companyId] || 50
      const brandEquityMult = 0.8 + (globalReputation / 250) // 0.8x to 1.2x effectiveness

      const rawAwarenessGrowth = spendFactorDay * campaign.awareness * demBonus.awarenessBoost * efficiencyMult * directiveAwarenessMult * brandEquityMult
      const currentAwareness = ProductBrand.awareness[brandEntity]
      const diminishingFactor = 1 - (currentAwareness / 120) 
      const finalAwarenessGrowth = Math.max(0, rawAwarenessGrowth * diminishingFactor)
      ProductBrand.awareness[brandEntity] = Math.min(100, currentAwareness + finalAwarenessGrowth)
      
      const cmoDir = Company.cmoDirective[companyId] || 0;
      if (cmoDir === 1 && Math.random() < 0.08) {
         // Corporate Trust Campaign: CMO focuses on long-term brand equity
         // This is a premium "Management Expert" feature: building the "Moat"
         Company.reputation[companyId] = Math.min(100, (Company.reputation[companyId] || 50) + 0.15);
      }
    }

    // ─── Monthly Deep Metrics (Loyalty, Reach, PR) ───
    if (isNewMonth && spending > 0) {
      const spendFactor = Math.sqrt(spending / 1_000_000)
      const efficiencyMult = (efficiency / 100) * 1.5 // 0 eff → 0, 100 eff → 1.5x

      // 1. Awareness Growth (Removed from monthly because it's daily now)
      // 1. Loyalty Growth (slower, requires sustained campaigns)
      const directive = Company.strategicDirective[companyId] || 0
      let directiveLoyaltyMult = 1.0
      if (directive === 1) directiveLoyaltyMult = 1.1 // Quality Leadership builds loyalty faster

      const rawLoyaltyGrowth = spendFactor * campaign.loyalty * demBonus.loyaltyBoost * efficiencyMult * 0.5 * directiveLoyaltyMult
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

      // 6. PR Campaign: Crisis Mitigation (New)
      if (campaignType === 4 && spending > 100000) { // $1K+ min for PR impact
        const alerts = world.techAlerts.get(companyId);
        if (alerts && alerts.size > 0) {
            // PR works by 'spinning' the news, reducing the panic penalty
            // We'll store a "PR Shield" value in a new property (or reputation)
            const prPower = Math.min(1.0, Math.sqrt(spending / 10_000_000)); 
            
            // Boost reputation faster during crises to counteract bad PR
            Company.reputation[companyId] = Math.min(100, (Company.reputation[companyId] || 50) + (prPower * 5));
        }
        
        const cmoDir = Company.cmoDirective[companyId] || 0;

        // ─── DISINFORMATION CAMPAIGN (ATTACK LEADER) ───
        // If it's a PR campaign but no internal crisis exists, and demographic is 'All' (0), OR cmoDir is 3 (Aggressive)
        // It acts as a smear campaign against the market leader
        if ((demographic === 0 && spending > 500000 && (!alerts || alerts.size === 0)) || cmoDir === 3) {
            // Find market leader
            let leaderId = companyId;
            let highestShare = ProductBrand.marketShare[brandEntity] || 0;
            
            const brandQuery = defineQuery([ProductBrand]);
            brandQuery(world.ecsWorld).forEach(bid => {
                if (ProductBrand.productId[bid] === productId) {
                    const share = ProductBrand.marketShare[bid] || 0;
                    if (share > highestShare) {
                        highestShare = share;
                        leaderId = ProductBrand.companyId[bid];
                    }
                }
            });

            if (leaderId !== companyId && highestShare > 30) {
                // Success chance based on spending vs leader's reputation
                const leaderRep = Company.reputation[leaderId] || 50;
                let attackPower = Math.min(0.8, spending / 10_000_000);
                if (cmoDir === 3) attackPower += 0.2; // Extra power for explicit directive
                
                if (Math.random() < attackPower && leaderRep > 20) {
                    const dmg = 4 + Math.floor(Math.random() * 6); // 4-10 rep damage
                    Company.reputation[leaderId] = Math.max(0, leaderRep - dmg);
                    
                    if (Math.random() < 0.3) { // 30% chance to make the news
                        const pName = world.dataStore.getProduct(productId)?.name || 'product';
                        const leaderName = leaderId === world.playerEntityId ? 'Player' : `Competitor ${leaderId}`;
                        world.newsFeed.unshift({
                            id: `smear_${companyId}_${world.tick}`,
                            type: 'market',
                            title: 'Corporate Smear Campaign',
                            content: `A highly funded anonymous PR campaign has severely damaged the public image of ${leaderName} in the ${pName} sector.`,
                            timestamp: Date.now()
                        });
                        if (world.newsFeed.length > 50) world.newsFeed.pop();
                    }
                }
            }
        }
      }

      // ─── VIRAL MARKETING (GUERRILLA SPIKE) ───
      // Guerrilla marketing (type 3) has a small chance to go massive
      if (campaignType === 3 && Math.random() < 0.05) { // 5% chance per month
          ProductBrand.awareness[brandEntity] = Math.min(100, ProductBrand.awareness[brandEntity] + 15);
          ProductBrand.loyalty[brandEntity] = Math.min(100, ProductBrand.loyalty[brandEntity] + 5);
          
          if (Math.random() < 0.5) { // 50% chance to log
             const pName = world.dataStore.getProduct(productId)?.name || 'product';
             const compName = companyId === world.playerEntityId ? 'Player' : `Competitor ${companyId}`;
             world.newsFeed.unshift({
                  id: `viral_${companyId}_${world.tick}`,
                  type: 'market',
                  title: 'Viral Sensation!',
                  content: `${compName}'s guerrilla marketing campaign for their ${pName} has gone totally viral on social media!`,
                  timestamp: Date.now()
              });
              if (world.newsFeed.length > 50) world.newsFeed.pop();
          }
      }
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
    const loyalty = ProductBrand.loyalty[brandId] || 0
    let decayRate = 0.02 * (1 - loyalty / 200) // High loyalty slows decay
    
    const companyId = ProductBrand.companyId[brandId];
    const cmoDir = Company.cmoDirective[companyId] || 0;
    if (cmoDir === 2) {
       // Greenwashing builds a huge false cushion of trust, drastically reducing awareness decay
       decayRate *= 0.25; 
       // but it slowly eats cash every month (handled in monthly tick below, but we calculate here per-brand daily)
       if (isNewDay) {
           Finances.cash[companyId] -= 33333; // ~1m a month divided by 30 across all brands (simplified)
       }
    } else if (cmoDir === 1 && isNewDay) { // Corporate
         Finances.cash[companyId] -= 16666; // 500k a month
    } else if (cmoDir === 3 && isNewDay) { // Aggressive
         Finances.cash[companyId] -= 66666; // 2m a month
    }

    if (ProductBrand.awareness[brandId] > 0) {
      ProductBrand.awareness[brandId] = Math.max(0, ProductBrand.awareness[brandId] - decayRate)
    }

    // Loyalty decays very slowly
    let loyaltyDecay = 0.003;
    if (cmoDir === 3) loyaltyDecay += 0.005; // Aggressive PR turns off loyal customers over time
    if (ProductBrand.loyalty[brandId] > 0) {
      ProductBrand.loyalty[brandId] = Math.max(0, ProductBrand.loyalty[brandId] - loyaltyDecay)
    }
  }

  // ─── Market Share Calculation (monthly) ───
  if (isNewMonth) {
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
