import { 
  addComponent, 
  addEntity, 
  getAllEntities, 
  hasComponent
} from 'bitecs'
import { GameWorld, createGameWorld, initializeGameWorld } from '../ecs/world'
import { 
  Position,
  EntityType,
  Renderable,
  Isometric,
  Building,
  Maintenance,
  ProductionOutput,
  RetailPlot,
  RetailExpertise,
  TechAge,
  Executive,
  Company,
  Finances,
  AIController,
  CompanyTechnology,
  ResearchCenter,
  Inventory,
  LogisticSupply,
  Factory,
  MarketingOffice,
  HumanResources,
  CityEconomicData,
  MarketData,
  PlayerProfile,
  BrandLoyalty,
  ProductBrand,
  ProductTech,
  ManagementUnit,
  Stock,
  KnowledgePoints,
  MarketCompetition,
  PowerConsumer,
  PollutionEmitter,
  RDCenter,
  Warehouse,
  Loan,
  CorporateBond,
} from '../ecs/components'
import { companyFinancialsStore } from '../ecs/systems/FinancialSystem'

// Define a schema for our save file
interface SaveFile {
  meta: {
    version: string
    timestamp: number
    tick: number
    cash: number
    date: { day: number, month: number, year: number }
    seed: number
  }
  entities: ArchivedEntity[]
  financials?: Record<number, { loans: Loan[], bonds: CorporateBond[] }> // Extended financial data
}

interface ArchivedEntity {
  id: number // Original ID (might map to new one, or we reset world)
  components: Record<string, any>
}

const STORAGE_PREFIX = 'macromogul_save_'

export const PersistenceService = {
  
  /**
   * Components Registry
   * We need a map of Component Name -> Component Object to serialize/deserialize
   */
  componentRegistry: {
    'Position': Position,
    'EntityType': EntityType,
    'Renderable': Renderable,
    'Isometric': Isometric,
    'Building': Building,
    'Maintenance': Maintenance,
    'ProductionOutput': ProductionOutput,
    'RetailPlot': RetailPlot,
    'RetailExpertise': RetailExpertise,
    'TechAge': TechAge,
    'Executive': Executive,
    'Company': Company,
    'Finances': Finances,
    'AIController': AIController,
    'CompanyTechnology': CompanyTechnology,
    'ResearchCenter': ResearchCenter,
    'Inventory': Inventory,
    'LogisticSupply': LogisticSupply,
    'Factory': Factory,
    'MarketingOffice': MarketingOffice,
    'HumanResources': HumanResources,
    'CityEconomicData': CityEconomicData,
    'MarketData': MarketData,
    'PlayerProfile': PlayerProfile,
    'BrandLoyalty': BrandLoyalty,
    'ProductBrand': ProductBrand,
    'ProductTech': ProductTech,
    'ManagementUnit': ManagementUnit,
    'Stock': Stock,
    'KnowledgePoints': KnowledgePoints,
    'MarketCompetition': MarketCompetition,
    'PowerConsumer': PowerConsumer,
    'PollutionEmitter': PollutionEmitter,
    'RDCenter': RDCenter,
    'Warehouse': Warehouse,
  } as Record<string, any>,

  /**
   * Save the current game state to a slot
   */
  saveGame: (world: GameWorld, slotName: string): boolean => {
    try {
      console.log(`Saving game to slot: ${slotName}...`)
      const entities = getAllEntities(world.ecsWorld)
      
      const archived: ArchivedEntity[] = []

      // Iterate all entities
      for (const eid of entities) {
        const entityData: ArchivedEntity = {
          id: eid,
          components: {}
        }

        let hasData = false

        // Check each component type
        for (const [compName, compObj] of Object.entries(PersistenceService.componentRegistry)) {
           if (hasComponent(world.ecsWorld, compObj, eid)) {
             // Serialize this component's data for this entity
             // We assume component props are typed arrays on the component object
             // e.g. Position.x[eid]
             const compData: Record<string, any> = {}
             
             for (const prop of Object.keys(compObj)) {
               // Skip internal properties if any (bitecs internals usually not enumerable on the proxy/object in this way?)
               // Actually bitECS components are objects with TypedArray properties.
               if (compObj[prop] && compObj[prop].length > eid) {
                  compData[prop] = compObj[prop][eid]
               }
             }
             
             entityData.components[compName] = compData
             hasData = true
           }
        }

        if (hasData) {
          archived.push(entityData)
        }
      }

      // Collect extended financial data (loans & bonds)
      const financialsData: Record<number, { loans: Loan[], bonds: CorporateBond[] }> = {}
      for (const [companyId, finData] of companyFinancialsStore.entries()) {
        if (finData.loans.length > 0 || finData.bonds.length > 0) {
          financialsData[companyId] = {
            loans: finData.loans,
            bonds: finData.bonds
          }
        }
      }

      const saveFile: SaveFile = {
        meta: {
          version: '1.0.0',
          timestamp: Date.now(),
          tick: world.tick,
          cash: world.cash,
          date: { day: world.day, month: world.month, year: world.year },
          seed: world.seed
        },
        entities: archived,
        financials: Object.keys(financialsData).length > 0 ? financialsData : undefined
      }

      const json = JSON.stringify(saveFile)
      localStorage.setItem(`${STORAGE_PREFIX}${slotName}`, json)
      console.log(`Game saved successfully. ${archived.length} entities archived.`)
      return true
    } catch (err) {
      console.error('Failed to save game:', err)
      return false
    }
  },

  /**
   * Load a game from a slot
   * WARNING: This creates a NEW world instance. The caller should replace their world reference.
   */
  loadGame: async (slotName: string): Promise<GameWorld | null> => {
    try {
      const json = localStorage.getItem(`${STORAGE_PREFIX}${slotName}`)
      if (!json) {
        console.error(`Save slot ${slotName} not found.`)
        return null
      }

      const saveFile: SaveFile = JSON.parse(json)
      console.log(`Loading save from ${new Date(saveFile.meta.timestamp).toLocaleString()}...`)

      // 1. Create fresh world
      const world = createGameWorld(saveFile.meta.seed)
      
      // 2. Restore Meta
      world.tick = saveFile.meta.tick
      world.cash = saveFile.meta.cash
      world.day = saveFile.meta.date.day
      world.month = saveFile.meta.date.month
      world.year = saveFile.meta.date.year

      // 3. Initialize Data (needed for lookup)
      // 3. Initialize Data (needed for lookup)
      await initializeGameWorld(world)

      // 4. Restore Entities
      // RE-THINKING RESTORATION STRATEGY:
      // Since bitECS manages IDs, we cannot force them.
      // We must map OldID -> NewID.
      
      // Clear the "half-baked" world above and redo properly
      const restorationMap = new Map<number, number>() // Old -> New

      // Pass 1: Create Entities
      for (const archived of saveFile.entities) {
         const newId = addEntity(world.ecsWorld)
         restorationMap.set(archived.id, newId)
      }

      // Pass 2: Add Components & Data
      for (const archived of saveFile.entities) {
        const newId = restorationMap.get(archived.id)!

        for (const [compName, compData] of Object.entries(archived.components)) {
           const Comp = PersistenceService.componentRegistry[compName]
           if (!Comp) {
             console.warn(`Unknown component in save: ${compName}`)
             continue
           }

           addComponent(world.ecsWorld, Comp, newId)

           // Restore props
           for (const [prop, val] of Object.entries(compData)) {
             // Check if this prop is a reference (ends with 'Id' and we have a map?)
             // This is risky automation. Better to use known schema types.
             // But for now, let's copy values.
             // IF the value corresponds to an Entity ID, it needs remapping.
             // bitECS uses 'Types.eid' for entity refs? If we can detect that... we cannot easily at runtime.
             
             // Manual exclusions/remapping list:
             // Reference Props: 
             // Position.cityId -> Entity? No, City ID is internal ID? Wait, creates use Entity ID for cities.
             // LogisticSupply.sourceXId -> Entity ID.
             // Company.companyId -> NOT Entity ID. 
             // Building.buildingTypeId -> Data ID.
             
             // Known Entity Reference Fields:
             const isEntityRef = (
               (compName === 'LogisticSupply' && (prop === 'source1Id' || prop === 'source2Id' || prop === 'source3Id')) ||
               (compName === 'Position' && prop === 'cityId') // City is an entity
             )

             if (isEntityRef && typeof val === 'number' && val > 0) {
                // Try to remap
                if (restorationMap.has(val)) {
                   Comp[prop][newId] = restorationMap.get(val)!
                } else {
                   console.warn(`Could not remap entity ref ${compName}.${prop}: ${val}`)
                   Comp[prop][newId] = val // Fallback
                }
             } else {
                Comp[prop][newId] = val
             }
           }
        }
      }

      // 5. Restore Extended Financial Data (Loans & Bonds)
      if (saveFile.financials) {
        companyFinancialsStore.clear()
        for (const [oldCompanyId, finData] of Object.entries(saveFile.financials)) {
          const newCompanyId = restorationMap.get(parseInt(oldCompanyId))
          if (newCompanyId) {
            companyFinancialsStore.set(newCompanyId, {
              companyId: newCompanyId,
              loans: finData.loans || [],
              bonds: finData.bonds || [],
              lastMonthInterestPaid: 0,
              lastMonthPrincipalPaid: 0,
              lastMonthCouponPaid: 0,
              totalInterestPaidYTD: 0,
            })
          }
        }
        console.log(`Restored financial data for ${Object.keys(saveFile.financials).length} companies`)
      }

      console.log("Game loaded successfully.")
      return world
    } catch (err) {
      console.error('Failed to load game:', err)
      return null
    }
  },

  /**
   * Get list of used slots
   */
  getAvailableSaves: (): { slot: string; meta: any }[] => {
    const saves: { slot: string; meta: any }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const json = localStorage.getItem(key)
          if (json) {
            const data = JSON.parse(json)
            saves.push({
              slot: key.replace(STORAGE_PREFIX, ''),
              meta: data.meta
            })
          }
        } catch (e) { /* ignore corrupt */ }
      }
    }
    return saves.sort((a: { slot: string; meta: any }, b: { slot: string; meta: any }) => b.meta.timestamp - a.meta.timestamp)
  }
}
