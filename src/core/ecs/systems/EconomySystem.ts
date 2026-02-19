import { defineQuery } from 'bitecs'
import { Building, MarketData, Inventory, Company, CompanyTechnology, ProductBrand, CityEconomicData, Position } from '../components'
import { GameWorld } from '../world'
import { ProductCategory } from '../../data/types'

/**
 * EconomySystem manages high-level economic indicators:
 * 1. Updates product quality based on manufacturing and tech.
 * 2. Adjusts market share based on price vs. quality.
 * 3. Handles price inflation and macro trends.
 */
import { ProductionOutput } from '../components'

export const economySystem = (world: GameWorld) => {
  const buildingQuery = defineQuery([Building, MarketData, Inventory, ProductionOutput, Company])
  const entities = buildingQuery(world.ecsWorld)

  // Cache company tech levels for this tick
  const techQuery = defineQuery([CompanyTechnology])
  const techEntities = techQuery(world.ecsWorld)
  const techMap: Record<string, number> = {} // "compId-prodId" -> level
  
  for (const tid of techEntities) {
    const key = `${CompanyTechnology.companyId[tid]}-${CompanyTechnology.productId[tid]}`
    techMap[key] = CompanyTechnology.techLevel[tid]
  }

  // Cache city data
  const cityQuery = defineQuery([CityEconomicData, Position])
  const cityEntities = cityQuery(world.ecsWorld)
  const cityEconomy: Record<number, { pop: number, pp: number, demandMult: number }> = {}
  for (const cid of cityEntities) {
      cityEconomy[Position.cityId[cid]] = {
          pop: CityEconomicData.population[cid],
          pp: CityEconomicData.purchasingPower[cid],
          demandMult: CityEconomicData.industryDemandMult[cid] || 1.0,
      };
  }

  // Track total output per product
  const productTotals: Record<number, number> = {}
  
  // First pass: Calculate Price/Quality and Sum Totals
  for (const id of entities) {
    const prodId = Inventory.productId[id]
    const compId = Company.companyId[id]
    if (prodId === 0) continue

    // 1. Quality & Price Baseline
    // Quality is now tied to Company specific Product Technology level
    const techKey = `${compId}-${prodId}`
    const techLevel = techMap[techKey] || 40 // default starting quality if not researched
    
    MarketData.quality[id] = techLevel

    if (MarketData.price[id] === 0) {
        const prodData = world.dataStore.getProduct(prodId)
        if (prodData) {
            MarketData.price[id] = prodData.basePrice * 100
        }
    }

    // 4. Brand Integration
    // Get brand awareness for this product/company
    const brandQuery = defineQuery([ProductBrand])
    const brands = brandQuery(world.ecsWorld)
    const brandEntity = brands.find(bid => ProductBrand.companyId[bid] === compId && ProductBrand.productId[bid] === prodId)
    const awareness = brandEntity ? ProductBrand.awareness[brandEntity] : 10
    
    MarketData.brandPower[id] = awareness

    // Accumulate total "appeal"
    // Appeal = Output * (Quality / Price) * (1 + BrandPower/100)
    const output = ProductionOutput.actualOutput[id] || 10
    const brandMultiplier = 1 + (MarketData.brandPower[id] / 100)
    const appeal = output * (MarketData.quality[id] / (MarketData.price[id] / 100 || 1)) * brandMultiplier
    
    productTotals[prodId] = (productTotals[prodId] || 0) + appeal
  }

  // Second pass: Update individual Market Share
  for (const id of entities) {
    const prodId = Inventory.productId[id]
    if (prodId === 0 || !productTotals[prodId]) continue

    const output = ProductionOutput.actualOutput[id] || 10
    const brandMultiplier = 1 + (MarketData.brandPower[id] / 100)
    const appeal = output * (MarketData.quality[id] / (MarketData.price[id] / 100 || 1)) * brandMultiplier
    
    const share = Math.round((appeal / productTotals[prodId]) * 100)
    
    // Capping logic: If total output > city demand, adjust share to represent real penetration
    const cityId = Position.cityId[id]
    const econ = cityEconomy[cityId] || { pop: 1000000, pp: 50, demandMult: 1.0 }
    const product = world.dataStore.getProduct(prodId)
    
    // Estimated monthly demand = Pop * (PurchasingPower / 100) * CategoryFactor * MacroDemandMult
    const categoryFactor = product?.category === ProductCategory.RAW ? 0.3 : (product?.category === ProductCategory.CONSUMER ? 1.0 : 0.6)
    const cityDemand = econ.pop * (econ.pp / 100) * categoryFactor * econ.demandMult
    
    // Total market penetration
    const totalMarketAppeal = productTotals[prodId]
    // Log saturation periodically for debugging
    if (world.tick % 100 === 0 && id === entities[0]) {
        console.log(`[Economy] Prod ${prodId} Saturation: ${(totalMarketAppeal / (cityDemand * 10) * 100).toFixed(1)}% | DemandMult: ${econ.demandMult.toFixed(2)}`)
    }

    // In a more complex model, saturation would REDUCE actual sales.
    // For now, we use it to represent how much of the potential demand is met.
    MarketData.marketShare[id] = share

    // Sync market share back to ProductBrand entity (for UI and MarketingSystem feedback)
    const compIdForBrand = Company.companyId[id]
    const brandQuerySync = defineQuery([ProductBrand])
    const allBrands = brandQuerySync(world.ecsWorld)
    for (const bid of allBrands) {
      if (ProductBrand.companyId[bid] === compIdForBrand && ProductBrand.productId[bid] === prodId) {
        // Use max of building-level shares for this company+product
        if (share > (ProductBrand.marketShare[bid] || 0)) {
          ProductBrand.marketShare[bid] = share
        }
        break
      }
    }
  }

  return world
}
