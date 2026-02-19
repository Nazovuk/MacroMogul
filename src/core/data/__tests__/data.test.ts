import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseProducts,
  parseBuildings,
  parseRecipes,
  DataStore,
  ProductCategory,
  BuildingType,
} from '../'

describe('Data Parser', () => {
  describe('parseProducts', () => {
    it('should parse valid product data', () => {
      const content = `# Product Test Data
ID	Name	Category	BasePrice	BaseDemand	UnitWeight	Perishable	QualitySensitive
1	Test Wheat	RAW	10	100	1	false	false
2	Test Bread	CONSUMER	40	120	1	true	true`

      const result = parseProducts(content)
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
      
      const wheat = result.data[0]
      expect(wheat.id).toBe(1)
      expect(wheat.name).toBe('Test Wheat')
      expect(wheat.category).toBe(ProductCategory.RAW)
      expect(wheat.basePrice).toBe(10)
      expect(wheat.baseDemand).toBe(100)
      expect(wheat.perishable).toBe(false)
      
      const bread = result.data[1]
      expect(bread.category).toBe(ProductCategory.CONSUMER)
      expect(bread.perishable).toBe(true)
    })

    it('should handle missing optional columns', () => {
      const content = `ID	Name	Category	BasePrice	BaseDemand	UnitWeight
1	Test Product	RAW	10	100	1`

      const result = parseProducts(content)
      
      expect(result.success).toBe(true)
      expect(result.data[0].perishable).toBe(false)
      expect(result.data[0].qualitySensitive).toBe(false)
    })

    it('should report missing required columns', () => {
      const content = `ID	Name	Category
1	Test	RAW`

      const result = parseProducts(content)
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('baseprice'))).toBe(true)
    })

    it('should skip comments and empty lines', () => {
      const content = `# Comment line

ID	Name	Category	BasePrice	BaseDemand	UnitWeight
1	Test	RAW	10	100	1

# Another comment
2	Test2	CONSUMER	20	50	2`

      const result = parseProducts(content)
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })
  })

  describe('parseBuildings', () => {
    it('should parse valid building data', () => {
      const content = `# Building Test Data
ID	Name	Type	BaseCost	ConstructionTime	MaxFloors	MaxSize	PowerConsumption	Pollution
1	Test Farm	FARM	5000	3	1	2	5	2
2	Test Factory	FACTORY	15000	4	2	3	15	5`

      const result = parseBuildings(content)
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
      
      const farm = result.data[0]
      expect(farm.id).toBe(1)
      expect(farm.name).toBe('Test Farm')
      expect(farm.type).toBe(BuildingType.FARM)
      expect(farm.baseCost).toBe(5000)
      expect(farm.maintenanceCost).toBe(500) // Default 10%
      expect(farm.employeeCapacity).toBe(50) // Default
      expect(farm.constructionTime).toBe(3)
      expect(farm.maxFloors).toBe(1)
      expect(farm.maxSize).toBe(2)
      expect(farm.powerConsumption).toBe(5)
      expect(farm.pollution).toBe(2)
      
      const factory = result.data[1]
      expect(factory.type).toBe(BuildingType.FACTORY)
    })

    it('should report invalid building types', () => {
      const content = `ID	Name	Type	BaseCost	ConstructionTime	MaxFloors	MaxSize
1	Test	INVALID	5000	3	1	2`

      const result = parseBuildings(content)
      
      expect(result.success).toBe(false) // Fails when no valid buildings parsed
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('INVALID'))).toBe(true)
    })
  })

  describe('parseRecipes', () => {
    it('should parse valid recipe JSON', () => {
      const content = JSON.stringify([
        {
          id: 1,
          name: 'Wheat to Flour',
          outputProductId: 7,
          outputQuantity: 2,
          inputs: [{ productId: 1, quantity: 3 }],
          productionTime: 10,
          techLevel: 1,
          qualityFactor: 1.0,
        },
        {
          id: 2,
          name: 'Flour to Bread',
          outputProductId: 12,
          outputQuantity: 1,
          inputs: [{ productId: 7, quantity: 1 }],
          productionTime: 5,
        },
      ])

      const result = parseRecipes(content)
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      
      const recipe = result.data[0]
      expect(recipe.id).toBe(1)
      expect(recipe.name).toBe('Wheat to Flour')
      expect(recipe.inputs).toHaveLength(1)
      expect(recipe.inputs[0].productId).toBe(1)
      expect(recipe.inputs[0].quantity).toBe(3)
    })

    it('should handle invalid JSON', () => {
      const content = 'not valid json'

      const result = parseRecipes(content)
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})

describe('DataStore', () => {
  let store: DataStore

  beforeEach(() => {
    store = new DataStore()
  })

  describe('initializeFromData', () => {
    it('should store products and buildings', () => {
      const products = [
        { id: 1, name: 'Wheat', category: ProductCategory.RAW, basePrice: 10, baseDemand: 100, unitWeight: 1, perishable: false, qualitySensitive: false },
        { id: 2, name: 'Bread', category: ProductCategory.CONSUMER, basePrice: 40, baseDemand: 120, unitWeight: 1, perishable: true, qualitySensitive: true },
      ]
      
      const buildings = [
        { id: 1, name: 'Wheat Farm', type: BuildingType.FARM, baseCost: 5000, maintenanceCost: 500, employeeCapacity: 50, constructionTime: 3, maxFloors: 1, maxSize: 2, powerConsumption: 5, pollution: 2 },
        { id: 2, name: 'Bakery', type: BuildingType.FACTORY, baseCost: 15000, maintenanceCost: 1500, employeeCapacity: 100, constructionTime: 4, maxFloors: 2, maxSize: 3, powerConsumption: 15, pollution: 5 },
      ]

      store.initializeFromData(products, buildings)

      expect(store.loaded).toBe(true)
      expect(store.getProduct(1)?.name).toBe('Wheat')
      expect(store.getProduct(2)?.name).toBe('Bread')
      expect(store.getBuilding(1)?.name).toBe('Wheat Farm')
      expect(store.getBuilding(2)?.name).toBe('Bakery')
    })

    it('should filter products by category', () => {
      const products = [
        { id: 1, name: 'Wheat', category: ProductCategory.RAW, basePrice: 10, baseDemand: 100, unitWeight: 1, perishable: false, qualitySensitive: false },
        { id: 2, name: 'Flour', category: ProductCategory.INTERMEDIATE, basePrice: 25, baseDemand: 90, unitWeight: 1, perishable: false, qualitySensitive: true },
        { id: 3, name: 'Bread', category: ProductCategory.CONSUMER, basePrice: 40, baseDemand: 120, unitWeight: 1, perishable: true, qualitySensitive: true },
      ]

      store.initializeFromData(products, [])

      const rawProducts = store.getProductsByCategory(ProductCategory.RAW)
      expect(rawProducts).toHaveLength(1)
      expect(rawProducts[0].name).toBe('Wheat')

      const consumerProducts = store.getProductsByCategory(ProductCategory.CONSUMER)
      expect(consumerProducts).toHaveLength(1)
      expect(consumerProducts[0].name).toBe('Bread')
    })

    it('should filter buildings by type', () => {
      const buildings = [
        { id: 1, name: 'Wheat Farm', type: BuildingType.FARM, baseCost: 5000, maintenanceCost: 500, employeeCapacity: 50, constructionTime: 3, maxFloors: 1, maxSize: 2, powerConsumption: 5, pollution: 2 },
        { id: 2, name: 'Iron Mine', type: BuildingType.MINE, baseCost: 15000, maintenanceCost: 1500, employeeCapacity: 200, constructionTime: 5, maxFloors: 1, maxSize: 3, powerConsumption: 20, pollution: 10 },
        { id: 3, name: 'Corn Farm', type: BuildingType.FARM, baseCost: 5000, maintenanceCost: 500, employeeCapacity: 50, constructionTime: 3, maxFloors: 1, maxSize: 2, powerConsumption: 5, pollution: 2 },
      ]

      store.initializeFromData([], buildings)

      const farms = store.getBuildingsByType(BuildingType.FARM)
      expect(farms).toHaveLength(2)
      
      const mines = store.getBuildingsByType(BuildingType.MINE)
      expect(mines).toHaveLength(1)
      expect(mines[0].name).toBe('Iron Mine')
    })

    it('should return undefined for non-existent IDs', () => {
      store.initializeFromData([], [])

      expect(store.getProduct(999)).toBeUndefined()
      expect(store.getBuilding(999)).toBeUndefined()
    })

    it('should get all IDs', () => {
      const products = [
        { id: 1, name: 'Wheat', category: ProductCategory.RAW, basePrice: 10, baseDemand: 100, unitWeight: 1, perishable: false, qualitySensitive: false },
        { id: 2, name: 'Bread', category: ProductCategory.CONSUMER, basePrice: 40, baseDemand: 120, unitWeight: 1, perishable: true, qualitySensitive: true },
      ]

      store.initializeFromData(products, [])

      expect(store.getAllProductIds()).toEqual([1, 2])
    })
  })
})
