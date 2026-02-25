/**
 * Data Types for MacroMogul
 * Defines the structure of all data-driven game entities
 */

// ============================================================================
// PRODUCT DATA
// ============================================================================

export enum ProductCategory {
  RAW = 'RAW',
  INTERMEDIATE = 'INTERMEDIATE',
  CONSUMER = 'CONSUMER',
  DIGITAL = 'DIGITAL',
  FINANCIAL = 'FINANCIAL',
  GREEN = 'GREEN',
  INTERNAL = 'INTERNAL',
}

export interface ProductData {
  id: number
  name: string
  category: ProductCategory
  basePrice: number
  baseDemand: number
  unitWeight: number
  perishable: boolean
  qualitySensitive: boolean
  techLevel: number
  expertiseRequired: number
  knowledgePoints: number
  innovationRate: number
}

// ============================================================================
// BUILDING DATA
// ============================================================================

export enum BuildingType {
  FARM = 'FARM',
  MINE = 'MINE',
  FACTORY = 'FACTORY',
  RETAIL = 'RETAIL',
  WAREHOUSE = 'WAREHOUSE',
  OFFICE = 'OFFICE',
  RESIDENTIAL = 'RESIDENTIAL',
  SUPERMARKET = 'SUPERMARKET',
  HOSPITAL = 'HOSPITAL',
  GYM = 'GYM',
  CINEMA = 'CINEMA',
  KINDERGARTEN = 'KINDERGARTEN',
  RESTAURANT = 'RESTAURANT',
  HOTEL = 'HOTEL',
  BANK = 'BANK',
}

export interface BuildingData {
  id: number
  name: string
  type: BuildingType
  baseCost: number
  maintenanceCost: number     // Monthly upkeep in cents
  employeeCapacity: number    // Max workers per building
  constructionTime: number    // in days
  maxFloors: number
  maxSize: number             // 2=2x2, 3=3x3, etc.
  powerConsumption: number
  pollution: number
}

// ============================================================================
// RECIPE DATA (for manufacturing)
// ============================================================================

export interface RecipeInput {
  productId: number
  quantity: number
}

export interface RecipeData {
  id: number
  name: string
  outputProductId: number
  outputQuantity: number
  inputs: RecipeInput[]
  productionTime: number // base time in ticks
  techLevel: number
  qualityFactor: number
}

// ============================================================================
// DATA STORE INTERFACE
// ============================================================================

export interface GameDataStore {
  products: Map<number, ProductData>
  buildings: Map<number, BuildingData>
  recipes: Map<number, RecipeData>
  
  // Helper lookup methods
  getProduct(id: number): ProductData | undefined
  getBuilding(id: number): BuildingData | undefined
  getRecipe(id: number): RecipeData | undefined
  getProductsByCategory(category: ProductCategory): ProductData[]
  getRecipesForProduct(productId: number): RecipeData[]

  // Company management
  companies: Map<number, CompanyMetadata>
  getCompany(id: number): CompanyMetadata | undefined
}

export interface CompanyMetadata {
  id: number
  name: string
  symbol: string
  color: string
}
