import { defineQuery } from 'bitecs'
import { 
  Building, 
  AIController, 
  Company, 
  Finances, 
  ResearchCenter,
  Inventory,
  Factory,
  RetailPlot,
  Position,
  CityEconomicData,
  MarketData,
  ProductBrand,
  MarketingOffice,
  LogisticSupply,
  ProductionOutput
} from '../components'
import { GameWorld, createBuilding, getGlobalTechLevel, getCompetitorAvgTechLevel } from '../world'
import { hasTechAlert } from './TechSystem'
import { BuildingType } from '../../data/types'
import { issueLoan, issueCorporateBond } from './FinancialSystem'

/**
 * CompetitorSystem — Rival Corporation Engine (AI) v2.0
 *
 * Simulates AI-controlled companies that analyze markets, build infrastructures,
 * and react to macro-economic shifts.
 * 
 * UPGRADES:
 * - Vertical Integration: AI builds farms/mines to supply its own factories.
 * - Dynamic Pricing: AI adjusts prices based on inventory levels and competition.
 * - Strategic Research: AI prioritizes researching products where it lags in quality.
 */
export const competitorSystem = (world: GameWorld) => {
  const aiQuery = defineQuery([AIController, Company, Finances])
  const aiEntities = aiQuery(world.ecsWorld)

  // Cache average global economic state
  const cityQuery = defineQuery([CityEconomicData])
  const cityEntities = cityQuery(world.ecsWorld)
  
  let globalInterestRate = 500 // 5.0% default
  let globalGdpGrowth = 200 // 2.0% default
  if (cityEntities.length > 0) {
    let sumInterest = 0, sumGdp = 0
    cityEntities.forEach(eid => {
      sumInterest += CityEconomicData.interestRate[eid]
      sumGdp += CityEconomicData.gdpGrowthRate[eid]
    })
    globalInterestRate = sumInterest / cityEntities.length
    globalGdpGrowth = sumGdp / cityEntities.length
  }

  for (const aiId of aiEntities) {
    const cash = Finances.cash[aiId]
    const currentDebt = Finances.debt[aiId] || 0
    const lastAction = AIController.lastActionTick[aiId]
    const personality = AIController.personality[aiId] || 0 // 0: Aggr, 1: Bal, 2: Cons
    
    // AI acts every 30 ticks (approx 1 game month)
    if (world.tick - lastAction < 30) continue

    // ─── 1. ADVANCED FINANCIAL MANAGEMENT ───
    const creditRating = Finances.creditRating[aiId] || 50
    const creditLimit = Finances.creditLimit[aiId] || 0
    const expansionThreshold = AIController.expansionThreshold[aiId] || 200000

    // A. Emergency Funding (If running out of operational cash)
    if (cash < 100000 && creditRating > 40 && (creditLimit - currentDebt) > 500000) {
      const loanAmount = Math.max(1000000, Math.floor(creditLimit * 0.2)) // Request 20% of limit
      issueLoan(world, aiId, loanAmount, 12)
      console.log(`[Competitor ${aiId}] Financial: Emergency funding secured ($${loanAmount/100}) for operations`)
    }

    // B. Debt Repayment (If cash is abundant)
    if (cash > expansionThreshold * 3 && currentDebt > 0) {
      const isRateWarning = globalInterestRate > 800
      const payment = isRateWarning ? Math.min(cash * 0.4, currentDebt) : Math.min(cash * 0.1, currentDebt)
      Finances.cash[aiId] -= payment
      Finances.debt[aiId] -= payment
      console.log(`[Competitor ${aiId}] Financial: Paying down debt $${payment/100} surplus cash`)
    }

    // C. Bond Issuance (For major giants only)
    if (creditRating > 85 && cash < expansionThreshold && currentDebt < (Company.marketCap[aiId] * 0.15)) {
        const bondAmount = Math.floor(Company.marketCap[aiId] * 0.1)
        if (bondAmount > 5000000) { // Only if $50k+
            issueCorporateBond(world, aiId, bondAmount, 400, 60) // 4% coupon, 5 years
            const compData = world.dataStore.getCompany(aiId);
            const compName = compData ? compData.name : `Competitor ${aiId}`;
            console.log(`[${compName}] Financial: Issuing corporate bonds ($${bondAmount/100}) for strategic growth`)
            world.newsFeed.unshift({
                id: `bond_${aiId}_${world.tick}`,
                type: 'finance',
                title: `news.bond_issuance_title`,
                content: `news.bond_issuance_content|{"company":"${compName}","amount":"$${(bondAmount / 100).toLocaleString()}"}`,
                timestamp: Date.now()
            });
            if (world.newsFeed.length > 50) world.newsFeed.pop(); // Keep max 50
        }
    }

    // ─── 2. DYNAMIC PRICING ───
    manageAIPricing(world, aiId, personality);

    // ─── Macro-Economic Adjustment ───
    // Interest rate sensitivity: if rates > 8%, conservative/balanced AI slows down
    const isRateWarning = globalInterestRate > 800
    const isRecession = globalGdpGrowth < 0
    
    // Dynamic expansion threshold based on macro + personality
    let dynamicThreshold = expansionThreshold
    if (isRateWarning) dynamicThreshold *= personality === 0 ? 1.2 : 2.0 // Aggressive cares less
    if (isRecession) dynamicThreshold *= 3.0 // Recession freezes construction for almost everyone

    if (cash > dynamicThreshold) {
      // 2. Vertical Integration Check (Supply Chain)
      // Check if any of our factories are starving for inputs
      if (attemptVerticalIntegration(world, aiId)) {
         AIController.lastActionTick[aiId] = world.tick;
         continue;
      }

      // 3. Strategic Decision Making with Market Intelligence
      const intelligence = gatherMarketIntelligence(world, aiId);
      const decision = makeStrategicDecision(world, aiId, intelligence);
      
      console.log(`[Competitor ${aiId}] Strategic decision: ${decision.action} - ${decision.reason}`);
      
      if (decision.action === 'research') {
         // Build R&D Center
         if (performAIConstruction(world, aiId, 33, 0)) {
            AIController.lastActionTick[aiId] = world.tick;
            const compData = world.dataStore.getCompany(aiId);
            const compName = compData ? compData.name : `Competitor ${aiId}`;
            notifyUI(`notifications.investing_rd|{"company":"${compName}"}`, 'info');

            world.newsFeed.unshift({
               id: `rd_${aiId}_${world.tick}`,
               type: 'market',
               title: `news.investing_rd|{"company":"${compName}","product":"N/A"}`,
               content: `news.investing_rd|{"company":"${compName}","product":"N/A"}`,
               timestamp: Date.now()
            });
            continue;
         }
      }
      else if (decision.action === 'pr') {
          // Build Marketing Office for PR/Crisis defense
          if (performAIConstruction(world, aiId, 34, decision.targetProductId || 0)) {
            AIController.lastActionTick[aiId] = world.tick;
            const compData = world.dataStore.getCompany(aiId);
            const compName = compData ? compData.name : `Competitor ${aiId}`;
            notifyUI(`notifications.emergency_pr|{"company":"${compName}"}`, 'warning');

            world.newsFeed.unshift({
               id: `pr_${aiId}_${world.tick}`,
               type: 'market',
               title: `news.emergency_pr|{"company":"${compName}"}`,
               content: `news.emergency_pr|{"company":"${compName}"}`,
               timestamp: Date.now()
            });
            continue;
          }
      }
      else if (decision.action === 'expand' && decision.targetProductId) {
         // Strategic expansion based on market analysis
         const targetProduct = world.dataStore.getProduct(decision.targetProductId);
         if (targetProduct) {
            let targetBuildingTypeId = 0;
            
            if (targetProduct.category === 'RAW') {
                 const farm = Array.from(world.dataStore.buildings.values()).find(b => 
                     (b.type === BuildingType.FARM || b.type === BuildingType.MINE) && 
                     b.name.includes(targetProduct.name)
                 );
                 if (farm) targetBuildingTypeId = farm.id;
            } 
            else if (targetProduct.category === 'CONSUMER') {
                 // Strategic choice: Retail vs Factory based on market share
                 const intel = intelligence.get(decision.targetProductId);
                 if (intel && intel.ourMarketShare === 0) {
                     // New market - start with retail to test demand
                     const retail = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.RETAIL);
                     if (retail) targetBuildingTypeId = retail.id;
                 } else {
                     // Existing market - expand production
                     const factory = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.FACTORY);
                     if (factory) targetBuildingTypeId = factory.id;
                 }
            }
            else {
                 const factory = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.FACTORY);
                 if (factory) targetBuildingTypeId = factory.id;
            }

            if (targetBuildingTypeId !== 0) {
               if (performAIConstruction(world, aiId, targetBuildingTypeId, decision.targetProductId)) {
                  AIController.lastActionTick[aiId] = world.tick;
                  const compData = world.dataStore.getCompany(aiId);
                  const compName = compData ? compData.name : `Competitor ${aiId}`;
                  notifyUI(`notifications.expanding_product|{"company":"${compName}","product":"${targetProduct.name}","reason":"${decision.reason}"}`, 'info');

                  world.newsFeed.unshift({
                     id: `expand_${aiId}_${world.tick}`,
                     type: 'market',
                     title: `news.expanding_product|{"company":"${compName}","product":"${targetProduct.name}","reason":"${decision.reason}"}`,
                     content: `news.expanding_product|{"company":"${compName}","product":"${targetProduct.name}","reason":"${decision.reason}"}`,
                     timestamp: Date.now()
                  });
                  continue;
               }
            }
         }
      }
      else if (decision.action === 'defend' && decision.targetProductId) {
         // Defensive expansion - build more capacity in threatened market
         const targetProduct = world.dataStore.getProduct(decision.targetProductId);
         if (targetProduct) {
            const factory = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.FACTORY);
            if (factory && performAIConstruction(world, aiId, factory.id, decision.targetProductId)) {
               AIController.lastActionTick[aiId] = world.tick;
               const compData = world.dataStore.getCompany(aiId);
               const compName = compData ? compData.name : `Competitor ${aiId}`;
               notifyUI(`notifications.defending_market|{"company":"${compName}","product":"${targetProduct.name}"}`, 'warning');

               world.newsFeed.unshift({
                  id: `def_${aiId}_${world.tick}`,
                  type: 'market',
                  title: `news.defending_market|{"company":"${compName}","product":"${targetProduct.name}"}`,
                  content: `news.defending_market|{"company":"${compName}","product":"${targetProduct.name}"}`,
                  timestamp: Date.now()
               });
               continue;
            }
         }
      }
      
      // 4. Fallback: Random market gap expansion if no strategic opportunity
      const fallbackProduct = findMarketGaps(world);
      if (fallbackProduct && Math.random() > 0.5) {
         let targetBuildingTypeId = 0;
         
         if (fallbackProduct.category === 'RAW') {
              const farm = Array.from(world.dataStore.buildings.values()).find(b => 
                  (b.type === BuildingType.FARM || b.type === BuildingType.MINE) && 
                  b.name.includes(fallbackProduct.name)
              );
              if (farm) targetBuildingTypeId = farm.id;
         } 
         else if (fallbackProduct.category === 'CONSUMER' && Math.random() > 0.4) {
              const retail = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.RETAIL);
              if (retail) targetBuildingTypeId = retail.id;
         }
         else {
              const factory = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.FACTORY);
              if (factory) targetBuildingTypeId = factory.id;
         }

         if (targetBuildingTypeId !== 0) {
            if (performAIConstruction(world, aiId, targetBuildingTypeId, fallbackProduct.id)) {
               AIController.lastActionTick[aiId] = world.tick;
            }
         }
      }
    }

    // 5. Manage Marketing & PR
    manageAIMarketing(world, aiId, personality);

    // 6. Manage Research Projects
    updateAIResearch(world, aiId)

    // 7. Auto-link Supply Chains
    autoLinkAISupplyChains(world, aiId)
  }

  return world
}

/**
 * AI Logic: Vertical Integration
 * Checks if any factory owned by this AI is continuously low on input materials.
 * If so, tries to build the producer of that material.
 */
function attemptVerticalIntegration(world: GameWorld, aiId: number): boolean {
    const factoryQuery = defineQuery([Building, Factory, Inventory, Company]);
    const myFactories = factoryQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === Company.companyId[aiId]);

    for (const fid of myFactories) {
        // Check Inputs
        const checkInput = (productId: number, amount: number) => {
            if (productId === 0) return false;
            // Threshold: if buffer is less than 10 units (arbitrary low number)
            if (amount < 10) {
                // Find what builds this
                const pData = world.dataStore.getProduct(productId);
                if (!pData) return false;

                // Only integrate if it's a RAW material (Farm/Mine) for now
                // Complex multi-stage integration is harder
                if (pData.category === 'RAW') {
                     const producer = Array.from(world.dataStore.buildings.values()).find(b => 
                        (b.type === BuildingType.FARM || b.type === BuildingType.MINE) &&
                        b.name.includes(pData.name) // Basic matching
                     );
                     
                     if (producer) {
                         console.log(`[Competitor] AI ${aiId} attempting vertical integration: Building ${producer.name} for ${pData.name}`);
                         return performAIConstruction(world, aiId, producer.id, productId);
                     }
                }
            }
            return false;
        };

        if (checkInput(Inventory.input1ProductId[fid], Inventory.input1Amount[fid])) return true;
        if (checkInput(Inventory.input2ProductId[fid], Inventory.input2Amount[fid])) return true;
        if (checkInput(Inventory.input3ProductId[fid], Inventory.input3Amount[fid])) return true;
    }
    return false;
}

/**
 * AI Logic: Dynamic Pricing v2.0 - Enhanced Competitor Reactivity
 * 
 * Adjusts prices based on:
 * 1. Inventory pressure (High -> Lower, Low -> Raise)
 * 2. Competitive pressure (Market averages vs Player prices)
 * 3. Personality-driven strategies (Aggressive undercutting, Premium pricing)
 * 4. Market share goals (Price wars when losing share)
 */
function manageAIPricing(world: GameWorld, aiId: number, personality: number) {
    const retailQuery = defineQuery([Building, RetailPlot, Inventory, Company]);
    const myStores = retailQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === Company.companyId[aiId]);
    
    const marketQuery = defineQuery([MarketData, ProductBrand]);
    const marketEntities = marketQuery(world.ecsWorld);
    
    // Identify player entity for targeted competition
    const allCompanies = defineQuery([Company, Finances])(world.ecsWorld);
    const playerEntity = allCompanies.find(eid => !AIController.personality[eid]); // Player has no AIController
    const playerCompanyId = playerEntity ? Company.companyId[playerEntity] : 0;

    for (const sid of myStores) {
        const productId = Inventory.productId[sid];
        if (productId === 0) continue;

        const currentStock = Inventory.currentAmount[sid];
        const capacity = Inventory.capacity[sid];
        const utilization = currentStock / capacity;

        // === MARKET INTELLIGENCE GATHERING ===
        let totalMarketPrice = 0;
        let totalMarketQuality = 0;
        let competitorCount = 0;
        let minCompetitorPrice = Infinity;
        let playerPrice = 0;
        let playerMarketShare = 0;
        let totalMarketShare = 0;
        
        for (const mid of marketEntities) {
            if (ProductBrand.productId[mid] === productId) {
                const price = MarketData.price[mid];
                const share = MarketData.marketShare[mid];
                const cid = ProductBrand.companyId[mid];
                
                totalMarketPrice += price;
                totalMarketQuality += MarketData.quality[mid];
                competitorCount++;
                totalMarketShare += share;
                
                if (price < minCompetitorPrice) minCompetitorPrice = price;
                
                if (cid === playerCompanyId) {
                    playerPrice = price;
                    playerMarketShare = share;
                }
            }
        }
        
        const avgMarketQuality = competitorCount > 0 ? totalMarketQuality / competitorCount : 50;
        
        // === DYNAMIC PRICING STRATEGY ===
        let priceMultiplier = 1.0;
        const currentPrice = RetailPlot.price1[sid];
        const ourQuality = Inventory.quality[sid] || 50;
        const productData = world.dataStore.getProduct(productId);
        const minSafePrice = productData ? (productData.basePrice * 0.8) : currentPrice * 0.5; // Don't crash below 80% cost easily

        // 1. INVENTORY PRESSURE ADJUSTMENT
        if (utilization > 0.9) {
            priceMultiplier *= 0.85; // Liquidate
        } else if (utilization > 0.7) {
            priceMultiplier *= 0.94;
        } else if (utilization < 0.15) {
            priceMultiplier *= 1.06;
        }
        
        // 2. COMPETITIVE POSITIONING & PLAYER DEFENSE
        if (competitorCount > 1) {
            // A. Market Share Threat Response
            const playerShareTotal = (playerMarketShare / Math.max(1, totalMarketShare)) * 100;
            
            if (playerShareTotal > 25) {
                // Player is becoming a monopolist! All AI personalities react.
                const defenseAggression = personality === 0 ? 0.80 : (personality === 1 ? 0.90 : 0.95);
                priceMultiplier *= defenseAggression;
                
                if (world.tick % 900 === 0) { // Notify only once a month
                    const pData = world.dataStore.getProduct(productId);
                    const pName = pData ? pData.name : `#${productId}`;
                    const compData = world.dataStore.getCompany(aiId);
                    const compName = compData ? compData.name : `Competitor ${aiId}`;
                    // The UI will handle translation and interpolation
                    notifyUI(`notifications.price_war_msg|{"company":"${compName}","product":"${pName}"}`, 'warning'); 
                    console.log(`[${compName}] PRICE WAR: Aggressively undercutting player's ${playerShareTotal.toFixed(1)}% market share`);
                    
                    world.newsFeed.unshift({
                        id: `pw_${aiId}_${productId}_${world.tick}`,
                        type: 'market',
                        title: `news.price_war_title`,
                        content: `news.price_war_content|{"company":"${compName}","product":"${pName}"}`,
                        timestamp: Date.now()
                    });
                    if (world.newsFeed.length > 50) world.newsFeed.pop();
                }
            }

            // B. Direct Competitor Undercutting
            if (playerPrice > 0 && playerPrice < currentPrice) {
                switch (personality) {
                    case 0: // Aggressive: Undercut player by 10%
                        priceMultiplier = (playerPrice * 0.90) / currentPrice;
                        break;
                    case 1: // Balanced: Stay within 2% of player
                        if (playerPrice < currentPrice * 0.98) {
                            priceMultiplier = (playerPrice * 1.01) / currentPrice;
                        }
                        break;
                }
            }
        }
        
        // 3. QUALITY PREMIUM
        const qualityDiff = ourQuality - avgMarketQuality;
        if (qualityDiff > 10) {
            priceMultiplier *= 1.05; // Quality leader premium
        } else if (qualityDiff < -15) {
            priceMultiplier *= 0.90; // Junk discount
        }

        // 4. PERSONALITY MODIFIERS
        if (personality === 0 && priceMultiplier > 0.95) priceMultiplier *= 0.97; // Always lean cheaper
        if (personality === 2 && priceMultiplier < 1.05) priceMultiplier *= 1.03; // Always lean premium
        
        // === APPLY PRICE CHANGE ===
        const targetPrice = Math.max(minSafePrice, Math.floor(currentPrice * priceMultiplier));
        
        if (targetPrice !== currentPrice) {
            // Smoothing: Don't jump more than 15% in one month unless desperate
            const maxJump = currentPrice * 0.15;
            const absoluteChange = Math.abs(targetPrice - currentPrice);
            const limitedChange = Math.min(absoluteChange, maxJump);
            const finalPrice = targetPrice > currentPrice ? currentPrice + limitedChange : currentPrice - limitedChange;

            RetailPlot.price1[sid] = Math.max(5, Math.floor(finalPrice));
            RetailPlot.price2[sid] = Math.max(5, Math.floor(finalPrice));
            RetailPlot.price3[sid] = Math.max(5, Math.floor(finalPrice));
        }
    }
}


/**
 * AI Logic: Marketing & PR Management
 * 
 * Adjusts campaign types based on market sentiment and tech standing.
 * Switches to PR mode (Campaign Type 4) if tech alerts are present.
 */
function manageAIMarketing(world: GameWorld, aiId: number, personality: number) {
    const marketingQuery = defineQuery([Building, MarketingOffice, Company]);
    const myOffices = marketingQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === Company.companyId[aiId]);
    
    const cash = Finances.cash[aiId];
    const companyId = Company.companyId[aiId];
    const alerts = world.techAlerts.get(companyId);

    for (const mid of myOffices) {
        const productId = MarketingOffice.productId[mid];
        const hasCrisis = alerts && alerts.has(productId);
        
        // Find awareness for this product+company
        const mktQuery = defineQuery([MarketData, ProductBrand]);
        const brandEntity = mktQuery(world.ecsWorld).find(bid => 
            ProductBrand.companyId[bid] === companyId && ProductBrand.productId[bid] === productId
        );
        const awareness = brandEntity ? MarketData.brandPower[brandEntity] : 0;

        if (hasCrisis && cash > 1000000) { // $10k+ cash for crisis management
            // Switch to PR mode
            if (MarketingOffice.campaignType[mid] !== 4) {
                MarketingOffice.campaignType[mid] = 4;
                MarketingOffice.targetDemographic[mid] = 2; // Target Adults for stability
                MarketingOffice.spending[mid] *= 1.5; 
                
                const compData = world.dataStore.getCompany(aiId);
                const compName = compData ? compData.name : `Competitor ${aiId}`;
                const pData = world.dataStore.getProduct(productId);
                const pName = pData ? pData.name : `#${productId}`;
                
                console.log(`[${compName}] switching to PR OFFENSIVE for product ${productId}`);
                world.newsFeed.unshift({
                    id: `pr_${aiId}_${productId}_${world.tick}`,
                    type: 'tech',
                    title: `news.pr_campaign_title`,
                    content: `news.pr_campaign_content|{"company":"${compName}","product":"${pName}"}`,
                    timestamp: Date.now()
                });
                if (world.newsFeed.length > 50) world.newsFeed.pop();
            }
        } else {
            // Normal operation
            if (MarketingOffice.campaignType[mid] === 4) {
                const normalType = personality === 0 ? 0 : (personality === 2 ? 2 : 1); 
                MarketingOffice.campaignType[mid] = normalType;
                MarketingOffice.spending[mid] *= 0.7; // Normalize spend
            }

            // Efficiency: If awareness is high (>90), cut spend to save cash
            let spendModifier = 1.0;
            if (awareness > 90) spendModifier = 0.4; // Maintain only
            else if (awareness < 20) spendModifier = 1.5; // Aggressive push

            // Set Demographic based on personality
            if (personality === 0) MarketingOffice.targetDemographic[mid] = 1; // Youth (Viral)
            else if (personality === 2) MarketingOffice.targetDemographic[mid] = 3; // Premium (Loyal)
            else MarketingOffice.targetDemographic[mid] = 0; // All

            const targetSpendPercent = personality === 0 ? 0.05 : (personality === 1 ? 0.02 : 0.01);
            MarketingOffice.spending[mid] = Math.min(20000000, cash * targetSpendPercent * spendModifier); 
        }
    }
}

/**
 * Research logic for AI: focuses on products they are already selling to maintain quality edge
 * UPGRADE: Now checks MarketData to prioritize products where the AI is falling behind in quality.
 */
function updateAIResearch(world: GameWorld, aiId: number) {
  const rdQuery = defineQuery([Building, ResearchCenter, Company])
  const marketQuery = defineQuery([MarketData, ProductBrand])
  const rdEntities = rdQuery(world.ecsWorld)
  const marketEntities = marketQuery(world.ecsWorld)
  
  for (const rdId of rdEntities) {
    if (Company.companyId[rdId] === Company.companyId[aiId]) {
      if (ResearchCenter.researchingProductId[rdId] === 0) {
        // Find products this AI owns or produces
        const ownedProds = Array.from(defineQuery([Building, Inventory, Company])(world.ecsWorld))
          .filter(eid => Company.companyId[eid] === Company.companyId[aiId] && Inventory.productId[eid] !== 0)
          .map(eid => Inventory.productId[eid]);
        
        if (ownedProds.length > 0) {
          // Intelligent Selection: Find the product with the worst quality gap
          let bestCandidate = ownedProds[0];
          let maxGap = -100;

          // Check against global market data if available
          const productQualityMap = new Map<number, number>(); // ProductID -> Max Quality
          
          for (const mid of marketEntities) {
             const pid = ProductBrand.productId[mid];
             const quality = MarketData.quality[mid];
             const currentMax = productQualityMap.get(pid) || 0;
             if (quality > currentMax) {
                 productQualityMap.set(pid, quality);
             }
          }

          // Evaluate gaps
          const aiCompanyId = Company.companyId[aiId];
          let candidateFound = false;
          for (const pid of ownedProds) {
              const myTech = world.techLookup.get(aiCompanyId)?.get(pid) || 40;
              const globalTech = getGlobalTechLevel(world, pid);
              const compAvg = getCompetitorAvgTechLevel(world, pid, aiCompanyId);
              
              // Gap is relative to both leader and average
              const gap = (globalTech - myTech) * 1.5 + (compAvg - myTech);
              
              if (gap > maxGap) {
                  maxGap = gap;
                  bestCandidate = pid;
                  candidateFound = true;
              }
          }

          // Simple Heuristic fallback
          if (!candidateFound || Math.random() > 0.8) {
            // 20% chance to just pick a random product to diversify research
             bestCandidate = ownedProds[Math.floor(Math.random() * ownedProds.length)];
          }

          // Special Tech: Process Innovation
          const buildingQuery = defineQuery([Building, Company])
          const buildingCount = buildingQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === Company.companyId[aiId]).length
          
          if (buildingCount > 5 && Math.random() > 0.8) {
            ResearchCenter.researchingProductId[rdId] = 1000
            const compData = world.dataStore.getCompany(aiId);
            const compName = compData ? compData.name : `Competitor ${aiId}`;
            notifyUI(`notifications.investing_process|{"company":"${compName}"}`, 'info');
          } else {
            // Get product name if possible, otherwise use ID
            const pData = world.dataStore.getProduct(bestCandidate);
            const pName = pData ? pData.name : `#${bestCandidate}`;
            const compData = world.dataStore.getCompany(aiId);
            const compName = compData ? compData.name : `Competitor ${aiId}`;
            notifyUI(`notifications.started_rd|{"company":"${compName}","product":"${pName}"}`, 'info'); 
          }
        }
      }
    }
  }
}

// Helper to dispatch game events for the UI
function notifyUI(message: string, type: 'info' | 'warning' | 'danger' = 'info') {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-notification', { 
            detail: { message, type, timestamp: Date.now() } 
        }));
    }
}

const findMarketGaps = (world: GameWorld) => {
  const products = Array.from(world.dataStore.products.values())
  // Sort by baseDemand to prioritize popular items
  const sorted = products.sort((a, b) => b.baseDemand - a.baseDemand);
  
  // Pick from top 40% for smarter selection
  const poolSize = Math.max(1, Math.floor(sorted.length * 0.4));
  const pool = sorted.slice(0, poolSize);
      
  return pool[Math.floor(Math.random() * pool.length)]
}

const performAIConstruction = (world: GameWorld, ownerId: number, buildingTypeId: number, productId: number): boolean => {
  // 1. Select a Target City (Weighted by Economy + Low Unemployment)
  const cityQuery = defineQuery([CityEconomicData, Position]);
  const cityEntities = cityQuery(world.ecsWorld);
  
  if (cityEntities.length === 0) return false;

  let totalPot = 0;
  const cityPotentials = cityEntities.map(eid => {
      // Pot = Population * Purchasing Power * Sentiment
      const pop = CityEconomicData.population[eid] || 1000000;
      const pp = CityEconomicData.purchasingPower[eid] || 50;
      const sentiment = CityEconomicData.consumerSentiment[eid] || 50;
      
      // NEW: Competitive Pressure - If player/rival has high share here, target it
      let pressure = 1.0;
      // We don't have per-city market share in components yet, but we can proxy 
      // by looking if AI personality is aggressive
      const aiPersonality = AIController.personality[ownerId] || 1;
      if (aiPersonality === 0) pressure = 1.3; // Aggressors hunt for conflict

      const pot = (pop / 1000) * pp * (sentiment / 50) * pressure;
      totalPot += pot;
      return { eid, pot };
  });

  let r = Math.random() * totalPot;
  let targetCityEid = cityEntities[0];
  for (const item of cityPotentials) {
      r -= item.pot;
      if (r <= 0) {
          targetCityEid = item.eid;
          break;
      }
  }

  const cityX = Position.x[targetCityEid];
  const cityY = Position.y[targetCityEid];
  const cityId = Position.cityId[targetCityEid];

  // 2. Build via world factory function
  const bData = world.dataStore.getBuilding(buildingTypeId);
  if (!bData) return false;

  // Search for empty spot near city
  let validEntity = 0;
  for (let i = 0; i < 15; i++) {
      const offsetX = Math.floor(Math.random() * 20) - 10;
      const offsetY = Math.floor(Math.random() * 20) - 10;
      const cx = Math.max(0, Math.min(100, cityX + offsetX));
      const cy = Math.max(0, Math.min(100, cityY + offsetY));

      const result = createBuilding(world, cx, cy, buildingTypeId, cityId, ownerId);
      if (result !== undefined) {
          validEntity = result;
          break;
      }
  }
  
  if (validEntity === 0) return false;

  // 3. Pay for Construction
  Finances.cash[ownerId] -= bData.baseCost * 100;
  
  // NOTIFICATION
  const compData = world.dataStore.getCompany(ownerId);
  const compName = compData ? compData.name : (ownerId === 0 ? "Player" : `Rival #${ownerId}`);
  console.log(`[Competitor] ${compName} built ${bData.name} in City ${cityId}`);
  notifyUI(`notifications.expanded_building|{"company":"${compName}","building":"${bData.name}"}`, 'info');

  // 4. Initial Configuration
  configureNewAIBuilding(world, validEntity, buildingTypeId, productId);

  return true;
}

function configureNewAIBuilding(world: GameWorld, entity: number, typeId: number, productId: number) {
  const bData = world.dataStore.getBuilding(typeId);
  if (!bData) return;

  // Factory Setup
  if (bData.type === BuildingType.FACTORY && productId !== 0) {
      const recipes = world.dataStore.getRecipesForProduct(productId);
      if (recipes.length > 0) {
          Factory.recipeId[entity] = recipes[0].id;
          Inventory.productId[entity] = productId;
      }
  } 
  // Extraction Setup
  else if (productId !== 0) {
      Inventory.productId[entity] = productId;
  }

  // Retail Pricing (Dynamic entry pricing with market analysis)
  if (bData.type === BuildingType.RETAIL || bData.type === BuildingType.SUPERMARKET) {
      const p = world.dataStore.getProduct(productId);
      if (p) {
          // Analyze current market pricing for this product
          const marketQuery = defineQuery([MarketData, ProductBrand]);
          const marketEntities = marketQuery(world.ecsWorld);
          
          let totalPrice = 0;
          let priceCount = 0;
          let minPrice = Infinity;
          
          for (const mid of marketEntities) {
              if (ProductBrand.productId[mid] === productId) {
                  const price = MarketData.price[mid];
                  totalPrice += price;
                  priceCount++;
                  if (price < minPrice) minPrice = price;
              }
          }
          
          let entryPrice: number;
          if (priceCount > 0) {
              const avgPrice = totalPrice / priceCount;
              // Enter at 95% of average to be competitive, or match lowest
              entryPrice = Math.floor(Math.min(avgPrice * 0.95, minPrice * 1.02));
          } else {
              // No competition - premium pricing
              entryPrice = Math.floor(p.basePrice * 1.5);
          }
          
          RetailPlot.price1[entity] = Math.max(p.basePrice, entryPrice);
          RetailPlot.price2[entity] = Math.max(p.basePrice, entryPrice);
          RetailPlot.price3[entity] = Math.max(p.basePrice, entryPrice);
      }
  }

  // Marketing Office Setup
  if (typeId === 34 && productId !== 0) {
      MarketingOffice.productId[entity] = productId;
      MarketingOffice.spending[entity] = 500000; // $5k start
      MarketingOffice.campaignType[entity] = 1; // Digital start
  }
}

/**
 * Market Intelligence: Analyze competitive landscape for strategic decisions
 */
interface MarketIntelligence {
    productId: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    totalMarketShare: number;
    ourMarketShare: number;
    playerMarketShare: number;
    competitorCount: number;
    priceTrend: 'rising' | 'falling' | 'stable';
}

function gatherMarketIntelligence(world: GameWorld, aiId: number): Map<number, MarketIntelligence> {
    const intelligence = new Map<number, MarketIntelligence>();
    const marketQuery = defineQuery([MarketData, ProductBrand]);
    const marketEntities = marketQuery(world.ecsWorld);
    
    // Identify player
    const allCompanies = defineQuery([Company])(world.ecsWorld);
    const playerEntity = allCompanies.find(eid => {
        const hasAI = defineQuery([AIController])(world.ecsWorld).includes(eid);
        return !hasAI;
    });
    const playerCompanyId = playerEntity ? Company.companyId[playerEntity] : 0;
    const aiCompanyId = Company.companyId[aiId];
    
    // Group by product
    const productData = new Map<number, {
        prices: number[];
        shares: Map<number, number>; // companyId -> share
    }>();
    
    for (const mid of marketEntities) {
        const pid = ProductBrand.productId[mid];
        const cid = ProductBrand.companyId[mid];
        const price = MarketData.price[mid];
        const share = MarketData.marketShare[mid];
        
        if (!productData.has(pid)) {
            productData.set(pid, { prices: [], shares: new Map() });
        }
        
        const data = productData.get(pid)!;
        data.prices.push(price);
        data.shares.set(cid, share);
    }
    
    // Calculate intelligence for each product
    for (const [pid, data] of productData) {
        if (data.prices.length === 0) continue;
        
        const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
        const minPrice = Math.min(...data.prices);
        const maxPrice = Math.max(...data.prices);
        
        let totalShare = 0;
        let ourShare = 0;
        let playerShare = 0;
        
        for (const [cid, share] of data.shares) {
            totalShare += share;
            if (cid === aiCompanyId) ourShare = share;
            if (cid === playerCompanyId) playerShare = share;
        }
        
        // Simple trend analysis (compare to historical if available)
        const priceTrend: 'rising' | 'falling' | 'stable' = 'stable';
        
        intelligence.set(pid, {
            productId: pid,
            avgPrice,
            minPrice,
            maxPrice,
            totalMarketShare: totalShare,
            ourMarketShare: ourShare,
            playerMarketShare: playerShare,
            competitorCount: data.prices.length,
            priceTrend
        });
    }
    
    return intelligence;
}

/**
 * Strategic Decision Making: Should AI enter a new market or defend existing?
 */
function makeStrategicDecision(world: GameWorld, aiId: number, intelligence: Map<number, MarketIntelligence>): { 
    action: 'expand' | 'defend' | 'research' | 'pr' | 'wait';
    targetProductId?: number;
    reason: string;
} {
    const personality = AIController.personality[aiId] || 1;
    const cash = Finances.cash[aiId];
    const companyId = Company.companyId[aiId];
    
    // Get AI's current products
    const buildingQuery = defineQuery([Building, Inventory, Company]);
    const myBuildings = buildingQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === companyId);
    const myProducts = new Set(myBuildings.map(eid => Inventory.productId[eid]).filter(pid => pid !== 0));
    
    // Analyze each market
    let bestExpansionOpportunity: { productId: number; score: number } | null = null;
    let needsDefense = false;
    let defenseProductId: number | null = null;
    
    // Check for Tech Alerts (P0 Threat)
    const companyAlerts = world.techAlerts.get(companyId);
    const hasAlerts = companyAlerts && companyAlerts.size > 0;
    if (hasAlerts && cash > 50000) {
        // High priority: Fix technology gaps
        const hasRD = myBuildings.some(eid => Building.buildingTypeId[eid] === 33);
        if (!hasRD) {
            return { action: 'research', reason: 'strategic_reasons.obsolete_tech' };
        }

        // Crisis PR: If we have alerts and no marketing office, build one ASAP
        const hasMarketing = myBuildings.some(eid => Building.buildingTypeId[eid] === 34);
        if (!hasMarketing && cash > 1500000) {
            return { action: 'pr', reason: 'strategic_reasons.market_panic' };
        }
    }

    for (const [pid, intel] of intelligence) {
        // Check if we're in this market
        const inMarket = myProducts.has(pid);
        
        if (inMarket && intel.ourMarketShare < 20 && intel.playerMarketShare > 30) {
            // Losing to player - consider defense
            needsDefense = true;
            defenseProductId = pid;
        }
        
        if (!inMarket && intel.competitorCount < 4) {
            // Potential expansion opportunity
            let score = 0;
            
            // High margin opportunity
            const pData = world.dataStore.getProduct(pid);
            if (pData) {
                const margin = (intel.avgPrice - pData.basePrice * 0.6) / intel.avgPrice;
                score += margin * 100;
            }
            
            // Low competition bonus
            score += (5 - intel.competitorCount) * 10;
            
            // Personality adjustment
            if (personality === 0) score *= 1.3; // Aggressive AI loves expansion
            if (personality === 2) score *= 0.7; // Conservative is cautious
            
            if (!bestExpansionOpportunity || score > bestExpansionOpportunity.score) {
                bestExpansionOpportunity = { productId: pid, score };
            }
        }
        
        // --- NEW: Tech Defense Check ---
        if (inMarket && hasTechAlert(world, companyId, pid)) {
            // My product is obsolete!
            needsDefense = true;
            defenseProductId = pid;
            
            // If we have an R&D center, focus research there immediately
            const hasRD = myBuildings.find(eid => Building.buildingTypeId[eid] === 33);
            if (hasRD) {
                ResearchCenter.researchingProductId[hasRD] = pid; 
            }
        }
    }
    
    // Decision logic
    if (needsDefense && personality !== 0) {
        return { 
            action: 'defend', 
            targetProductId: defenseProductId!,
            reason: 'strategic_reasons.defensive_maneuver' 
        };
    }
    
    if (bestExpansionOpportunity && bestExpansionOpportunity.score > 30 && cash > 100000) {
        return { 
            action: 'expand', 
            targetProductId: bestExpansionOpportunity.productId,
            reason: 'strategic_reasons.expansion_opportunity' 
        };
    }
    
    // Check if we should research instead
    const hasRD = myBuildings.some(eid => Building.buildingTypeId[eid] === 33);
    if (!hasRD && cash > 200000 && personality !== 2) {
        return { action: 'research', reason: 'strategic_reasons.process_optimization' };
    }
    
    return { action: 'wait', reason: 'strategic_reasons.market_stagnation' };
}

/**
 * AI Logic: Automatically scan AI's buildings and setup LogisticSupply 
 * links for any missing inputs, buying from internal or external sources.
 */
function autoLinkAISupplyChains(world: GameWorld, aiId: number) {
  const companyId = Company.companyId[aiId];
  
  // Find all buildings that need supply (factories & retail)
  const reqsQuery = defineQuery([Building, LogisticSupply, Inventory]);
  const myBuildings = reqsQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === companyId);
  
  // Find all possible suppliers (all buildings that output something)
  const prodQuery = defineQuery([Building, Inventory, ProductionOutput]);
  const allProducers = prodQuery(world.ecsWorld);
  
  for (const bid of myBuildings) {
      if (Building.isOperational[bid] === 0) continue;
      
      const bData = world.dataStore.getBuilding(Building.buildingTypeId[bid]);
      if (!bData) continue;
      
      const isFactory = bData.type === BuildingType.FACTORY;
      const isRetail = bData.type === BuildingType.RETAIL || bData.type === BuildingType.SUPERMARKET;
      
      const neededInputs: { slot: number; prodId: number }[] = [];
      
      if (isFactory) {
          const recipeId = Factory.recipeId[bid];
          if (recipeId) {
             const recipe = world.dataStore.getRecipe(recipeId);
             if (recipe) {
                 recipe.inputs.forEach((inp, idx) => {
                     neededInputs.push({ slot: idx + 1, prodId: inp.productId });
                 });
             }
          }
      } else if (isRetail) {
          // Retail usually only has 1 main product for now
          const pId = Inventory.productId[bid];
          if (pId !== 0) {
              neededInputs.push({ slot: 1, prodId: pId });
          }
      }
      
      for (const req of neededInputs) {
          let currentSource = 0;
          let currentProd = 0;
          if (req.slot === 1) { currentSource = LogisticSupply.source1Id[bid]; currentProd = LogisticSupply.product1Id[bid]; }
          else if (req.slot === 2) { currentSource = LogisticSupply.source2Id[bid]; currentProd = LogisticSupply.product2Id[bid]; }
          else if (req.slot === 3) { currentSource = LogisticSupply.source3Id[bid]; currentProd = LogisticSupply.product3Id[bid]; }
          
          // If slot is empty or mapped to wrong product, try to find a supplier
          if (currentSource === 0 || currentProd !== req.prodId) {
              const potentialIds = allProducers.filter(eid => Inventory.productId[eid] === req.prodId && eid !== bid);
              
              if (potentialIds.length > 0) {
                  // Prefer own buildings
                  let bestSupplier = potentialIds.find(eid => Company.companyId[eid] === companyId);
                  if (!bestSupplier) {
                      // Fallback to random competitor's building
                      bestSupplier = potentialIds[Math.floor(Math.random() * potentialIds.length)];
                  }
                  
                  if (bestSupplier) {
                      if (req.slot === 1) { LogisticSupply.source1Id[bid] = bestSupplier; LogisticSupply.product1Id[bid] = req.prodId; }
                      else if (req.slot === 2) { LogisticSupply.source2Id[bid] = bestSupplier; LogisticSupply.product2Id[bid] = req.prodId; }
                      else if (req.slot === 3) { LogisticSupply.source3Id[bid] = bestSupplier; LogisticSupply.product3Id[bid] = req.prodId; }
                      
                      LogisticSupply.autoSupply[bid] = 1;
                      LogisticSupply.transportCost[bid] = 50;
                  }
              }
          }
      }
  }
}
