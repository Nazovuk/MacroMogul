import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import './TopBar.css';
import { getEconomicCycle } from '../../core/ecs/systems/MacroUtils';
import { 
  Building, Company, Finances, Stock, CityEconomicData, 
  HumanResources, AIController 
} from '../../core/ecs/components';
import { GameWorld } from '../../core/ecs/world';

interface TopBarProps {
  gameDate: { day: number; month: number; year: number };
  tick: number;
  cash: number;
  companyName?: string;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  currentSpeed: number;
  isPaused: boolean;
  currentCity?: string;
  onOpenMarket?: () => void;
  onOpenFinance?: () => void;
  onOpenStocks?: () => void;
  onOpenIntelligence?: () => void;
  onOpenLogistics?: () => void;
  onOpenHQ?: () => void;
  world?: GameWorld;
}

export function TopBar({
  gameDate,
  tick,
  cash,
  companyName = "MacroMogul Corp",
  onPause,
  onSpeedChange,
  currentSpeed,
  isPaused,
  currentCity = "New York",
  onOpenFinance,
  onOpenStocks,
  onOpenIntelligence,
  onOpenLogistics,
  onOpenHQ,
  world
}: TopBarProps) {
  const { t } = useTranslation();
  const [displayCash, setDisplayCash] = useState(cash);
  const [cashFlash, setCashFlash] = useState<'none' | 'green' | 'red'>('none');
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  // Economic Cycle Status
  const { isRecession, isBoom } = getEconomicCycle(tick);
  
  // Real-time Data from ECS
  const companyStats = useMemo(() => {
    if (!world) return null;
    
    const stats = {
      buildings: 0,
      employees: 0,
      morale: 0,
      productivity: 0,
      stockPrice: 0,
      stockChange: 0,
      marketCap: 0,
      creditRating: 0,
      debt: 0,
      revenue: 0,
      netIncome: 0,
      inflation: 0,
      interestRate: 0,
      unemployment: 0,
      gdpGrowth: 0,
      consumerSentiment: 0,
      competitorCount: 0
    };

    if (world.playerEntityId > 0) {
      const pid = world.playerEntityId;
      stats.stockPrice = Stock.sharePrice[pid] || 0;
      const prevPrice = Stock.prevSharePrice[pid] || stats.stockPrice;
      stats.stockChange = prevPrice > 0 ? ((stats.stockPrice - prevPrice) / prevPrice) * 100 : 0;
      stats.marketCap = Company.marketCap[pid] || 0;
      stats.creditRating = Finances.creditRating[pid] || 0;
      stats.debt = Finances.debt[pid] || 0;
      stats.revenue = Company.revenueLastMonth[pid] || 0;
      stats.netIncome = Company.netIncomeLastMonth[pid] || 0;

      // Buildings count
      const bQuery = defineQuery([Building, Company]);
      const bEntities = bQuery(world.ecsWorld);
      stats.buildings = bEntities.filter(bid => Company.companyId[bid] === Company.companyId[pid]).length;

      // Employee metrics
      const hrQuery = defineQuery([HumanResources, Building]);
      const hrEntities = hrQuery(world.ecsWorld);
      let totalHeadcount = 0;
      let totalMorale = 0;
      hrEntities.forEach(id => {
        totalHeadcount += HumanResources.headcount[id] || 0;
        totalMorale += (HumanResources.morale[id] || 0) * (HumanResources.headcount[id] || 0);
      });
      stats.employees = totalHeadcount;
      stats.morale = totalHeadcount > 0 ? totalMorale / totalHeadcount : 0;
      stats.productivity = stats.morale * 0.8;
    }

    // City economic data
    const cityQuery = defineQuery([CityEconomicData]);
    const cities = cityQuery(world.ecsWorld);
    if (cities.length > 0) {
      const cid = cities[0];
      stats.inflation = CityEconomicData.inflationRate[cid] || 0;
      stats.interestRate = CityEconomicData.interestRate[cid] || 0;
      stats.unemployment = CityEconomicData.unemployment[cid] || 0;
      stats.gdpGrowth = CityEconomicData.gdpGrowthRate[cid] || 0;
      stats.consumerSentiment = CityEconomicData.consumerSentiment[cid] || 0;
    }

    // Competitor count
    const aiQuery = defineQuery([AIController]);
    stats.competitorCount = aiQuery(world.ecsWorld).length;

    return stats;
  }, [world, tick]);

  // Animate cash changes
  useEffect(() => {
    const diff = cash - displayCash;
    if (diff !== 0) {
      setCashFlash(diff > 0 ? 'green' : 'red');
      const timer = setTimeout(() => setCashFlash('none'), 500);
      
      const steps = 20;
      const stepValue = diff / steps;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        setDisplayCash(prev => prev + stepValue);
        if (currentStep >= steps) {
          setDisplayCash(cash);
          clearInterval(interval);
        }
      }, 25);
      
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [cash]);

  const formatCash = (amount: number) => {
    const dollars = amount / 100;
    if (Math.abs(dollars) >= 1e9) return `$${(dollars / 1e9).toFixed(2)}B`;
    if (Math.abs(dollars) >= 1e6) return `$${(dollars / 1e6).toFixed(2)}M`;
    if (Math.abs(dollars) >= 1e3) return `$${(dollars / 1e3).toFixed(2)}K`;
    return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const monthNames = [
    t('months.jan'), t('months.feb'), t('months.mar'), 
    t('months.apr'), t('months.may'), t('months.jun'), 
    t('months.jul'), t('months.aug'), t('months.sep'), 
    t('months.oct'), t('months.nov'), t('months.dec')
  ];

  // Economic cycle visual
  const getCycleInfo = () => {
    if (isBoom) return { 
      label: t('world_map.economy_excellent') || 'BOOM', 
      color: '#10b981', 
      icon: '📈',
      gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
    };
    if (isRecession) return { 
      label: t('world_map.economy_recession') || 'RECESSION', 
      color: '#ef4444', 
      icon: '📉',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
    };
    return { 
      label: t('world_map.economy_normal') || 'NORMAL', 
      color: '#fbbf24', 
      icon: '➡️',
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%)'
    };
  };

  const cycleInfo = getCycleInfo();

  return (
    <header className="top-bar">
      <div className="top-bar-glass">
        {/* Left Section - Company Identity */}
        <div className="top-section company-section">
          <div className="company-identity">
            <div className="company-logo">
              <svg viewBox="0 0 40 40" width="36" height="36" className="premium-logo">
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e94560" />
                    <stop offset="100%" stopColor="#70a1ff" />
                  </linearGradient>
                </defs>
                <rect x="5" y="5" width="30" height="30" rx="8" fill="none" stroke="url(#logoGrad)" strokeWidth="2.5" />
                <path d="M12 28V12L20 20L28 12V28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="logo-glow"></div>
            </div>
            <div className="company-details">
              <h1 className="company-name">{companyName}</h1>
              <div className={`cash-display ${cashFlash}`}>
                <span className="cash-label">{t('stats.cash')}</span>
                <span className="cash-amount">{formatCash(displayCash)}</span>
                {cashFlash === 'green' && <span className="cash-pulse positive">+</span>}
                {cashFlash === 'red' && <span className="cash-pulse negative">−</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Center Section - Date & Economic Status */}
        <div className="top-section date-section">
          <div className="date-display">
            <div className="date-main">
              <span className="month">{monthNames[gameDate.month - 1]}</span>
              <span className="day">{gameDate.day}</span>
              <span className="year">, {gameDate.year}</span>
            </div>
            <div className="date-subtitle">
              <span className="city-name">{currentCity}</span>
              <span className="cycle-indicator" style={{ 
                background: cycleInfo.gradient,
                color: isBoom || isRecession ? 'white' : '#1f2937'
              }}>
                <span className="cycle-icon">{cycleInfo.icon}</span>
                {cycleInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section - Navigation Tabs */}
        <div className="top-section navigation-section">
          {/* Management Tab */}
          <div 
            className="nav-tab management-tab"
            onMouseEnter={() => setHoveredTab('management')}
            onMouseLeave={() => setHoveredTab(null)}
            onClick={() => onOpenHQ?.()}
          >
            <div className="premium-icon-btn" style={{ '--btn-color': '#70a1ff' } as React.CSSProperties}>
              <span className="tab-icon">📊</span>
              <div className="btn-glow"></div>
            </div>
            <div className="tab-content">
              <span className="tab-title">{t('menu.management')}</span>
              {companyStats && (
                <div className="tab-metrics">
                  <span className="metric">
                    <span className="metric-dot" style={{ background: '#70a1ff' }}></span>
                    {companyStats.buildings} {t('stats.buildings_count')}
                  </span>
                  <span className="metric">
                    <span className="metric-dot" style={{ background: '#00d9a5' }}></span>
                    {companyStats.employees} {t('stats.employees')}
                  </span>
                </div>
              )}
            </div>
            
            {/* Dropdown */}
            {hoveredTab === 'management' && companyStats && (
              <div className="tab-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-title">{t('menu.executive_dashboard')}</span>
                </div>
                <div className="dropdown-grid">
                  <div className="dropdown-stat">
                    <span className="stat-icon">🏢</span>
                    <span className="stat-value">{companyStats.buildings}</span>
                    <span className="stat-label">{t('menu.buildings')}</span>
                  </div>
                  <div className="dropdown-stat">
                    <span className="stat-icon">👥</span>
                    <span className="stat-value">{companyStats.employees}</span>
                    <span className="stat-label">{t('stats.employees')}</span>
                  </div>
                  <div className="dropdown-stat">
                    <span className="stat-icon">😊</span>
                    <span className="stat-value">{companyStats.morale.toFixed(0)}%</span>
                    <span className="stat-label">{t('stats.morale')}</span>
                  </div>
                  <div className="dropdown-stat">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-value">{companyStats.productivity.toFixed(0)}%</span>
                    <span className="stat-label">{t('stats.productivity')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Finance Tab */}
          <div 
            className="nav-tab finance-tab"
            onMouseEnter={() => setHoveredTab('finance')}
            onMouseLeave={() => setHoveredTab(null)}
            onClick={() => onOpenFinance?.()}
          >
            <div className="premium-icon-btn" style={{ '--btn-color': '#00d9a5' } as React.CSSProperties}>
              <span className="tab-icon">💰</span>
              <div className="btn-glow"></div>
            </div>
            <div className="tab-content">
              <span className="tab-title">{t('menu.finance')}</span>
              {companyStats && (
                <div className="tab-metrics">
                  <span className={`metric ${companyStats.stockChange >= 0 ? 'positive' : 'negative'}`}>
                    <span className="metric-arrow">{companyStats.stockChange >= 0 ? '▲' : '▼'}</span>
                    {formatPercent(companyStats.stockChange)}
                  </span>
                  <span className="metric">
                    <span className="credit-rating" style={{ 
                      background: companyStats.creditRating >= 80 ? '#10b981' : 
                                 companyStats.creditRating >= 60 ? '#fbbf24' : '#ef4444'
                    }}>
                      {companyStats.creditRating}
                    </span>
                  </span>
                </div>
              )}
            </div>
            
            {/* Dropdown */}
            {hoveredTab === 'finance' && companyStats && (
              <div className="tab-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-title">{t('menu.financial_overview')}</span>
                </div>
                <div className="dropdown-section">
                  <div className="finance-row">
                    <span className="finance-label">{t('stats.market_cap')}</span>
                    <span className="finance-value">{formatCash(companyStats.marketCap)}</span>
                  </div>
                  <div className="finance-row">
                    <span className="finance-label">{t('stats.stock_price')}</span>
                    <span className={`finance-value ${companyStats.stockChange >= 0 ? 'positive' : 'negative'}`}>
                      {formatCash(companyStats.stockPrice * 100)}
                      <span className="change-indicator">{formatPercent(companyStats.stockChange)}</span>
                    </span>
                  </div>
                  <div className="finance-row">
                    <span className="finance-label">{t('stats.debt')}</span>
                    <span className="finance-value debt">{formatCash(companyStats.debt)}</span>
                  </div>
                  <div className="finance-row">
                    <span className="finance-label">{t('finance.credit_rating')}</span>
                    <span className="finance-value">
                      <span className="rating-badge" style={{ 
                        background: companyStats.creditRating >= 80 ? 'rgba(16, 185, 129, 0.2)' : 
                                   companyStats.creditRating >= 60 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: companyStats.creditRating >= 80 ? '#10b981' : 
                               companyStats.creditRating >= 60 ? '#fbbf24' : '#ef4444'
                      }}>
                        {companyStats.creditRating}/100
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Economy Tab */}
          <div 
            className="nav-tab economy-tab"
            onMouseEnter={() => setHoveredTab('economy')}
            onMouseLeave={() => setHoveredTab(null)}
            onClick={() => onOpenStocks?.()}
          >
            <div className="premium-icon-btn" style={{ '--btn-color': '#e94560' } as React.CSSProperties}>
              <span className="tab-icon">🌍</span>
              <div className="btn-glow"></div>
            </div>
            <div className="tab-content">
              <span className="tab-title">{t('menu.economy')}</span>
              {companyStats && (
                <div className="tab-metrics">
                  <span className="metric">
                    <span className="metric-dot" style={{ background: '#ef4444' }}></span>
                    {(companyStats.inflation * 100).toFixed(1)}%
                  </span>
                  <span className="metric">
                    <span className="metric-dot" style={{ background: '#8b5cf6' }}></span>
                    {companyStats.competitorCount} {t('market.competitors').toLowerCase()}
                  </span>
                </div>
              )}
            </div>
            
            {/* Dropdown */}
            {hoveredTab === 'economy' && companyStats && (
              <div className="tab-dropdown wide">
                <div className="dropdown-header">
                  <span className="dropdown-title">{t('world_map.global_economy')}</span>
                </div>
                <div className="economy-grid">
                  <div className="economy-stat">
                    <span className="economy-icon">📊</span>
                    <div className="economy-info">
                      <span className="economy-value">{(companyStats.gdpGrowth * 100).toFixed(1)}%</span>
                      <span className="economy-label">{t('world_map.gdp_growth')}</span>
                    </div>
                  </div>
                  <div className="economy-stat">
                    <span className="economy-icon">📉</span>
                    <div className="economy-info">
                      <span className="economy-value">{(companyStats.inflation * 100).toFixed(1)}%</span>
                      <span className="economy-label">{t('world_map.inflation')}</span>
                    </div>
                  </div>
                  <div className="economy-stat">
                    <span className="economy-icon">🏦</span>
                    <div className="economy-info">
                      <span className="economy-value">{(companyStats.interestRate * 100).toFixed(1)}%</span>
                      <span className="economy-label">{t('world_map.interest_rate')}</span>
                    </div>
                  </div>
                  <div className="economy-stat">
                    <span className="economy-icon">👔</span>
                    <div className="economy-info">
                      <span className="economy-value">{(companyStats.unemployment * 100).toFixed(1)}%</span>
                      <span className="economy-label">{t('world_map.unemployment')}</span>
                    </div>
                  </div>
                </div>
                <div className="competitor-bar">
                  <span className="competitor-label">{t('market.total_competitors')}</span>
                  <div className="competitor-dots">
                    {Array.from({ length: Math.min(companyStats.competitorCount, 8) }).map((_, i) => (
                      <span key={i} className="competitor-dot" style={{ 
                        background: `hsl(${i * 45}, 70%, 60%)`,
                        animationDelay: `${i * 0.1}s`
                      }}></span>
                    ))}
                    {companyStats.competitorCount > 8 && (
                      <span className="competitor-more">+{companyStats.competitorCount - 8}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Intelligence Tab */}
          <div 
            className="nav-tab intelligence-tab"
            onMouseEnter={() => setHoveredTab('intelligence')}
            onMouseLeave={() => setHoveredTab(null)}
            onClick={() => onOpenIntelligence?.()}
          >
            <div className="premium-icon-btn" style={{ '--btn-color': '#8b5cf6' } as React.CSSProperties}>
              <span className="tab-icon">📡</span>
              <div className="btn-glow"></div>
            </div>
            <div className="tab-content">
              <span className="tab-title">{t('menu.intelligence', { defaultValue: 'INTEL' })}</span>
              {companyStats && (
                <div className="tab-metrics">
                  <span className="metric">
                    <span className="metric-dot" style={{ background: '#8b5cf6' }}></span>
                    {companyStats.competitorCount} {t('market.competitors', { defaultValue: 'rivals' }).toLowerCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Dropdown */}
            {hoveredTab === 'intelligence' && (
              <div className="tab-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-title">{t('menu.intelligence_center', { defaultValue: 'Competitive Intel' })}</span>
                </div>
                <div className="dropdown-section">
                   <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '10px 0' }}>
                      {t('intelligence.monitoring_signals', { defaultValue: 'Monitoring AI pricing, debt, and expansion signals...' })}
                   </p>
                </div>
              </div>
            )}
          </div>

          {/* Logistics Tab */}
          <div 
            className="nav-tab logistics-tab"
            onMouseEnter={() => setHoveredTab('logistics')}
            onMouseLeave={() => setHoveredTab(null)}
            onClick={() => onOpenLogistics?.()}
          >
            <div className="premium-icon-btn" style={{ '--btn-color': '#f59e0b' } as React.CSSProperties}>
              <span className="tab-icon">⚙️</span>
              <div className="btn-glow"></div>
            </div>
            <div className="tab-content">
              <span className="tab-title">{t('menu.logistics', { defaultValue: 'LOGISTICS' })}</span>
              {companyStats && (
                <div className="tab-metrics">
                  <span className="metric">
                    <span className="metric-dot" style={{ background: '#f59e0b' }}></span>
                    {(companyStats.buildings)} {t('stats.ops', { defaultValue: 'ops' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="nav-divider"></div>

          {/* Speed Controls */}
          <div className="speed-controls-pill">
            <button 
              className={`pause-btn ${isPaused ? 'paused' : ''}`}
              onClick={onPause}
              title={isPaused ? t('actions.resume') : t('actions.pause')}
            >
              {isPaused ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>
            
            <div className="speed-divider"></div>

            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                className={`speed-btn ${currentSpeed === speed ? 'active' : ''}`}
                onClick={() => onSpeedChange(speed)}
                title={`${speed}x ${t('actions.speed')}`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* System Menu Button */}
          <button 
            className="system-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('toggleSystemMenu'))}
            title={t('menu.settings')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="top-bar-accent"></div>
    </header>
  );
}
