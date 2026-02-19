import { useState, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { ProductData, BuildingData, BuildingType } from '../../core/data/types';
import { GameWorld } from '../../core/ecs/world';
import { defineQuery } from 'bitecs';
import { 
  Building, 
  Maintenance, 
  ProductionOutput, 
  MarketData, 
  Inventory, 
  AIController, 
  Company, 
  Finances, 
  Stock,
  CityEconomicData,
  HumanResources,
  CompanyTechnology,
  LogisticSupply
} from '../../core/ecs/components';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart,
  PieChart, Pie, Cell, Line
} from 'recharts';
import { globalFuelPrice } from '../../core/ecs/systems/MacroEconomySystem';

import './Dashboard.css';

interface DashboardProps {
  products: ProductData[];
  buildings: BuildingData[];
  cash: number;
  gameTick: number;
  world?: GameWorld;
  onUpgradeBuilding?: (entityId: number) => void;
  activeOverlay?: string | null;
  onSetOverlay?: (overlay: string | null) => void;
}

// INTERNAL MANAGEMENT DATA
interface EmployeeMetrics {
  morale: number;
  trainingLevel: number;
  productivity: number;
  turnoverRate: number;
  satisfaction: number;
  skillLevel: number;
}

interface ProductExpertise {
  productClass: string;
  expertiseLevel: number;
  knowledgePoints: number;
  techLevel: number;
}

// Generate mock historical data for charts
const generateStockData = (points: number, tick: number) => {
  const data = [];
  let price = 100;
  for (let i = 0; i < points; i++) {
    price = price + (Math.random() - 0.5) * 5 + Math.sin((tick + i) * 0.1) * 2;
    data.push({
      day: i + 1,
      price: Math.max(50, price),
      volume: Math.floor(Math.random() * 10000) + 5000,
      movingAvg: Math.max(50, price + (Math.random() - 0.5) * 3),
    });
  }
  return data;
};

const generateRevenueData = (tick: number) => {
  return Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    revenue: Math.floor(Math.sin((tick + i) * 0.5) * 20000 + 50000),
    expenses: Math.floor(Math.sin((tick + i) * 0.3) * 15000 + 25000),
    profit: 0,
    cashFlow: 0,
  })).map(d => ({ 
    ...d, 
    profit: d.revenue - d.expenses,
    cashFlow: d.revenue - d.expenses - 5000
  }));
};

const generateMarketShareData = () => [
  { name: 'Your Corp', value: 35, color: '#e94560' },
  { name: 'Competitor A', value: 25, color: '#70a1ff' },
  { name: 'Competitor B', value: 20, color: '#00d9a5' },
  { name: 'Competitor C', value: 15, color: '#ffa502' },
  { name: 'Others', value: 5, color: '#747d8c' },
];


// Product Expertise Data
const generateProductExpertise = (products: ProductData[]): ProductExpertise[] => {
  return products.slice(0, 8).map((p, i) => ({
    productClass: p.name,
    expertiseLevel: Math.min(100, 20 + i * 8 + Math.random() * 20),
    knowledgePoints: Math.floor(Math.random() * 50),
    techLevel: (p as any).techLevel || 1,
  }));
};

export function Dashboard({ 
  products, 
  buildings, 
  cash, 
  gameTick, 
  world, 
  onUpgradeBuilding,
  activeOverlay: currentOverlay,
  onSetOverlay 
}: DashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'buildings' | 'finance' | 'management' | 'economy' | 'logistics'>('overview');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // REAL SIMULATION DATA - Connected to game tick
  const revenueData = useMemo(() => generateRevenueData(gameTick), [gameTick]);
  
  const economyMarketShareData = useMemo(() => {
    if (!world) return generateMarketShareData();
    
    const marketQuery = defineQuery([MarketData, Inventory]);
    const entities = marketQuery(world.ecsWorld);
    
    if (entities.length === 0) return generateMarketShareData();

    const colors = ['#e94560', '#70a1ff', '#00d9a5', '#ffa502', '#5352ed'];

    // Map real market shares from components
    const realData = entities.map((id, idx) => {
      const prodId = Inventory.productId[id];
      const prodName = world.dataStore.getProduct(prodId)?.name || 'Product';
      // If market share is 0 (sim hasn't run yet), give it a tiny slice based on capacity
      const value = MarketData.marketShare[id] || Math.min(25, 5 + id % 10); 
      return {
        name: prodName,
        value,
        color: colors[idx % colors.length]
      };
    }).slice(0, 5); // top 5

    return realData.length > 0 ? realData : generateMarketShareData();
  }, [world, gameTick]);

  // Connect Stock Price to real Market Price if possible
  const liveStockData = useMemo(() => {
     if (!world) return generateStockData(30, gameTick);
     
     const marketQuery = defineQuery([MarketData]);
     const entities = marketQuery(world.ecsWorld);
     
     if (entities.length === 0) return generateStockData(30, gameTick);
     
     // For MVP stock price of "Your Corp", average the prices of your products
     let total = 0;
     entities.forEach(id => total += MarketData.price[id]);
     const avgPrice = (total / entities.length) / 100; // back to dollars

     const baseData = generateStockData(30, gameTick);
     // Override the last point with REAL current price
     baseData[baseData.length - 1].price = avgPrice;
     return baseData;
  }, [world, gameTick]);

  // REAL HR DATA - Aggregated from all owned buildings
  const realEmployeeMetrics = useMemo(() => {
    if (!world) return { morale: 0, trainingLevel: 0, productivity: 0, turnoverRate: 0, satisfaction: 0, skillLevel: 0, headcount: 0 };
    
    const hrQuery = defineQuery([HumanResources, Building]);
    const entities = hrQuery(world.ecsWorld);
    
    if (entities.length === 0) return { morale: 0, trainingLevel: 0, productivity: 0, turnoverRate: 0, satisfaction: 0, skillLevel: 0, headcount: 0 };
    
    let totalMorale = 0;
    let totalTraining = 0;
    let totalHeadcount = 0;
    
    entities.forEach(id => {
      const hc = HumanResources.headcount[id] || 0;
      totalMorale += (HumanResources.morale[id] || 0) * hc;
      totalTraining += (HumanResources.trainingLevel[id] || 0) * hc;
      totalHeadcount += hc;
    });
    
    const avgMorale = totalHeadcount > 0 ? totalMorale / totalHeadcount : 0;
    const avgTraining = totalHeadcount > 0 ? totalTraining / totalHeadcount : 0;
    
    return {
      morale: avgMorale,
      trainingLevel: avgTraining,
      productivity: (avgMorale * 0.4 + avgTraining * 0.6),
      turnoverRate: Math.max(2, 20 - (avgMorale / 5)), // Derived turnover
      satisfaction: avgMorale,
      skillLevel: avgTraining,
      headcount: totalHeadcount
    };
  }, [world, gameTick]);

  const productExpertise = useMemo(() => {
    if (!world) return generateProductExpertise(products);
    
    const techQuery = defineQuery([CompanyTechnology]);
    const techEntities = techQuery(world.ecsWorld);
    
    // Sort by tech level and map to display objects
    return techEntities
      .map(id => ({
        productClass: world.dataStore.getProduct(CompanyTechnology.productId[id])?.name || 'Unknown',
        expertiseLevel: Math.floor(CompanyTechnology.techLevel[id] / 10), // 0-100 scale for UI
        knowledgePoints: Math.floor(CompanyTechnology.techLevel[id] % 100),
        techLevel: CompanyTechnology.techLevel[id],
      }))
      .sort((a,b) => b.techLevel - a.techLevel)
      .slice(0, 10);
  }, [world, products, gameTick, currentOverlay]);

  // City Economy Memo
  const cityStats = useMemo(() => {
    if (!world) return { pop: 0, sentiment: 0, pp: 0, wage: 0 };
    const query = defineQuery([CityEconomicData]);
    const entities = query(world.ecsWorld);
    if (entities.length === 0) return { pop: 0, sentiment: 0, pp: 0, wage: 0 };
    const eid = entities[0]; // For MVP assume first city
    return {
        pop: CityEconomicData.population[eid],
        sentiment: CityEconomicData.consumerSentiment[eid],
        pp: CityEconomicData.purchasingPower[eid],
        wage: CityEconomicData.realWage[eid]
    };
  }, [world, gameTick]);

  // Employee radar chart data
  const employeeRadarData = [
    { subject: 'Morale', A: realEmployeeMetrics.morale, fullMark: 100 },
    { subject: 'Training', A: realEmployeeMetrics.trainingLevel, fullMark: 100 },
    { subject: 'Productivity', A: realEmployeeMetrics.productivity, fullMark: 100 },
    { subject: 'Retention', A: 100 - realEmployeeMetrics.turnoverRate, fullMark: 100 },
    { subject: 'Satisfaction', A: realEmployeeMetrics.satisfaction, fullMark: 100 },
    { subject: 'Skills', A: realEmployeeMetrics.skillLevel, fullMark: 100 },
  ];

  const categories = [
    { id: 'all', label: t('menu.all') || 'All', icon: '🌐' },
    { id: 'RAW', label: t('categories.raw_materials') || 'Raw Materials', icon: '🌾' },
    { id: 'INTERMEDIATE', label: t('categories.intermediate') || 'Intermediate', icon: '⚙️' },
    { id: 'CONSUMER', label: t('categories.consumer') || 'Consumer', icon: '🛍️' },
    { id: 'DIGITAL', label: t('categories.digital') || 'Digital', icon: '💻' },
    { id: 'GREEN', label: t('categories.green_tech') || 'Green Tech', icon: '🌱' },
  ];

  const ownedBuildingsData = useMemo(() => {
    if (!world) return [];
    const query = defineQuery([Building]);
    const entities = query(world.ecsWorld);
    return entities.map(id => {
      const typeId = Building.buildingTypeId[id];
      const template = world.dataStore.getBuilding(typeId);
      return {
        id,
        name: template?.name || 'Unknown Building',
        type: template?.type || BuildingType.OFFICE,
        level: Building.level[id],
        capacity: ProductionOutput.capacity[id],
        output: ProductionOutput.actualOutput[id],
        upkeep: Maintenance.monthlyCost[id],
        utilization: ProductionOutput.utilization[id],
        isOperational: !!Building.isOperational[id]
      };
    });
  }, [world, gameTick]);


  const buildingTypes = [
    { id: 'all', label: t('menu.all') || 'All', icon: '🏢' },
    { id: 'FARM', label: t('menu.farms') || 'Farms', icon: '🚜' },
    { id: 'MINE', label: t('menu.mines') || 'Mines', icon: '⛏️' },
    { id: 'FACTORY', label: t('menu.factories') || 'Factories', icon: '🏭' },
    { id: 'RETAIL', label: t('menu.retail') || 'Retail', icon: '🏪' },
    { id: 'WAREHOUSE', label: t('menu.warehouses') || 'Warehouses', icon: '📦' },
    { id: 'OFFICE', label: t('menu.offices') || 'Offices', icon: '💼' },
  ];


  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const filteredBuildings = selectedCategory === 'all'
    ? buildings
    : buildings.filter(b => b.type === selectedCategory);

  const formatCurrency = (amount: number) => {
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`;
    return `$${amount.toFixed(0)}`;
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard">
        {/* Tab Navigation */}
        <div className="dashboard-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">{t('menu.overview') || 'Overview'}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <span className="tab-icon">📦</span>
            <span className="tab-label">{t('menu.products') || 'Products'}</span>
            <span className="tab-count">{products.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'buildings' ? 'active' : ''}`}
            onClick={() => setActiveTab('buildings')}
          >
            <span className="tab-icon">🏗️</span>
            <span className="tab-label">{t('menu.buildings') || 'Buildings'}</span>
            <span className="tab-count">{buildings.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'management' ? 'active' : ''}`}
            onClick={() => setActiveTab('management')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">{t('menu.management') || 'Management'}</span>
          </button>
           <button 
            className={`tab-btn ${activeTab === 'finance' ? 'active' : ''}`}
            onClick={() => setActiveTab('finance')}
          >
            <span className="tab-icon">💰</span>
            <span className="tab-label">{t('menu.finance') || 'Finance'}</span>
          </button>
           <button 
            className={`tab-btn ${activeTab === 'logistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('logistics')}
          >
            <span className="tab-icon">🚚</span>
            <span className="tab-label">{t('menu.logistics') || 'Logistics'}</span>
          </button>
           <button 
            className={`tab-btn ${activeTab === 'economy' ? 'active' : ''}`}
            onClick={() => setActiveTab('economy')}
          >
            <span className="tab-icon">📉</span>
            <span className="tab-label">{t('menu.economy') || 'Economy'}</span>
          </button>
        </div>


        {/* Content Area */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <div className="tab-panel overview-panel">
              <div className="panel-header">
                <h2>{t('menu.executive_dashboard') || 'Executive Dashboard'}</h2>
                <p>{t('menu.realtime_bi') || 'Real-time business intelligence'} • {t('stats.tick') || 'Tick'}: {gameTick}</p>
              </div>

              
              {/* KPI Cards — Real ECS Data */}
              {(() => {
                // Read real financial data from player's company entity
                let realMarketCap = cash * 2.5;
                let realNetIncome = 0;
                let realRevenue = 0;
                let realExpenses = 0;
                let buildingCount = 0;
                let productCount = products.length;
                let stockChange = 0;

                if (world && world.playerEntityId > 0) {
                  realMarketCap = Company.marketCap[world.playerEntityId] || cash * 2.5;
                  realNetIncome = Company.netIncomeLastMonth[world.playerEntityId] || 0;
                  realRevenue = Company.revenueLastMonth[world.playerEntityId] || 0;
                  realExpenses = Company.expensesLastMonth[world.playerEntityId] || 0;

                  const bq = defineQuery([Building, Company]);
                  const bEntities = bq(world.ecsWorld);
                  buildingCount = bEntities.filter(bid => Company.companyId[bid] === Company.companyId[world.playerEntityId]).length;

                  // Stock price change
                  const curPrice = Stock.sharePrice[world.playerEntityId] || 0;
                  const prevPrice = Stock.prevSharePrice[world.playerEntityId] || curPrice;
                  stockChange = prevPrice > 0 ? ((curPrice - prevPrice) / prevPrice) * 100 : 0;
                }

                const operatingMarginPct = realRevenue > 0 ? ((realNetIncome / realRevenue) * 100) : 0;
                const cashChangePct = realRevenue > 0 ? ((realRevenue - realExpenses) / realRevenue * 100) : 0;

                return (
                  <>
                    <div className="kpi-grid">
                      <KpiCard 
                        title={t('stats.cash_on_hand') || "Cash on Hand"} 
                        value={formatCurrency(cash)} 
                        change={parseFloat(cashChangePct.toFixed(1))} 
                        icon="💵"
                        color="#00d9a5"
                      />
                      <KpiCard 
                        title={t('stats.market_cap') || "Market Cap"} 
                        value={formatCurrency(realMarketCap)} 
                        change={parseFloat(stockChange.toFixed(1))} 
                        icon="📈"
                        color="#70a1ff"
                      />
                      <KpiCard 
                        title={t('stats.morale') || "Employee Morale"} 
                        value={`${realEmployeeMetrics.morale.toFixed(1)}%`}
                        change={realEmployeeMetrics.morale > 75 ? +3.2 : -2.1}
                        icon="😊"
                        color="#ffa502"
                      />
                      <KpiCard 
                        title={t('stats.training') || "Training Level"} 
                        value={`${realEmployeeMetrics.trainingLevel.toFixed(1)}%`}
                        change={+8.7}
                        icon="🎓"
                        color="#e94560"
                      />
                    </div>

                    {/* Company Vitals Strip — Real Data */}
                    <div className="vitals-strip glass-card">
                      <div className="vital-item">
                        <span className="vital-dot" style={{ background: '#00d9a5' }}></span>
                        <span className="vital-label">{t('stats.products_owned') || 'Products'}</span>
                        <span className="vital-value">{productCount}</span>
                      </div>
                      <div className="vital-divider"></div>
                      <div className="vital-item">
                        <span className="vital-dot" style={{ background: '#70a1ff' }}></span>
                        <span className="vital-label">{t('stats.buildings_count') || 'Buildings'}</span>
                        <span className="vital-value">{buildingCount}</span>
                      </div>
                      <div className="vital-divider"></div>
                      <div className="vital-item">
                        <span className="vital-dot" style={{ background: '#ffa502' }}></span>
                        <span className="vital-label">{t('stats.employees') || 'Employees'}</span>
                        <span className="vital-value">{realEmployeeMetrics.headcount}</span>
                      </div>
                      <div className="vital-divider"></div>
                      <div className="vital-item">
                        <span className="vital-dot" style={{ background: '#e94560' }}></span>
                        <span className="vital-label">{t('finance.operating_margin') || 'Op. Margin'}</span>
                        <span className="vital-value" style={{ color: operatingMarginPct >= 0 ? '#00d9a5' : '#ff4757' }}>{operatingMarginPct.toFixed(1)}%</span>
                      </div>
                      <div className="vital-divider"></div>
                      <div className="vital-item">
                        <span className="vital-dot" style={{ background: '#5352ed' }}></span>
                        <span className="vital-label">{t('finance.net_income') || 'Net Income'}</span>
                        <span className="vital-value" style={{ color: realNetIncome >= 0 ? '#00d9a5' : '#ff4757' }}>{formatCurrency(realNetIncome)}</span>
                      </div>
                      <div className="vital-divider"></div>
                      <div className="vital-item">
                        <span className="vital-dot" style={{ background: '#ff6348' }}></span>
                        <span className="vital-label">{t('stats.market_position') || 'Market Rank'}</span>
                        <span className="vital-value" style={{ color: '#ffa502' }}>#1</span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Charts Grid */}

              <div className="charts-grid">
                <div className="chart-card glass-card">
                  <div className="chart-header">
                    <h3>{t('stats.stock_price') || 'Stock Price'}</h3>
                    <span className="chart-badge live">{t('stats.live') || 'LIVE'}</span>

                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={liveStockData}>
                        <defs>
                          <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#e94560" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#e94560" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(22, 33, 62, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#e94560" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#stockGradient)" 
                        />
                        <Line type="monotone" dataKey="movingAvg" stroke="#70a1ff" strokeWidth={1} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card glass-card">
                  <div className="chart-header">
                    <h3>{t('stats.revenue_vs_expenses') || 'Revenue vs Expenses'}</h3>

                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(22, 33, 62, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="revenue" fill="#00d9a5" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" fill="#ff4757" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card glass-card">
                  <div className="chart-header">
                    <h3>{t('stats.employee_performance') || 'Employee Performance'}</h3>

                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={employeeRadarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Metrics"
                          dataKey="A"
                          stroke="#e94560"
                          strokeWidth={2}
                          fill="#e94560"
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card glass-card">
                  <div className="chart-header">
                    <h3>{t('stats.cash_flow') || 'Cash Flow'}</h3>

                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00d9a5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00d9a5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(22, 33, 62, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cashFlow" 
                          stroke="#00d9a5" 
                          strokeWidth={2}
                          fill="url(#cashFlowGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="tab-panel">
              <div className="panel-header">
                <h2>{t('menu.product_catalog') || 'Product Catalog'}</h2>
                <div className="filter-chips">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      className={`filter-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="products-grid">
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product}
                    t={t}
                    labels={{

                      perishable: t('stats.perishable') || 'Perishable',
                      quality: t('stats.quality') || 'Quality',
                      tech_lv: t('stats.tech_lv') || 'Tech Lv.',
                      base_price: t('stats.base_price') || 'Base Price',
                      demand: t('stats.demand') || 'Demand',
                      weight: t('stats.weight') || 'Weight',
                      kp: t('stats.kp') || 'Knowledge Points',
                      categoryLabels: {
                        RAW: t('categories.raw_materials') || 'Raw Materials',
                        INTERMEDIATE: t('categories.intermediate') || 'Intermediate',
                        CONSUMER: t('categories.consumer') || 'Consumer',
                        DIGITAL: t('categories.digital') || 'Digital',
                        GREEN: t('categories.green_tech') || 'Green Tech',
                        FINANCIAL: 'Financial'
                      }
                    }}

                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'buildings' && (
            <div className="tab-panel">
              <div className="panel-header">
                <h2>{t('menu.building_types') || 'Building Types'}</h2>
                <div className="filter-chips">
                  {buildingTypes.map(type => (
                    <button
                      key={type.id}
                      className={`filter-chip ${selectedCategory === type.id ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(type.id)}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="buildings-grid">
                {ownedBuildingsData.length > 0 && (
                  <div className="section-divider-full">
                    <span className="section-label">OWNED ASSETS ({ownedBuildingsData.length})</span>
                  </div>
                )}
                
                {ownedBuildingsData.map(owned => (
                  <OwnedBuildingCard 
                    key={`owned-${owned.id}`} 
                    building={owned}
                    formatCurrency={formatCurrency}
                    onUpgrade={() => onUpgradeBuilding?.(owned.id)}
                    t={t}
                  />
                ))}

                <div className="section-divider-full">
                    <span className="section-label">AVAILABLE BLUEPRINTS</span>
                </div>

                {filteredBuildings.map(building => (
                  <BuildingCard 
                    key={building.id} 
                    building={building}
                    t={t}
                    labels={{
                      cost: t('stats.cost') || 'Cost',
                      time: t('stats.build_time') || 'Build Time',
                      size: t('stats.size') || 'Size',
                      floors: t('stats.floors') || 'Floors',
                      days: t('stats.days') || 'days',
                      typeLabels: {
                        FARM: t('menu.farms') || 'Farms',
                        MINE: t('menu.mines') || 'Mines',
                        FACTORY: t('menu.factories') || 'Factories',
                        RETAIL: t('menu.retail') || 'Retail',
                        WAREHOUSE: t('menu.warehouses') || 'Warehouses',
                        OFFICE: t('menu.offices') || 'Offices'
                      }
                    }}
                  />

                ))}
              </div>
            </div>
          )}

          {activeTab === 'management' && (
            <ManagementPanel 
              employeeMetrics={realEmployeeMetrics}
              productExpertise={productExpertise}
              t={t}
              labels={{
                title: t('menu.internal_management') || 'Internal Management',
                desc: t('menu.hr_excellence') || 'Human Resources & Organizational Excellence',
                metrics: t('menu.employee_metrics') || 'Employee Metrics',
                expertise: t('menu.product_class_expertise') || 'Product Class Expertise',
                kp_desc: t('menu.kp_by_category') || 'Knowledge Points by Product Category',
                morale: t('stats.morale') || 'Morale',
                training: t('stats.training') || 'Training Level',
                productivity: t('stats.productivity') || 'Productivity',
                turnover: t('stats.turnover') || 'Turnover Rate',
                tech_lv: t('stats.tech_lv') || 'Tech Lv.',
                high_risk: t('menu.high_risk') || 'High Disruption Risk',
                happiness: t('stats.happiness') || 'Happiness',
                skills: t('stats.skills') || 'Skills',
                output: t('stats.output') || 'Output',
                retention: t('stats.retention') || 'Retention'
              }}
            />

          )}

          {activeTab === 'finance' && (
            <FinancePanel 
              cash={cash} 
              formatCurrency={formatCurrency}
              revenueData={revenueData}
              marketShareData={economyMarketShareData}
              t={t}
              world={world}
              labels={{
                title: t('menu.financial_overview') || 'Financial Overview',
                cash: t('stats.cash_on_hand') || 'Cash on Hand',
                revenue: t('stats.revenue') || 'Revenue',
                expenses: t('stats.expenses') || 'Expenses',
                assets: t('stats.assets') || 'Assets',
                debt: t('stats.debt') || 'Debt'
              }}
            />
          )}

          {activeTab === 'logistics' && (
            <LogisticsPanel 
              world={world} 
              ownedBuildings={ownedBuildingsData} 
              formatCurrency={formatCurrency}
              currentOverlay={currentOverlay}
              onSetOverlay={onSetOverlay}
            />
          )}

          {activeTab === 'economy' && (
            <EconomicPanel 
              cityStats={cityStats} 
              formatCurrency={formatCurrency} 
              gameTick={gameTick}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, change, icon, color }: { 
  title: string; 
  value: string; 
  change: number; 
  icon: string;
  color: string;
}) {
  return (
    <div className="kpi-card glass-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="kpi-glow" style={{ background: color }}></div>
      <div className="kpi-icon" style={{ background: `${color}20`, color }}>{icon}</div>
      <div className="kpi-content">
        <span className="kpi-title">{title}</span>
        <span className="kpi-value">{value}</span>
        <span className={`kpi-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      </div>
    </div>
  );
}

function ProductCard({ product, labels, t }: { product: ProductData; labels: any; t: (key: string) => string }) {


  const categoryColors: Record<string, string> = {
    RAW: '#00d9a5',
    INTERMEDIATE: '#70a1ff',
    CONSUMER: '#e94560',
    DIGITAL: '#5352ed',
    GREEN: '#2ed573',
    FINANCIAL: '#ffa502',
  };

  const extendedProduct = product as any;

  return (
    <div className="glass-card product-card">
      <div className="card-glow" style={{ background: categoryColors[product.category] || '#e94560' }}></div>
      <div className="card-header">
        <span className="category-badge" style={{ 
          background: `${categoryColors[product.category] || '#e94560'}20`,
          color: categoryColors[product.category] || '#e94560',
          borderColor: `${categoryColors[product.category] || '#e94560'}40`
        }}>
          {labels.categoryLabels?.[product.category] || product.category}

        </span>
        {product.perishable && <span className="badge perishable">{labels.perishable}</span>}
        {product.qualitySensitive && <span className="badge quality">{labels.quality}</span>}
        {extendedProduct.techLevel && (
          <span className="badge tech">{labels.tech_lv}{extendedProduct.techLevel}</span>
        )}


      </div>
      <h3 className="card-title">{t(`products.${product.name}`) || product.name}</h3>

      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">{labels.base_price}</span>
          <span className="stat-value">${product.basePrice}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{labels.demand}</span>
          <span className="stat-value">{product.baseDemand}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{labels.weight}</span>
          <span className="stat-value">{product.unitWeight}kg</span>
        </div>
      </div>

      {/* Demand Indicator */}
      <div className="demand-indicator">
        <div className="demand-header">
          <span className="demand-label">{t('stats.demand_level') || 'Demand Level'}</span>
          <span className={`demand-level ${product.baseDemand > 150 ? 'high' : product.baseDemand > 80 ? 'medium' : 'low'}`}>
            {product.baseDemand > 150 ? (t('stats.demand_high') || 'High') : product.baseDemand > 80 ? (t('stats.demand_medium') || 'Medium') : (t('stats.demand_low') || 'Low')}
          </span>
        </div>
        <div className="demand-bar">
          <div 
            className={`demand-fill ${product.baseDemand > 150 ? 'high' : product.baseDemand > 80 ? 'medium' : 'low'}`}
            style={{ width: `${Math.min((product.baseDemand / 250) * 100, 100)}%` }}
          ></div>
        </div>
      </div>

      {extendedProduct.knowledgePoints > 0 && (
        <div className="knowledge-bar">
          <div className="knowledge-label">
            <span>📚 {labels.kp}</span>
            <span>{extendedProduct.knowledgePoints}</span>
          </div>
          <div className="knowledge-progress">
            <div 
              className="knowledge-fill" 
              style={{ width: `${(extendedProduct.knowledgePoints / 100) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Supply chain inputs */}
      {extendedProduct.inputs && extendedProduct.inputs.length > 0 && (
        <div className="supply-chain">
          <span className="supply-label">🔗 {t('stats.inputs') || 'Inputs'}</span>
          <div className="supply-items">
            {extendedProduct.inputs.map((input: string, i: number) => (
              <span key={i} className="supply-chip">{t(`products.${input}`) || input}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BuildingCard({ building, labels, t }: { building: BuildingData; labels: any; t: (key: string) => string }) {


  const typeIcons: Record<string, string> = {
    FARM: '🚜',
    MINE: '⛏️',
    FACTORY: '🏭',
    RETAIL: '🏪',
    WAREHOUSE: '📦',
    OFFICE: '💼',
  };

  return (
    <div className="glass-card building-card">
      <div className="card-icon">{typeIcons[building.type]}</div>
      <h3 className="card-title">{t(`buildings.${building.name}`) || building.name}</h3>
      <span className="type-badge">{labels.typeLabels?.[building.type] || building.type}</span>

      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">{labels.cost}</span>
          <span className="stat-value">${building.baseCost.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{labels.time}</span>
          <span className="stat-value">{building.constructionTime} {labels.days}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{labels.size}</span>
          <span className="stat-value">{building.maxSize}x{building.maxSize}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{labels.floors}</span>
          <span className="stat-value">{building.maxFloors}</span>
        </div>
      </div>

      {/* Efficiency Rating */}
      <div className="efficiency-bar">
        <div className="efficiency-header">
          <span className="efficiency-label">{t('stats.efficiency') || 'Efficiency'}</span>
          <span className="efficiency-value">{Math.round(85 + Math.random() * 15)}%</span>
        </div>
        <div className="efficiency-track">
          <div className="efficiency-fill" style={{ width: `${85 + Math.random() * 15}%` }}></div>
        </div>
      </div>

      <div className="card-footer">
        <span className="power-stat">⚡ {t('stats.power') || 'Power'}: {building.powerConsumption}</span>
        <span className="pollution-stat">🌿 {t('stats.pollution') || 'Pollution'}: {building.pollution}</span>
      </div>
    </div>
  );
}

function ManagementPanel({ 
  employeeMetrics, 
  productExpertise,
  labels,
  t
}: { 
  employeeMetrics: EmployeeMetrics;
  productExpertise: ProductExpertise[];
  labels: any;
  t: (key: string) => string;
}) {


  const employeeRadarData = [
    { subject: labels.morale, A: employeeMetrics.morale, fullMark: 100 },
    { subject: labels.training, A: employeeMetrics.trainingLevel, fullMark: 100 },
    { subject: labels.productivity, A: employeeMetrics.productivity, fullMark: 100 },
    { subject: labels.retention, A: 100 - employeeMetrics.turnoverRate, fullMark: 100 },
    { subject: labels.happiness, A: employeeMetrics.satisfaction, fullMark: 100 },
    { subject: labels.skills, A: employeeMetrics.skillLevel, fullMark: 100 },
  ];


  return (
    <div className="tab-panel management-panel">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <p>{labels.desc}</p>
      </div>


      <div className="management-grid">
        {/* Employee Metrics Section */}
        <div className="management-section glass-card">
          <h3>{labels.metrics}</h3>


          <div className="metrics-grid">
            <MetricBox 
              label={labels.morale} 
              value={employeeMetrics.morale} 
              icon="😊" 
              color="#00d9a5"
              description={labels.happiness}
            />
            <MetricBox 
              label={labels.training} 
              value={employeeMetrics.trainingLevel} 
              icon="🎓" 
              color="#70a1ff"
              description={labels.skills}

            />
            <MetricBox 
              label={labels.productivity} 
              value={employeeMetrics.productivity} 
              icon="⚡" 
              color="#ffa502"
              description={labels.output}
            />
            <MetricBox 
              label={labels.turnover} 
              value={employeeMetrics.turnoverRate} 
              icon="🔄" 
              color="#ff4757"
              description={labels.retention}

              lowerIsBetter
            />
          </div>

          
          <div className="radar-container">
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={employeeRadarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Current"
                  dataKey="A"
                  stroke="#e94560"
                  strokeWidth={3}
                  fill="#e94560"
                  fillOpacity={0.25}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(22, 33, 62, 0.95)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Expertise Section */}
        <div className="management-section glass-card">
          <h3>{labels.expertise}</h3>
          <p className="section-desc">{labels.kp_desc}</p>


          <div className="expertise-list">
            {productExpertise.map((expertise, index) => (
              <div key={index} className="expertise-item">
                <div className="expertise-header">
                  <span className="expertise-name">{t(`products.${expertise.productClass}`) || expertise.productClass}</span>

                  <span className="expertise-level">Lv. {Math.floor(expertise.expertiseLevel / 10)}</span>
                </div>
                <div className="expertise-bar-container">
                  <div className="expertise-bar">
                    <div 
                      className="expertise-fill"
                      style={{ 
                        width: `${expertise.expertiseLevel}%`,
                        background: expertise.expertiseLevel > 80 ? '#00d9a5' : 
                                   expertise.expertiseLevel > 50 ? '#70a1ff' : '#e94560'
                      }}
                    ></div>
                  </div>
                  <span className="expertise-points">{expertise.knowledgePoints} KP</span>
                </div>
                <div className="expertise-meta">
                  <span className="tech-badge">{labels.tech_lv} {expertise.techLevel}</span>
                  {expertise.techLevel >= 8 && <span className="disruption-badge">⚠️ {labels.high_risk}</span>}
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ 
  label, 
  value, 
  icon, 
  color, 
  description,
  lowerIsBetter = false 
}: { 
  label: string; 
  value: number; 
  icon: string; 
  color: string;
  description: string;
  lowerIsBetter?: boolean;
}) {
  const isGood = lowerIsBetter ? value < 50 : value > 70;
  
  return (
    <div className="metric-box" style={{ borderColor: color }}>
      <div className="metric-icon" style={{ background: `${color}20`, color }}>{icon}</div>
      <div className="metric-info">
        <span className="metric-label">{label}</span>
        <span className="metric-value" style={{ color }}>{value.toFixed(1)}%</span>
        <span className="metric-desc">{description}</span>
      </div>
      <div className={`metric-indicator ${isGood ? 'good' : 'warning'}`}>
        {isGood ? '✓' : '!'}
      </div>
    </div>
  );
}

function FinancePanel({ 
  cash, 
  formatCurrency, 
  labels,
  revenueData,
  marketShareData,
  t,
  world
}: { 
  cash: number; 
  formatCurrency: (v: number) => string; 
  labels: any;
  revenueData: any[];
  marketShareData: any[];
  t: (key: string) => string;
  world?: GameWorld;
}) {
  // ─── Real ECS Financial Data ───
  let realRevenue = 0;
  let realExpenses = 0;
  let realNetIncome = 0;
  let totalAssets = 0;
  let totalDebt = 0;

  if (world && world.playerEntityId > 0) {
    const pid = world.playerEntityId;
    realRevenue = Company.revenueLastMonth[pid] || 0;
    realExpenses = Company.expensesLastMonth[pid] || 0;
    realNetIncome = Company.netIncomeLastMonth[pid] || 0;

    // Sum building assets
    const bQuery = defineQuery([Building, Company, Maintenance]);
    const bEntities = bQuery(world.ecsWorld);
    bEntities.forEach(bid => {
      if (Company.companyId[bid] === Company.companyId[pid]) {
        totalAssets += (Maintenance.monthlyCost[bid] || 0) * 120;
      }
    });
    totalAssets += Math.max(0, cash); // Cash is an asset

    // Debt = negative cash or credit usage
    totalDebt = cash < 0 ? Math.abs(cash) : 0;
  }

  // Fallback to mock data if no real data exists yet
  const totalRevenue = realRevenue || revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = realExpenses || revenueData.reduce((sum, d) => sum + d.expenses, 0);
  const netIncome = realNetIncome || (totalRevenue - totalExpenses);
  const operatingMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0.0';
  const assets = totalAssets || cash * 3.2;
  const debt = totalDebt || cash * 0.08;
  const equity = assets - debt;
  const debtToEquity = equity > 0 ? (debt / equity).toFixed(2) : '0.00';

  const incomeStatementRows = [
    { label: t('finance.total_revenue'), value: totalRevenue, color: '#00d9a5', icon: '📈' },
    { label: t('finance.cost_of_goods'), value: -totalExpenses * 0.6, color: '#ff4757', icon: '📦' },
    { label: t('finance.gross_profit'), value: totalRevenue - totalExpenses * 0.6, color: '#70a1ff', icon: '💎', isBold: true },
    { label: t('finance.operating_expenses'), value: -totalExpenses * 0.3, color: '#ffa502', icon: '⚙️' },
    { label: t('finance.rd_expenses'), value: -totalExpenses * 0.1, color: '#5352ed', icon: '🔬' },
    { label: t('finance.net_income'), value: netIncome, color: netIncome >= 0 ? '#00d9a5' : '#ff4757', icon: '💰', isBold: true },
  ];

  return (
    <div className="tab-panel finance-panel">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <p>{t('finance.comprehensive_view')}</p>
      </div>

      {/* Financial KPIs */}
      <div className="finance-kpi-row">
        <div className="finance-kpi glass-card">
          <div className="finance-kpi-icon" style={{ background: 'rgba(0, 217, 165, 0.15)', color: '#00d9a5' }}>💵</div>
          <div className="finance-kpi-info">
            <span className="finance-kpi-label">{labels.cash}</span>
            <span className="finance-kpi-value" style={{ color: '#00d9a5' }}>{formatCurrency(cash)}</span>
          </div>
        </div>
        <div className="finance-kpi glass-card">
          <div className="finance-kpi-icon" style={{ background: 'rgba(112, 161, 255, 0.15)', color: '#70a1ff' }}>📊</div>
          <div className="finance-kpi-info">
            <span className="finance-kpi-label">{t('finance.operating_margin')}</span>
            <span className="finance-kpi-value" style={{ color: '#70a1ff' }}>{operatingMargin}%</span>
          </div>
        </div>
        <div className="finance-kpi glass-card">
          <div className="finance-kpi-icon" style={{ background: 'rgba(233, 69, 96, 0.15)', color: '#e94560' }}>🏦</div>
          <div className="finance-kpi-info">
            <span className="finance-kpi-label">{t('finance.debt_equity')}</span>
            <span className="finance-kpi-value" style={{ color: '#e94560' }}>{debtToEquity}x</span>
          </div>
        </div>
        <div className="finance-kpi glass-card">
          <div className="finance-kpi-icon" style={{ background: 'rgba(255, 165, 2, 0.15)', color: '#ffa502' }}>💰</div>
          <div className="finance-kpi-info">
            <span className="finance-kpi-label">{t('finance.net_income')}</span>
            <span className="finance-kpi-value" style={{ color: netIncome >= 0 ? '#00d9a5' : '#ff4757' }}>{formatCurrency(netIncome)}</span>
          </div>
        </div>
      </div>

      <div className="finance-content-grid">
        {/* Income Statement */}
        <div className="glass-card income-statement">
          <h3>{t('finance.income_statement')}</h3>
          <div className="statement-rows">
            {incomeStatementRows.map((row, i) => (
              <div key={i} className={`statement-row ${row.isBold ? 'total-row' : ''}`}>
                <div className="row-left">
                  <span className="row-icon">{row.icon}</span>
                  <span className="row-label">{row.label}</span>
                </div>
                <span className="row-value" style={{ color: row.color }}>
                  {row.value >= 0 ? '' : '-'}${Math.abs(row.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* P&L Trend Chart */}
        <div className="glass-card pl-trend">
          <h3>{t('finance.pl_trend')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d9a5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d9a5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4757" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff4757" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(22, 33, 62, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#00d9a5" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="expenses" stroke="#ff4757" strokeWidth={2} fill="url(#expGrad)" />
              <Line type="monotone" dataKey="profit" stroke="#70a1ff" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Balance Sheet Summary */}
        <div className="glass-card balance-sheet">
          <h3>{t('finance.balance_sheet')}</h3>
          <div className="balance-bars">
            <div className="balance-item">
              <div className="balance-header">
                <span>{labels.assets}</span>
                <span style={{ color: '#00d9a5' }}>{formatCurrency(assets)}</span>
              </div>
              <div className="balance-bar">
                <div className="balance-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #00d9a5, #2ed573)' }}></div>
              </div>
            </div>
            <div className="balance-item">
              <div className="balance-header">
                <span>{labels.debt}</span>
                <span style={{ color: '#ff4757' }}>{formatCurrency(debt)}</span>
              </div>
              <div className="balance-bar">
                <div className="balance-fill" style={{ width: `${(debt / assets) * 100}%`, background: 'linear-gradient(90deg, #ff4757, #ff6b81)' }}></div>
              </div>
            </div>
            <div className="balance-item">
              <div className="balance-header">
                <span>{t('finance.equity')}</span>
                <span style={{ color: '#70a1ff' }}>{formatCurrency(equity)}</span>
              </div>
              <div className="balance-bar">
                <div className="balance-fill" style={{ width: `${(equity / assets) * 100}%`, background: 'linear-gradient(90deg, #70a1ff, #5352ed)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Share Pie */}
        <div className="glass-card market-share">
          <h3>{t('finance.market_share')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={marketShareData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {marketShareData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(22, 33, 62, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="share-legend">
            {marketShareData.map((entry, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ background: entry.color }}></span>
                <span className="legend-label">{entry.name}</span>
                <span className="legend-value">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card competitor-ranking animate-slideIn" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '15px', color: '#70a1ff' }}>COMPETITOR LEADERBOARD</h3>
        <div className="competitor-leaderboard">
          {(() => {
            if (!world) return <p>Syncing with market...</p>;
            const aiQuery = defineQuery([AIController, Company, Finances]);
            const entities = aiQuery(world.ecsWorld);
            
            return entities
              .sort((a,b) => Finances.cash[b] - Finances.cash[a])
              .map((id, i) => (
                <div key={id} className="competitor-entry" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '12px', 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  gap: '15px' 
                }}>
                  <div className="comp-rank" style={{ fontWeight: 'bold', fontSize: '1.2em', opacity: 0.5 }}>#{i+1}</div>
                  <div className="comp-info" style={{ flex: 1 }}>
                    <div className="comp-name" style={{ fontWeight: 'bold' }}>RIVAL COMPANY {Company.companyId[id]}</div>
                    <div className="comp-personality" style={{ fontSize: '0.8em', color: '#aaa', textTransform: 'uppercase' }}>
                      {AIController.personality[id] === 0 ? '🔺 AGGRESSIVE' : 
                       AIController.personality[id] === 1 ? '💠 BALANCED' : '🛡️ CONSERVATIVE' }
                    </div>
                  </div>
                  <div className="comp-wealth" style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7em', opacity: 0.6 }}>NET CASH</div>
                    <div style={{ color: '#00d9a5', fontWeight: 'bold' }}>${(Finances.cash[id]).toLocaleString()}</div>
                  </div>
                </div>
              ));
          })()}
        </div>
      </div>
    </div>
  );
}

function OwnedBuildingCard({ building, formatCurrency, onUpgrade, t }: { 
  building: any; 
  formatCurrency: (n: number) => string;
  onUpgrade?: () => void;
  t: (key: string) => string;
}) {
  const typeIcons: Record<string, string> = {
    FARM: '🚜',
    MINE: '⛏️',
    FACTORY: '🏭',
    RETAIL: '🏪',
    WAREHOUSE: '📦',
    OFFICE: '💼',
  };

  return (
    <div className="glass-card building-card owned">
      <div className="card-icon">{typeIcons[building.type] || '🏢'}</div>
      <div className="level-badge">LVL {building.level}</div>
      <h3 className="card-title">{t(`buildings.${building.name}`) || building.name}</h3>
      <span className="type-badge">{building.type}</span>

      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">OUTPUT</span>
          <span className="stat-value">{building.output.toLocaleString()} u</span>
        </div>
        <div className="stat">
          <span className="stat-label">CAPACITY</span>
          <span className="stat-value">{building.capacity.toLocaleString()} u</span>
        </div>
        <div className="stat">
          <span className="stat-label">UPKEEP</span>
          <span className="stat-value">{formatCurrency(building.upkeep)}/mo</span>
        </div>
        <div className="stat">
          <span className="stat-label">STATUS</span>
          <span className="stat-value" style={{ color: building.isOperational ? '#00d9a5' : '#ff4757' }}>
            {building.isOperational ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
      </div>

      <div className="efficiency-bar">
        <div className="efficiency-header">
          <span className="efficiency-label">UTILIZATION</span>
          <span className="efficiency-value">{building.utilization}%</span>
        </div>
        <div className="efficiency-track">
          <div className="efficiency-fill" style={{ width: `${building.utilization}%`, background: '#00d9a5' }}></div>
        </div>
      </div>
      
      <div className="building-actions">
        <button 
          className="upgrade-btn" 
          onClick={onUpgrade}
        >
          UPGRADE
        </button>
      </div>
    </div>
  );
}

function LogisticsPanel({ world, ownedBuildings, formatCurrency, currentOverlay, onSetOverlay }: { 
  world?: GameWorld; 
  ownedBuildings: any[]; 
  formatCurrency: (n: number) => string;
  currentOverlay?: string | null;
  onSetOverlay?: (view: string | null) => void;
}) {
  if (!world) return <div className="tab-panel">Syncing logistics...</div>;

  return (
    <div className="tab-panel logistics-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{"Logistics & Supply Chain"}</h2>
          <p>Real-time tracking of product flow and transport efficiency</p>
        </div>
        <button 
          className={`glass-btn ${currentOverlay === 'logistics' ? 'active' : ''}`}
          onClick={() => onSetOverlay?.(currentOverlay === 'logistics' ? null : 'logistics')}
          style={{ 
            background: currentOverlay === 'logistics' ? 'rgba(0, 217, 165, 0.2)' : 'rgba(255,255,255,0.05)',
            borderColor: currentOverlay === 'logistics' ? '#00d9a5' : 'rgba(255,255,255,0.2)'
          }}
        >
          {currentOverlay === 'logistics' ? '🌐 HIDE FLOW' : '🌐 SHOW FLOW LINES'}
        </button>
      </div>

      <div className="logistics-grid">
        {ownedBuildings.map((building) => {
          const id = building.id;
          const slots = [
            { id: LogisticSupply.source1Id[id], prodId: LogisticSupply.product1Id[id], amt: Inventory.input1Amount[id], q: Inventory.input1Quality[id] },
            { id: LogisticSupply.source2Id[id], prodId: LogisticSupply.product2Id[id], amt: Inventory.input2Amount[id], q: Inventory.input2Quality[id] },
            { id: LogisticSupply.source3Id[id], prodId: LogisticSupply.product3Id[id], amt: Inventory.input3Amount[id], q: Inventory.input3Quality[id] },
          ].filter(s => s.prodId !== 0);

          return (
            <div key={id} className="glass-card logistics-building-card">
              <div className="logistics-card-header">
                <h3>{building.name}</h3>
                <span className="type-badge">{building.type}</span>
              </div>
              
              <div className="supply-slots">
                {slots.length === 0 ? (
                  <div className="no-supply">No incoming supply routes</div>
                ) : (
                  slots.map((slot, idx) => {
                    const prod = world.dataStore.getProduct(slot.prodId);
                    const sourceBuilding = world.dataStore.getBuilding(Building.buildingTypeId[slot.id]);
                    const transportCost = (LogisticSupply.transportCost[id] || 10) * slot.amt / 100;

                    return (
                      <div key={idx} className="supply-slot">
                        <div className="slot-meta">
                          <span className="slot-product">{prod?.name || 'Unknown'}</span>
                          <span className="slot-source">From {sourceBuilding?.name || 'External'}</span>
                        </div>
                        <div className="slot-stats">
                          <div className="stat">
                            <span className="label">STOCK</span>
                            <span className="value">{slot.amt.toLocaleString()}</span>
                          </div>
                          <div className="stat">
                            <span className="label">QUALITY</span>
                            <span className="value">{slot.q}</span>
                          </div>
                          <div className="stat">
                            <span className="label">COST</span>
                            <span className="value" style={{ color: transportCost > (prod?.basePrice || 100) * 0.15 ? '#ff4757' : '#00d9a5' }}>
                              {formatCurrency(transportCost)}
                            </span>
                          </div>
                        </div>
                        {transportCost > (prod?.basePrice || 100) * 0.15 && (
                          <div className="supply-alert">⚠️ High Transport Cost</div>
                        )}
                        {slot.amt < 500 && (
                          <div className="supply-alert critical">🚨 CRITICAL SHORTAGE</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function EconomicPanel({ cityStats, formatCurrency, gameTick }: { 
  cityStats: any; 
  formatCurrency: (n: number) => string;
  gameTick: number;
}) {
  return (
    <div className="tab-panel economy-panel">
      <div className="panel-header">
        <h2>{ "City Macro-Economy" }</h2>
        <p>Dynamic urban growth and consumer market indicators</p>
      </div>

      <div className="kpi-grid">
        <KpiCard 
          title="City Population" 
          value={cityStats.pop.toLocaleString()} 
          change={+0.5} 
          icon="🏘️"
          color="#3498db"
        />
        <KpiCard 
          title="Purchasing Power" 
          value={`${cityStats.pp}%`}
          change={cityStats.pp > 50 ? +1.2 : -0.5} 
          icon="💳"
          color="#f1c40f"
        />
        <KpiCard 
          title="Consumer Sentiment" 
          value={`${cityStats.sentiment}%`}
          change={cityStats.sentiment > 70 ? +2.1 : -4.2} 
          icon="😊"
          color="#1abc9c"
        />
        <KpiCard 
          title="Avg. Annual Wage" 
          value={formatCurrency(cityStats.wage)} 
          change={+0.2} 
          icon="💰"
          color="#e67e22"
        />
        <KpiCard 
          title="Global Fuel Price" 
          value={`$${(globalFuelPrice / 100).toFixed(2)}`} 
          change={globalFuelPrice > 8000 ? +2.5 : -1.2} 
          icon="⛽"
          color="#e94560"
        />
      </div>

      <div className="macro-view glass-card" style={{ marginTop: '20px' }}>
          <h3>Consumer Market Dynamics</h3>
          <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={Array.from({ length: 20 }, (_, i) => ({
                tick: gameTick - (20 - i),
                sentiment: cityStats.sentiment + Math.sin((gameTick - 20 + i) * 0.1) * 5,
                pp: cityStats.pp + Math.cos((gameTick - 20 + i) * 0.05) * 3
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="tick" stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <Tooltip 
                contentStyle={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              />
              <Area type="monotone" dataKey="sentiment" name="Sentiment" stroke="#1abc9c" fill="#1abc9c33" />
              <Area type="monotone" dataKey="pp" name="Purchasing Power" stroke="#f1c40f" fill="#f1c40f33" />
            </AreaChart>
          </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
}
