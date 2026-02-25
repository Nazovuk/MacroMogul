import { defineQuery, hasComponent } from 'bitecs'
import { Company, Finances, Stock, Building, Maintenance, CompanyTechnology, Factory, MarketingOffice, Strike } from '../components'
import { GameWorld } from '../world'
import { getEconomicCycle } from './MacroUtils'
import { getGlobalTechLevel } from '../world'

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

      // 1. Basic profit generation estimate (could be replaced by actual metrics)
      const revenue = Company.currentMonthRevenue[id] || 0
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
      
      // --- NEW: TECH GAP & OBSOLESCENCE RISK ---
      // We check the specific tech laggard risk for what the company actually produces
      let techGapPremium = 1.0;
      let rAndDRisk = 0;
      
      // Look up all products this company is making in factories
      const factoryQuery = defineQuery([Factory, Company]);
      const companyFactories = factoryQuery(world.ecsWorld).filter(fid => Company.companyId[fid] === compId);
      
      const producedProducts = new Set<number>();
      companyFactories.forEach(fid => {
        if (Factory.recipeId[fid]) producedProducts.add(Factory.recipeId[fid]);
      });

      if (producedProducts.size > 0) {
        let maxGlobalGap = 0; // Negative = behind leader
        for (const pid of producedProducts) {
          const myTech = world.techLookup.get(compId)?.get(pid) || 40;
          const globalTech = getGlobalTechLevel(world, pid);
          const gap = myTech - globalTech;
          if (gap < maxGlobalGap) maxGlobalGap = gap;
        }

        if (maxGlobalGap < -15) {
          // Obsolescence Risk: Penalty for being significantly behind the leader
          techGapPremium = 0.85 + (maxGlobalGap + 15) * 0.01; // Scale down
          rAndDRisk = 0.15; // 15% valuation discount for "obsolete" threat
        } else if (maxGlobalGap >= 0) {
          // Innovator Premium: Bonus for being the leader
          techGapPremium = 1.1; 
        }
      }

      targetPE = targetPE * techGapPremium * (1.0 - rAndDRisk);
      
      // --- NEWS SHOCK EFFECT ---
      // Apply immediate PE compression based on recent bad news
      const companyAlerts = world.techAlerts.get(compId);
      if (companyAlerts && companyAlerts.size > 0) {
          // PR Mitigation: Check if company is running a PR campaign to shield valuation
          const reputation = Company.reputation[compId] || 50;
          
          // Check for active PR campaign
          const mQuery = defineQuery([MarketingOffice, Company]);
          const hasPRCampaign = mQuery(world.ecsWorld).some(mid => 
            Company.companyId[mid] === compId && MarketingOffice.campaignType[mid] === 4
          );
          
          let prShield = reputation > 80 ? 0.4 : (reputation > 60 ? 0.2 : 0);
          if (hasPRCampaign) prShield += 0.4; // Active PR campaign provides significant extra shield
          
          const panicDiscount = 0.08 * (1 - Math.min(1.0, prShield));
          targetPE *= (1 - panicDiscount); 
      }

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
      
      // --- NEWS-DRIVEN MOMENTUM SHOCK ---
      const hasNewsShock = companyAlerts && companyAlerts.size > 0;
      const momentum = hasNewsShock ? 0.08 : 0.2; 

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

      // ─── Payout Dividend ───
      const dividendBps = Stock.dividend[id] || 0;
      if (dividendBps > 0) {
        // Dividend is presented as an annual yield based on stock price
        const dividendYield = dividendBps / 10000;
        const annualDividendPerShare = newPrice * dividendYield;
        const monthlyDividendPerShare = annualDividendPerShare / 12;
        const totalDividendPayment = monthlyDividendPerShare * shares;

        if (Finances.cash[id] >= totalDividendPayment) {
          Finances.cash[id] -= totalDividendPayment;
          if (Company.companyId[id] === world.playerEntityId) {
            world.cash -= totalDividendPayment;
          }
        } else {
          // If the company cannot afford it, dividend is cut. 
          Stock.dividend[id] = 0;
          if (Company.companyId[id] === world.playerEntityId) {
            world.newsFeed.unshift({
                id: `div_cut_${id}_${world.tick}`,
                type: 'finance',
                title: 'Dividend Cut',
                content: `Your board of directors was forced to cancel the dividend due to insufficient cash!`,
                timestamp: Date.now()
            });
            if (world.newsFeed.length > 50) world.newsFeed.pop();
          }
        }
      }
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

      // --- WORKER STRIKE PANIC SELLING ---
      // Check if this company is currently suffering a labor strike
      let internalShock = 0;
      const buildingQuery = defineQuery([Building, Company]);
      const companyBuildings = buildingQuery(world.ecsWorld).filter(bid => Company.companyId[bid] === Company.companyId[id]);
      
      let criticalStrikes = 0;
      companyBuildings.forEach(bid => {
          if (hasComponent(world.ecsWorld, Strike, bid) && Strike.severity[bid] >= 2) {
              criticalStrikes++;
          }
      });
      
      if (criticalStrikes > 0) {
          // Absolute panic selling - 4% to 8% daily bleed depending on severity
          internalShock = -(0.04 + (Math.random() * 0.04)) * criticalStrikes;
          
          if (Math.random() < 0.02) {
              world.newsFeed.unshift({
                  id: `stock_panic_${id}_${world.tick}`,
                  type: 'finance',
                  title: 'Market Panic',
                  content: `Investors are dumping shares of Competitor ${Company.companyId[id]} as critical labor strikes drag on.`,
                  timestamp: Date.now()
              });
              if (world.newsFeed.length > 50) world.newsFeed.pop();
          }
      }

      // --- SHORT SQUEEZE MECHANICS ---
      // If stock is heavily discounted (pullback is strongly positive) but eps > 0
      let squeezeBoost = 0;
      if (pullback > 0.05 && eps > 0 && !internalShock) {
          // Stock is deeply oversold (divergence < -50%). 1% chance per day of a massive squeeze
          if (Math.random() < 0.01) {
              squeezeBoost = 0.30 + Math.random() * 0.40; // 30% to 70% immediate spike
              
              world.newsFeed.unshift({
                  id: `squeeze_${id}_${world.tick}`,
                  type: 'finance',
                  title: 'Short Squeeze!',
                  content: `Massive sudden buying volume has triggered a short squeeze in Competitor ${Company.companyId[id]}'s stock, skyrocketing the price!`,
                  timestamp: Date.now()
              });
              if (world.newsFeed.length > 50) world.newsFeed.pop();
          }
      }

      let newPrice = currentPrice * (1 + drift + pullback + internalShock + squeezeBoost)
      Stock.sharePrice[id] = Math.max(1, newPrice)

      // Update market cap daily too
      Company.marketCap[id] = Stock.sharePrice[id] * shares

      // Daily volume (volume scales enormously during squeezes or crashes)
      const volumeSpike = (squeezeBoost > 0 || internalShock < 0) ? 5.0 : 1.0;
      Stock.volume[id] = Math.floor((Stock.volume[id] || shares * 0.01) * (0.3 + Math.random() * 0.4) * volumeSpike)
    }
  }

  return world
}

export const issueShares = (world: GameWorld, companyId: number, sharesToIssue: number): boolean => {
  if (sharesToIssue <= 0) return false;
  const currentShares = Stock.sharesOutstanding[companyId];
  const currentPrice = Stock.sharePrice[companyId];
  if (!currentShares || !currentPrice) return false;

  const capitalRaised = sharesToIssue * currentPrice;
  Stock.sharesOutstanding[companyId] += sharesToIssue;
  Finances.cash[companyId] += capitalRaised;
  if (companyId === world.playerEntityId) {
    world.cash += capitalRaised;
  }
  Company.marketCap[companyId] = Stock.sharesOutstanding[companyId] * Stock.sharePrice[companyId];
  return true;
};

export const buybackShares = (world: GameWorld, companyId: number, sharesToBuy: number): boolean => {
  if (sharesToBuy <= 0) return false;
  const currentShares = Stock.sharesOutstanding[companyId];
  const currentPrice = Stock.sharePrice[companyId];
  if (!currentShares || !currentPrice || currentShares <= sharesToBuy) return false;

  const capitalCost = sharesToBuy * currentPrice;
  if (Finances.cash[companyId] < capitalCost) return false;

  Stock.sharesOutstanding[companyId] -= sharesToBuy;
  Finances.cash[companyId] -= capitalCost;
  if (companyId === world.playerEntityId) {
    world.cash -= capitalCost;
  }
  Company.marketCap[companyId] = Stock.sharesOutstanding[companyId] * Stock.sharePrice[companyId];
  return true;
};

export const setDividend = (companyId: number, basisPoints: number): boolean => {
  if (basisPoints < 0 || basisPoints > 2000) return false; // Max 20%
  Stock.dividend[companyId] = basisPoints;
  return true;
};
