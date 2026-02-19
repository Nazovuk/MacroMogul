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
  ProductBrand
} from '../components'
import { GameWorld, createBuilding } from '../world'
import { BuildingType } from '../../data/types'

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

    // ─── 1. DYNAMIC PRICING (Every Month) ───
    manageAIPricing(world, aiId, personality);

    // ─── Macro-Economic Adjustment ───
    // Interest rate sensitivity: if rates > 8%, conservative/balanced AI slows down
    const isRateWarning = globalInterestRate > 800
    const isRecession = globalGdpGrowth < 0
    
    // Dynamic expansion threshold based on macro + personality
    let dynamicThreshold = AIController.expansionThreshold[aiId] || 200000 // $200k base
    if (isRateWarning) dynamicThreshold *= personality === 0 ? 1.2 : 2.0 // Aggressive cares less
    if (isRecession) dynamicThreshold *= 3.0 // Recession freezes construction for almost everyone

    // ─── Debt Management ───
    // If debt is high and rates are rising, pay down debt before expanding
    if (currentDebt > 0 && isRateWarning && cash > 50000) {
      const payment = Math.min(cash * 0.5, currentDebt)
      Finances.cash[aiId] -= payment
      Finances.debt[aiId] -= payment
      console.log(`[Competitor] AI ${aiId} paying debt ($${payment/100}) due to high interest rates (${globalInterestRate/100}%)`)
      continue // Use this month's action for financial cleanup
    }

    if (cash > dynamicThreshold) {
      // 2. Vertical Integration Check (Supply Chain)
      // Check if any of our factories are starving for inputs
      if (attemptVerticalIntegration(world, aiId)) {
         AIController.lastActionTick[aiId] = world.tick;
         continue;
      }

      // 3. Identify Need for R&D (Strategic Tech Advantage)
      const hasRD = Array.from(defineQuery([Building, Company])(world.ecsWorld)).some(eid => 
         Company.companyId[eid] === Company.companyId[aiId] && Building.buildingTypeId[eid] === 33 // 33 is R&D
      );

      // AI Logic: Research is the future. Aggressive AI builds R&D faster.
      const rdChance = personality === 0 ? 0.90 : 0.96
      if (!hasRD && cash > dynamicThreshold * 1.5 && Math.random() > rdChance) {
         if (performAIConstruction(world, aiId, 33, 0)) {
            AIController.lastActionTick[aiId] = world.tick;
            continue;
         }
      }

      // 4. Identify Market Gaps (Expansion)
      const targetProduct = findMarketGaps(world)
      
      if (targetProduct) {
        let targetBuildingTypeId = 0;

        if (targetProduct.category === 'RAW') {
             const farm = Array.from(world.dataStore.buildings.values()).find(b => 
                 (b.type === BuildingType.FARM || b.type === BuildingType.MINE) && 
                 b.name.includes(targetProduct.name)
             );
             if (farm) targetBuildingTypeId = farm.id;
        } 
        else if (targetProduct.category === 'CONSUMER' && Math.random() > 0.4) {
             // AI prefers Retail for Consumer goods to get market share feedback
             const retail = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.RETAIL);
             if (retail) targetBuildingTypeId = retail.id;
        }
        else {
             const factory = Array.from(world.dataStore.buildings.values()).find(b => b.type === BuildingType.FACTORY);
             if (factory) targetBuildingTypeId = factory.id;
        }

        if (targetBuildingTypeId !== 0) {
           if (performAIConstruction(world, aiId, targetBuildingTypeId, targetProduct.id)) {
              AIController.lastActionTick[aiId] = world.tick
           }
        }
      }
    }

    // 5. Manage Research Projects
    updateAIResearch(world, aiId)
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
 * AI Logic: Dynamic Pricing
 * Adjusts prices based on inventory pressure.
 * High Inventory -> Lower Price
 * Low Inventory -> Raise Price
 */
function manageAIPricing(world: GameWorld, aiId: number, personality: number) {
    const retailQuery = defineQuery([Building, RetailPlot, Inventory, Company]);
    const myStores = retailQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === Company.companyId[aiId]);

    for (const sid of myStores) {
        const currentStock = Inventory.currentAmount[sid];
        const capacity = Inventory.capacity[sid];
        const utilization = currentStock / capacity; // 0.0 to 1.0

        let priceChange = 1.0;

        // Pricing logic
        if (utilization > 0.8) {
             // Too much stock, clearance sale!
             priceChange = 0.95; 
        } else if (utilization < 0.2) {
             // Low stock, scarcity pricing!
             priceChange = 1.05;
        }

        // Personality modifier: Aggressive AI cuts prices deeper
        if (personality === 0 && priceChange < 1.0) priceChange -= 0.02;

        if (priceChange !== 1.0) {
            const oldPrice = RetailPlot.price1[sid];
            const newPrice = Math.max(10, Math.floor(oldPrice * priceChange));
            
            if (newPrice !== oldPrice) {
               RetailPlot.price1[sid] = newPrice;
               RetailPlot.price2[sid] = newPrice;
               RetailPlot.price3[sid] = newPrice;
               // console.log(`[Competitor] AI ${aiId} adjusted price from ${oldPrice} to ${newPrice} (Util: ${utilization.toFixed(2)})`);
            }
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
          // We need AI's current quality for each owned product. 
          // Since finding "AI Quality" is complex (depends on factory/inventory), we'll assume AI wants to dominate.
          // If Max Market Quality > 50, and we are researching, we should pick the one with highest market quality to catch up.
          
          let candidateFound = false;
          for (const pid of ownedProds) {
              const marketMax = productQualityMap.get(pid) || 0;
              // If market has high quality (e.g. > 30), prioritize it
              // Gap = MarketMax - Reference (say 0, since we want to beat everyone)
              // Actually, simply picking the product with the HIGHEST standard in the market is a good strategy to stay relevant.
              if (marketMax > maxGap) {
                  maxGap = marketMax;
                  bestCandidate = pid;
                  candidateFound = true;
              }
          }

          // Simple Heuristic fallback
          if (!candidateFound || Math.random() > 0.7) {
            // 30% chance to just pick a random product to diversify research
             bestCandidate = ownedProds[Math.floor(Math.random() * ownedProds.length)];
          }

          // Special Tech: Process Innovation
          const buildingQuery = defineQuery([Building, Company])
          const buildingCount = buildingQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === Company.companyId[aiId]).length
          
          if (buildingCount > 5 && Math.random() > 0.8) {
            ResearchCenter.researchingProductId[rdId] = 1000
            notifyUI(`Competitor ${aiId} is investing in Process Efficiency!`, 'info');
          } else {
            ResearchCenter.researchingProductId[rdId] = bestCandidate
            // Get product name if possible, otherwise use ID
            const pData = world.dataStore.getProduct(bestCandidate);
            const pName = pData ? pData.name : `#${bestCandidate}`;
            notifyUI(`Competitor ${aiId} started R&D on ${pName}`, 'info'); 
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
      const pot = (pop / 1000) * pp * (sentiment / 50);
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
  const compName = ownerId === 0 ? "Player" : `Rival #${ownerId}`; // Simplified
  console.log(`[Competitor] ${compName} built ${bData.name} in City ${cityId}`);
  notifyUI(`${compName} expanded: New ${bData.name} construction approved.`, 'info');

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

  // Retail Pricing (Dynamic entry pricing)
  if (bData.type === BuildingType.RETAIL || bData.type === BuildingType.SUPERMARKET) {
      const p = world.dataStore.getProduct(productId);
      if (p) {
          // AI entry price: basePrice * 1.4 (competitive)
          const price = Math.floor(p.basePrice * 1.4);
          RetailPlot.price1[entity] = price;
          RetailPlot.price2[entity] = price;
          RetailPlot.price3[entity] = price;
      }
  }
}
