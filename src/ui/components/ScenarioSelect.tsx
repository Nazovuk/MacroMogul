import { useState } from 'react';
import scenarios from '../../core/data/scenarios.json';
import './ScenarioSelect.css';

interface ScenarioSelectProps {
  onStartScenario: (scenarioId: string) => void;
  onBack: () => void;
}

export function ScenarioSelect({ onStartScenario, onBack }: ScenarioSelectProps) {
  // const { t } = useTranslation();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const currentScenario = scenarios.find(s => s.id === selectedScenario);

  return (
    <div className="scenario-menu animate-fadeIn">
      <div className="menu-header">
         <h2>SELECT SCENARIO</h2>
      </div>
      
      <div className="scenario-container">
        <div className="scenario-list">
          {scenarios.map(s => (
            <button 
              key={s.id}
              className={`scenario-item ${selectedScenario === s.id ? 'active' : ''}`}
              onClick={() => setSelectedScenario(s.id)}
            >
              <div className="s-title">{s.title}</div>
              <div className="s-meta">{s.startYear} • {s.difficulty}</div>
            </button>
          ))}
        </div>

        <div className="scenario-detail">
          {currentScenario ? (
            <>
              <h3>{currentScenario.title}</h3>
              <div className="detail-meta">
                <span className="dif-tag" data-difficulty={currentScenario.difficulty}>
                  {currentScenario.difficulty}
                </span>
                <span>Starting Capital: ${(currentScenario.startCash / 1000000).toFixed(0)}M</span>
              </div>
              <p className="desc">{currentScenario.description}</p>
              
              <div className="cities-preview">
                <h4>Available Regions:</h4>
                <div className="city-tags">
                  {currentScenario.cityIds.map(cid => (
                    <span key={cid} className="tag">{cid.replace('city_', 'City ')}</span>
                  ))}
                </div>
              </div>

              <button className="start-btn" onClick={() => onStartScenario(currentScenario.id)}>
                START ENTERPRISE
              </button>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a scenario to view details</p>
            </div>
          )}
        </div>
      </div>
      
      <button className="back-btn" onClick={onBack}>BACK</button>
    </div>
  );
}
