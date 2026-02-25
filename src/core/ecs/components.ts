import { defineComponent, Types } from 'bitecs'

// ============================================================================
// CORE TRANSFORM COMPONENTS
// ============================================================================

export const Position = defineComponent({
  x: Types.ui16,
  y: Types.ui16,
  cityId: Types.ui8,
})

export const EntityType = defineComponent({
  kind: Types.ui8,
})

export const Renderable = defineComponent({
  spriteId: Types.ui16,
  layer: Types.ui8,
  visible: Types.ui8,
  alpha: Types.f32, // 0.0 to 1.0 transparency
})

export const Isometric = defineComponent({
  screenX: Types.i16,
  screenY: Types.i16,
  depth: Types.ui8,
})

// ============================================================================
// ENTITY KINDS
// ============================================================================

export enum EntityKind {
  None = 0,
  Building = 1,
  Product = 2,
  Company = 3,
  City = 4,
  Resource = 5,
  Bank = 6,
  Executive = 7,
  Vehicle = 8,
}

// ============================================================================
// BUILDING COMPONENTS
// ============================================================================

export const Building = defineComponent({
  buildingTypeId: Types.ui16,
  level: Types.ui8,
  maxFloors: Types.ui8,
  size: Types.ui8, // 1=1x1, 2=2x2, 3=3x3
  isOperational: Types.ui8,
})

export const PowerConsumer = defineComponent({
  consumption: Types.ui16,
  hasPower: Types.ui8,
})

export const PollutionEmitter = defineComponent({
  amount: Types.ui8,
  radius: Types.ui8,
})

// ============================================================================
// RETAIL COMPONENTS (Expertise & Traffic)
// ============================================================================

export const RetailPlot = defineComponent({
  trafficIndex: Types.ui8, // 0-100: Foot traffic quality
  visibility: Types.ui8,   // 0-100: Street visibility
  rent: Types.ui32,
  maxCustomers: Types.ui16,

  // Sales Controls per Slot
  price1: Types.ui32, // Price in cents
  price2: Types.ui32,
  price3: Types.ui32,
})

export const RetailExpertise = defineComponent({
  apparel: Types.ui8,      // 0-100
  electronics: Types.ui8,  // 0-100
  food: Types.ui8,         // 0-100
  luxury: Types.ui8,       // 0-100
  general: Types.ui8,      // 0-100
})
export const BrandLoyalty = defineComponent({
  rating: Types.ui8,       // 0-100
  awareness: Types.ui8,    // 0-100
  trend: Types.i8,         // -50 to +50
})

export const MarketingOffice = defineComponent({
  productId: Types.ui16,
  spending: Types.f64,        // Monthly budget in cents
  efficiency: Types.ui8,      // Impacted by expertise (0-100)
  campaignType: Types.ui8,    // 0=Mass Media, 1=Digital, 2=Premium, 3=Guerilla
  targetDemographic: Types.ui8, // 0=All, 1=Youth, 2=Adults, 3=Premium, 4=Budget
  reach: Types.f64,           // Cumulative ad impressions (thousands)
})

export const ProductBrand = defineComponent({
  productId: Types.ui16,
  companyId: Types.ui32,
  awareness: Types.ui8,       // 0-100
  loyalty: Types.ui8,         // 0-100
  marketShare: Types.f64,     // 0-100% of total market for this product
  adSpendThisMonth: Types.f64, // Total marketing spend this period (cents)
  reputationBonus: Types.ui8, // 0-100 bonus from company reputation
})

// ============================================================================
// TECHNOLOGY COMPONENTS (TechAge & Innovation)
// ============================================================================

export const TechAge = defineComponent({
  currentLevel: Types.ui8,     // 0-255
  maxLevel: Types.ui8,         // Cap based on era
  obsolescenceRate: Types.ui8, // 0-100
  innovationPoints: Types.ui32,
  globalInnovationSpeed: Types.f32,
})

export const ProductTech = defineComponent({
  productId: Types.ui16,
  techLevelRequired: Types.ui8,
  complexity: Types.ui8,
  maintainanceHours: Types.ui16,
  bugRate: Types.ui8,
})

export const ResearchCenter = defineComponent({
  researchingProductId: Types.ui16,
  innovationPoints: Types.ui32,
  progress: Types.ui8,       // 0-100%
  efficiency: Types.ui8,     // Impacted by employees/spending
})

export const CompanyTechnology = defineComponent({
  productId: Types.ui16,
  techLevel: Types.ui16,     // 0-1000
  companyId: Types.ui32,
})

export const RDCenter = defineComponent({
  researchSpeed: Types.ui16,
  techPointsPerTick: Types.ui8,
  specialization: Types.ui8, // Product category focus
})

// ============================================================================
// MANUFACTURING COMPONENTS
// ============================================================================

export const Factory = defineComponent({
  recipeId: Types.ui16,
  efficiency: Types.ui8,   // 0-100
  quality: Types.ui8,      // 0-100
  productionRate: Types.ui16,
})

export const Inventory = defineComponent({
  capacity: Types.f64,
  currentAmount: Types.f64, // Output / Sales Stock
  productId: Types.ui16,     // Output / Sales Product ID
  quality: Types.ui8,        // Average quality of stock (0-100)

  // Input Buffers (for factories)
  input1ProductId: Types.ui16,
  input1Amount: Types.f64,
  input1Quality: Types.ui8,

  input2ProductId: Types.ui16,
  input2Amount: Types.f64,
  input2Quality: Types.ui8,

  input3ProductId: Types.ui16,
  input3Amount: Types.f64,
  input3Quality: Types.ui8,
})

export const Warehouse = defineComponent({
  maxStores: Types.ui8,    // Can supply up to N retail stores
  distributionRadius: Types.ui8,
  bufferLevel: Types.ui32, // Current buffer stock
})

export const Maintenance = defineComponent({
  baseUpkeep: Types.f64,
  monthlyCost: Types.f64,
  lastPaymentTick: Types.ui32,
})

export const ProductionOutput = defineComponent({
  capacity: Types.f64,
  actualOutput: Types.f64,
  utilization: Types.ui8, // 0-100
})

// ============================================================================
// HUMAN CAPITAL COMPONENTS (Executives & Management)
// ============================================================================

export enum ExecutiveRole {
  None = 0,
  COO = 1,  // Chief Operating Officer - reduces internal friction
  CTO = 2,  // Chief Technical Officer - boosts R&D efficiency
  CMO = 3,  // Chief Marketing Officer - manages pricing & advertising
  CFO = 4,  // Chief Financial Officer - manages finances & investments
  CHRO = 5, // Chief HR Officer - manages morale & training
}

export const Executive = defineComponent({
  role: Types.ui8,         // COO, CTO, CMO, etc.
  expertiseManufacturing: Types.ui8,
  expertiseRetailing: Types.ui8,
  expertiseRD: Types.ui8,
  expertiseMarketing: Types.ui8,
  salary: Types.ui32,
  loyalty: Types.ui8,
})

export const ManagementUnit = defineComponent({
  unitsManaged: Types.ui8, // 3x3 = 9 max
  efficiency: Types.ui8,
  internalFriction: Types.ui8, // 0-100
})

export const HumanResources = defineComponent({
  headcount: Types.ui16,
  morale: Types.ui8,         // 0-100
  trainingLevel: Types.ui8,  // 0-100
  salary: Types.f64,        // Average monthly salary per head
  benefits: Types.f64,      // Monthly benefit spend per head (health, pension, etc)
  trainingBudget: Types.f64, // Monthly training spend
})

export const Strike = defineComponent({
  durationDays: Types.ui8,
  startTick: Types.ui32,
  severity: Types.ui8, // 0=None, 1=High, 2=Critical
})

// ============================================================================
// FINANCIAL COMPONENTS
// ============================================================================

export const Finances = defineComponent({
  cash: Types.f64,
  debt: Types.f64,          // Total outstanding loans (cents)
  creditLimit: Types.f64,
  interestRate: Types.ui16, // Basis points (e.g., 500 = 5%)
  creditRating: Types.ui8,  // 0-100
})

// Loan structure for tracking individual loans
export interface Loan {
  id: number;
  principal: number;        // Original loan amount
  remaining: number;        // Remaining balance
  interestRate: number;     // Annual interest rate in basis points
  monthlyPayment: number;   // Fixed monthly payment
  monthsRemaining: number;  // Months left to pay
  startTick: number;        // When loan was issued
}

// Bond structure for corporate bonds
export interface CorporateBond {
  id: number;
  faceValue: number;        // Bond face value (cents)
  couponRate: number;       // Annual coupon rate in basis points
  issuePrice: number;       // Price bond was issued at
  maturityMonths: number;   // Total months to maturity
  monthsRemaining: number;  // Months left
  startTick: number;
  bondRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';
}

// Extended financial tracking (stored separately from ECS due to complexity)
export interface CompanyFinancials {
  companyId: number;
  loans: Loan[];
  bonds: CorporateBond[];
  lastMonthInterestPaid: number;
  lastMonthPrincipalPaid: number;
  lastMonthCouponPaid: number;
  totalInterestPaidYTD: number;
}

export const Stock = defineComponent({
  sharesOutstanding: Types.f64,
  sharePrice: Types.f64,       // Current price in cents
  prevSharePrice: Types.f64,   // Previous month's price for momentum/change calc
  dividend: Types.ui16,        // Basis points of share price (annual)
  earningsPerShare: Types.f64, // Calculated from net income / shares
  peRatio: Types.f64,          // Price-to-Earnings ratio
  volume: Types.f64,           // Monthly trading volume
  sector: Types.ui8,           // 0=Conglomerate, 1=Tech, 2=Consumer, 3=Industrial, 4=Finance, 5=Energy
})

// ============================================================================
// COMPANY STATE COMPONENTS
// ============================================================================

export const Company = defineComponent({
  companyId: Types.ui16,
  parentCompanyId: Types.ui16, // For subsidiaries
  reputation: Types.ui8,
  marketCap: Types.f64,
  revenueLastMonth: Types.f64,
  expensesLastMonth: Types.f64,
  netIncomeLastMonth: Types.f64,
  currentMonthRevenue: Types.f64,
  currentMonthExpenses: Types.f64,
  strategicDirective: Types.ui8, // 0=None, 1=Quality, 2=Aggression, 3=Efficiency
  activePolicies: Types.ui8, // Bitmask: 1=Training, 2=Automation, 4=Benefits
})

// ============================================================================
// AI & COMPETITION COMPONENTS
// ============================================================================

export const AIController = defineComponent({
  personality: Types.ui8,    // 0=Aggressive, 1=Balanced, 2=Conservative
  focusIndustry: Types.ui8,   // Product category index
  expansionThreshold: Types.ui32, // Cash needed before building new firm
  lastActionTick: Types.ui32,
})

export const MarketCompetition = defineComponent({
  saturation: Types.ui8,     // 0-100%
  rivalCount: Types.ui8,
  avgPrice: Types.ui32,
  avgQuality: Types.ui8,
})

export const KnowledgePoints = defineComponent({
  total: Types.ui32,
  unspent: Types.ui32,
})

// ============================================================================
// LOGISTICS & SUPPLY CHAIN COMPONENTS
// ============================================================================

/**
 * LogisticSupply defines a link from a destination building to a source building.
 * In a true CapLab clone, this would be per "unit", but for MVP we link the whole firm.
 */
export const LogisticSupply = defineComponent({
  // Source 1 -> Input 1
  source1Id: Types.eid,
  product1Id: Types.ui16,
  
  // Source 2 -> Input 2
  source2Id: Types.eid,
  product2Id: Types.ui16,
  
  // Source 3 -> Input 3
  source3Id: Types.eid,
  product3Id: Types.ui16,

  autoSupply: Types.ui8, // 1 = enabled
  minStockLevel: Types.ui32,
  transportCost: Types.ui16,
})

// ============================================================================
// MARKET & PRODUCT STATE COMPONENTS
// ============================================================================

/**
 * MarketData tracks the global standing of a product within the simulation.
 */
export const MarketData = defineComponent({
  productId: Types.ui16,
  price: Types.f64,          // Current selling price (cents)
  quality: Types.ui8,         // 0-100: Impacted by Tech and Factory efficiency
  brandPower: Types.ui8,      // 0-100: Impacted by marketing
  marketShare: Types.ui8,     // 0-100: Percentage of city demand captured
  avgCost: Types.f64,        // Average cost of goods sold
})

export const PlayerProfile = defineComponent({
  level: Types.ui8,
  experience: Types.ui32,
  achievements: Types.ui32, // Bitmask
})

export const CityEconomicData = defineComponent({
  population: Types.ui32,           // Total inhabitants
  purchasingPower: Types.ui8,       // 0-100: GDP/wage factor
  unemployment: Types.ui8,          // 0-100
  consumerSentiment: Types.ui8,     // 0-100: Impacted by recent trends
  realWage: Types.f64,              // Average annual income in cents
  interestRate: Types.f64,          // Central bank rate (basis points, e.g. 500 = 5.0%)
  inflationRate: Types.f64,         // Annual inflation rate (basis points, e.g. 250 = 2.5%)
  taxRate: Types.ui8,               // Corporate tax rate (0-100%)
  industryDemandMult: Types.f64,    // Global demand multiplier (1.0 = normal)
  gdpGrowthRate: Types.f64,         // Annualized GDP growth (basis points)
})
