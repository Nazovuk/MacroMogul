import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { GameWorld } from '../../core/ecs/world';
import { 
  Company, AIController, Finances, MarketData, 
  ProductBrand
} from '../../core/ecs/components';
import './IntelligenceDashboard.css';

interface IntelligenceDashboardProps {
  world: GameWorld;
  onClose: () => void;
}

export function IntelligenceDashboard({ world, onClose }: IntelligenceDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'ai_profiles' | 'market_intelligence' | 'news'>('ai_profiles');

  // 1. Gather AI Profiles
  const aiProfiles = useMemo(() => {
    const aiQuery = defineQuery([AIController, Company, Finances]);
    const entities = aiQuery(world.ecsWorld);
    
    return entities.map(eid => {
      const compId = Company.companyId[eid];
      const personality = AIController.personality[eid];
      
      // Calculate market dominance (sum of all shares)
      const brandQuery = defineQuery([ProductBrand]);
      const brands = brandQuery(world.ecsWorld).filter(bid => ProductBrand.companyId[bid] === compId);
      const totalShare = brands.reduce((sum, bid) => sum + (ProductBrand.marketShare[bid] || 0), 0);
      
      const compData = world.dataStore.getCompany(eid);
      const name = compData ? compData.name : t('intelligence.competitor_x', { id: eid, defaultValue: `Competitor ${eid}` });
      
      return {
        id: eid,
        name: name,
        personality: personality === 0 ? 'Aggressive' : (personality === 1 ? 'Balanced' : 'Conservative'),
        cash: Finances.cash[eid],
        debt: Finances.debt[eid],
        netWorth: Company.marketCap[eid] || 0,
        dominantMarket: totalShare.toFixed(1) + '%',
        creditRating: Finances.creditRating[eid] || 0,
        threatLevel: personality === 0 ? 'High' : (personality === 1 ? 'Medium' : 'Low')
      };
    });
  }, [world, world.tick]);

  // 2. Market Intelligence Alerts (Real-time checks)
  const alerts = useMemo(() => {
    const list: string[] = [];
    
    // Check for Tech Obsolescence across player products
    const playerCompId = Company.companyId[world.playerEntityId];
    const alertsSet = world.techAlerts.get(playerCompId);
    if (alertsSet && alertsSet.size > 0) {
      list.push(t('intelligence.tech_alert', { count: alertsSet.size }));
    }

    // Check for AI Price Wars
    // (We look for low prices relative to world average)
    const mktQuery = defineQuery([MarketData, ProductBrand]);
    const products = Array.from(world.dataStore.products.keys());
    
    products.forEach(pid => {
       const productBrands = mktQuery(world.ecsWorld).filter(bid => ProductBrand.productId[bid] === pid);
       const playerBrand = productBrands.find(bid => ProductBrand.companyId[bid] === playerCompId);
       
       if (playerBrand) {
          const rivals = productBrands.filter(bid => ProductBrand.companyId[bid] !== playerCompId);
          const priceWar = rivals.some(rb => MarketData.price[rb] < MarketData.price[playerBrand] * 0.85);
          if (priceWar) {
             const pData = world.dataStore.getProduct(pid);
             list.push(t('intelligence.price_war_alert', { product: pData?.name || '???' }));
          }
       }
    });

    return list;
  }, [world, world.tick]);

  // Handle news simulation (in a real app, this would come from an EventSystem)
  const news = useMemo(() => {
    return world.newsFeed || [];
  }, [world.tick]);

  return (
    <div className="intelligence-dashboard animate-fadeIn">
      <div className="intelligence-glass">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-title">
            <span className="title-icon">📡</span>
            <h2>{t('menu.intelligence_center', { defaultValue: 'INTELLIGENCE CENTER' })}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Sidebar Navigation */}
        <div className="dashboard-body">
          <nav className="dashboard-sidebar">
            <button 
              className={`sidebar-link ${activeTab === 'ai_profiles' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai_profiles')}
            >
              <span className="link-icon">🏢</span>
              {t('intelligence.rival_profiles', { defaultValue: 'Rival Profiles' })}
            </button>
            <button 
              className={`sidebar-link ${activeTab === 'market_intelligence' ? 'active' : ''}`}
              onClick={() => setActiveTab('market_intelligence')}
            >
              <span className="link-icon">👁️</span>
              {t('intelligence.market_watch', { defaultValue: 'Market Watch' })}
            </button>
            <button 
              className={`sidebar-link ${activeTab === 'news' ? 'active' : ''}`}
              onClick={() => setActiveTab('news')}
            >
              <span className="link-icon">🗞️</span>
              {t('intelligence.news_feed', { defaultValue: 'News Feed' })}
            </button>
          </nav>

          {/* Main Content Area */}
          <main className="dashboard-content scrollbar-custom">
            {activeTab === 'ai_profiles' && (
              <div className="profiles-grid">
                {aiProfiles.map(ai => (
                  <div key={ai.id} className="ai-card">
                    <div className="card-top">
                      <div className="ai-status-orb" data-threat={ai.threatLevel}></div>
                      <div className="ai-identity">
                        <h3>{ai.name}</h3>
                        <span className="ai-tag">{t(`personality.${ai.personality.toLowerCase()}`, { defaultValue: ai.personality })}</span>
                      </div>
                    </div>
                    
                    <div className="card-stats">
                      <div className="stat-item">
                        <span className="stat-label">{t('intelligence.market_cap', { defaultValue: 'MARKET CAP' })}</span>
                        <span className="stat-value">${(ai.netWorth/100e6).toFixed(1)}B</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">{t('intelligence.debt_ratio', { defaultValue: 'DEBT RATIO' })}</span>
                        <span className="stat-value">{((ai.debt / Math.max(1, ai.netWorth)) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">{t('intelligence.dominance', { defaultValue: 'DOMINANCE' })}</span>
                        <span className="stat-value">{ai.dominantMarket}</span>
                      </div>
                    </div>

                    <div className="card-footer">
                      <span className="credit-rating">{t('intelligence.rating', { defaultValue: 'Rating' })}: {ai.creditRating}</span>
                      <span className="threat-label">{t('intelligence.threat', { defaultValue: 'Threat' })}: <strong>{t(`threat_level.${ai.threatLevel.toLowerCase()}`, { defaultValue: ai.threatLevel })}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'market_intelligence' && (
              <div className="intelligence-list">
                <div className="section-banner">
                  <h3>{t('intelligence.active_alerts', { defaultValue: 'Active Alerts & Signals' })}</h3>
                  <p>{t('intelligence.active_alerts_desc', { defaultValue: 'Real-time analysis of competitor behavior and market signals.' })}</p>
                </div>
                {alerts.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">✅</span>
                    <p>{t('intelligence.no_threats', { defaultValue: 'No critical competitive threats detected.' })}</p>
                  </div>
                ) : (
                  alerts.map((alert, i) => (
                    <div key={i} className="intelligence-alert animate-slideIn">
                      <div className="alert-icon">⚠️</div>
                      <div className="alert-text">{alert}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'news' && (
              <div className="news-feed">
                {news.map(item => (
                  <div key={item.id} className="news-item" data-type={item.type}>
                    <div className="news-meta">
                      <span className="news-type">{item.type.toUpperCase()}</span>
                      <span className="news-time">{t('intelligence.just_now', { defaultValue: 'Just now' })}</span>
                    </div>
                    <h4>{(() => {
                        if (item.title.includes('|')) {
                            const [key, paramsStr] = item.title.split('|');
                            try { return t(key, JSON.parse(paramsStr)) as string; } catch(e) { return t(key) as string; }
                        }
                        return t(item.title) as string;
                    })()}</h4>
                    <p>{(() => {
                        if (item.content.includes('|')) {
                            const [key, paramsStr] = item.content.split('|');
                            try { return t(key, JSON.parse(paramsStr)) as string; } catch(e) { return t(key) as string; }
                        }
                        return t(item.content) as string;
                    })()}</p>
                  </div>
                ))}
                {news.length === 0 && (
                  <div className="empty-state">
                    <p>{t('intelligence.standby_news', { defaultValue: 'Stand by for incoming intelligence reports...' })}</p>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
