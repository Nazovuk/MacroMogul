import { createWorld, addEntity, addComponent, IWorld, defineQuery } from 'bitecs'
import {
  Position,
  EntityType,
  EntityKind,
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
  CityEconomicData,
  Inventory,
  LogisticSupply,
  Factory,
  MarketingOffice,
  HumanResources,
  Stock,
  ProductBrand,
  MarketData,
} from './components'
import { DataStore } from '../data'
import { BuildingType } from '../data/types'
import { macroEconomySystem, marketingSystem, productionSystem, financialSystem, retailSystem, researchSystem, logisticsSystem, economySystem, competitorSystem, managementSystem, stockMarketSystem } from './systems'

export interface GameWorld {
  ecsWorld: IWorld
  tick: number
  cash: number
  day: number
  month: number
  year: number
  paused: boolean
  speed: number
  seed: number
  dataStore: DataStore
  playerEntityId: number
  components: {
    Position: typeof Position
    EntityType: typeof EntityType
    Renderable: typeof Renderable
    Isometric: typeof Isometric
    Building: typeof Building
    Maintenance: typeof Maintenance
    ProductionOutput: typeof ProductionOutput
    RetailPlot: typeof RetailPlot
    RetailExpertise: typeof RetailExpertise
    TechAge: typeof TechAge
    Executive: typeof Executive
    Company: typeof Company
    Finances: typeof Finances
    AIController: typeof AIController
    CompanyTechnology: typeof CompanyTechnology
    ResearchCenter: typeof ResearchCenter
    HumanResources: typeof HumanResources
    Stock: typeof Stock
    ProductBrand: typeof ProductBrand
    MarketingOffice: typeof MarketingOffice
    Inventory: typeof Inventory
    LogisticSupply: typeof LogisticSupply
    MarketData: typeof MarketData
  }
}

export function createGameWorld(seed: number = 12345): GameWorld {
  const ecsWorld = createWorld()

  return {
    ecsWorld,
    tick: 0,
    cash: 1000000,
    day: 1,
    month: 1,
    year: 2024,
    paused: true,
    speed: 1,
    seed,
    dataStore: new DataStore(),
    playerEntityId: 0,
    components: {
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
      HumanResources,
      Stock,
      ProductBrand,
      MarketingOffice,
      Inventory,
      LogisticSupply,
      MarketData,
    },
  }
}

/**
 * Initialize the game world with data loading
 * Call this after createGameWorld to load products, buildings, etc.
 */
export async function initializeGameWorld(
  world: GameWorld,
  dataPath: string = '/data'
): Promise<boolean> {
  const success = await world.dataStore.initialize(dataPath)
  if (!success) {
    console.error('Failed to initialize game world data')
    return false
  }
  return true
}

/**
 * Execute all logic systems for the world
 */
export function runSystems(world: GameWorld) {
  // 0. Macro Economy (produces rates/multipliers consumed by all other systems)
  macroEconomySystem(world)
  
  // 1. Production & Distribution
  productionSystem(world)
  logisticsSystem(world)
  
  // 2. Financial / Market Systems (reads macro interest rates)
  economySystem(world)
  retailSystem(world)
  financialSystem(world)
  
  // 3. AI / Tech / Brand Systems
  competitorSystem(world)
  researchSystem(world)
  marketingSystem(world)
  stockMarketSystem(world)
  
  // 4. Management & HR
  managementSystem(world)
}

export function createCity(world: GameWorld, x: number, y: number, cityId: number, population: number = 1000000): number {
  const entity = addEntity(world.ecsWorld)
  addComponent(world.ecsWorld, Position, entity)
  addComponent(world.ecsWorld, Renderable, entity)
  addComponent(world.ecsWorld, Isometric, entity)
  addComponent(world.ecsWorld, EntityType, entity)
  
  Position.x[entity] = x
  Position.y[entity] = y
  Position.cityId[entity] = cityId
  EntityType.kind[entity] = EntityKind.City
  
  Renderable.spriteId[entity] = 0 
  Renderable.visible[entity] = 1
  Renderable.alpha[entity] = 1.0
  Isometric.depth[entity] = x + y
  
  addComponent(world.ecsWorld, CityEconomicData, entity)
  CityEconomicData.population[entity] = population
  CityEconomicData.purchasingPower[entity] = 60
  CityEconomicData.consumerSentiment[entity] = 70
  CityEconomicData.unemployment[entity] = 6         // 6% baseline
  CityEconomicData.realWage[entity] = 4500000        // $45,000/year
  CityEconomicData.interestRate[entity] = 500         // 5.0% central bank rate
  CityEconomicData.inflationRate[entity] = 250        // 2.5% annual inflation
  CityEconomicData.taxRate[entity] = 25               // 25% corporate tax
  CityEconomicData.industryDemandMult[entity] = 1.0   // Normal demand
  CityEconomicData.gdpGrowthRate[entity] = 200        // 2.0% annual GDP growth
  
  return entity
}

export function createBuilding(
  world: GameWorld, 
  x: number, 
  y: number, 
  _buildingType: number,
  cityId: number,
  ownerId: number = 1
): number | undefined {
  // Check for overlap
  const query = defineQuery([Position, Building])
  const existing = query(world.ecsWorld)
  for (const id of existing) {
    if (Position.x[id] === x && Position.y[id] === y) {
      console.warn(`[world] Cannot create building at ${x},${y}: already occupied by entity ${id}`)
      return undefined
    }
  }

  const entity = addEntity(world.ecsWorld)
  addComponent(world.ecsWorld, Position, entity)
  addComponent(world.ecsWorld, Renderable, entity)
  addComponent(world.ecsWorld, Isometric, entity)
  addComponent(world.ecsWorld, EntityType, entity)
  
  Position.x[entity] = x
  Position.y[entity] = y
  Position.cityId[entity] = cityId
  EntityType.kind[entity] = EntityKind.Building
  
  Renderable.spriteId[entity] = _buildingType
  Renderable.layer[entity] = 1
  Renderable.visible[entity] = 1
  Renderable.alpha[entity] = 1.0
  
  Isometric.depth[entity] = x + y
  
  // Initialize Building Stats
  addComponent(world.ecsWorld, Building, entity)
  addComponent(world.ecsWorld, Maintenance, entity)
  addComponent(world.ecsWorld, ProductionOutput, entity)
  addComponent(world.ecsWorld, Inventory, entity)
  addComponent(world.ecsWorld, LogisticSupply, entity)
  addComponent(world.ecsWorld, HumanResources, entity) // Add HR Component
  addComponent(world.ecsWorld, Company, entity)
  Company.companyId[entity] = ownerId
  
  Building.buildingTypeId[entity] = _buildingType
  Building.level[entity] = 1
  
  const bData = world.dataStore.getBuilding(_buildingType);
  Building.size[entity] = bData ? Math.max(1, bData.maxSize) : 1;

  Building.isOperational[entity] = 1
  
  Inventory.capacity[entity] = 50000 // Default capacity
  
  ProductionOutput.utilization[entity] = 100 // Default to full utilization
  ProductionOutput.capacity[entity] = 5000 
  
  // Initialize HR defaults
  HumanResources.headcount[entity] = 10 
  HumanResources.salary[entity] = 300000 // $3000/mo default (Market Wage)
  HumanResources.morale[entity] = 50
  HumanResources.trainingLevel[entity] = 10
  HumanResources.trainingBudget[entity] = 10000 // $100/mo default (Low training)

  // Add specific components based on type
  if (bData?.type === BuildingType.FACTORY) {
      addComponent(world.ecsWorld, Factory, entity)
      // Factory.productionRate[entity] = 100
  } else if (bData?.type === BuildingType.RETAIL || bData?.type === BuildingType.SUPERMARKET) {
      addComponent(world.ecsWorld, RetailPlot, entity)
      addComponent(world.ecsWorld, RetailExpertise, entity)
      RetailExpertise.general[entity] = 50
  } else if (bData?.name.includes('R&D') || bData?.id === 33) {
      addComponent(world.ecsWorld, ResearchCenter, entity)
  } else if (bData?.name.includes('Marketing') || bData?.id === 34) {
      addComponent(world.ecsWorld, MarketingOffice, entity)
  }
  
  return entity
}

export function createAICompany(world: GameWorld, name: string, cash: number): number {
  const symbol = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
  const entity = createCompany(world, cash, name, symbol);
  
  addComponent(world.ecsWorld, AIController, entity);
  AIController.personality[entity] = Math.floor(Math.random() * 3);
  AIController.expansionThreshold[entity] = cash * 1.5; // Expand when cash increases significantly
  AIController.lastActionTick[entity] = 0;
  
  console.log(`AI Company created: ${name} (ID: ${Company.companyId[entity]})`);
  return entity;
}

/**
 * Unified company creation logic for both player and AI.
 */
export function createCompany(world: GameWorld, cashCents: number, name: string = "Player Corp", symbol: string = "PLR"): number {
  const entity = addEntity(world.ecsWorld);
  
  addComponent(world.ecsWorld, Company, entity);
  Company.companyId[entity] = entity;
  
  addComponent(world.ecsWorld, Finances, entity);
  Finances.cash[entity] = cashCents;
  Finances.creditLimit[entity] = cashCents * 0.5; // Initial credit
  
  addComponent(world.ecsWorld, Stock, entity);
  Stock.sharesOutstanding[entity] = 1000000; // 1 Million shares
  // Initial price (cents): (Total Cash Cents / Shares) * 1.5 multiplier
  Stock.sharePrice[entity] = (cashCents / Stock.sharesOutstanding[entity]) * 1.5;
  Stock.prevSharePrice[entity] = Stock.sharePrice[entity]; // Start with 0% change
  Stock.volume[entity] = 0;
  Stock.sector[entity] = 0; // Default sector (General)
  Company.marketCap[entity] = Stock.sharePrice[entity] * Stock.sharesOutstanding[entity];
  
  // Register in dataStore for name/symbol lookup
  world.dataStore.companies.set(entity, {
    id: entity,
    name,
    symbol,
    color: entity === world.playerEntityId ? '#00d9a5' : '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
  });

  // Initialize tech for all products
  initializeCompanyTech(world, entity);
  
  return entity;
}

export function initializeCompanyTech(world: GameWorld, companyId: number) {
  const products = Array.from(world.dataStore.products.values());
  for (const p of products) {
    const techEntity = addEntity(world.ecsWorld);
    addComponent(world.ecsWorld, CompanyTechnology, techEntity);
    CompanyTechnology.companyId[techEntity] = companyId;
    CompanyTechnology.productId[techEntity] = p.id;
    CompanyTechnology.techLevel[techEntity] = 40; // Base quality
  }
}
