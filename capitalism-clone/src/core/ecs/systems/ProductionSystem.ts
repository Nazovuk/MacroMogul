import { defineQuery } from 'bitecs'
import { Building, ProductionOutput, Factory, Maintenance, Inventory, Company, CompanyTechnology } from '../components'
import { GameWorld } from '../world'
import { BuildingType } from '../../data/types'

/**
 * ProductionSystem calculates the output and upkeep of all buildings.
 * It now handles:
 * 1. Raw material extraction (FARM, MINE)
 * 2. Manufacturing (FACTORY) requiring inputs
 * 3. Inventory updates
 * 4. HR Efficiency integration for output scaling
 * 5. Tech Level integration for quality calculation
 */
export const productionSystem = (world: GameWorld) => {
  const productionQuery = defineQuery([Building, ProductionOutput, Company])
  const entities = productionQuery(world.ecsWorld)

  // Cache tech lookups per company
  const techCache = new Map<number, Map<number, number>>()

  const getTechLevel = (companyId: number, productId: number): number => {
    if (!techCache.has(companyId)) {
      const techMap = new Map<number, number>()
      const techQuery = defineQuery([CompanyTechnology])
      const techEntities = techQuery(world.ecsWorld)
      for (const techId of techEntities) {
        if (CompanyTechnology.companyId[techId] === companyId) {
          techMap.set(CompanyTechnology.productId[techId], CompanyTechnology.techLevel[techId])
        }
      }
      techCache.set(companyId, techMap)
    }
    return techCache.get(companyId)?.get(productId) || 40 // Default 40 if not found
  }
  
  for (const id of entities) {
    const level = Building.level[id] || 1
    const buildingTypeId = Building.buildingTypeId[id]
    const buildingData = world.dataStore.getBuilding(buildingTypeId)
    
    if (!buildingData) continue

    // 1. Calculate Capacity
    // Base Capacity scaled by level
    const baseCapacity = buildingData.baseCost ? Math.floor(buildingData.baseCost / 10000) : 100
    const capacityMultiplier = Math.pow(1.5, level - 1)
    const capacity = Math.floor(baseCapacity * capacityMultiplier)
    ProductionOutput.capacity[id] = capacity
    
    // 2. Process Production based on Building Type
    // Check if operational
    const isOperational = Building.isOperational[id] === 1
    
    // Only produce if operational
    let actualProduced = 0
    if (isOperational) {
      const utilization = ProductionOutput.utilization[id] || 100
      // Apply HR efficiency multiplier: 100 efficiency = 1.0x, 0 = 0.5x, 200 = 1.5x
      const efficiency = Factory.efficiency[id] || 100
      const efficiencyMultiplier = 1 + (efficiency - 100) / 200
      let potentialOutput = Math.floor(capacity * (utilization / 100) * efficiencyMultiplier)

    if (buildingData.type === BuildingType.FARM || buildingData.type === BuildingType.MINE) {
      // Extraction buildings produce without inputs (simplified for now)
      actualProduced = potentialOutput
      // TODO: Link to specific natural resources on map
    } 
    else if (buildingData.type === BuildingType.FACTORY) {
      const recipeId = Factory.recipeId[id]
      const recipe = world.dataStore.getRecipe(recipeId)

      if (recipe) {
        // Factory requires inputs
        let canProduceCount = potentialOutput

        // Check input availability across all 3 slots
        const slots = [
          { prod: Inventory.input1ProductId[id], amt: Inventory.input1Amount[id], idx: 1 },
          { prod: Inventory.input2ProductId[id], amt: Inventory.input2Amount[id], idx: 2 },
          { prod: Inventory.input3ProductId[id], amt: Inventory.input3Amount[id], idx: 3 },
        ]

        // 1. Calculate max possible production based on ingredients
        for (const input of recipe.inputs) {
          const slot = slots.find(s => s.prod === input.productId)
          if (!slot) {
            canProduceCount = 0 // Missing ingredient entirely
            break
          }
          const maxFromIngredient = Math.floor(slot.amt / input.quantity)
          canProduceCount = Math.min(canProduceCount, maxFromIngredient)
        }

        if (canProduceCount > 0) {
          // 2. Consume inputs & Calculate Input Quality
          let totalInputQuality = 0
          let totalInputQuantity = 0

          for (const input of recipe.inputs) {
             const slot = slots.find(s => s.prod === input.productId)
             if (slot) {
               const consumed = input.quantity * canProduceCount
               
               let q = 0
               if (slot.idx === 1) { Inventory.input1Amount[id] -= consumed; q = Inventory.input1Quality[id]; }
               else if (slot.idx === 2) { Inventory.input2Amount[id] -= consumed; q = Inventory.input2Quality[id]; }
               else if (slot.idx === 3) { Inventory.input3Amount[id] -= consumed; q = Inventory.input3Quality[id]; }
               
               totalInputQuality += q * consumed
               totalInputQuantity += consumed
             }
          }

          // 3. Calculate Output Quality
          // Base Quality from Inputs
          const avgInputQuality = totalInputQuantity > 0 ? totalInputQuality / totalInputQuantity : 50

          // Tech Bonus - lookup company's tech level for this product
          const companyId = Company.companyId[id]
          const productTechLevel = getTechLevel(companyId, recipe.outputProductId)
          // Normalize tech level (0-1000 scale) to 0-100 for quality calc
          const normalizedTech = Math.min(100, productTechLevel / 10)

          // Quality formula: blend of input quality and tech level
          // Higher tech = ability to produce better quality from same inputs
          let finalQuality = Math.floor((avgInputQuality * 0.6) + (normalizedTech * 0.4))
          finalQuality = Math.min(100, Math.max(1, finalQuality))

          // 4. Produce output
          actualProduced = canProduceCount * recipe.outputQuantity
          // Note: Factory.efficiency is now managed by ManagementSystem (HR), don't overwrite here 
          
          // Set output product ID and Quality
          // If existing stock, average the quality?
          const currentStock = Inventory.currentAmount[id]
          const currentQuality = Inventory.quality[id] || 0
          
          if (currentStock > 0) {
              const blendedQuality = Math.floor(((currentStock * currentQuality) + (actualProduced * finalQuality)) / (currentStock + actualProduced))
              Inventory.quality[id] = blendedQuality
          } else {
              Inventory.quality[id] = finalQuality
          }

          Inventory.productId[id] = recipe.outputProductId
          
        } else {
          actualProduced = 0 // Not enough inputs
        }
      }
    }
  }

    ProductionOutput.actualOutput[id] = actualProduced

    // 3. Update Output Inventory (Output Slot)
    if (Inventory.capacity[id] > 0) {
      const current = Inventory.currentAmount[id]
      const space = Inventory.capacity[id] - current
      const toAdd = Math.min(actualProduced, space)
      Inventory.currentAmount[id] += toAdd
    }
  }

  // Upkeep calculation
  const maintenanceQuery = defineQuery([Building, Maintenance])
  const mEntities = maintenanceQuery(world.ecsWorld)

  for (const id of mEntities) {
    const level = Building.level[id] || 1
    const buildingType = world.dataStore.getBuilding(Building.buildingTypeId[id])
    
    // Upkeep grows with Level
    const baseUpkeep = buildingType?.powerConsumption || 1000
    const upkeepMultiplier = 1 + (level - 1) * 0.5 // +50% per level
    
    const isOperational = Building.isOperational[id] === 1
    // If stopped, reduce upkeep to 10% (security/maintenance only)
    const factor = isOperational ? 1.0 : 0.1
    
    // ─── R&D Integration: Production Technology ───
    // Tech Level for product ID 1000 (Production Tech) reduces upkeep
    // -1% upkeep per 10 points (max 20% reduction at level 200)
    const companyId = Company.companyId[id]
    const techLevel = getTechLevel(companyId, 1000) // Tech ID 1000 is internal Production Tech
    const upkeepReduction = Math.min(0.20, (techLevel / 1000))
    const techFactor = 1.0 - upkeepReduction
    
    Maintenance.monthlyCost[id] = Math.floor(baseUpkeep * upkeepMultiplier * factor * techFactor)
  }
  
  return world
}
