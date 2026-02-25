import { defineQuery } from 'bitecs'
import { Building, RetailPlot, Inventory, RetailExpertise, Company, ProductBrand, Finances, Position, CityEconomicData, MarketData } from '../components'
import { GameWorld } from '../world'
import { BuildingType } from '../../data/types'

/**
 * RetailSystem handles the sale of products to the local population.
 *
 * Logic Chain:
 * 1. Identify Retail & Supermarket buildings.
 * 2. Check for inventory of CONSUMER products.
 * 3. Calculate demand based on:
 *    - City Population (future integration)
 *    - Plot Traffic (RetailPlot.trafficIndex)
 *    - Price vs BasePrice (Price sensitivity)
 *    - Brand Awareness (from MarketingSystem)
 *    - Brand Loyalty (affects price sensitivity)
 *    - Retail Expertise (HR-based efficiency boost)
 * 4. Process sales: Decrease inventory, Increase company cash.
 */
export const retailSystem = (world: GameWorld) => {
  // Process sales every day (approx 30 ticks)
  const isProcessDay = world.tick % 30 === 0
  
  const retailQuery = defineQuery([Building, RetailPlot, Inventory, RetailExpertise, Company, Position])
  const entities = retailQuery(world.ecsWorld)
 
  // Cache market data
  const marketQuery = defineQuery([MarketData])
  const marketEntities = marketQuery(world.ecsWorld)
  const marketMap = new Map<number, { avgPrice: number, avgQuality: number }>()
  for (const meid of marketEntities) {
    marketMap.set(MarketData.productId[meid], {
      avgPrice: MarketData.price[meid],
      avgQuality: MarketData.quality[meid]
    })
  }

  // Cache city data entities
  const cityQuery = defineQuery([CityEconomicData, Position])
  const cityEntities = cityQuery(world.ecsWorld)
  const cityMap = new Map<number, number>()
  for (const ceid of cityEntities) {
    cityMap.set(Position.cityId[ceid], ceid)
  }

  // ─── NEW: City-Level Market Concentration ───
  // Map<CityID, Map<ProductID, Count>>
  const storeConcentration = new Map<number, Map<number, number>>()
  if (isProcessDay) {
    for (const id of entities) {
      if (Building.isOperational[id] === 0) continue
      const cityId = Position.cityId[id]
      const prods = [Inventory.input1ProductId[id], Inventory.input2ProductId[id], Inventory.input3ProductId[id]]
      
      if (!storeConcentration.has(cityId)) storeConcentration.set(cityId, new Map())
      const cityProds = storeConcentration.get(cityId)!
      
      for (const p of prods) {
        if (p > 0) {
          cityProds.set(p, (cityProds.get(p) || 0) + 1)
        }
      }
    }
  }

  // Cache brand lookups per company to avoid repeated queries
  const brandCache = new Map<number, Map<number, number>>()

  const getBrandData = (companyId: number, productId: number): { awareness: number; loyalty: number } | null => {
    if (!brandCache.has(companyId)) {
      const brandMap = new Map<number, number>()
      const brandQuery = defineQuery([ProductBrand])
      const brands = brandQuery(world.ecsWorld)
      for (const brandId of brands) {
        if (ProductBrand.companyId[brandId] === companyId) {
          brandMap.set(ProductBrand.productId[brandId], brandId)
        }
      }
      brandCache.set(companyId, brandMap)
    }

    const brandEntity = brandCache.get(companyId)?.get(productId)
    if (brandEntity) {
      return {
        awareness: ProductBrand.awareness[brandEntity],
        loyalty: ProductBrand.loyalty[brandEntity]
      }
    }
    return null
  }

  for (const id of entities) {
    const buildingTypeId = Building.buildingTypeId[id]
    const buildingData = world.dataStore.getBuilding(buildingTypeId)
    
    // Only RETAIL and SUPERMARKET sell to customers
    if (!buildingData || (buildingData.type !== BuildingType.RETAIL && buildingData.type !== BuildingType.SUPERMARKET)) {
      continue
    }

    if (Building.isOperational[id] === 0) continue

    // Iterate over 3 input slots (Retail stores sell what they buy)
    const slots = [
      { prod: Inventory.input1ProductId[id], amt: Inventory.input1Amount[id], quality: Inventory.input1Quality[id], idx: 1 },
      { prod: Inventory.input2ProductId[id], amt: Inventory.input2Amount[id], quality: Inventory.input2Quality[id], idx: 2 },
      { prod: Inventory.input3ProductId[id], amt: Inventory.input3Amount[id], quality: Inventory.input3Quality[id], idx: 3 },
    ]

    // ONLY PROCESS SALES ON PROCESSING DAYS
    if (!isProcessDay) continue

    for (const slot of slots) {
      if (slot.prod === 0 || slot.amt <= 0) continue

      const productData = world.dataStore.getProduct(slot.prod)
      if (!productData) continue

      // 1. Local Economic Factors
      const cityId = Position.cityId[id]
      const cityEntity = cityMap.get(cityId)
      
      const population = cityEntity ? CityEconomicData.population[cityEntity] : 1000000
      const purchasingPower = cityEntity ? CityEconomicData.purchasingPower[cityEntity] : 70
      const sentiment = cityEntity ? CityEconomicData.consumerSentiment[cityEntity] : 70
      const industryDemand = cityEntity ? (CityEconomicData.industryDemandMult[cityEntity] || 1.0) : 1.0
      const unemployment = cityEntity ? (CityEconomicData.unemployment[cityEntity] || 6) : 6
      
      // Multipliers based on city data
      const popMult = population / 1000000 // scaled by 1M baseline
      const econMult = (purchasingPower / 70) * (sentiment / 70)
      // High unemployment = cautious consumers (0.9x at 15%, 1.0x at 6%)
      const unemploymentDrag = Math.max(0.7, 1 - (unemployment - 6) / 90)
      
      // Holiday Seasonality (Q4 Boom: Nov/Dec)
      const isHolidaySeason = world.month === 11 || world.month === 12;
      const holidayBoom = isHolidaySeason ? 1.35 : 1.0;

      // Macro demand wave from MacroEconomySystem + Seasonality
      const macroDemandMult = industryDemand * unemploymentDrag * holidayBoom;

      // 1.5. RETAIL SHRINKAGE (Theft / Loss)
      // High unemployment increases daily theft rate
      if (isProcessDay && unemployment > 5) {
          const theftRate = (unemployment / 100) * 0.005; // 0.05% loss per day at 10% unemployment
          const stolenAmount = Math.floor(slot.amt * theftRate);
          if (stolenAmount > 0) {
              if (slot.idx === 1) Inventory.input1Amount[id] = Math.max(0, Inventory.input1Amount[id] - stolenAmount);
              else if (slot.idx === 2) Inventory.input2Amount[id] = Math.max(0, Inventory.input2Amount[id] - stolenAmount);
              else if (slot.idx === 3) Inventory.input3Amount[id] = Math.max(0, Inventory.input3Amount[id] - stolenAmount);
              
              // Only log occasionally to avoid spam
              if (Math.random() < 0.01) {
                  // console.log(`[RETAIL] Shrinkage: Building ${id} lost ${stolenAmount} units to theft/spoilage.`);
              }
          }
      }

      // 2. Get Configured Price or default to 150% markup
      let currentPrice = 0
      if (slot.idx === 1) currentPrice = RetailPlot.price1[id]
      else if (slot.idx === 2) currentPrice = RetailPlot.price2[id]
      else if (slot.idx === 3) currentPrice = RetailPlot.price3[id]

      if (currentPrice === 0) {
        currentPrice = Math.floor(productData.basePrice * 1.5)
        // Store the default price so UI sees it
        if (slot.idx === 1) RetailPlot.price1[id] = currentPrice
        else if (slot.idx === 2) RetailPlot.price2[id] = currentPrice
        else if (slot.idx === 3) RetailPlot.price3[id] = currentPrice
      }

      // 3. Calculate Demand Factors
      // Base demand scaled by traffic index (0-100) and population
      const trafficMult = (RetailPlot.trafficIndex[id] || 50) / 50
      const baseDemand = productData.baseDemand * trafficMult * popMult * econMult

      // Get Brand Data for demand boost
      const companyId = Company.companyId[id]
      const brandData = getBrandData(companyId, slot.prod)
      const awareness = brandData?.awareness || 5 // Base 5% awareness
      const loyalty = brandData?.loyalty || 10

      // Brand Awareness multiplier: 0-100 awareness maps to 0.5x - 1.5x demand
      const awarenessMult = 0.5 + (awareness / 100)

      // Market share feedback: market leaders get small demand bonus (network effect)
      const brandEntity = brandCache.get(companyId)?.get(slot.prod)
      const mktShare = brandEntity ? (ProductBrand.marketShare[brandEntity] || 0) : 0
      const marketLeaderBonus = 1 + (mktShare / 500) // 50% share → 1.10x

      // Price Sensitivity (modified by brand loyalty)
      const priceRatio = currentPrice / productData.basePrice
      const loyaltyFactor = 1 - (loyalty / 200) // 0.5 to 1.0

      // Retail Expertise boost: 100 expertise = 1.0x, 200 = 1.5x, 0 = 0.5x
      const expertise = RetailExpertise.general[id] || 50
      const expertiseMult = 1 + (expertise - 100) / 200

      // Quality multiplier: 50 = 1.0x, 100 = 1.5x, 0 = 0.5x
      const productQuality = slot.quality || 50
      const qualityMult = 0.5 + (productQuality / 100)

      // Adjust price ratio by quality
      const qualityPriceAdjustment = 1 - ((productQuality - 50) / 200) 
      const adjustedPriceRatio = priceRatio * qualityPriceAdjustment
      const adjustedPriceMult = Math.max(0, 1.5 - (adjustedPriceRatio - 1) * 0.75 * loyaltyFactor)

      // ─── HIGH-TECH / OBSOLESCENCE FACTOR ───
      const productTechLevel = world.techLookup.get(companyId)?.get(slot.prod) || 40
      const normTech = Math.floor(productTechLevel / 10)
      
      // Look up world Era Level (highest global tech level)
      const globalTechEra = Math.max(...Array.from(world.techLookup.values()).map(m => Math.max(...Array.from(m.values()), 0)), 40)
      const normGlobal = Math.floor(globalTechEra / 10)
      
      // Obsolescence drag: if tech is behind global era, demand drops
      const techBehind = Math.max(0, normGlobal - normTech)
      const obsolescenceDrag = Math.max(0.3, 1 - (techBehind * 0.05)) // 5% drop per level behind

      // ─── COMPETITIVE VALUE FACTOR ───
      const marketInfo = marketMap.get(slot.prod)
      let competitiveMult = 1.0
      
      if (marketInfo) {
          const avgPrice = marketInfo.avgPrice || currentPrice
          const avgQuality = marketInfo.avgQuality || productQuality
          
          // Value relative to market
          const myValue = productQuality / (currentPrice / 100)
          const marketValue = avgQuality / (avgPrice / 100)
          
          if (marketValue > 0) {
              const valueRatio = myValue / marketValue
              competitiveMult = 0.5 + (Math.min(2.0, valueRatio) * 0.5)
          }
      }

      // ─── SATURATION FACTOR (NEW) ───
      // If there are many stores in this city selling the same product, they share the market
      const cityConcentration = storeConcentration.get(cityId)?.get(slot.prod) || 1
      const saturationPenalty = Math.max(0.4, 1.2 / Math.sqrt(cityConcentration)) // 1 store=1.2, 4 stores=0.6, 9 stores=0.4

      const directive = Company.strategicDirective[companyId] || 0
      let directiveDemandMult = 1.0
      if (directive === 2) directiveDemandMult = 1.2 // Market Aggression

      const dailyDemand = Math.floor(baseDemand * adjustedPriceMult * expertiseMult * awarenessMult * qualityMult * macroDemandMult * marketLeaderBonus * obsolescenceDrag * competitiveMult * saturationPenalty * directiveDemandMult)
      
      // 4. Process Sales
      const actualSales = Math.min(slot.amt, dailyDemand)

      if (actualSales > 0) {
        // Decrease stock in the specific slot
        if (slot.idx === 1) Inventory.input1Amount[id] -= actualSales
        else if (slot.idx === 2) Inventory.input2Amount[id] -= actualSales
        else if (slot.idx === 3) Inventory.input3Amount[id] -= actualSales
        
        // Calculate Revenue (Price * Quantity)
        const revenue = Math.floor(actualSales * currentPrice)
        
        // Credit Company Cash
        const ownerId = Company.companyId[id];
        
        if (ownerId > 0) {
          Finances.cash[ownerId] += revenue;
          // Accumulate Month-to-date Revenue
          if (Company.companyId[id] === ownerId) {
             Company.currentMonthRevenue[id] = (Company.currentMonthRevenue[id] || 0) + revenue;
          }
        }

        if (ownerId === world.playerEntityId) {
          world.cash += revenue;
        }

        // ─── STOCKOUT PENALTY (BRAND LOYALTY DAMAGE) ───
        // If demand significantly exceeds our supply, customers leave angry
        if (actualSales === slot.amt && dailyDemand > actualSales * 1.5) {
            const brandEId = brandCache.get(Company.companyId[id])?.get(slot.prod);
            if (brandEId && isProcessDay) {
                // Minor loyalty hit per stockout
                ProductBrand.loyalty[brandEId] = Math.max(0, ProductBrand.loyalty[brandEId] - 1);
                
                // If it's the player's store, maybe trigger a notification occasionally
                if (ownerId === world.playerEntityId && Math.random() < 0.05) {
                    const pName = world.dataStore.getProduct(slot.prod)?.name || 'product';
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('game-notification', {
                            detail: {
                                message: `Stockout! Angry customers couldn't find ${pName} at Retail #${id}. Loyalty dropped.`,
                                type: 'warning',
                                timestamp: Date.now()
                            }
                        }));
                    }
                }
            }
        }
      } else if (slot.amt === 0 && dailyDemand > 0 && isProcessDay) {
         // Complete stockout with active demand!
         const brandEId = brandCache.get(Company.companyId[id])?.get(slot.prod);
         if (brandEId) {
             ProductBrand.loyalty[brandEId] = Math.max(0, ProductBrand.loyalty[brandEId] - 2);
         }
      }
    }

    // Daily Expenses (Rent & Utilities)
    if (world.tick % 30 === 0) {
        const ownerId = Company.companyId[id];
        const traffic = RetailPlot.trafficIndex[id] || 100;
        const size = Building.size[id] || 1;
        // Base rent factor: $500 per traffic point per size unit per month (in cents)
        const monthlyRent = Math.floor(traffic * size * 500);
        const dailyRent = Math.floor(monthlyRent / 30);
        
        const directive = Company.strategicDirective[ownerId] || 0
        let directiveCostMult = 1.0
        if (directive === 2) directiveCostMult = 1.25 // Market Aggression overhead

        if (ownerId > 0 && dailyRent > 0) {
          const finalDailyRent = Math.floor(dailyRent * directiveCostMult);
          Finances.cash[ownerId] -= finalDailyRent;
          
          // Accumulate Month-to-date Expenses
          if (Company.companyId[id] === ownerId) {
             Company.currentMonthExpenses[id] = (Company.currentMonthExpenses[id] || 0) + finalDailyRent;
          }

          if (ownerId === world.playerEntityId) {
              world.cash -= finalDailyRent;
          }
        }
    }
  }

  return world
}
