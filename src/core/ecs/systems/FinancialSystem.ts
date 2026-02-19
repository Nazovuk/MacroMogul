import { defineQuery, hasComponent } from 'bitecs'
import {
  Building,
  Maintenance,
  Company,
  Finances,
  Stock,
  TechAge,
  ResearchCenter,
  CityEconomicData,
} from '../components'
import { GameWorld } from '../world'

/**
 * FinancialSystem — The P&L Engine
 *
 * Runs every tick but performs key operations on daily (30-tick) and monthly (900-tick) cycles.
 *
 * Responsibilities:
 * 1. Monthly P&L Reset: Snapshot last month's revenue/expenses/net, then zero the accumulators.
 * 2. Maintenance Costs: Deduct building upkeep daily from company cash.
 * 3. Loan Interest: Calculate and deduct monthly interest on negative cash (below credit limit).
 * 4. Credit Rating: Dynamically adjust based on cash position, revenue trend, and debt ratio.
 * 5. Dividend Payouts: If dividends are enabled, pay shareholders monthly.
 * 6. Tech Obsolescence: Advance global tech age for buildings with TechAge component.
 * 7. Player Cash Sync: Keep world.cash aligned with the player's Finances.cash.
 */

const TICKS_PER_DAY = 30
const TICKS_PER_MONTH = 900 // 30 days * 30 ticks

export const financialSystem = (world: GameWorld) => {
  const isNewDay = world.tick % TICKS_PER_DAY === 0
  const isNewMonth = world.tick % TICKS_PER_MONTH === 0

  // ═══════════════════════════════════════════════════════════════════════
  //  1. MONTHLY P&L SNAPSHOT & RESET
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    const companyQuery = defineQuery([Company, Finances])
    const companies = companyQuery(world.ecsWorld)

    // Sum per-building revenue/expenses into per-company totals
    const buildingQuery = defineQuery([Building, Company])
    const buildings = buildingQuery(world.ecsWorld)

    // Accumulate totals per company
    const companyTotals = new Map<number, { revenue: number; expenses: number }>()

    for (const bId of buildings) {
      const cId = Company.companyId[bId]
      if (cId === 0) continue

      const existing = companyTotals.get(cId) || { revenue: 0, expenses: 0 }
      existing.revenue += Company.revenueLastMonth[bId] || 0
      existing.expenses += Company.expensesLastMonth[bId] || 0
      companyTotals.set(cId, existing)

      // Reset per-building accumulators for next month
      Company.revenueLastMonth[bId] = 0
      Company.expensesLastMonth[bId] = 0
    }

    // Write company-level totals
    for (const compId of companies) {
      const id = Company.companyId[compId]
      const totals = companyTotals.get(id) || { revenue: 0, expenses: 0 }

      // Store the final monthly figures on the company entity itself
      Company.revenueLastMonth[compId] = totals.revenue
      Company.expensesLastMonth[compId] = totals.expenses
      Company.netIncomeLastMonth[compId] = totals.revenue - totals.expenses
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  2. DAILY MAINTENANCE COSTS
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewDay) {
    const maintenanceQuery = defineQuery([Building, Maintenance, Company])
    const entities = maintenanceQuery(world.ecsWorld)

    for (const id of entities) {
      if (Building.isOperational[id] === 0) continue

      const monthlyCost = Maintenance.monthlyCost[id]
      if (monthlyCost <= 0) continue

      const ownerId = Company.companyId[id]
      if (ownerId === 0) continue

      // Auto-calculate monthly cost from base upkeep + level scaling
      if (monthlyCost === 0 && Maintenance.baseUpkeep[id] > 0) {
        const level = Building.level[id] || 1
        Maintenance.monthlyCost[id] = Math.floor(
          Maintenance.baseUpkeep[id] * (1 + (level - 1) * 0.15)
        )
      }

      const dailyCost = Math.floor(monthlyCost / 30)

      // Deduct from company
      if (hasComponent(world.ecsWorld, Finances, ownerId)) {
        Finances.cash[ownerId] -= dailyCost
      }

      // Accumulate into building-level expense tracker
      Company.expensesLastMonth[id] = (Company.expensesLastMonth[id] || 0) + dailyCost

      // Sync player cash
      if (ownerId === world.playerEntityId) {
        world.cash -= dailyCost
      }

      Maintenance.lastPaymentTick[id] = world.tick
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  3. MONTHLY LOAN INTEREST & CREDIT MECHANICS
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    const finQuery = defineQuery([Company, Finances])
    const companies = finQuery(world.ecsWorld)

    // Read the central bank rate from the first city (global rate)
    const cityQuery = defineQuery([CityEconomicData])
    const cityEntities = cityQuery(world.ecsWorld)
    const centralBankRate = cityEntities.length > 0
      ? (CityEconomicData.interestRate[cityEntities[0]] || 500)
      : 500 // Fallback 5.0%

    for (const id of companies) {
      const cash = Finances.cash[id]
      const creditLimit = Finances.creditLimit[id]

      // Company interest = central bank rate + credit spread
      // Credit spread: 100bps (good credit) to 800bps (poor credit)
      const companyRate = Finances.interestRate[id] || 0
      const effectiveRate = Math.max(companyRate, centralBankRate + 100) // At least CB + 1%

      // If cash is negative, they're borrowing against credit line
      if (cash < 0) {
        const debt = Math.abs(cash)
        const monthlyRate = effectiveRate / 10000 / 12 // BPS -> annual -> monthly
        const interest = Math.floor(debt * monthlyRate)

        // Deduct interest
        Finances.cash[id] -= interest

        // Track as expense on the company entity
        Company.expensesLastMonth[id] = (Company.expensesLastMonth[id] || 0) + interest

        if (Company.companyId[id] === world.playerEntityId) {
          world.cash -= interest
        }

        // If debt exceeds credit limit, increase spread (penalty)
        if (debt > creditLimit) {
          Finances.interestRate[id] = Math.min(2000, effectiveRate + 50) // +0.5% penalty, cap at 20%
        }
      } else {
        // Healthy cash → drift rate back toward central bank + small spread
        const floorRate = centralBankRate + 100 // CB + 1% minimum spread
        if (companyRate > floorRate) {
          Finances.interestRate[id] = Math.max(floorRate, companyRate - 10) // -0.1% recovery
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  4. MONTHLY CREDIT RATING UPDATE
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    const creditQuery = defineQuery([Company, Finances])
    const companies = creditQuery(world.ecsWorld)

    for (const id of companies) {
      const cash = Finances.cash[id]
      const creditLimit = Finances.creditLimit[id]
      const currentRating = Finances.creditRating[id]
      const revenue = Company.revenueLastMonth[id] || 0
      const netIncome = Company.netIncomeLastMonth[id] || 0

      // Factors affecting rating:
      let targetRating = 50 // Base

      // Cash position vs credit limit (positive is good)
      if (creditLimit > 0) {
        const healthRatio = cash / creditLimit
        targetRating += Math.min(25, Math.max(-25, healthRatio * 20))
      }

      // Profitability bonus
      if (revenue > 0 && netIncome > 0) {
        const margin = netIncome / revenue
        targetRating += Math.min(15, margin * 100) // Up to +15 for high margins
      } else if (netIncome < 0) {
        targetRating -= 10 // Penalty for losing money
      }

      // Smooth transition
      const newRating = Math.floor(currentRating + (targetRating - currentRating) * 0.1)
      Finances.creditRating[id] = Math.max(0, Math.min(100, newRating))

      // Credit limit adjusts with rating
      // Higher rating = more credit available (up to 2x of original)
      const ratingFactor = 0.5 + (Finances.creditRating[id] / 100) * 1.5
      const baseCreditLimit = Company.marketCap[id] * 0.1 // 10% of market cap
      Finances.creditLimit[id] = Math.floor(Math.max(baseCreditLimit, creditLimit * ratingFactor * 0.1 + creditLimit * 0.9))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  5. MONTHLY DIVIDEND PAYOUTS
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    const divQuery = defineQuery([Company, Finances, Stock])
    const companies = divQuery(world.ecsWorld)

    for (const id of companies) {
      const dividendBps = Stock.dividend[id] // basis points of share price
      if (dividendBps === 0) continue

      const shares = Stock.sharesOutstanding[id]
      const sharePrice = Stock.sharePrice[id]

      // Annual dividend per share = sharePrice * dividendBps / 10000
      // Monthly = annual / 12
      const annualDividendPerShare = (sharePrice * dividendBps) / 10000
      const monthlyPayout = Math.floor((annualDividendPerShare * shares) / 12)

      if (monthlyPayout > 0 && Finances.cash[id] > monthlyPayout) {
        Finances.cash[id] -= monthlyPayout
        Company.expensesLastMonth[id] = (Company.expensesLastMonth[id] || 0) + monthlyPayout

        if (Company.companyId[id] === world.playerEntityId) {
          world.cash -= monthlyPayout
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  6. TECH OBSOLESCENCE (from Kimi's orphaned TechSystem)
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewDay) {
    const techQuery = defineQuery([TechAge, Building])
    const techEntities = techQuery(world.ecsWorld)

    for (const id of techEntities) {
      if (Building.isOperational[id] === 0) continue

      // Generate Innovation Points (enhanced by R&D Centers)
      let pointsPerDay = 1 // Base generation
      if (hasComponent(world.ecsWorld, ResearchCenter, id)) {
        const rdEfficiency = ResearchCenter.efficiency[id] || 50
        pointsPerDay += Math.floor(rdEfficiency / 10) // Up to +10 bonus from R&D
      }
      TechAge.innovationPoints[id] += pointsPerDay

      // Breakthrough: Every 1000 points, level up
      if (TechAge.innovationPoints[id] >= 1000) {
        if (TechAge.currentLevel[id] < TechAge.maxLevel[id]) {
          TechAge.currentLevel[id]++
          TechAge.innovationPoints[id] = 0
        }
      }

      // Obsolescence: Apply efficiency decay to older tech
      // Rate is 0-100, higher = faster obsolescence
      const obsRate = TechAge.obsolescenceRate[id] || 5
      if (world.tick % (TICKS_PER_MONTH * 3) === 0 && TechAge.currentLevel[id] > 0) {
        // Every quarter, tech ages slightly
        const globalTechTarget = Math.floor(world.tick / (TICKS_PER_MONTH * 12)) + 1 // Years of play
        if (TechAge.currentLevel[id] < globalTechTarget) {
          // This building's tech is behind the curve
          TechAge.obsolescenceRate[id] = Math.min(100, obsRate + 5)
        } else {
          TechAge.obsolescenceRate[id] = Math.max(0, obsRate - 2)
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  7. PLAYER CASH SYNC (Safety Net)
  // ═══════════════════════════════════════════════════════════════════════
  if (world.playerEntityId > 0 && hasComponent(world.ecsWorld, Finances, world.playerEntityId)) {
    world.cash = Finances.cash[world.playerEntityId]
  }

  return world
}
