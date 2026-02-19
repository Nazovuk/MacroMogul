import { defineQuery } from 'bitecs'
import {
  Building,
  HumanResources,
  Factory,
  RetailExpertise,
  ResearchCenter,
  Company,
  MarketingOffice, 
  CityEconomicData,
  Position,
  EntityKind,
  EntityType,
  Finances
} from '../components'
import { GameWorld } from '../world'

/**
 * ManagementSystem handles internal company operations:
 * - HR: Salaries, Morale, Training
 * - Efficiency updates based on HR stats
 */
export const managementSystem = (world: GameWorld) => {
  // 1. Get City Wages
  const cityQuery = defineQuery([CityEconomicData, Position, EntityType])
  const cities = cityQuery(world.ecsWorld)
  const cityWages = new Map<number, number>()
  
  for (const cid of cities) {
    // Only process actual City entities
    if (EntityType.kind[cid] === EntityKind.City) {
       const cityId = Position.cityId[cid];
       cityWages.set(cityId, CityEconomicData.realWage[cid] || 300000); // Default $3k
    }
  }

  // 2. Process HR for Buildings
  const hrQuery = defineQuery([Building, HumanResources, Position])
  const entities = hrQuery(world.ecsWorld)

  for (const id of entities) {
    if (Building.isOperational[id] === 0) continue

    const cityId = Position.cityId[id]
    const marketWage = cityWages.get(cityId) || 300000 
    
    // --- PAYROLL & COSTS ---
    const headcount = HumanResources.headcount[id] || 10
    const salary = HumanResources.salary[id]
    const trainingBudget = HumanResources.trainingBudget[id]

    const monthlyWageBill = salary * headcount // Salary is monthly
    const totalCost = monthlyWageBill + trainingBudget

    // Deduct from Company Cash
    // Note: We need Company ID to find the wallet. 
    // This system usually runs on owned buildings. 
    // Let's assume the building entity has Company component (ownership)
    // If not, we skip financial deduction (AI handled elsewhere? Or assuming player owned?)
    // Actually, createBuilding adds Company component.
    const ownerId = Company.companyId[id];
    
    // Every company has a 'Finances' entity.
    // The ownerId (stored in Company component) corresponds to the entity ID of the company controller.
    if (ownerId > 0 && world.tick % 30 === 0) {
       const costPerDay = Math.floor(totalCost / 30);
       Finances.cash[ownerId] -= costPerDay;
       
       // For player (ID 1), also sync with world.cash reference used by UI
       if (ownerId === world.playerEntityId) {
         world.cash -= costPerDay;
       }
    }

    // --- MORALE CALCULATION ---
    // Compare salary to market wage
    const wageRatio = salary / marketWage
    let targetMorale = 50
    if (wageRatio > 1.0) targetMorale = 50 + (wageRatio - 1.0) * 50 // >100% wage -> >50 morale
    else targetMorale = 50 * wageRatio // <100% wage -> <50 morale
    
    targetMorale = Math.min(100, Math.max(0, targetMorale))
    
    // Trend morale towards target
    const currentMorale = HumanResources.morale[id]
    if (currentMorale < targetMorale) HumanResources.morale[id]++
    else if (currentMorale > targetMorale) HumanResources.morale[id]--


    // --- TRAINING CALCULATION ---
    // Budget per/head impacts training speed
    const spendPerHead = headcount > 0 ? trainingBudget / headcount : 0
    let targetTraining = Math.min(100, Math.floor(spendPerHead / 500)) // $5000/head = 100 training?
    
    const currentTraining = HumanResources.trainingLevel[id]
    if (currentTraining < targetTraining) {
        // Training takes time
        if (Math.random() > 0.5) HumanResources.trainingLevel[id]++
    } else if (currentTraining > targetTraining) {
        // Decay if budget cut
        if (Math.random() > 0.8) HumanResources.trainingLevel[id]--
    }


    // --- EFFICIENCY UPDATES ---
    // Overall Efficiency = (Morale * 0.4) + (Training * 0.6)
    const effectiveness = Math.floor((HumanResources.morale[id] * 0.4) + (HumanResources.trainingLevel[id] * 0.6))
    
    // Apply to Factory
    if (Factory.efficiency[id] !== undefined) {
       // Factories also depend on Technology, but that's base quality. 
       // Efficiency here creates 'Production Rate' bonus? 
       // For now, map HR effectiveness directly to efficiency
       Factory.efficiency[id] = effectiveness
    }

    // Apply to R&D
    if (ResearchCenter.efficiency[id] !== undefined) {
       ResearchCenter.efficiency[id] = effectiveness
    }

    // Apply to Marketing
    if (MarketingOffice.efficiency[id] !== undefined) {
      MarketingOffice.efficiency[id] = effectiveness
    }
    
    // Apply to Retail
    if (RetailExpertise.general[id] !== undefined) {
      // Retail expertise logic is complex (per category), but let's simplify
      RetailExpertise.general[id] = effectiveness
      RetailExpertise.apparel[id] = effectiveness
      RetailExpertise.electronics[id] = effectiveness
      RetailExpertise.food[id] = effectiveness
      RetailExpertise.luxury[id] = effectiveness
    }
  }

  return world
}
