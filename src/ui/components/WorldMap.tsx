import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { GameWorld } from '../../core/ecs/world';
import { CityEconomicData, Position, Company, Building } from '../../core/ecs/components';
import { CITIES } from '../../core/data/cities';
import './WorldMap.css';

interface WorldMapProps {
  onClose: () => void;
  onSelectCity: (cityId: string) => void;
  currentCityId: string | null;
  world: GameWorld;
}

export function WorldMap({ onClose, onSelectCity, currentCityId, world }: WorldMapProps) {
  const { t } = useTranslation();

  // Query ECS for city data
  const cityQuery = defineQuery([CityEconomicData, Position]);
  const cityEntities = cityQuery(world.ecsWorld);
  
  // Find player company buildings to simulate "presence"
  const buildingQuery = defineQuery([Building, Position, Company]);
  const buildingEntities = buildingQuery(world.ecsWorld);
  
  const cityPresence = new Map<number, { bCount: number }>();
  for (const bid of buildingEntities) {
    if (Company.companyId[bid] === Company.companyId[world.playerEntityId]) {
      const cityId = Position.cityId[bid];
      if (!cityPresence.has(cityId)) cityPresence.set(cityId, { bCount: 0 });
      cityPresence.get(cityId)!.bCount++;
    }
  }

  // Create a map of ECS data for easy lookup by index/id
  const cityDataMap = new Map<number, { pop: number, pp: number, sentiment: number }>();
  for (const eid of cityEntities) {
    const cid = Position.cityId[eid];
    cityDataMap.set(cid, {
        pop: CityEconomicData.population[eid],
        pp: CityEconomicData.purchasingPower[eid],
        sentiment: CityEconomicData.consumerSentiment[eid]
    });
  }

  // Calculate Global Stats
  let totalPop = 0;
  let avgPP = 0;
  let avgSentiment = 0;
  if (cityEntities.length > 0) {
      cityEntities.forEach(eid => {
          totalPop += CityEconomicData.population[eid];
          avgPP += CityEconomicData.purchasingPower[eid];
          avgSentiment += CityEconomicData.consumerSentiment[eid];
      });
      avgPP /= cityEntities.length;
      avgSentiment /= cityEntities.length;
  } else {
      totalPop = 7800000000;
      avgPP = 60;
      avgSentiment = 50;
  }

  const currentCityData = CITIES.find(c => c.id === currentCityId) || CITIES[0];

  return (
    <div className="world-map-overlay animate-fadeIn">
      {/* Background Holographic Effects */}
      <div className="holo-grid"></div>
      <div className="scan-line"></div>
      
      <div className="world-map-container glass-panel">
        
        {/* Header */}
        <div className="world-map-header">
          <div className="header-left">
            <span className="premium-icon">🌐</span>
            <h2>{t('world_map.title') || 'GLOBAL OPERATIONS'}</h2>
          </div>
          <button className="premium-icon-btn close-btn" onClick={onClose} style={{ '--btn-color': '#ef4444' } as React.CSSProperties}>
            ✕<div className="btn-glow"></div>
          </button>
        </div>
        
        {/* Main Map Visual Area */}
        <div className="world-map-visual">
          <div className="world-bg-svg"></div>
          
          {/* Animated Trade Routes (Lines connecting current city to others) */}
          <svg className="trade-routes-layer">
            <defs>
              <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(0, 217, 165, 0.1)" />
                <stop offset="50%" stopColor="rgba(0, 217, 165, 0.8)" />
                <stop offset="100%" stopColor="rgba(0, 217, 165, 0.1)" />
              </linearGradient>
            </defs>
            {CITIES.map((city) => {
              if (city.id === currentCityData.id) return null;
              return (
                <path 
                  key={`route-${city.id}`}
                  className="route-path"
                  d={`M ${currentCityData.x}% ${currentCityData.y}% Q 50% 20% ${city.x}% ${city.y}%`}
                  stroke="url(#route-gradient)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeDasharray="4 4"
                />
              )
            })}
          </svg>

          {/* City Markers */}
          {CITIES.map((city, index) => {
            const ecsData = cityDataMap.get(index + 1);
            const popDisplay = ecsData ? `${(ecsData.pop / 1000000).toFixed(1)}M` : city.population;
            const presence = cityPresence.get(index + 1)?.bCount || 0;
            const isCurrent = currentCityId === city.id;
            
            return (
              <div 
                key={city.id}
                className={`city-node ${isCurrent ? 'current' : ''} ${presence > 0 ? 'active-market' : ''}`}
                style={{ left: `${city.x}%`, top: `${city.y}%` }}
                onClick={() => onSelectCity(city.id)}
              >
                <div className="node-core"></div>
                <div className="node-ring"></div>
                {isCurrent && <div className="node-pulse"></div>}
                
                <div className="city-tooltip-premium">
                  <div className="tooltip-header">
                    <span className="city-name">{city.name}</span>
                    {presence > 0 && <span className="presence-badge">MARKET PRESENCE</span>}
                  </div>
                  <div className="tooltip-body">
                    <div className="stat-item">
                      <span className="label">POPULATION</span>
                      <span className="value">{popDisplay}</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">GDP</span>
                      <span className="value">{city.gdp}</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">PURCHASING POWER</span>
                      <span className="value">{ecsData?.pp || 60}</span>
                    </div>
                    {presence > 0 && (
                      <div className="stat-item highlight">
                        <span className="label">YOUR BUILDINGS</span>
                        <span className="value">{presence}</span>
                      </div>
                    )}
                  </div>
                  <div className="tooltip-footer">Click to establish operations</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Global Analytics Panel (Left/Right overlayed panels) */}
        <div className="analytics-panel global-stats">
           <h3><span className="panel-icon">📊</span> {t('world_map.global_economy') || 'MACROECONOMICS'}</h3>
           
           <div className="analytics-card">
             <div className="stat-row">
               <span className="stat-label">WORLD POPULATION</span>
               <span className="stat-val primary">{(totalPop / 1000000000).toFixed(2)}B</span>
             </div>
             <div className="stat-bar"><div className="fill" style={{width: '75%', background: '#00d9a5'}}></div></div>
           </div>

           <div className="analytics-card">
             <div className="stat-row">
               <span className="stat-label">AVG PURCHASING POWER</span>
               <span className="stat-val">{avgPP.toFixed(1)}</span>
             </div>
             <div className="stat-bar"><div className="fill" style={{width: `${(avgPP / 100) * 100}%`, background: '#3b82f6'}}></div></div>
           </div>

           <div className="analytics-card">
             <div className="stat-row">
               <span className="stat-label">CONSUMER SENTIMENT</span>
               <span className="stat-val">{avgSentiment.toFixed(1)}</span>
             </div>
             <div className="stat-bar"><div className="fill" style={{width: `${(avgSentiment / 100) * 100}%`, background: '#a55eea'}}></div></div>
           </div>
        </div>
        
        {/* Territory Control Panel */}
        <div className="analytics-panel territory-stats">
           <h3><span className="panel-icon">🏢</span> MARKET DOMINANCE</h3>
           <div className="territory-list">
             {CITIES.map((city, idx) => {
               const presence = cityPresence.get(idx + 1)?.bCount || 0;
               if (presence === 0) return null;
               return (
                 <div key={'t-'+city.id} className="territory-row">
                   <span className="city-label">{city.name}</span>
                   <span className="presence-val">{presence} operations</span>
                 </div>
               )
             })}
             {cityPresence.size === 0 && (
               <div className="no-presence">No global operations established. Expand your empire to see data here.</div>
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
