import { defineQuery } from 'bitecs'
import { Company, Finances, Stock, Building, Maintenance, CompanyTechnology } from '../components'
import { GameWorld } from '../world'
import { getEconomicCycle } from './MacroUtils'

/**
 * StockMarketSystem — Corporate Valuation Engine
 *
 * Updates share prices based on real fundamentals from the ECS.
 * Runs on two cadences:
 *   - Daily (30 ticks): Market noise, volume, momentum
 *   - Monthly (900 ticks): Fundamental revaluation (EPS, P/E, dividends)
 *
 * Valuation Model:
 *   1. Earnings Per Share (EPS) = Net Income / Shares Outstanding
 *   2. Industry P/E ratio (sector-adjusted, cycle-modified)
 *   3. Target Price = EPS * P/E (or Book Value floor)
 *   4. Price moves toward target with momentum + noise
 *   5. P/E compression during recessions, expansion during booms
 *
 * This system also powers:
 *   - StockTicker HUD component (reads Stock.sharePrice, Stock.prevSharePrice)
 *   - StockTrading component (reads all Stock fields)
 *   - Dashboard KPIs (reads Company.marketCap)
 */

const TICKS_PER_DAY = 30
const TICKS_PER_MONTH = 900

// Sector-specific base P/E ratios (higher = growth, lower = value)
const SECTOR_PE: Record<number, { base: number; label: string }> = {
  0: { base: 15.0, label: 'Conglomerate' },
  1: { base: 28.0, label: 'Technology' },
  2: { base: 20.0, label: 'Consumer' },
  3: { base: 14.0, label: 'Industrial' },
  4: { base: 12.0, label: 'Finance' },
  5: { base: 16.0, label: 'Energy' },
}

export const stockMarketSystem = (world: GameWorld) => {
  const companyQuery = defineQuery([Company, Finances, Stock])
  const companies = companyQuery(world.ecsWorld)

  if (companies.length === 0) return world

  const isNewDay = world.tick % TICKS_PER_DAY === 0
  const isNewMonth = world.tick % TICKS_PER_MONTH === 0

  const { isRecession, isBoom, valuationMultiple: cycleValMult } = getEconomicCycle(world.tick)

  // ═══════════════════════════════════════════════════════════════════════
  //  1. MONTHLY FUNDAMENTAL REVALUATION
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    // Pre-compute total assets per company (sum of building values)
    const buildingQuery = defineQuery([Building, Company, Maintenance])
    const buildingEntities = buildingQuery(world.ecsWorld)

    const companyAssets = new Map<number, number>()
    const companyBuildingCount = new Map<number, number>()

    for (const bId of buildingEntities) {
      const cId = Company.companyId[bId]
      if (cId === 0) continue
      const upkeep = Maintenance.monthlyCost[bId] || 0
      // Rough asset value: monthly upkeep * 120 (10 year payback)
      const assetValue = upkeep * 120
      companyAssets.set(cId, (companyAssets.get(cId) || 0) + assetValue)
      companyBuildingCount.set(cId, (companyBuildingCount.get(cId) || 0) + 1)
    }

    // Pre-compute company tech level (average across all products)
    const techQuery = defineQuery([CompanyTechnology])
    const techEntities = techQuery(world.ecsWorld)
    const companyAvgTech = new Map<number, number>()
    const compTechCounts = new Map<number, number>()

    for (const tId of techEntities) {
      const cId = CompanyTechnology.companyId[tId]
      const level = CompanyTechnology.techLevel[tId]
      companyAvgTech.set(cId, (companyAvgTech.get(cId) || 0) + level)
      compTechCounts.set(cId, (compTechCounts.get(cId) || 0) + 1)
    }

    for (const [cId, total] of companyAvgTech) {
      const count = compTechCounts.get(cId) || 1
      companyAvgTech.set(cId, total / count)
    }

    for (const id of companies) {
      const compId = Company.companyId[id]
      const shares = Stock.sharesOutstanding[id]
      if (shares === 0) continue

      // Snapshot previous price for change tracking
      Stock.prevSharePrice[id] = Stock.sharePrice[id]

      // ─── Calculate EPS ───
      const netIncome = Company.netIncomeLastMonth[id] || 0
      const annualizedIncome = netIncome * 12
      const eps = annualizedIncome / shares
      Stock.earningsPerShare[id] = eps

      // ─── Determine P/E Ratio ───
      const sectorId = Stock.sector[id] || 0
      const sectorData = SECTOR_PE[sectorId] || SECTOR_PE[0]
      let targetPE = sectorData.base

      // Cycle adjustment: In booms P/E expands, in recessions it compresses
      // ─── HIGH-TECH RESILIENCE ───
      // Technology companies (Sector 1) or companies with high average tech (> 100)
      // are more resilient to recessionary valuation compression.
      const avgTech = companyAvgTech.get(compId) || 40
      const isHighTech = sectorId === 1 || avgTech > 100
      
      let effectiveCycleMult = cycleValMult
      if (isHighTech && isRecession) {
        // High tech only takes 50% of the recession hit
        effectiveCycleMult = cycleValMult + (1.0 - cycleValMult) * 0.5
      } else if (isHighTech && isBoom) {
        // High tech gets extra premium in booms
        effectiveCycleMult *= 1.2
      }

      targetPE *= effectiveCycleMult

      // Growth adjustment: If revenue is growing, P/E expands
      const revenue = Company.revenueLastMonth[id] || 0
      if (revenue > 0 && netIncome > 0) {
        const margin = netIncome / revenue
        targetPE *= 1 + Math.min(0.5, margin) // Up to 50% P/E boost for high margins
      } else if (netIncome < 0) {
        targetPE *= 0.6 // P/E compression for loss-making companies
      }

      // Reputation bonus (0-100 reputation maps to 0.9-1.1 P/E modifier)
      const repMod = 0.9 + (Company.reputation[id] / 500)
      targetPE *= repMod

      // Smooth P/E transition (don't whipsaw)
      const currentPE = Stock.peRatio[id] || targetPE
      Stock.peRatio[id] = currentPE + (targetPE - currentPE) * 0.3

      // ─── Calculate Target Price ───
      let targetPrice: number

      if (eps > 0) {
        // Profitable: Price = EPS * P/E
        targetPrice = eps * Stock.peRatio[id]
      } else {
        // Unprofitable: Fall back to book value
        const totalAssets = companyAssets.get(compId) || 0
        const cash = Finances.cash[id]
        const bookValue = Math.max(0, totalAssets + cash)
        const bookPerShare = bookValue / shares

        // Discount unprofitable companies to 60% of book
        targetPrice = bookPerShare * 0.6

        // But floor at some minimum based on assets
        targetPrice = Math.max(targetPrice, 100) // Minimum $1.00 (in cents)
      }

      // ─── Move Price Toward Target ───
      const currentPrice = Stock.sharePrice[id]
      const momentum = 0.2 // How fast price converges (higher = faster)

      // Add market noise (±3%)
      const noise = 1 + (Math.random() - 0.5) * 0.06

      const newPrice = (currentPrice + (targetPrice - currentPrice) * momentum) * noise

      Stock.sharePrice[id] = Math.max(1, newPrice) // Floor: $0.01

      // ─── Update Market Cap ───
      Company.marketCap[id] = Stock.sharePrice[id] * shares

      // ─── Simulate Volume ───
      // Higher volatility = higher volume
      const priceChange = Math.abs(newPrice - currentPrice) / currentPrice
      const baseVolume = shares * 0.02 // 2% of float
      Stock.volume[id] = Math.floor(baseVolume * (1 + priceChange * 100))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  2. DAILY MICRO-MOVEMENTS (Market Noise + Intraday)
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewDay && !isNewMonth) {
    for (const id of companies) {
      const shares = Stock.sharesOutstanding[id]
      if (shares === 0) continue

      const currentPrice = Stock.sharePrice[id]

      // Small daily drift: ±0.5% random walk
      const dailyVolatility = isRecession ? 0.012 : (isBoom ? 0.006 : 0.008)
      const drift = (Math.random() - 0.5) * 2 * dailyVolatility

      // Mean-reversion tendency: if price diverged from EPS*PE target, gently pull back
      const eps = Stock.earningsPerShare[id]
      const pe = Stock.peRatio[id]
      let pullback = 0
      if (eps > 0 && pe > 0) {
        const targetPrice = eps * pe
        const divergence = (currentPrice - targetPrice) / targetPrice
        pullback = -divergence * 0.02 // 2% of divergence per day
      }

      const newPrice = currentPrice * (1 + drift + pullback)
      Stock.sharePrice[id] = Math.max(1, newPrice)

      // Update market cap daily too
      Company.marketCap[id] = Stock.sharePrice[id] * shares

      // Daily volume (lower than monthly rebalance day)
      Stock.volume[id] = Math.floor((Stock.volume[id] || shares * 0.01) * (0.3 + Math.random() * 0.4))
    }
  }

  return world
}
