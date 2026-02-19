import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import {
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart,
  XAxis,
  YAxis
} from 'recharts';
import { GameWorld } from '../../core/ecs/world';
import {
  Building,
  Inventory,
  Company,
  ProductBrand,
  HumanResources,
  RetailPlot
} from '../../core/ecs/components';
import { BuildingType } from '../../core/data/types';
import './MarketDashboard.css';

interface MarketDashboardProps {
  world: GameWorld;
  onClose: () => void;
}

// Sparkline component for awareness trends
function Sparkline({ value, color = '#00d9a5' }: { value: number; color?: string }) {
  // Generate a simple sparkline path based on value
  const points = [];
  const segments = 10;
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * 60;
    const trend = Math.sin(i * 0.8) * 10 + (value / 100) * 20;
    const y = 25 - trend;
    points.push(`${x},${y}`);
  }
  
  return (
    <svg width="60" height="30" className="sparkline">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points.join(' ')}
      />
      <circle cx="60" cy={points[points.length - 1].split(',')[1]} r="3" fill={color} />
    </svg>
  );
}

// Horizontal bar chart for market share
function MarketShareBar({ 
  playerShare, 
  competitorShare, 
  total 
}: { 
  playerShare: number; 
  competitorShare: number;
  total: number;
}) {
  const playerPercent = total > 0 ? (playerShare / total) * 100 : 0;
  const competitorPercent = total > 0 ? (competitorShare / total) * 100 : 0;
  
  return (
    <div className="market-share-bar">
      <div className="share-track">
        <div 
          className="share-fill player"
          style={{ width: `${playerPercent}%` }}
          title={`Your Share: ${playerPercent.toFixed(1)}%`}
        />
        <div 
          className="share-fill competitor"
          style={{ width: `${competitorPercent}%`, left: `${playerPercent}%` }}
          title={`Competitors: ${competitorPercent.toFixed(1)}%`}
        />
      </div>
      <div className="share-labels">
        <span className="player-label">{playerPercent.toFixed(1)}%</span>
        <span className="competitor-label">{competitorPercent.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Mini chart for market share history
function MarketShareMiniChart({ 
  currentShare,
  competitorShare 
}: { 
  currentShare: number;
  competitorShare: number;
}) {
  // Generate mock historical data based on current values
  const data = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 6; i++) {
      // Simulate some fluctuation
      const fluctuation = Math.sin(i * 0.8) * 5;
      points.push({
        tick: i,
        you: Math.max(0, currentShare + fluctuation - (6 - i) * 2),
        competitors: Math.max(0, competitorShare - fluctuation + (6 - i) * 2)
      });
    }
    return points;
  }, [currentShare, competitorShare]);
  
  return (
    <div className="mini-chart-container">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="colorYou" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d9a5" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00d9a5" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorCompetitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="tick" hide />
          <YAxis hide domain={[0, 'dataMax + 10']} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a2e', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value: any) => `${Number(value).toFixed(1)}%`}
          />
          <Area 
            type="monotone" 
            dataKey="you" 
            stroke="#00d9a5" 
            fillOpacity={1} 
            fill="url(#colorYou)" 
            strokeWidth={2}
          />
          <Area 
            type="monotone" 
            dataKey="competitors" 
            stroke="#ef4444" 
            fillOpacity={1} 
            fill="url(#colorCompetitors)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Brand Power Card Component
function BrandPowerCard({ 
  companyId,
  brandPower,
  rank 
}: { 
  companyId: number;
  brandPower: number;
  rank: number;
}) {
  const getPowerLevel = (power: number) => {
    if (power >= 80) return { label: 'Legendary', color: '#fbbf24', icon: '👑' };
    if (power >= 60) return { label: 'Strong', color: '#00d9a5', icon: '💪' };
    if (power >= 40) return { label: 'Moderate', color: '#3b82f6', icon: '📈' };
    return { label: 'Weak', color: '#ef4444', icon: '📉' };
  };
  
  const powerInfo = getPowerLevel(brandPower);
  
  return (
    <div className="brand-power-card">
      <div className="brand-rank">#{rank}</div>
      <div className="brand-info">
        <span className="brand-icon">{powerInfo.icon}</span>
        <span className="brand-name">{companyId === 1 ? 'Your Company' : `Competitor ${companyId}`}</span>
      </div>
      <div className="brand-metrics">
        <div className="brand-power-bar">
          <div 
            className="brand-power-fill" 
            style={{ width: `${brandPower}%`, background: powerInfo.color }}
          />
        </div>
        <span className="brand-power-value" style={{ color: powerInfo.color }}>
          {Math.round(brandPower)}% {powerInfo.label}
        </span>
      </div>
    </div>
  );
}

export function MarketDashboard({ world, onClose }: MarketDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'competitors' | 'products'>('overview');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);

  const marketData = useMemo(() => {
    // Get all buildings
    const buildingQuery = defineQuery([Building, Inventory, Company]);
    const buildings = buildingQuery(world.ecsWorld);

    // Get all brands
    const brandQuery = defineQuery([ProductBrand]);
    const brands = brandQuery(world.ecsWorld);

    // Calculate market stats
    const companyStats = new Map<number, {
      id: number;
      buildingCount: number;
      totalInventory: number;
      avgAwareness: number;
      avgLoyalty: number;
      avgMorale: number;
      retailCount: number;
      factoryCount: number;
      brands: { productId: number; awareness: number; loyalty: number; marketShare: number }[];
    }>();

    // Initialize with AI companies
    const aiQuery = defineQuery([Company]);
    const aiEntities = aiQuery(world.ecsWorld);
    aiEntities.forEach(id => {
      const cid = Company.companyId[id];
      if (!companyStats.has(cid)) {
        companyStats.set(cid, {
          id: cid,
          buildingCount: 0,
          totalInventory: 0,
          avgAwareness: 0,
          avgLoyalty: 0,
          avgMorale: 0,
          retailCount: 0,
          factoryCount: 0,
          brands: []
        });
      }
    });

    // Count buildings per company
    buildings.forEach(id => {
      const cid = Company.companyId[id];
      const stats = companyStats.get(cid);
      if (stats) {
        stats.buildingCount++;
        stats.totalInventory += Inventory.currentAmount[id] || 0;

        const buildingTypeId = Building.buildingTypeId[id];
        const buildingData = world.dataStore.getBuilding(buildingTypeId);
        if (buildingData) {
          if (buildingData.type === BuildingType.RETAIL || buildingData.type === BuildingType.SUPERMARKET) {
            stats.retailCount++;
          } else if (buildingData.type === BuildingType.FACTORY) {
            stats.factoryCount++;
          }
        }
      }
    });

    // Calculate brand metrics per company
    const brandMetrics = new Map<number, { awareness: number[]; loyalty: number[]; marketShares: number[] }>();
    brands.forEach(id => {
      const cid = ProductBrand.companyId[id];
      if (!brandMetrics.has(cid)) {
        brandMetrics.set(cid, { awareness: [], loyalty: [], marketShares: [] });
      }
      const metrics = brandMetrics.get(cid)!;
      metrics.awareness.push(ProductBrand.awareness[id]);
      metrics.loyalty.push(ProductBrand.loyalty[id]);
      metrics.marketShares.push(ProductBrand.marketShare[id]);
      
      // Add to company stats
      const stats = companyStats.get(cid);
      if (stats) {
        stats.brands.push({
          productId: ProductBrand.productId[id],
          awareness: ProductBrand.awareness[id],
          loyalty: ProductBrand.loyalty[id],
          marketShare: ProductBrand.marketShare[id]
        });
      }
    });

    brandMetrics.forEach((metrics, cid) => {
      const stats = companyStats.get(cid);
      if (stats) {
        stats.avgAwareness = metrics.awareness.reduce((a, b) => a + b, 0) / metrics.awareness.length;
        stats.avgLoyalty = metrics.loyalty.reduce((a, b) => a + b, 0) / metrics.loyalty.length;
      }
    });

    // Calculate average morale per company
    const hrQuery = defineQuery([Building, HumanResources, Company]);
    const hrEntities = hrQuery(world.ecsWorld);
    const moraleMap = new Map<number, number[]>();

    hrEntities.forEach(id => {
      const cid = Company.companyId[id];
      if (!moraleMap.has(cid)) {
        moraleMap.set(cid, []);
      }
      moraleMap.get(cid)?.push(HumanResources.morale[id]);
    });

    moraleMap.forEach((moraleList, cid) => {
      const stats = companyStats.get(cid);
      if (stats) {
        stats.avgMorale = moraleList.reduce((a, b) => a + b, 0) / moraleList.length;
      }
    });

    // Product market analysis with brand data
    const productStats = new Map<number, {
      id: number;
      name: string;
      category: string;
      totalSupply: number;
      avgPrice: number;
      avgQuality: number;
      competitorCount: number;
      playerBrand: { awareness: number; loyalty: number; marketShare: number } | null;
      totalMarketShare: number;
    }>();

    // Initialize products
    world.dataStore.products.forEach((product, id) => {
      productStats.set(id, {
        id,
        name: product.name,
        category: product.category,
        totalSupply: 0,
        avgPrice: 0,
        avgQuality: 0,
        competitorCount: 0,
        playerBrand: null,
        totalMarketShare: 0
      });
    });

    // Calculate supply per product
    buildings.forEach(id => {
      const productId = Inventory.productId[id];
      const stats = productStats.get(productId);
      if (stats) {
        stats.totalSupply += Inventory.currentAmount[id] || 0;
        if (Inventory.quality[id] > 0) {
          stats.avgQuality = (stats.avgQuality * stats.competitorCount + Inventory.quality[id]) / (stats.competitorCount + 1);
        }
        stats.competitorCount++;
      }
    });

    // Get retail prices and player brand data
    const retailQuery = defineQuery([Building, RetailPlot, Inventory, Company]);
    const retailEntities = retailQuery(world.ecsWorld);
    const priceMap = new Map<number, number[]>();

    retailEntities.forEach(id => {
      const slots = [
        { prod: Inventory.input1ProductId[id], price: RetailPlot.price1[id] },
        { prod: Inventory.input2ProductId[id], price: RetailPlot.price2[id] },
        { prod: Inventory.input3ProductId[id], price: RetailPlot.price3[id] },
      ];

      slots.forEach(slot => {
        if (slot.prod !== 0 && slot.price > 0) {
          if (!priceMap.has(slot.prod)) {
            priceMap.set(slot.prod, []);
          }
          priceMap.get(slot.prod)?.push(slot.price);
        }
      });
    });

    priceMap.forEach((prices, productId) => {
      const stats = productStats.get(productId);
      if (stats) {
        stats.avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      }
    });

    // Get player brand data for each product
    brands.forEach(id => {
      const cid = ProductBrand.companyId[id];
      const productId = ProductBrand.productId[id];
      const stats = productStats.get(productId);
      if (stats && cid === 1) { // Player company
        stats.playerBrand = {
          awareness: ProductBrand.awareness[id],
          loyalty: ProductBrand.loyalty[id],
          marketShare: ProductBrand.marketShare[id]
        };
      }
      if (stats) {
        stats.totalMarketShare += ProductBrand.marketShare[id];
      }
    });

    return {
      companies: Array.from(companyStats.values()).sort((a, b) => b.buildingCount - a.buildingCount),
      products: Array.from(productStats.values())
        .filter(p => p.competitorCount > 0)
        .sort((a, b) => b.totalSupply - a.totalSupply)
    };
  }, [world]);

  const playerCompany = marketData.companies.find(c => c.id === 1);
  const competitors = marketData.companies.filter(c => c.id !== 1);

  // Calculate competitive position
  const getCompetitivePosition = (product: typeof marketData.products[0]) => {
    if (!product.playerBrand) return 'none';
    const share = product.playerBrand.marketShare;
    if (share > 40) return 'leading';
    if (share > 15) return 'competitive';
    return 'trailing';
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'leading': return '#00d9a5';
      case 'competitive': return '#ffa502';
      case 'trailing': return '#ef4444';
      default: return '#6c6c6c';
    }
  };

  const getPositionLabel = (position: string) => {
    switch (position) {
      case 'leading': return t('market.position_leading');
      case 'competitive': return t('market.position_competitive');
      case 'trailing': return t('market.position_trailing');
      default: return t('market.position_none');
    }
  };

  return (
    <div className="market-dashboard-overlay">
      <div className="market-dashboard">
        <div className="dashboard-header">
          <h2>📊 {t('market.title')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dashboard-tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            {t('market.overview')}
          </button>
          <button
            className={activeTab === 'competitors' ? 'active' : ''}
            onClick={() => setActiveTab('competitors')}
          >
            {t('market.competitors')} ({competitors.length})
          </button>
          <button
            className={activeTab === 'products' ? 'active' : ''}
            onClick={() => setActiveTab('products')}
          >
            {t('market.products')}
          </button>
        </div>

        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">{t('market.total_competitors')}</span>
                  <span className="stat-value">{competitors.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{t('market.your_buildings')}</span>
                  <span className="stat-value">{playerCompany?.buildingCount || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{t('market.market_products')}</span>
                  <span className="stat-value">{marketData.products.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{t('market.avg_awareness')}</span>
                  <span className="stat-value">{Math.round(playerCompany?.avgAwareness || 0)}%</span>
                </div>
              </div>

              <div className="section">
                <h3>🏆 {t('market.leaders')}</h3>
                <div className="leader-list">
                  {marketData.companies.slice(0, 5).map((company, idx) => (
                    <div key={company.id} className={`leader-item ${company.id === 1 ? 'player' : ''}`}>
                      <span className="rank">#{idx + 1}</span>
                      <span className="name">
                        {company.id === 1 ? t('market.your_company') : `${t('market.competitor')} ${company.id}`}
                      </span>
                      <div className="leader-stats">
                        <span>{company.buildingCount} {t('market.buildings')}</span>
                        <span>{company.retailCount} {t('market.retail')}</span>
                        <span>{company.factoryCount} {t('market.factories')}</span>
                      </div>
                      {company.avgAwareness > 0 && (
                        <div className="awareness-bar">
                          <div className="fill" style={{ width: `${company.avgAwareness}%` }}></div>
                          <span>{Math.round(company.avgAwareness)}% {t('market.awareness')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Share Comparison */}
              <div className="section">
                <h3>📊 {t('market.share_comparison')}</h3>
                <div className="market-comparison">
                  {marketData.products
                    .filter(p => p.playerBrand)
                    .slice(0, 5)
                    .map(product => (
                      <div key={product.id} className="comparison-row">
                        <span className="product-name">{product.name}</span>
                        <MarketShareBar
                          playerShare={product.playerBrand?.marketShare || 0}
                          competitorShare={product.totalMarketShare - (product.playerBrand?.marketShare || 0)}
                          total={product.totalMarketShare}
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'competitors' && (
            <div className="competitors-tab">
              {/* Brand Power Rankings */}
              <div className="section">
                <h3>⚡ {t('market.brand_power_rankings') || 'Brand Power Rankings'}</h3>
                <div className="brand-power-list">
                  {marketData.companies
                    .sort((a, b) => (b.avgAwareness + b.avgLoyalty) - (a.avgAwareness + a.avgLoyalty))
                    .map((company, index) => (
                      <BrandPowerCard
                        key={company.id}
                        companyId={company.id}
                        brandPower={(company.avgAwareness + company.avgLoyalty) / 2}
                        rank={index + 1}
                      />
                    ))}
                </div>
              </div>

              {/* Competitor Details */}
              <div className="section">
                <h3>🏢 {t('market.competitor_details') || 'Competitor Details'}</h3>
                <div className="competitor-list">
                  {competitors.map(company => (
                    <div key={company.id} className="competitor-card">
                      <div className="competitor-header">
                        <h4>{t('market.competitor')} {company.id}</h4>
                        <span className={`threat-level ${
                          company.buildingCount > (playerCompany?.buildingCount || 0) * 1.5 ? 'high' :
                          company.buildingCount > (playerCompany?.buildingCount || 0) ? 'medium' : 'low'
                        }`}>
                          {company.buildingCount > (playerCompany?.buildingCount || 0) * 1.5 ? '🔴' :
                           company.buildingCount > (playerCompany?.buildingCount || 0) ? '🟡' : '🟢'} {' '}
                          {company.buildingCount > (playerCompany?.buildingCount || 0) * 1.5 ? t('market.threat_high') :
                           company.buildingCount > (playerCompany?.buildingCount || 0) ? t('market.threat_medium') : t('market.threat_low')}
                        </span>
                      </div>
                      <div className="competitor-stats">
                        <div className="stat">
                          <span className="label">{t('market.buildings')}</span>
                          <span className="value">{company.buildingCount}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.retail')}</span>
                          <span className="value">{company.retailCount}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.factories')}</span>
                          <span className="value">{company.factoryCount}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.inventory')}</span>
                          <span className="value">{company.totalInventory.toLocaleString()}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.awareness')}</span>
                          <span className="value">{Math.round(company.avgAwareness)}%</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.loyalty')}</span>
                          <span className="value">{Math.round(company.avgLoyalty)}%</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.avg_morale')}</span>
                          <span className={`value ${company.avgMorale < 30 ? 'warning' : ''}`}>
                            {Math.round(company.avgMorale)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="products-tab">
              <div className="product-filters">
                <span className="filter-label">{t('market.sort_by')}:</span>
                <button className="filter-btn active">{t('market.sort_supply')}</button>
                <button className="filter-btn">{t('market.sort_competitors')}</button>
                <button className="filter-btn">{t('market.sort_quality')}</button>
              </div>
              <div className="product-list">
                {marketData.products.slice(0, 20).map(product => {
                  const position = getCompetitivePosition(product);
                  const positionColor = getPositionColor(position);
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`product-card position-${position}`}
                      style={{ borderLeftColor: positionColor }}
                    >
                      <div className="product-header">
                        <div className="product-title-row">
                          <h4>{product.name}</h4>
                          {product.playerBrand && (
                            <span 
                              className="market-share-badge"
                              style={{ background: positionColor }}
                            >
                              {product.playerBrand.marketShare.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <span className="category">{product.category}</span>
                        {product.playerBrand && (
                          <span className="position-label" style={{ color: positionColor }}>
                            {getPositionLabel(position)}
                          </span>
                        )}
                      </div>
                      
                      {product.playerBrand && (
                        <>
                          <div className="brand-metrics">
                            <div className="brand-metric">
                              <span className="metric-label">{t('market.awareness')}</span>
                              <div className="metric-bar">
                                <div 
                                  className="metric-fill"
                                  style={{ width: `${product.playerBrand.awareness}%` }}
                                />
                              </div>
                              <Sparkline value={product.playerBrand.awareness} color={positionColor} />
                              <span className="metric-value">{Math.round(product.playerBrand.awareness)}%</span>
                            </div>
                            <div className="brand-metric">
                              <span className="metric-label">{t('market.loyalty')}</span>
                              <div className="metric-bar">
                                <div 
                                  className="metric-fill loyalty"
                                  style={{ width: `${product.playerBrand.loyalty}%` }}
                                />
                              </div>
                              <span className="metric-value">{Math.round(product.playerBrand.loyalty)}%</span>
                            </div>
                          </div>
                          <div className="market-share-chart-section">
                            <span className="chart-label">{t('market.share_trend') || 'Market Share Trend'}</span>
                            <MarketShareMiniChart 
                              currentShare={product.playerBrand.marketShare}
                              competitorShare={product.totalMarketShare - product.playerBrand.marketShare}
                            />
                          </div>
                        </>
                      )}
                      
                      <div className="product-stats">
                        <div className="stat">
                          <span className="label">{t('market.market_supply')}</span>
                          <span className="value">{product.totalSupply.toLocaleString()}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.competitors')}</span>
                          <span className="value">{product.competitorCount}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.avg_price')}</span>
                          <span className="value">${product.avgPrice > 0 ? (product.avgPrice / 100).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="stat">
                          <span className="label">{t('market.avg_quality')}</span>
                          <span className="value">
                            {product.avgQuality > 0 ? (
                              <>
                                {Math.round(product.avgQuality)}/100
                                <div className="quality-bar">
                                  <div className="fill" style={{ width: `${product.avgQuality}%` }}></div>
                                </div>
                              </>
                            ) : 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="market-intel">
                        {product.competitorCount === 1 && (
                          <span className="opportunity">💎 {t('market.opportunity')}</span>
                        )}
                        {product.avgQuality < 50 && product.competitorCount > 0 && (
                          <span className="strategy">📈 {t('market.strategy_quality')}</span>
                        )}
                        {product.avgPrice > 0 && product.avgPrice < (world.dataStore.getProduct(product.id)?.basePrice || 0) * 1.3 && (
                          <span className="pricing">💰 {t('market.pricing_opportunity')}</span>
                        )}
                      </div>
                      
                      {product.playerBrand && (
                        <button 
                          className="campaign-btn"
                          onClick={() => {
                            setSelectedProduct(product.id);
                            setShowCampaignModal(true);
                          }}
                        >
                          📢 {t('market.marketing_campaign')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Marketing Campaign Modal (Placeholder) */}
      {showCampaignModal && (
        <div className="campaign-modal-overlay" onClick={() => setShowCampaignModal(false)}>
          <div className="campaign-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('market.campaign_title')}</h3>
              <button className="close-btn" onClick={() => setShowCampaignModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="campaign-icon">📢</div>
              <p>{t('market.campaign_coming_soon')}</p>
              <p className="campaign-subtitle">
                {selectedProduct && world.dataStore.getProduct(selectedProduct)?.name}
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowCampaignModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketDashboard;
