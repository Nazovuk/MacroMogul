/**
 * Data Parser Module
 * Parses MacroMogul-style tab-delimited text files
 * Mimics the original game's data-driven architecture
 */

import {
  ProductData,
  ProductCategory,
  BuildingData,
  BuildingType,
  RecipeData,
} from './types'

// ============================================================================
// TEXT FILE PARSER
// ============================================================================

export interface ParseResult<T> {
  success: boolean
  data: T[]
  errors: string[]
}

/**
 * Parse a tab-delimited text file content
 * Skips comment lines (starting with #) and empty lines
 */
function parseTabDelimited(content: string): string[][] {
  const lines = content.split('\n')
  const rows: string[][] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    // Split by tab character
    const cells = trimmed.split('\t').map(cell => cell.trim())
    rows.push(cells)
  }
  
  return rows
}

/**
 * Parse header row and return column index mapping
 */
function parseHeader(row: string[]): Map<string, number> {
  const headers = new Map<string, number>()
  row.forEach((cell, index) => {
    headers.set(cell.toLowerCase(), index)
  })
  return headers
}

// ============================================================================
// PRODUCT PARSER
// ============================================================================

export function parseProducts(content: string): ParseResult<ProductData> {
  const rows = parseTabDelimited(content)
  
  if (rows.length < 2) {
    return {
      success: false,
      data: [],
      errors: ['File must contain at least a header row and one data row'],
    }
  }
  
  const headers = parseHeader(rows[0])
  const products: ProductData[] = []
  const errors: string[] = []
  
  // Validate required columns
  const requiredColumns = ['id', 'name', 'category', 'baseprice', 'basedemand', 'unitweight']
  for (const col of requiredColumns) {
    if (!headers.has(col)) {
      errors.push(`Missing required column: ${col}`)
    }
  }
  
  if (errors.length > 0) {
    return { success: false, data: [], errors }
  }
  
  // Parse data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 1
    
    try {
      const id = parseInt(row[headers.get('id')!], 10)
      const name = row[headers.get('name')!]
      const categoryStr = row[headers.get('category')!].toUpperCase()
      const basePrice = parseFloat(row[headers.get('baseprice')!])
      const baseDemand = parseInt(row[headers.get('basedemand')!], 10)
      const unitWeight = parseFloat(row[headers.get('unitweight')!])
      const perishableStr = row[headers.get('perishable')!]?.toLowerCase()
      const qualitySensitiveStr = row[headers.get('qualitysensitive')!]?.toLowerCase()
      
      // Validate category
      if (!Object.values(ProductCategory).includes(categoryStr as ProductCategory)) {
        errors.push(`Line ${lineNum}: Invalid category "${categoryStr}"`)
        continue
      }
      
      const product: ProductData = {
        id,
        name,
        category: categoryStr as ProductCategory,
        basePrice,
        baseDemand,
        unitWeight,
        perishable: perishableStr === 'true',
        qualitySensitive: qualitySensitiveStr === 'true',
      }
      
      products.push(product)
    } catch (err) {
      errors.push(`Line ${lineNum}: Parse error - ${err}`)
    }
  }
  
  return {
    success: errors.length === 0,
    data: products,
    errors,
  }
}

// ============================================================================
// BUILDING PARSER
// ============================================================================

export function parseBuildings(content: string): ParseResult<BuildingData> {
  const rows = parseTabDelimited(content)
  
  if (rows.length < 2) {
    return {
      success: false,
      data: [],
      errors: ['File must contain at least a header row and one data row'],
    }
  }
  
  const headers = parseHeader(rows[0])
  const buildings: BuildingData[] = []
  const errors: string[] = []
  
  // Validate required columns
  const requiredColumns = ['id', 'name', 'type', 'basecost', 'constructiontime', 'maxfloors', 'maxsize']
  for (const col of requiredColumns) {
    if (!headers.has(col)) {
      errors.push(`Missing required column: ${col}`)
    }
  }
  
  if (errors.length > 0) {
    return { success: false, data: [], errors }
  }
  
  // Parse data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 1
    
    try {
      const id = parseInt(row[headers.get('id')!], 10)
      const name = row[headers.get('name')!]
      const typeStr = row[headers.get('type')!].toUpperCase()
      const baseCost = parseInt(row[headers.get('basecost')!], 10)
      const maintenanceCost = parseInt(row[headers.get('maintenancecost')!] || Math.floor(baseCost * 0.1).toString(), 10)
      const employeeCapacity = parseInt(row[headers.get('employeecapacity')!] || '50', 10)
      const constructionTime = parseInt(row[headers.get('constructiontime')!], 10)
      const maxFloors = parseInt(row[headers.get('maxfloors')!], 10)
      const maxSize = parseInt(row[headers.get('maxsize')!], 10)
      const powerConsumption = parseInt(row[headers.get('powerconsumption')!] || '0', 10)
      const pollution = parseInt(row[headers.get('pollution')!] || '0', 10)
      
      // Validate type
      if (!Object.values(BuildingType).includes(typeStr as BuildingType)) {
        errors.push(`Line ${lineNum}: Invalid building type "${typeStr}"`)
        continue
      }
      
      const building: BuildingData = {
        id,
        name,
        type: typeStr as BuildingType,
        baseCost,
        maintenanceCost,
        employeeCapacity,
        constructionTime,
        maxFloors,
        maxSize,
        powerConsumption,
        pollution,
      }
      
      buildings.push(building)
    } catch (err) {
      errors.push(`Line ${lineNum}: Parse error - ${err}`)
    }
  }
  
  return {
    success: errors.length === 0,
    data: buildings,
    errors,
  }
}

// ============================================================================
// RECIPE PARSER (JSON format - for more complex structure)
// ============================================================================

export function parseRecipes(content: string): ParseResult<RecipeData> {
  try {
    const data = JSON.parse(content)
    
    if (!Array.isArray(data)) {
      return {
        success: false,
        data: [],
        errors: ['Recipe data must be an array'],
      }
    }
    
    const recipes: RecipeData[] = []
    const errors: string[] = []
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      
      try {
        const recipe: RecipeData = {
          id: item.id,
          name: item.name,
          outputProductId: item.outputProductId,
          outputQuantity: item.outputQuantity || 1,
          inputs: item.inputs || [],
          productionTime: item.productionTime || 10,
          techLevel: item.techLevel || 1,
          qualityFactor: item.qualityFactor || 1.0,
        }
        
        recipes.push(recipe)
      } catch (err) {
        errors.push(`Recipe ${i}: Parse error - ${err}`)
      }
    }
    
    return {
      success: errors.length === 0,
      data: recipes,
      errors,
    }
  } catch (err) {
    return {
      success: false,
      data: [],
      errors: [`JSON parse error: ${err}`],
    }
  }
}

// ============================================================================
// FETCH HELPERS
// ============================================================================

export interface DataFiles {
  products?: string
  buildings?: string
  recipes?: string
}

/**
 * Load and parse all data files
 * Returns parsed data or errors
 */
export async function loadDataFiles(basePath: string = '/data'): Promise<{
  products: ParseResult<ProductData>
  buildings: ParseResult<BuildingData>
  recipes: ParseResult<RecipeData>
}> {
  const [productsResponse, buildingsResponse] = await Promise.all([
    fetch(`${basePath}/products.txt`),
    fetch(`${basePath}/buildings.txt`),
  ])
  
  const productsText = await productsResponse.text()
  const buildingsText = await buildingsResponse.text()
  
  const products = parseProducts(productsText)
  const buildings = parseBuildings(buildingsText)
  
  // Recipes are optional for now
  let recipes: ParseResult<RecipeData> = { success: true, data: [], errors: [] }
  try {
    const recipesResponse = await fetch(`${basePath}/recipes.json`)
    if (recipesResponse.ok) {
      const recipesText = await recipesResponse.text()
      recipes = parseRecipes(recipesText)
    }
  } catch {
    // Recipes file is optional
  }
  
  return { products, buildings, recipes }
}
