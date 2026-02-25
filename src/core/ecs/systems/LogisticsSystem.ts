import { defineQuery } from 'bitecs'
import { LogisticSupply, Inventory, Building, Company, Finances, Position, Strike, Executive } from '../components'
import { GameWorld } from '../world'
import { ProductCategory } from '../../data/types'
import { globalFuelPrice } from './MacroEconomySystem'

/**
 * LogisticsSystem — Supply Chain & Distribution Engine
 *
 * Handles the physical movement of goods between buildings within the same
 * company. Simulates transport logistics with realistic cost factors.
 *
 * Features:
 *   1. Multi-slot supply routing (3 input slots per building)
 *   2. Weighted quality blending on arrival
 *   3. Distance-based transport costs (same city = cheap, cross-city = expensive)
 *   4. Fuel-adjusted transport costs from MacroEconomySystem
 *   5. Transport capacity scaling with building size
 *   6. Spoilage risk for long-distance perishable goods
 *   7. Full P&L integration (expenses tracked per company)
 */

// Base transfer rate per tick (units)
const BASE_TRANSFER_RATE = 2000
// Cross-city transport multiplier
const CROSS_CITY_COST_MULT = 3.0
// Minimum transport cost per unit (cents)  
const MIN_TRANSPORT_COST = 5
// Distance calculation: 1 grid unit = this many "virtual km"
const GRID_TO_KM = 10
// Max transport distance before exponential cost increase
const MAX_EFFICIENT_DISTANCE = 50

// Calculate Euclidean distance between two buildings
const calculateDistance = (sourceId: number, destId: number): number => {
  const dx = Position.x[sourceId] - Position.x[destId]
  const dy = Position.y[sourceId] - Position.y[destId]
  return Math.sqrt(dx * dx + dy * dy) * GRID_TO_KM
}

// AI helper: Calculate total logistics cost for supplier selection
export const calculateLogisticsCost = (
  sourceId: number,
  destId: number,
  amount: number
): number => {
  const distance = calculateDistance(sourceId, destId)
  const sourceCityId = Position.cityId[sourceId]
  const destCityId = Position.cityId[destId]
  const isCrossCity = sourceCityId !== destCityId
  
  // Base transport cost rate from component (default 10)
  const baseCostRate = LogisticSupply.transportCost[destId] || 10
  
  // Fuel impact: Normalizing around $80/bbl (8000 cents)
  const fuelFactor = globalFuelPrice / 8000
  
  // Cross-city premium
  const distanceMult = isCrossCity ? CROSS_CITY_COST_MULT : 1.0
  
  // Distance penalty for very long routes (inefficient)
  const distancePenalty = (distance / GRID_TO_KM) > MAX_EFFICIENT_DISTANCE 
    ? 1 + (((distance / GRID_TO_KM) - MAX_EFFICIENT_DISTANCE) / 100) 
    : 1.0
  
  const costPerUnit = Math.max(MIN_TRANSPORT_COST, Math.floor((distance / GRID_TO_KM) * baseCostRate * fuelFactor * distanceMult * distancePenalty / 100))
  return Math.floor(costPerUnit * amount)
}

// AI helper: Find optimal supplier considering both price and logistics
export const findOptimalSupplier = (
  productId: number,
  destId: number,
  candidateIds: number[]
): { supplierId: number; totalCost: number } | null => {
  if (candidateIds.length === 0) return null
  
  let bestSupplier = candidateIds[0]
  let lowestTotalCost = Infinity
  
  for (const sourceId of candidateIds) {
    if (Inventory.productId[sourceId] !== productId) continue
    if (Inventory.currentAmount[sourceId] <= 0) continue
    
    // Get product base price (placeholder for now)
    const basePrice = 100 
    
    // Calculate logistics cost for a standard amount (1000 units)
    const logisticsCost = calculateLogisticsCost(sourceId, destId, 1000)
    const totalCost = (basePrice * 1000) + logisticsCost
    
    if (totalCost < lowestTotalCost) {
      lowestTotalCost = totalCost
      bestSupplier = sourceId
    }
  }
  
  return { supplierId: bestSupplier, totalCost: lowestTotalCost }
}

export const logisticsSystem = (world: GameWorld) => {
  const supplyQuery = defineQuery([LogisticSupply, Inventory, Building, Company, Position])
  const destinations = supplyQuery(world.ecsWorld)

  // Pre-calculate COO logistics discount per company
  const cooQuery = defineQuery([Executive, Company]);
  const cooEntities = cooQuery(world.ecsWorld);
  const cooDiscounts = new Map<number, number>(); // companyId -> discount multiplier

  for (const eid of cooEntities) {
    if (Executive.role[eid] === 1) { // 1 = COO
      const compId = Company.companyId[eid];
      // Max 30% discount at 100 manufacturing expertise
      const expertise = Executive.expertiseManufacturing[eid] || 0;
      const discount = Math.max(0.7, 1.0 - (expertise / 100) * 0.30);
      cooDiscounts.set(compId, discount);
    }
  }

  // Track total logistics expenses per company for monthly reporting
  const logisticsExpenses = new Map<number, number>()

  for (const destId of destinations) {
    if (Building.isOperational[destId] === 0) continue

    const destCityId = Position.cityId[destId]
    const destSize = Building.size[destId] || 1

    // Process all 3 potential input slots
    for (let slotIdx = 1; slotIdx <= 3; slotIdx++) {
      let sourceId = 0
      let productId = 0
      
      if (slotIdx === 1) {
        sourceId = LogisticSupply.source1Id[destId]
        productId = LogisticSupply.product1Id[destId]
      } else if (slotIdx === 2) {
        sourceId = LogisticSupply.source2Id[destId]
        productId = LogisticSupply.product2Id[destId]
      } else if (slotIdx === 3) {
        sourceId = LogisticSupply.source3Id[destId]
        productId = LogisticSupply.product3Id[destId]
      }

      if (sourceId === 0 || productId === 0) continue

      // Verify Source Inventory
      const sourceStock = Inventory.currentAmount[sourceId]
      const sourceProdId = Inventory.productId[sourceId]
      const sourceQuality = Inventory.quality[sourceId] || 0

      if (sourceProdId !== productId || sourceStock <= 0) continue

      // ─── Supply Chain Disruption (Strikes) ───
      const destStrike = Strike.severity[destId] || 0
      const sourceStrike = Strike.severity[sourceId] || 0
      if (destStrike >= 2 || sourceStrike >= 2) {
         // Critical strike completely freezes logistics in or out of this facility
         continue
      }
      const strikePenalty = (destStrike === 1 || sourceStrike === 1) ? 2.0 : 1.0 // 2x transport cost during minor strikes

      // ─── Destination Capacity ───
      const destCap = 5000 * Math.max(1, destSize)
      
      let currentInputAmount = 0
      let currentInputQuality = 0
      
      if (slotIdx === 1) {
         currentInputAmount = Inventory.input1Amount[destId]
         currentInputQuality = Inventory.input1Quality[destId]
      } else if (slotIdx === 2) {
         currentInputAmount = Inventory.input2Amount[destId]
         currentInputQuality = Inventory.input2Quality[destId]
      } else {
         currentInputAmount = Inventory.input3Amount[destId]
         currentInputQuality = Inventory.input3Quality[destId]
      }

      const room = destCap - currentInputAmount
      if (room <= 0) continue

      // ─── Transfer Rate ───
      const transferRate = BASE_TRANSFER_RATE * Math.max(1, Math.sqrt(destSize))
      // Supply chain shock due to strikes
      const shockModifier = destStrike === 1 || sourceStrike === 1 ? 0.5 : 1.0;
      const toMove = Math.min(sourceStock, room, transferRate * shockModifier)

      if (toMove <= 0) continue

      // ─── Distance & Cost Calculation ───
      const sourceCityId = Position.cityId[sourceId]
      const dx = Position.x[destId] - Position.x[sourceId]
      const dy = Position.y[destId] - Position.y[sourceId]
      const gridDistance = Math.sqrt(dx * dx + dy * dy)
      const isCrossCity = sourceCityId !== destCityId && sourceCityId > 0 && destCityId > 0

      // Base transport rate from component (default 10)
      const baseCostRate = LogisticSupply.transportCost[destId] || 10

      // Distance premium (same city: 1x, cross-city: 3x)
      const distanceMult = isCrossCity ? CROSS_CITY_COST_MULT : 1.0

      // Fuel impact: Normalizing around $80/bbl
      const fuelFactor = globalFuelPrice / 8000
      
      const distancePenalty = gridDistance > MAX_EFFICIENT_DISTANCE 
        ? 1 + ((gridDistance - MAX_EFFICIENT_DISTANCE) / 100) 
        : 1.0

      // ─── COO Logistics Optimization ───
      const ownerId = Company.companyId[destId]
      const cooDiscount = ownerId ? (cooDiscounts.get(ownerId) || 1.0) : 1.0;

      const rawUnitCost = Math.floor(gridDistance * baseCostRate * fuelFactor * distanceMult * distancePenalty * cooDiscount * strikePenalty / 100)
      const costPerUnit = Math.max(MIN_TRANSPORT_COST, rawUnitCost)
      const totalTransferCost = Math.floor((costPerUnit * toMove) / 100)

      // ─── Quality Blending ───
      const totalQty = currentInputAmount + toMove
      let newQuality = sourceQuality
      if (totalQty > 0 && currentInputAmount > 0) {
        newQuality = Math.floor(
          ((currentInputAmount * currentInputQuality) + (toMove * sourceQuality)) / totalQty
        )
      }

      // Cross-city spoilage & Theft risk
      if (isCrossCity && newQuality > 0) {
        const product = world.dataStore.getProduct(productId)
        const isPerishable = product?.category === ProductCategory.RAW
        
        let spoilageFactor = isPerishable ? 0.03 : 0.01;
        // Bad logistics management (no COO discount) increases spoilage/theft risk
        if (cooDiscount > 0.95) spoilageFactor *= 1.5; 

        newQuality = Math.max(1, newQuality - Math.floor(newQuality * spoilageFactor))
      }

      // ─── Update Destination ───
      if (slotIdx === 1) {
        Inventory.input1Amount[destId] += toMove
        Inventory.input1ProductId[destId] = productId
        Inventory.input1Quality[destId] = newQuality
      } else if (slotIdx === 2) {
        Inventory.input2Amount[destId] += toMove
        Inventory.input2ProductId[destId] = productId
        Inventory.input2Quality[destId] = newQuality
      } else {
        Inventory.input3Amount[destId] += toMove
        Inventory.input3ProductId[destId] = productId
        Inventory.input3Quality[destId] = newQuality
      }

      // ─── Update Source ───
      Inventory.currentAmount[sourceId] -= toMove

      // ─── Financial Deduction ───
      if (ownerId > 0 && totalTransferCost > 0) {
        Finances.cash[ownerId] -= totalTransferCost
        logisticsExpenses.set(ownerId, (logisticsExpenses.get(ownerId) || 0) + totalTransferCost)
        if (ownerId === world.playerEntityId) {
          world.cash -= totalTransferCost
        }
      }
    }
  }

  // Monthly Expense Reporting
  if (world.tick % 30 === 0) {
    for (const [companyId, expense] of logisticsExpenses) {
      if (companyId > 0) {
        Finances.cash[companyId] -= expense
        Company.currentMonthExpenses[companyId] = (Company.currentMonthExpenses[companyId] || 0) + expense
        
        // Sync player cash if this is the player's company
        if (companyId === world.playerEntityId) {
          world.cash -= expense
        }
      }
    }
  }

  return world
}
