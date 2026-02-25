import { defineQuery, hasComponent, addComponent } from 'bitecs'
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
  Finances,
  Executive,
  ExecutiveRole,
  ManagementUnit,
  BrandLoyalty,
  Strike
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
    
    const ownerId = Company.companyId[id];

    // --- STRATEGIC DIRECTIVE EFFECTS ---
    const directive = Company.strategicDirective[ownerId] || 0;
    let directiveCostMult = 1.0;
    let modifierMoraleOffset = 0;

    if (directive === 3) { // Lean Operations
      directiveCostMult = 0.85; // 15% cheaper
      modifierMoraleOffset -= 5; // Lower morale
    }

    // --- HQ POLICIES EFFECTS ---
    const policies = Company.activePolicies[ownerId] || 0;
    const hasTraining = (policies & 1) === 1;
    const hasAutomation = (policies & 2) === 2;
    const hasBenefits = (policies & 4) === 4;

    if (hasAutomation) modifierMoraleOffset -= 10; // Automation causes job insecurity
    if (hasBenefits) modifierMoraleOffset += 15; // Premium benefits boost morale

    // --- PAYROLL & COSTS ---
    const headcount = HumanResources.headcount[id] || 10
    const salary = HumanResources.salary[id]
    const benefits = HumanResources.benefits[id] || 0
    const trainingBudget = HumanResources.trainingBudget[id]

    let monthlyWageBill = (salary + benefits) * headcount // Total comp bill
    if (hasAutomation) monthlyWageBill *= 0.8; // Automation reduces effective labor cost by 20%
    const totalCost = Math.floor((monthlyWageBill + trainingBudget) * directiveCostMult)

    // Deduct from Company Cash
    if (ownerId > 0 && world.tick % 30 === 0) {
       const costPerDay = Math.floor(totalCost / 30);
       Finances.cash[ownerId] -= costPerDay;
       
       if (ownerId === world.playerEntityId) {
         world.cash -= costPerDay;
       }
    }

    // --- MORALE CALCULATION ---
    const totalComp = salary + benefits
    const wageRatio = totalComp / marketWage
    const benefitBonus = Math.min(20, (benefits / (salary || 1)) * 100)
    
    let targetMorale = 50
    if (wageRatio > 1.0) targetMorale = 50 + (wageRatio - 1.0) * 50 + benefitBonus
    else targetMorale = 50 * wageRatio + (benefitBonus / 2)
    
    targetMorale = Math.min(100, Math.max(0, targetMorale + modifierMoraleOffset))
    
    // Trend morale towards target
    const currentMorale = HumanResources.morale[id]
    if (currentMorale < targetMorale) HumanResources.morale[id]++
    else if (currentMorale > targetMorale) HumanResources.morale[id]--


    // --- TRAINING CALCULATION ---
    // Budget per/head impacts training speed
    const spendPerHead = headcount > 0 ? trainingBudget / headcount : 0
    let targetTraining = Math.min(100, Math.floor(spendPerHead / 500)) // $5000/head = 100 training?
    
    if (hasTraining) {
       targetTraining = Math.min(100, targetTraining + 25); // +25 bonus to training cap
    }

    const currentTraining = HumanResources.trainingLevel[id]
    if (currentTraining < targetTraining) {
        // Training takes time
        if (Math.random() > 0.5) HumanResources.trainingLevel[id]++
    } else if (currentTraining > targetTraining) {
        // Decay if budget cut, but Training policy prevents natural decay
        if (!hasTraining && Math.random() > 0.8) HumanResources.trainingLevel[id]--
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
      RetailExpertise.general[id] = effectiveness
      RetailExpertise.apparel[id] = effectiveness
      RetailExpertise.electronics[id] = effectiveness
      RetailExpertise.food[id] = effectiveness
      RetailExpertise.luxury[id] = effectiveness
    }
  }

  // Deduct fixed monthly overheads for active company policies
  const companyQuery = defineQuery([Company, Finances])
  const activeCompanies = companyQuery(world.ecsWorld)
  for (const cid of activeCompanies) {
    if (world.tick % 30 === 0) {
       const policies = Company.activePolicies[cid] || 0;
       let policyCost = 0;
       
       if ((policies & 1) === 1) policyCost += 100_000_000 / 30; // $1M/yr -> per day approx
       if ((policies & 2) === 2) policyCost += 250_000_000 / 30; // $2.5M/yr
       if ((policies & 4) === 4) policyCost += 50_000_000 / 30;  // $500k/yr
       
       policyCost = Math.floor(policyCost);

       if (policyCost > 0) {
           Finances.cash[cid] -= policyCost;
           Company.currentMonthExpenses[cid] = (Company.currentMonthExpenses[cid] || 0) + policyCost;
           if (cid === world.playerEntityId) {
              world.cash -= policyCost;
           }
       }
    }
  }

  // 3. Executive Management Effects
  processExecutiveEffects(world)

  // 4. Management Unit Friction & Efficiency
  processManagementUnits(world)

  // 5. Employee Turnover & Attrition
  processEmployeeTurnover(world)

  // 6. Strike Risk Assessment & Resolution
  processStrikeRisk(world)

  return world
}

/**
 * Executive Effects: Different C-level executives provide bonuses to operations
 */
function processExecutiveEffects(world: GameWorld) {
  const execQuery = defineQuery([Executive, Company])
  const execEntities = execQuery(world.ecsWorld)

  for (const execId of execEntities) {
    const role = Executive.role[execId]
    const loyalty = Executive.loyalty[execId] || 50
    const companyId = Company.companyId[execId]

    // Find all buildings owned by this company
    const buildingQuery = defineQuery([Building, Company, HumanResources])
    const companyBuildings = buildingQuery(world.ecsWorld).filter(
      eid => Company.companyId[eid] === companyId && Building.isOperational[eid] === 1
    )

    // Calculate executive effectiveness (loyalty affects performance)
    const effectiveness = 0.5 + (loyalty / 100) * 0.5 // 50% to 100% effectiveness

    for (const bId of companyBuildings) {
      switch (role) {
        case ExecutiveRole.COO:
          // COO boosts overall operational efficiency
          if (Factory.efficiency[bId] !== undefined) {
            Factory.efficiency[bId] = Math.min(100, Factory.efficiency[bId] + Math.floor(5 * effectiveness))
          }
          break

        case ExecutiveRole.CTO:
          // CTO boosts R&D efficiency and building quality
          if (ResearchCenter.efficiency[bId] !== undefined) {
            ResearchCenter.efficiency[bId] = Math.min(100, ResearchCenter.efficiency[bId] + Math.floor(8 * effectiveness))
          }
          if (Factory.quality[bId] !== undefined) {
            Factory.quality[bId] = Math.min(100, Factory.quality[bId] + Math.floor(3 * effectiveness))
          }
          break

        case ExecutiveRole.CMO:
          // CMO boosts marketing effectiveness and brand loyalty
          if (MarketingOffice.efficiency[bId] !== undefined) {
            MarketingOffice.efficiency[bId] = Math.min(100, MarketingOffice.efficiency[bId] + Math.floor(10 * effectiveness))
          }
          // Find associated brand loyalty
          const brandQuery = defineQuery([BrandLoyalty, Company])
          const brands = brandQuery(world.ecsWorld).filter(eid => Company.companyId[eid] === companyId)
          for (const brandId of brands) {
            BrandLoyalty.awareness[brandId] = Math.min(100, BrandLoyalty.awareness[brandId] + Math.floor(2 * effectiveness))
          }
          break

        case ExecutiveRole.CFO:
          // CFO reduces operational costs (simulated by reducing cash burn rate)
          // This is handled in financial calculations - CFO presence reduces costs by 5%
          break

        case ExecutiveRole.CHRO:
          // CHRO boosts morale and reduces turnover
          if (HumanResources.morale[bId] !== undefined) {
            const boost = Math.floor(3 * effectiveness)
            HumanResources.morale[bId] = Math.min(100, HumanResources.morale[bId] + boost)
          }
          break
      }
    }
  }
}

/**
 * Management Units: Handle span of control and internal friction
 */
function processManagementUnits(world: GameWorld) {
  const mgmtQuery = defineQuery([ManagementUnit, Building, HumanResources])
  const mgmtEntities = mgmtQuery(world.ecsWorld)

  for (const mId of mgmtEntities) {
    const unitsManaged = ManagementUnit.unitsManaged[mId] || 0

    // Calculate optimal span of control (3x3 grid = 9 units optimal)
    const optimalSpan = 9
    const spanPenalty = Math.max(0, (unitsManaged - optimalSpan) * 2) // -2% per unit over optimal

    // Friction increases with low morale and poor training
    const morale = HumanResources.morale[mId] || 50
    const training = HumanResources.trainingLevel[mId] || 50
    const baseFriction = Math.floor((100 - morale) * 0.2 + (100 - training) * 0.1)

    // Update friction and efficiency
    const newFriction = Math.min(100, baseFriction + spanPenalty)
    ManagementUnit.internalFriction[mId] = newFriction

    // Efficiency = 100 - friction
    let newEfficiency = Math.max(20, 100 - newFriction)

    // apply minor strike penalty
    if (hasComponent(world.ecsWorld, Strike, mId) && Strike.severity[mId] === 1) {
       newEfficiency = Math.max(10, Math.floor(newEfficiency * 0.5))
    }

    ManagementUnit.efficiency[mId] = newEfficiency;

    // Apply efficiency penalty to production
    if (Factory.efficiency[mId] !== undefined) {
      const hrModifier = calculateProductivityModifier(world, mId)
      Factory.efficiency[mId] = Math.floor(Factory.efficiency[mId] * (newEfficiency / 100) * hrModifier)
    }
  }
}

/**
 * Employee Turnover: Staff leave if morale is too low or wages uncompetitive
 */
function processEmployeeTurnover(world: GameWorld) {
  // Only process on monthly tick
  if (world.tick % 900 !== 0) return

  const hrQuery = defineQuery([Building, HumanResources, Position])
  const entities = hrQuery(world.ecsWorld)

  for (const id of entities) {
    if (Building.isOperational[id] === 0) continue

    const morale = HumanResources.morale[id] || 50
    const headcount = HumanResources.headcount[id] || 10
    const salary = HumanResources.salary[id] || 300000

    // Get market wage for comparison
    const cityId = Position.cityId[id]
    const cityQuery = defineQuery([CityEconomicData, Position, EntityType])
    const cities = cityQuery(world.ecsWorld)
    let marketWage = 300000
    for (const cid of cities) {
      if (EntityType.kind[cid] === EntityKind.City && Position.cityId[cid] === cityId) {
        marketWage = CityEconomicData.realWage[cid] || 300000
        break
      }
    }

    // Calculate turnover probability
    let turnoverRisk = 0

    // Low morale increases turnover
    if (morale < 30) turnoverRisk += 0.10
    else if (morale < 50) turnoverRisk += 0.05
    else if (morale > 80) turnoverRisk -= 0.03 // High morale reduces turnover

    // Low wages increase turnover
    const wageRatio = salary / marketWage
    if (wageRatio < 0.7) turnoverRisk += 0.08
    else if (wageRatio < 0.9) turnoverRisk += 0.03
    else if (wageRatio > 1.2) turnoverRisk -= 0.05 // Competitive wages reduce turnover

    // Random fluctuation
    turnoverRisk += (Math.random() - 0.5) * 0.04

    // --- POLICIES EFFECT ---
    const ownerId = Company.companyId[id]
    const policies = Company.activePolicies[ownerId] || 0
    if ((policies & 4) === 4) { // Benefits policy drastically reduces turnover
      turnoverRisk -= 0.15;
    }

    // Apply turnover
    if (turnoverRisk > 0 && Math.random() < turnoverRisk) {
      const turnoverCount = Math.max(1, Math.floor(headcount * 0.05)) // 5% turnover
      HumanResources.headcount[id] = Math.max(1, headcount - turnoverCount)

      // Log significant turnover
      if (turnoverCount >= 3) {
        console.log(`[Management] Building ${id} lost ${turnoverCount} employees due to low morale/wages`)
      }

      // --- NEW: Turnover Costs ---
      // Hiring and training replacements costs money (approx 2 months salary per head)
      const replacementCost = Math.floor(salary * 2 * turnoverCount)
      
      if (ownerId > 0) {
        Finances.cash[ownerId] -= replacementCost
        if (ownerId === world.playerEntityId) {
          world.cash -= replacementCost
        }
        
        // Log financial hit for player
        if (ownerId === world.playerEntityId && turnoverCount > 0) {
           console.log(`[HR] Recruitment & Onboarding cost for ${turnoverCount} staff: $${(replacementCost/100).toLocaleString()}`)
        }
      }

      // Turnover affects remaining morale (colleagues leaving is demoralizing)
      HumanResources.morale[id] = Math.max(0, morale - (2 + Math.floor(turnoverCount / 2)))
    }

    // --- ENHANCED: Hiring Logic ---
    // Hiring occurs if morale is decent and wages are competitive
    const buildingLevel = Building.level[id] || 1
    const capacity = 10 * buildingLevel
    
    if (headcount < capacity && morale > 40 && wageRatio > 0.85) {
      // Hiring speed scales with how attractive the job is
      const jobAttractiveness = (morale / 100) * (wageRatio > 1.1 ? 1.2 : 1.0)
      if (Math.random() < 0.05 * jobAttractiveness) {
        const hireAmount = Math.min(capacity - headcount, Math.ceil(headcount * 0.1))
        HumanResources.headcount[id] += hireAmount
        
        // Hiring costs (1 month salary sign-on/recruitment)
        const hiringCost = salary * hireAmount
        const ownerId = Company.companyId[id]
        if (ownerId > 0) {
          Finances.cash[ownerId] -= hiringCost
          if (ownerId === world.playerEntityId) world.cash -= hiringCost
        }
      }
    }
  }
}

/**
 * Strike Risk: Very low morale can lead to work stoppages
 */
function processStrikeRisk(world: GameWorld) {
  // Check daily
  if (world.tick % 30 !== 0) return

  const hrQuery = defineQuery([Building, HumanResources, Company])
  const entities = hrQuery(world.ecsWorld)

  for (const id of entities) {
    // RESOLVE EXISTING STRIKES
    if (hasComponent(world.ecsWorld, Strike, id)) {
      const startTick = Strike.startTick[id]
      const durationTicks = Strike.durationDays[id] * 30 // 1 day = 30 ticks
      
      if (world.tick >= startTick + durationTicks) {
        // Strike ends
        Building.isOperational[id] = 1
        // Remove strike component - in bitecs we usually use a flag or just reset values 
        // if we don't want to removeComponent frequently. For simplicity, we reset severity.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('game-notification', {
            detail: {
              message: `Strike resolved. Operations resumed at optimum capacity.`,
              type: 'success',
              timestamp: Date.now()
            }
          }))
        }
        console.log(`[STRIKE] Strike resolved at building ${id}`)

        Strike.severity[id] = 0; // Reset severity
        world.newsFeed.unshift({
            id: `strike_end_${id}_${world.tick}`,
            type: 'market',
            title: 'Labor Dispute Resolved',
            content: `Workers have ended their strike and resumed normal operations.`,
            timestamp: Date.now()
        })
      }
      continue // Skip risk check if already on strike
    }

    if (Building.isOperational[id] === 0) continue

    const morale = HumanResources.morale[id] || 50
    const companyId = Company.companyId[id]

    // Strike risk thresholds
    if (morale < 15) {
      // Critical risk - 5% daily chance of strike
      if (Math.random() < 0.05) {
        triggerStrike(world, id, companyId, 'critical')
      }
    } else if (morale < 25) {
      // High risk - 2% daily chance
      if (Math.random() < 0.02) {
        triggerStrike(world, id, companyId, 'high')
      }
    }
  }
}

/**
 * Trigger a strike at a building
 */
function triggerStrike(world: GameWorld, buildingId: number, companyId: number, severity: 'critical' | 'high') {
  // Check if already on strike
  if (hasComponent(world.ecsWorld, Strike, buildingId) && Strike.severity[buildingId] > 0) return
  if (Building.isOperational[buildingId] === 0) return

  // Only critical strikes halt operations completely
  if (severity === 'critical') {
      Building.isOperational[buildingId] = 0
  }

  // Add/Update Strike component
  if (!hasComponent(world.ecsWorld, Strike, buildingId)) {
      addComponent(world.ecsWorld, Strike, buildingId)
  }
  const durationDays = severity === 'critical' ? 7 + Math.floor(Math.random() * 7) : 3 + Math.floor(Math.random() * 4)
  Strike.durationDays[buildingId] = durationDays
  Strike.startTick[buildingId] = world.tick
  Strike.severity[buildingId] = severity === 'critical' ? 2 : 1

  console.warn(`[STRIKE] Building ${buildingId} is on a ${severity} strike for ${durationDays} days! Morale critically low.`)

  world.newsFeed.unshift({
      id: `strike_${buildingId}_${world.tick}`,
      type: 'expansion', // Using expansion as a generic company ops category
      title: severity === 'critical' ? 'CRITICAL WORKOUT!' : 'Partial Walkout',
      content: severity === 'critical' 
          ? `Operations completely halted for ${durationDays} days due to terrible working conditions.` 
          : `Workers are on a slowdown strike for ${durationDays} days, slashing productivity and logistics efficiency.`,
      timestamp: Date.now()
  });

  // Dispatch UI notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('game-notification', {
      detail: {
        message: severity === 'critical' 
            ? `Workers are striking! Production halted for ${durationDays} days.`
            : `Workers are protesting! Facility efficiency and logistics crippled for ${durationDays} days.`,
        type: 'danger',
        timestamp: Date.now()
      }
    }))
  }

  // Company reputation damage
  const repQuery = defineQuery([Company])
  const companyEntities = repQuery(world.ecsWorld)
  for (const cId of companyEntities) {
    if (Company.companyId[cId] === companyId) {
      Company.reputation[cId] = Math.max(0, Company.reputation[cId] - 5)
      break
    }
  }
}

/**
 * Calculate total productivity modifier for a building
 * Combines morale, training, management efficiency, and executive bonuses
 */
export function calculateProductivityModifier(world: GameWorld, buildingId: number): number {
  if (!hasComponent(world.ecsWorld, HumanResources, buildingId)) return 1.0

  const morale = HumanResources.morale[buildingId] || 50
  const training = HumanResources.trainingLevel[buildingId] || 50

  let modifier = 0.5 + (morale / 100) * 0.3 + (training / 100) * 0.2 // Base: 0.5 to 1.0

  // Management efficiency bonus
  if (hasComponent(world.ecsWorld, ManagementUnit, buildingId)) {
    const mgmtEff = ManagementUnit.efficiency[buildingId] || 50
    modifier *= (0.8 + (mgmtEff / 100) * 0.2) // 0.8x to 1.0x multiplier
  }

  // Check for executive CHRO bonus
  const companyId = Company.companyId[buildingId]
  const execQuery = defineQuery([Executive, Company])
  const executives = execQuery(world.ecsWorld)
  for (const execId of executives) {
    if (Company.companyId[execId] === companyId && Executive.role[execId] === ExecutiveRole.CHRO) {
      modifier *= 1.1 // +10% with CHRO
      break
    }
  }

  return Math.max(0.3, Math.min(1.5, modifier))
}
