import { defineQuery } from 'bitecs'
import { CityEconomicData, Building, Company } from '../components'
import { GameWorld } from '../world'
import { getEconomicCycle } from './MacroUtils'

/**
 * MacroEconomySystem — Macro-Economic Simulation Engine
 *
 * Simulates city-level and global economic dynamics:
 *   1. Population dynamics (growth, migration)
 *   2. Consumer sentiment & purchasing power (drives RetailSystem demand)
 *   3. Interest rate cycles (drives FinancialSystem loan costs)
 *   4. Inflation (drives wage costs, building costs)
 *   5. Tax policy (corporate tax on profits)
 *   6. Unemployment → labor pool → wage pressure
 *   7. GDP growth tracking
 *   8. Industry demand multiplier (sector booms/busts)
 *
 * Cadence:
 *   - Daily (30 ticks): Consumer sentiment, purchasing power micro-adjustments
 *   - Monthly (900 ticks): Interest rates, inflation, tax policy, GDP snapshot
 *
 * Data Flow:
 *   MacroEconomySystem → CityEconomicData.interestRate → FinancialSystem (loan costs)
 *   MacroEconomySystem → CityEconomicData.purchasingPower → RetailSystem (demand)
 *   MacroEconomySystem → CityEconomicData.unemployment → ManagementSystem (hiring costs)
 *   MacroEconomySystem → CityEconomicData.industryDemandMult → ProductionSystem (utilization)
 *
 * Energy Market:
 *   MacroEconomySystem.globalFuelPrice → LogisticsSystem (freight costs)
 */

export let globalFuelPrice = 8000 // Base $80.00 in cents

const TICKS_PER_DAY = 30
const TICKS_PER_MONTH = 900

export const macroEconomySystem = (world: GameWorld) => {
  const cityQuery = defineQuery([CityEconomicData])
  const cities = cityQuery(world.ecsWorld)

  if (cities.length === 0) return world

  const isNewDay = world.tick % TICKS_PER_DAY === 0
  const isNewMonth = world.tick % TICKS_PER_MONTH === 0

  if (!isNewDay) return world

  // Global Economic Cycle (shared across all cities)
  const { phase: cyclePhase, isRecession, isBoom, oilPriceBase } = getEconomicCycle(world.tick)

  // 1. Daily Energy Market Micro-fluctuations
  if (isNewDay) {
    const volatility = isBoom ? 150 : (isRecession ? 300 : 50)
    const targetFuel = (oilPriceBase * 100) + (Math.random() * 500 - 250) // $ per barrel in cents
    globalFuelPrice = Math.floor(globalFuelPrice + (targetFuel - globalFuelPrice) * 0.05 + (Math.random() * volatility - volatility / 2))
    globalFuelPrice = Math.max(3000, Math.min(18000, globalFuelPrice)) // Cap $30 - $180
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  MONTHLY: Structural Economic Updates
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    // Count total businesses across all companies (proxy for economic health)
    const buildingQuery = defineQuery([Building, Company])
    const totalBuildings = buildingQuery(world.ecsWorld).length

    for (const cityId of cities) {
      // ─── 1. Interest Rate Policy ───
      // Central bank adjusts rates counter-cyclically:
      // Boom → raise rates to cool economy
      // Recession → cut rates to stimulate
      const currentRate = CityEconomicData.interestRate[cityId] || 500 // Default 5.0%
      let targetRate: number

      if (isBoom) {
        targetRate = 750 + Math.floor(Math.random() * 100) // 7.5-8.5%
      } else if (isRecession) {
        targetRate = 150 + Math.floor(Math.random() * 100) // 1.5-2.5%
      } else {
        targetRate = 400 + Math.floor(Math.random() * 150) // 4.0-5.5%
      }

      // Gradual adjustment (central banks don't move fast)
      const rateDelta = (targetRate - currentRate) * 0.15
      CityEconomicData.interestRate[cityId] = Math.max(50, Math.min(1500,
        Math.floor(currentRate + rateDelta)
      ))

      // ─── 2. Inflation Dynamics ───
      // Higher when: boom, high employment, lots of business activity
      const unemployment = CityEconomicData.unemployment[cityId] || 6
      const employmentFactor = Math.max(0, (100 - unemployment) / 100) // 0-1

      let baseInflation = 200 // 2.0% baseline
      if (isBoom) baseInflation += 150 // Demand-pull inflation
      if (unemployment < 4) baseInflation += 100 // Wage-push inflation
      if (isRecession) baseInflation -= 100 // Deflationary pressure

      // Business activity adds inflation pressure
      const activityInflation = Math.floor(totalBuildings * 0.5)
      baseInflation += Math.min(activityInflation, 100)

      const currentInflation = CityEconomicData.inflationRate[cityId] || 200
      CityEconomicData.inflationRate[cityId] = Math.max(0, Math.min(1500,
        Math.floor(currentInflation + (baseInflation - currentInflation) * 0.1)
      ))

      // ─── 3. Tax Policy ───
      // Small random fluctuations (government fiscal policy)
      const currentTax = CityEconomicData.taxRate[cityId] || 20
      if (Math.random() < 0.05) { // 5% chance of policy change per month
        const taxChange = Math.floor(Math.random() * 5) - 2 // -2 to +2
        CityEconomicData.taxRate[cityId] = Math.max(5, Math.min(50,
          currentTax + taxChange
        ))
      }

      // ─── 4. GDP Growth Rate ───
      // Composite of employment, sentiment, and cycle
      const sentiment = CityEconomicData.consumerSentiment[cityId] || 50
      const sentimentFactor = (sentiment - 50) / 50 // -1 to +1

      const gdpGrowth = Math.floor(
        200 + // Base 2% growth
        (cyclePhase * 300) + // Cycle effect: ±3%
        (sentimentFactor * 100) + // Sentiment: ±1%
        (employmentFactor * 50) + // Employment: 0-0.5%
        (Math.random() * 50 - 25) // Noise: ±0.25%
      )

      CityEconomicData.gdpGrowthRate[cityId] = Math.max(-500, Math.min(800, gdpGrowth))

      // ─── 5. Industry Demand Multiplier ───
      // Reflects overall business environment
      const demandBase = 1.0
      const cycleFactor = cyclePhase * 0.25 // ±25% from cycle
      const sentimentBoost = (sentiment - 50) / 200 // ±25% from sentiment
      const popFactor = CityEconomicData.population[cityId] > 500000 ? 0.05 : -0.05 // Big cities slightly higher demand

      CityEconomicData.industryDemandMult[cityId] =
        Math.max(0.4, Math.min(1.8,
          demandBase + cycleFactor + sentimentBoost + popFactor
        ))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DAILY: Micro-Adjustments
  // ═══════════════════════════════════════════════════════════════════════
  for (const cityId of cities) {
    // ─── Population Dynamics ───
    const currentPop = CityEconomicData.population[cityId]
    if (currentPop === 0) continue

    // Natural growth: 0.01-0.04% daily depending on conditions
    let growthRate: number
    if (isRecession) {
      growthRate = 0.9998 // Slight decline/emigration
    } else if (isBoom) {
      growthRate = 1.0004 // Immigration attracts people
    } else {
      growthRate = 1.0001 // Normal natural growth
    }

    // Large cities grow slower (diminishing returns)
    if (currentPop > 1000000) growthRate *= 0.999

    CityEconomicData.population[cityId] = Math.floor(currentPop * growthRate)

    // ─── Consumer Sentiment ───
    // Follows economic cycle with city-specific noise
    const sentiment = CityEconomicData.consumerSentiment[cityId] || 50
    const targetSentiment = 50 + (cyclePhase * 30) + (Math.random() * 10 - 5)

    // Sentiment also influenced by unemployment (negative) and wage growth (positive)
    const unemployment = CityEconomicData.unemployment[cityId] || 6
    const unemploymentPenalty = unemployment > 8 ? -(unemployment - 8) * 0.5 : 0
    const adjustedTarget = Math.max(5, Math.min(95, targetSentiment + unemploymentPenalty))

    CityEconomicData.consumerSentiment[cityId] = Math.max(1, Math.min(100,
      Math.floor(sentiment + (adjustedTarget - sentiment) * 0.05)
    ))

    // ─── Purchasing Power ───
    // Follows sentiment with a lag, adjusted by inflation erosion
    const pp = CityEconomicData.purchasingPower[cityId] || 50
    const inflationErosion = (CityEconomicData.inflationRate[cityId] || 200) / 10000 // Small daily erosion
    const basePP = 40 + (CityEconomicData.consumerSentiment[cityId] / 2)
    const adjustedPP = basePP * (1 - inflationErosion)

    CityEconomicData.purchasingPower[cityId] = Math.max(5, Math.min(100,
      Math.floor(pp + (adjustedPP - pp) * 0.02)
    ))

    // ─── Wages ───
    const wage = CityEconomicData.realWage[cityId]
    if (wage > 0) {
      // Wage growth = inflation + productivity premium - unemployment drag
      const inflationMult = 1 + (CityEconomicData.inflationRate[cityId] || 200) / (365 * 10000)
      const laborTightness = unemployment < 5 ? 1.0002 : 1.0 // Tight labor market pushes wages up
      const recessionDrag = isRecession ? 0.9999 : 1.0

      CityEconomicData.realWage[cityId] = Math.floor(wage * inflationMult * laborTightness * recessionDrag)
    }

    // ─── Unemployment ───
    // Structural rate influenced by cycle, drifts toward target
    const targetUnemployment = isRecession ? 12 : (isBoom ? 3 : 6)
    const u = CityEconomicData.unemployment[cityId] || 6
    const newU = u + (targetUnemployment - u) * 0.01

    // Add small random shocks
    const shock = (Math.random() - 0.5) * 0.3
    CityEconomicData.unemployment[cityId] = Math.max(1, Math.min(30,
      Math.round((newU + shock) * 10) / 10
    ))
  }

  return world
}
