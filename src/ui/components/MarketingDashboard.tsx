import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GameWorld } from '../../core/ecs/world';
import { defineQuery } from 'bitecs';
import {
  Building,
  Company,
  MarketingOffice,
  ProductBrand,
} from '../../core/ecs/components';
import './MarketingDashboard.css';

interface MarketingDashboardProps {
  world: GameWorld;
  onClose: () => void;
}

interface BrandMetric {
  productId: number;
  productName: string;
  awareness: number;
  loyalty: number;
  marketShare: number;
  reputationBonus: number;
  adSpend: number;
}

interface Campaign {
  id: number;
  productId: number;
  productName: string;
  spending: number;
  efficiency: number;
  campaignType: number;
  reach: number;
  isOperational: boolean;
}

export function MarketingDashboard({ world, onClose }: MarketingDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'campaigns' | 'intelligence'>('overview');

  const playerCompanyId = useMemo(() => Company.companyId[world.playerEntityId], [world.playerEntityId]);

  const marketingData = useMemo(() => {
    if (!playerCompanyId) return { brands: [], campaigns: [], globalRep: 0, totalSpend: 0, totalReach: 0 };

    // 1. Get Brands
    const brandQuery = defineQuery([ProductBrand]);
    const brandEntities = brandQuery(world.ecsWorld).filter(id => ProductBrand.companyId[id] === playerCompanyId);
    
    const brands: BrandMetric[] = brandEntities.map(id => {
      const pId = ProductBrand.productId[id];
      const pData = world.dataStore.getProduct(pId);
      return {
        productId: pId,
        productName: pData?.name || 'Unknown',
        awareness: ProductBrand.awareness[id],
        loyalty: ProductBrand.loyalty[id],
        marketShare: ProductBrand.marketShare[id],
        reputationBonus: ProductBrand.reputationBonus[id],
        adSpend: ProductBrand.adSpendThisMonth[id]
      };
    });

    // 2. Get Campaigns (Marketing Offices)
    const officeQuery = defineQuery([Building, MarketingOffice, Company]);
    const officeEntities = officeQuery(world.ecsWorld).filter(id => Company.companyId[id] === playerCompanyId);

    const campaigns: Campaign[] = officeEntities.map(id => {
      const pId = MarketingOffice.productId[id];
      const pData = world.dataStore.getProduct(pId);
      return {
        id,
        productId: pId,
        productName: pData?.name || 'None',
        spending: MarketingOffice.spending[id],
        efficiency: MarketingOffice.efficiency[id],
        campaignType: MarketingOffice.campaignType[id],
        reach: MarketingOffice.reach[id],
        isOperational: Building.isOperational[id] === 1
      };
    });

    const globalRep = Company.reputation[world.playerEntityId] || 50;
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spending, 0);
    const totalReach = campaigns.reduce((sum, c) => sum + c.reach, 0);

    return { brands, campaigns, globalRep, totalSpend, totalReach };
  }, [world, world.tick, playerCompanyId]);

  const pricingPower = useMemo(() => {
    if (marketingData.brands.length === 0) return 100;
    const avgLoyalty = marketingData.brands.reduce((sum, b) => sum + b.loyalty, 0) / marketingData.brands.length;
    // Loyalty 0-100 maps to 100-150% pricing power
    return Math.floor(100 + (avgLoyalty / 2));
  }, [marketingData.brands]);

  return (
    <div className="marketing-dashboard-overlay">
      <div className="marketing-dashboard glass-panel">
        
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-left">
            <span className="premium-icon">📣</span>
            <h2>{t('pazarlama.dashboard_title', 'Pazarlama & Marka Yönetimi')}</h2>
          </div>
          <button className="premium-icon-btn close-btn" onClick={onClose} style={{ '--btn-color': '#ef4444' } as React.CSSProperties}>
            ✕<div className="btn-glow"></div>
          </button>
        </div>

        {/* Global KPIs */}
        <div className="marketing-kpi-bar">
          <div className="kpi-card">
            <span className="kpi-label">{t('pazarlama.global_itibar', 'Kurumsal İtibar')}</span>
            <span className={`kpi-value ${marketingData.globalRep > 70 ? 'success' : marketingData.globalRep < 40 ? 'danger' : 'highlight'}`}>
              {Math.floor(marketingData.globalRep)}%
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">{t('pazarlama.pricing_power', 'Fiyatlandırma Gücü')}</span>
            <span className="kpi-value highlight">{pricingPower}%</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">{t('pazarlama.total_reach', 'Global Erişim')}</span>
            <span className="kpi-value">{(marketingData.totalReach / 1000).toFixed(1)}M</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">{t('pazarlama.monthly_budget', 'Aylık Bütçe')}</span>
            <span className="kpi-value">${(marketingData.totalSpend / 100000).toLocaleString()}K</span>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="dashboard-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            {t('pazarlama.ozet', 'Marka Özeti')}
          </button>
          <button className={activeTab === 'brands' ? 'active' : ''} onClick={() => setActiveTab('brands')}>
            {t('pazarlama.portfoy', 'Ürün Portföyü')} ({marketingData.brands.length})
          </button>
          <button className={activeTab === 'campaigns' ? 'active' : ''} onClick={() => setActiveTab('campaigns')}>
            {t('pazarlama.kampanyalar', 'Aktif Kampanyalar')} ({marketingData.campaigns.length})
          </button>
          <button className={activeTab === 'intelligence' ? 'active' : ''} onClick={() => setActiveTab('intelligence')}>
            {t('pazarlama.intelligence', 'Pazar İstihbaratı')}
          </button>
        </div>

        {/* Content Area */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <div className="brand-health-grid">
               {marketingData.brands.length > 0 ? marketingData.brands.map(brand => (
                 <div key={brand.productId} className="brand-card">
                   <div className="brand-header">
                     <div className="brand-title">
                       <span className="brand-icon">🏷️</span>
                       <div>
                         <div style={{ fontWeight: 700 }}>{t(`products.${brand.productName}`)}</div>
                         <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Market Payı: {brand.marketShare}%</div>
                       </div>
                     </div>
                     <div className={`brand-status-icon ${brand.awareness > 60 ? 'success' : 'warning'}`}>●</div>
                   </div>
                   
                   <div className="brand-stats-rows">
                     <div className="brand-stat-row">
                       <div className="stat-label-line">
                         <span>Bilinirlik</span>
                         <span>{Math.floor(brand.awareness)}%</span>
                       </div>
                       <div className="progress-bar-bg">
                         <div className="progress-bar-fill" style={{ width: `${brand.awareness}%`, background: '#3b82f6' }}></div>
                       </div>
                     </div>
                     
                     <div className="brand-stat-row">
                       <div className="stat-label-line">
                         <span>Sadakat</span>
                         <span>{Math.floor(brand.loyalty)}%</span>
                       </div>
                       <div className="progress-bar-bg">
                         <div className="progress-bar-fill" style={{ width: `${brand.loyalty}%`, background: '#ec4899' }}></div>
                       </div>
                     </div>
                   </div>
                 </div>
               )) : (
                 <div className="premium-empty-state">
                   <span className="empty-icon">📢</span>
                   <p>Henüz aktif bir markanız bulunmuyor. Satış ofisi kurun ve reklam bütçesi ayırın.</p>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="campaign-grid">
              <div className="campaign-row" style={{ background: 'transparent', fontWeight: 600, fontSize: '0.8rem', color: '#94a3b8' }}>
                <div>ÜRÜN / OFİS</div>
                <div>KAMPANYA TÜRÜ</div>
                <div>VERİMLİLİK</div>
                <div>AYLIK BÜTÇE</div>
                <div>ERİŞİM</div>
              </div>
              {marketingData.campaigns.map(c => (
                <div key={c.id} className="campaign-row">
                  <div style={{ fontWeight: 600 }}>#{c.id} {t(`products.${c.productName}`)}</div>
                  <div>
                    <span className={`campaign-type-badge ${c.isOperational ? 'status-active' : ''}`}>
                      {c.campaignType === 0 ? 'Kitle İletişim' : 
                       c.campaignType === 1 ? 'Dijital' :
                       c.campaignType === 2 ? 'Premium' :
                       c.campaignType === 3 ? 'Gerilla' : 'PR & İtibar'}
                    </span>
                  </div>
                  <div className={c.efficiency > 70 ? 'success' : 'warning'}>{c.efficiency}%</div>
                  <div>${(c.spending / 100000).toLocaleString()}K</div>
                  <div style={{ fontFamily: 'JetBrains Mono' }}>{(c.reach / 1000).toFixed(1)}k</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div className="intelligence-feed">
               <div className="intelligence-section">
                  <h4 style={{ color: '#e94560', marginBottom: '15px', borderBottom: '1px solid rgba(233,69,96,0.3)', paddingBottom: '5px' }}>
                    Rekabet Analizi & Tehditler
                  </h4>
                  {world.newsFeed.filter(n => n.type === 'market' || n.type === 'tech').slice(0, 10).map((news, idx) => (
                    <div key={news.id || idx} className="intelligence-item">
                      <span className="intel-time">{new Date(news.timestamp).toLocaleTimeString()}</span>
                      <span className="intel-content">{news.title}</span>
                      <p className="intel-desc" style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>{news.content}</p>
                    </div>
                  ))}
                  {world.newsFeed.filter(n => n.type === 'market').length === 0 && (
                     <div className="premium-empty-state">
                        <p>Pazar sakin. Ciddi bir rakip hamlesi tespit edilmedi.</p>
                     </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
