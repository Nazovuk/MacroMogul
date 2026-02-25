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
  Loan,
  CorporateBond,
  CompanyFinancials,
} from '../components'
import { GameWorld } from '../world'

// Store for extended financial data (loans, bonds)
export const companyFinancialsStore = new Map<number, CompanyFinancials>()

let nextLoanId = 1
let nextBondId = 1

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
      existing.revenue += Company.currentMonthRevenue[bId] || 0
      existing.expenses += Company.currentMonthExpenses[bId] || 0
      companyTotals.set(cId, existing)

      // Reset per-building accumulators for next month
      Company.currentMonthRevenue[bId] = 0
      Company.currentMonthExpenses[bId] = 0
    }

    // Write company-level totals
    for (const compId of companies) {
      const id = Company.companyId[compId]
      const totals = companyTotals.get(id) || { revenue: 0, expenses: 0 }

      const companyDirectRevenue = Company.currentMonthRevenue[compId] || 0
      const companyDirectExpenses = Company.currentMonthExpenses[compId] || 0
      
      const finalRevenue = totals.revenue + companyDirectRevenue;
      const finalExpenses = totals.expenses + companyDirectExpenses;

      // Store the final monthly figures on the company entity itself
      Company.revenueLastMonth[compId] = finalRevenue
      Company.expensesLastMonth[compId] = finalExpenses
      Company.netIncomeLastMonth[compId] = finalRevenue - finalExpenses

      // Reset direct company accumulators
      Company.currentMonthRevenue[compId] = 0
      Company.currentMonthExpenses[compId] = 0
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
      Company.currentMonthExpenses[id] = (Company.currentMonthExpenses[id] || 0) + dailyCost

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
        Company.currentMonthExpenses[id] = (Company.currentMonthExpenses[id] || 0) + interest

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
        Company.currentMonthExpenses[id] = (Company.currentMonthExpenses[id] || 0) + monthlyPayout

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

  // ═══════════════════════════════════════════════════════════════════════
  //  8. MONTHLY LOAN & BOND PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════
  if (isNewMonth && world.tick > 0) {
    processLoanPayments(world)
    processBondPayments(world)
  }

  return world
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAN MANAGEMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Issue a new loan to a company
 * @param world GameWorld
 * @param companyId Company entity ID
 * @param amount Loan amount in cents
 * @param termMonths Loan term in months
 * @returns Loan object or null if rejected
 */
export function issueLoan(
  world: GameWorld,
  companyId: number,
  amount: number,
  termMonths: number = 12
): Loan | null {
  if (!hasComponent(world.ecsWorld, Finances, companyId)) {
    console.error(`[FinancialSystem] Company ${companyId} has no Finances component`)
    return null
  }

  const creditLimit = Finances.creditLimit[companyId]
  const creditRating = Finances.creditRating[companyId]
  const currentDebt = Finances.debt[companyId]

  // Calculate total debt after loan
  const totalDebtAfterLoan = currentDebt + amount

  // Check credit limit
  if (totalDebtAfterLoan > creditLimit) {
    console.log(`[FinancialSystem] Loan rejected: Exceeds credit limit (${totalDebtAfterLoan} > ${creditLimit})`)
    return null
  }

  // Calculate interest rate based on credit rating and market conditions
  const cityQuery = defineQuery([CityEconomicData])
  const cityEntities = cityQuery(world.ecsWorld)
  const baseRate = cityEntities.length > 0
    ? CityEconomicData.interestRate[cityEntities[0]] || 500
    : 500

  // Credit spread based on rating (0-100)
  // Rating 100 = +1%, Rating 0 = +15%
  const creditSpread = 100 + (100 - creditRating) * 14 // 100 to 1500 bps

  // Term premium (longer = higher rate)
  const termPremium = Math.floor((termMonths - 12) * 2.5) // +0.025% per month over 12

  const interestRate = baseRate + creditSpread + termPremium

  // Calculate monthly payment using amortization formula
  const monthlyRate = interestRate / 10000 / 12
  const monthlyPayment = Math.floor(
    amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  )

  // Create loan
  const loan: Loan = {
    id: nextLoanId++,
    principal: amount,
    remaining: amount,
    interestRate,
    monthlyPayment,
    monthsRemaining: termMonths,
    startTick: world.tick,
  }

  // Add to company's financials
  let financials = companyFinancialsStore.get(companyId)
  if (!financials) {
    financials = {
      companyId,
      loans: [],
      bonds: [],
      lastMonthInterestPaid: 0,
      lastMonthPrincipalPaid: 0,
      lastMonthCouponPaid: 0,
      totalInterestPaidYTD: 0,
    }
    companyFinancialsStore.set(companyId, financials)
  }
  financials.loans.push(loan)

  // Update ECS components
  Finances.cash[companyId] += amount
  Finances.debt[companyId] += amount

  console.log(`[FinancialSystem] Loan issued to company ${companyId}: $${amount / 100} at ${interestRate / 100}% for ${termMonths} months`)

  return loan
}

/**
 * Process monthly loan payments for all companies
 */
function processLoanPayments(world: GameWorld): void {
  const finQuery = defineQuery([Company, Finances])
  const companies = finQuery(world.ecsWorld)

  for (const companyId of companies) {
    const financials = companyFinancialsStore.get(companyId)
    if (!financials || financials.loans.length === 0) continue

    let totalInterestPaid = 0
    let totalPrincipalPaid = 0
    const remainingLoans: Loan[] = []

    for (const loan of financials.loans) {
      if (loan.monthsRemaining <= 0) continue

      const monthlyRate = loan.interestRate / 10000 / 12
      const interestPortion = Math.floor(loan.remaining * monthlyRate)
      const principalPortion = Math.min(loan.monthlyPayment - interestPortion, loan.remaining)
      const totalPayment = interestPortion + principalPortion

      // Check if company can afford payment
      if (Finances.cash[companyId] >= totalPayment) {
        // Make payment
        Finances.cash[companyId] -= totalPayment
        Finances.debt[companyId] -= principalPortion
        loan.remaining -= principalPortion
        loan.monthsRemaining--

        totalInterestPaid += interestPortion
        totalPrincipalPaid += principalPortion

        Company.currentMonthExpenses[companyId] = (Company.currentMonthExpenses[companyId] || 0) + totalPayment

        if (companyId === world.playerEntityId) {
          world.cash -= totalPayment
        }

        if (loan.monthsRemaining > 0 && loan.remaining > 0) {
          remainingLoans.push(loan)
        } else {
          console.log(`[FinancialSystem] Loan ${loan.id} fully repaid for company ${companyId}`)
        }
      } else {
        // Payment failed - penalty and continue
        console.warn(`[FinancialSystem] Company ${companyId} missed loan payment of $${totalPayment / 100}`)
        Finances.creditRating[companyId] = Math.max(0, Finances.creditRating[companyId] - 5)
        remainingLoans.push(loan)
      }
    }

    // Update financials
    financials.loans = remainingLoans
    financials.lastMonthInterestPaid = totalInterestPaid
    financials.lastMonthPrincipalPaid = totalPrincipalPaid
    financials.totalInterestPaidYTD += totalInterestPaid
  }
}

/**
 * Get company's outstanding loans
 */
export function getCompanyLoans(companyId: number): Loan[] {
  const financials = companyFinancialsStore.get(companyId)
  return financials ? [...financials.loans] : []
}

/**
 * Prepay a loan (partial or full)
 */
export function prepayLoan(
  companyId: number,
  loanId: number,
  amount: number
): boolean {
  const financials = companyFinancialsStore.get(companyId)
  if (!financials) return false

  const loan = financials.loans.find(l => l.id === loanId)
  if (!loan) return false

  const prepayAmount = Math.min(amount, loan.remaining)

  if (Finances.cash[companyId] < prepayAmount) {
    console.log(`[FinancialSystem] Insufficient funds to prepay loan ${loanId}`)
    return false
  }

  Finances.cash[companyId] -= prepayAmount
  Finances.debt[companyId] -= prepayAmount
  loan.remaining -= prepayAmount

  if (loan.remaining <= 0) {
    financials.loans = financials.loans.filter(l => l.id !== loanId)
    console.log(`[FinancialSystem] Loan ${loanId} fully prepaid for company ${companyId}`)
  }

  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// CORPORATE BOND FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Issue corporate bonds
 * @param world GameWorld
 * @param companyId Company entity ID
 * @param faceValue Total face value in cents
 * @param couponRate Annual coupon rate in basis points
 * @param maturityMonths Months to maturity
 * @returns Bond object or null if rejected
 */
export function issueCorporateBond(
  world: GameWorld,
  companyId: number,
  faceValue: number,
  couponRate: number,
  maturityMonths: number = 60
): CorporateBond | null {
  if (!hasComponent(world.ecsWorld, Finances, companyId) || !hasComponent(world.ecsWorld, Stock, companyId)) {
    console.error(`[FinancialSystem] Company ${companyId} missing Finances or Stock component`)
    return null
  }

  const creditRating = Finances.creditRating[companyId]
  const marketCap = Company.marketCap[companyId]
  const currentDebt = Finances.debt[companyId]

  // Check if company qualifies for bond issuance
  // Requirements: Credit rating >= 60, debt-to-market-cap < 50%
  if (creditRating < 60) {
    console.log(`[FinancialSystem] Bond issuance rejected: Credit rating too low (${creditRating})`)
    return null
  }

  if (currentDebt + faceValue > marketCap * 0.5) {
    console.log(`[FinancialSystem] Bond issuance rejected: Would exceed 50% debt-to-market-cap`)
    return null
  }

  // Determine bond rating based on company credit
  let bondRating: CorporateBond['bondRating']
  if (creditRating >= 90) bondRating = 'AAA'
  else if (creditRating >= 80) bondRating = 'AA'
  else if (creditRating >= 70) bondRating = 'A'
  else if (creditRating >= 60) bondRating = 'BBB'
  else bondRating = 'BB'

  // Issue price may be at discount based on market demand
  const marketDemand = 1.0 - (100 - creditRating) * 0.002 // 0.8 to 1.0
  const issuePrice = Math.floor(faceValue * marketDemand)

  // Create bond
  const bond: CorporateBond = {
    id: nextBondId++,
    faceValue,
    couponRate,
    issuePrice,
    maturityMonths,
    monthsRemaining: maturityMonths,
    startTick: world.tick,
    bondRating,
  }

  // Add to company's financials
  let financials = companyFinancialsStore.get(companyId)
  if (!financials) {
    financials = {
      companyId,
      loans: [],
      bonds: [],
      lastMonthInterestPaid: 0,
      lastMonthPrincipalPaid: 0,
      lastMonthCouponPaid: 0,
      totalInterestPaidYTD: 0,
    }
    companyFinancialsStore.set(companyId, financials)
  }
  financials.bonds.push(bond)

  // Update ECS components
  Finances.cash[companyId] += issuePrice
  Finances.debt[companyId] += faceValue

  console.log(`[FinancialSystem] Corporate bond issued for company ${companyId}: $${faceValue / 100} face value at ${couponRate / 100}% (${bondRating} rated)`)

  return bond
}

/**
 * Process monthly bond coupon payments
 */
function processBondPayments(world: GameWorld): void {
  const finQuery = defineQuery([Company, Finances])
  const companies = finQuery(world.ecsWorld)

  for (const companyId of companies) {
    const financials = companyFinancialsStore.get(companyId)
    if (!financials || financials.bonds.length === 0) continue

    let totalCouponPaid = 0
    const remainingBonds: CorporateBond[] = []

    for (const bond of financials.bonds) {
      if (bond.monthsRemaining <= 0) continue

      // Calculate monthly coupon
      const annualCoupon = bond.faceValue * (bond.couponRate / 10000)
      const monthlyCoupon = Math.floor(annualCoupon / 12)

      // Check if company can afford coupon
      if (Finances.cash[companyId] >= monthlyCoupon) {
        Finances.cash[companyId] -= monthlyCoupon
        bond.monthsRemaining--
        totalCouponPaid += monthlyCoupon

        // Track expenses
        Company.currentMonthExpenses[companyId] = (Company.currentMonthExpenses[companyId] || 0) + monthlyCoupon

        if (bond.monthsRemaining <= 0) {
          // Bond matured - repay face value
          if (Finances.cash[companyId] >= bond.faceValue) {
            Finances.cash[companyId] -= bond.faceValue
            Finances.debt[companyId] -= bond.faceValue
            console.log(`[FinancialSystem] Bond ${bond.id} matured and repaid for company ${companyId}`)
          } else {
            // Default!
            console.error(`[FinancialSystem] DEFAULT: Company ${companyId} cannot repay matured bond ${bond.id}`)
            Finances.creditRating[companyId] = Math.max(0, Finances.creditRating[companyId] - 20)
            bond.bondRating = 'D' // Default
            remainingBonds.push(bond)
          }
        } else {
          remainingBonds.push(bond)
        }
      } else {
        // Missed coupon payment
        console.warn(`[FinancialSystem] Company ${companyId} missed coupon payment on bond ${bond.id}`)
        Finances.creditRating[companyId] = Math.max(0, Finances.creditRating[companyId] - 10)

        // Downgrade bond rating
        const ratings: CorporateBond['bondRating'][] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D']
        const currentIdx = ratings.indexOf(bond.bondRating)
        if (currentIdx < ratings.length - 1) {
          bond.bondRating = ratings[currentIdx + 1]
        }

        remainingBonds.push(bond)
      }
    }

    financials.bonds = remainingBonds
    financials.lastMonthCouponPaid = totalCouponPaid
    financials.totalInterestPaidYTD += totalCouponPaid
  }
}

/**
 * Get company's outstanding bonds
 */
export function getCompanyBonds(companyId: number): CorporateBond[] {
  const financials = companyFinancialsStore.get(companyId)
  return financials ? [...financials.bonds] : []
}

/**
 * Get complete financial summary for a company
 */
export function getFinancialSummary(companyId: number): {
  loans: Loan[]
  bonds: CorporateBond[]
  totalDebt: number
  monthlyDebtService: number
  weightedAvgInterestRate: number
} | null {
  const financials = companyFinancialsStore.get(companyId)
  if (!financials) return null

  const totalDebt = financials.loans.reduce((sum, l) => sum + l.remaining, 0) +
                    financials.bonds.reduce((sum, b) => sum + b.faceValue, 0)

  const monthlyLoanPayments = financials.loans.reduce((sum, l) => sum + l.monthlyPayment, 0)
  const monthlyCouponPayments = financials.bonds.reduce((sum, b) => {
    return sum + Math.floor(b.faceValue * (b.couponRate / 10000) / 12)
  }, 0)

  const totalInterestBearing = financials.loans.reduce((sum, l) => sum + l.remaining, 0) +
                               financials.bonds.reduce((sum, b) => sum + b.faceValue, 0)

  const weightedInterest = totalInterestBearing > 0
    ? (financials.loans.reduce((sum, l) => sum + l.remaining * l.interestRate, 0) +
       financials.bonds.reduce((sum, b) => sum + b.faceValue * b.couponRate, 0)) / totalInterestBearing
    : 0

  return {
    loans: [...financials.loans],
    bonds: [...financials.bonds],
    totalDebt,
    monthlyDebtService: monthlyLoanPayments + monthlyCouponPayments,
    weightedAvgInterestRate: weightedInterest,
  }
}
