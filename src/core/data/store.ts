/**
 * Data Store Module
 * Runtime storage and access for all game data
 * Provides efficient lookups and caching
 */

import {
  ProductData,
  BuildingData,
  RecipeData,
  ProductCategory,
  BuildingType,
  GameDataStore,
  CompanyMetadata
} from './types'
import { loadDataFiles } from './parser'

// ============================================================================
// DATA STORE IMPLEMENTATION
// ============================================================================

class DataStore implements GameDataStore {
  public products: Map<number, ProductData> = new Map()
  public buildings: Map<number, BuildingData> = new Map()
  public recipes: Map<number, RecipeData> = new Map()
  public companies: Map<number, CompanyMetadata> = new Map()
  
  // Index for fast category/type lookups
  private productsByCategory: Map<ProductCategory, ProductData[]> = new Map()
  private buildingsByType: Map<BuildingType, BuildingData[]> = new Map()
  private recipesByOutput: Map<number, RecipeData[]> = new Map()
  
  // Loading state
  public loaded: boolean = false
  public loadErrors: string[] = []
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  /**
   * Load all data files from the server
   * Should be called once at game initialization
   */
  async initialize(basePath: string = '/data'): Promise<boolean> {
    try {
      const { products, buildings, recipes } = await loadDataFiles(basePath)
      
      // Check for errors
      this.loadErrors = [
        ...products.errors,
        ...buildings.errors,
        ...recipes.errors,
      ]
      
      if (!products.success || !buildings.success) {
        console.error('Data loading failed:', this.loadErrors)
        return false
      }
      
      // Store products
      this.products.clear()
      this.productsByCategory.clear()
      for (const product of products.data) {
        this.products.set(product.id, product)
        
        // Index by category
        if (!this.productsByCategory.has(product.category)) {
          this.productsByCategory.set(product.category, [])
        }
        this.productsByCategory.get(product.category)!.push(product)
      }
      
      // Store buildings
      this.buildings.clear()
      this.buildingsByType.clear()
      for (const building of buildings.data) {
        this.buildings.set(building.id, building)
        
        // Index by type
        if (!this.buildingsByType.has(building.type)) {
          this.buildingsByType.set(building.type, [])
        }
        this.buildingsByType.get(building.type)!.push(building)
      }
      
      // Store recipes
      this.recipes.clear()
      this.recipesByOutput.clear()
      for (const recipe of recipes.data) {
        this.recipes.set(recipe.id, recipe)
        
        // Index by output product
        if (!this.recipesByOutput.has(recipe.outputProductId)) {
          this.recipesByOutput.set(recipe.outputProductId, [])
        }
        this.recipesByOutput.get(recipe.outputProductId)!.push(recipe)
      }
      
      this.loaded = true
      console.log(`Data loaded: ${this.products.size} products, ${this.buildings.size} buildings, ${this.recipes.size} recipes`)
      
      return true
    } catch (err) {
      this.loadErrors.push(`Initialization error: ${err}`)
      console.error('Data initialization failed:', err)
      return false
    }
  }
  
  /**
   * Initialize from pre-parsed data (for testing or embedded data)
   */
  initializeFromData(
    products: ProductData[],
    buildings: BuildingData[],
    recipes: RecipeData[] = []
  ): void {
    this.products.clear()
    this.buildings.clear()
    this.recipes.clear()
    this.productsByCategory.clear()
    this.buildingsByType.clear()
    this.recipesByOutput.clear()
    
    for (const product of products) {
      this.products.set(product.id, product)
      
      // Index by category
      if (!this.productsByCategory.has(product.category)) {
        this.productsByCategory.set(product.category, [])
      }
      this.productsByCategory.get(product.category)!.push(product)
    }
    
    for (const building of buildings) {
      this.buildings.set(building.id, building)
      
      // Index by type
      if (!this.buildingsByType.has(building.type)) {
        this.buildingsByType.set(building.type, [])
      }
      this.buildingsByType.get(building.type)!.push(building)
    }
    
    for (const recipe of recipes) {
      this.recipes.set(recipe.id, recipe)
      
      // Index by output product
      if (!this.recipesByOutput.has(recipe.outputProductId)) {
        this.recipesByOutput.set(recipe.outputProductId, [])
      }
      this.recipesByOutput.get(recipe.outputProductId)!.push(recipe)
    }
    
    this.loaded = true
  }
  
  // ============================================================================
  // LOOKUP METHODS
  // ============================================================================
  
  getProduct(id: number): ProductData | undefined {
    return this.products.get(id)
  }
  
  getBuilding(id: number): BuildingData | undefined {
    return this.buildings.get(id)
  }
  
  getRecipe(id: number): RecipeData | undefined {
    return this.recipes.get(id)
  }
  
  getProductsByCategory(category: ProductCategory): ProductData[] {
    return this.productsByCategory.get(category) || []
  }
  
  getBuildingsByType(type: BuildingType): BuildingData[] {
    return this.buildingsByType.get(type) || []
  }
  
  getRecipesForProduct(productId: number): RecipeData[] {
    return this.recipesByOutput.get(productId) || []
  }

  getCompany(id: number): CompanyMetadata | undefined {
    return this.companies.get(id)
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Get all product IDs
   */
  getAllProductIds(): number[] {
    return Array.from(this.products.keys())
  }
  
  /**
   * Get all building IDs
   */
  getAllBuildingIds(): number[] {
    return Array.from(this.buildings.keys())
  }
  
  /**
   * Get default building for a product type
   * Returns the first building that can produce/store this product type
   */
  getDefaultBuildingForProduct(productId: number): BuildingData | undefined {
    const product = this.getProduct(productId)
    if (!product) return undefined
    
    // Map product categories to building types
    const categoryToBuilding: Record<ProductCategory, BuildingType[]> = {
      [ProductCategory.RAW]: [BuildingType.FARM, BuildingType.MINE],
      [ProductCategory.INTERMEDIATE]: [BuildingType.FACTORY],
      [ProductCategory.CONSUMER]: [BuildingType.FACTORY, BuildingType.RETAIL],
      [ProductCategory.DIGITAL]: [BuildingType.OFFICE],
      [ProductCategory.FINANCIAL]: [BuildingType.BANK],
      [ProductCategory.GREEN]: [BuildingType.FACTORY],
      [ProductCategory.INTERNAL]: [BuildingType.OFFICE],
    }
    
    const buildingTypes = categoryToBuilding[product.category]
    if (!buildingTypes) return undefined
    
    for (const type of buildingTypes) {
      const buildings = this.getBuildingsByType(type)
      if (buildings.length > 0) {
        return buildings[0]
      }
    }
    
    return undefined
  }
  
  /**
   * Validate that all referenced IDs exist
   */
  validateData(): string[] {
    const errors: string[] = []
    
    // Validate recipes reference existing products
    for (const [id, recipe] of this.recipes) {
      if (!this.getProduct(recipe.outputProductId)) {
        errors.push(`Recipe ${id}: Output product ${recipe.outputProductId} not found`)
      }
      
      for (const input of recipe.inputs) {
        if (!this.getProduct(input.productId)) {
          errors.push(`Recipe ${id}: Input product ${input.productId} not found`)
        }
      }
    }
    
    return errors
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const dataStore = new DataStore()

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export function getDataStore(): DataStore {
  return dataStore
}

export async function initializeDataStore(basePath?: string): Promise<boolean> {
  return dataStore.initialize(basePath)
}

export { DataStore }
