import './WorldMap.css';

import { defineQuery } from 'bitecs';
import { GameWorld } from '../../core/ecs/world';
import { CityEconomicData, Position } from '../../core/ecs/components';
import { CITIES } from '../../core/data/cities';

interface WorldMapProps {
  onClose: () => void;
  onSelectCity: (cityId: string) => void;
  currentCityId: string | null;
  world: GameWorld;
}

export function WorldMap({ onClose, onSelectCity, currentCityId, world }: WorldMapProps) {
  // Query ECS for city data
  const cityQuery = defineQuery([CityEconomicData, Position]);
  const cityEntities = cityQuery(world.ecsWorld);
  
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

  return (
    <div className="world-map-overlay animate-fadeIn">
      <div className="world-map-container">
        <div className="world-map-header">
          <h2>WORLD MAP</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="world-map-visual">
          <div className="world-bg"></div>
          {/* Conceptual dots for cities */}
          {CITIES.map((city, index) => {
            const ecsData = cityDataMap.get(index + 1);
            const popDisplay = ecsData ? `${(ecsData.pop / 1000000).toFixed(1)}M` : city.population;
            const ppDisplay = ecsData ? `PP: ${ecsData.pp}` : '';
            return (
            <div 
              key={city.id}
              className={`city-marker ${currentCityId === city.id ? 'current' : ''}`}
              style={{ left: `${city.x}%`, top: `${city.y}%` }}
              onClick={() => onSelectCity(city.id)}
            >
              <div className="marker-dot"></div>
              <div className="marker-pulse"></div>
              <div className="city-tooltip">
                <span className="city-name">{city.name}</span>
                <span className="city-stats">{popDisplay} • {ppDisplay}</span>
              </div>
            </div>
          )})}
        </div>

        <div className="world-stats-panel">
           <h3>GLOBAL ECONOMY</h3>
           <div className="stat-row">
             <span>WORLD POPULATION</span>
             <span className="val">{(totalPop / 1000000).toFixed(1)} Million</span>
           </div>
           <div className="stat-row">
             <span>AVG PURCHASE POWER</span>
             <span className="val">{avgPP.toFixed(1)}</span>
           </div>
           <div className="stat-row">
             <span>CONS. SENTIMENT</span>
             <span className="val">{avgSentiment.toFixed(1)}</span>
           </div>
        </div>
      </div>
    </div>
  );
}
