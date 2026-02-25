import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import scenarios from '../../core/data/scenarios.json';
import './ScenarioSelect.css';

interface ScenarioSelectProps {
  onStartScenario: (scenarioId: string) => void;
  onBack: () => void;
}

export function ScenarioSelect({ onStartScenario, onBack }: ScenarioSelectProps) {
  const { t } = useTranslation();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const currentScenario = scenarios.find(s => s.id === selectedScenario);

  return (
    <div className="scenario-menu animate-fadeIn">
      <div className="menu-header">
         <h2>{t('scenario.select_title')}</h2>
      </div>
      
      <div className="scenario-container">
        <div className="scenario-list">
          {scenarios.map(s => (
            <button 
              key={s.id}
              className={`scenario-item ${selectedScenario === s.id ? 'active' : ''}`}
              onClick={() => setSelectedScenario(s.id)}
            >
              <div className="s-title">{t(`scenario.${s.id}.title`)}</div>
              <div className="s-meta">{s.startYear} • {t(`scenario.${s.difficulty.toLowerCase()}`)}</div>
            </button>
          ))}
        </div>

        <div className="scenario-detail">
          {currentScenario ? (
            <>
              <h3>{t(`scenario.${currentScenario.id}.title`)}</h3>
              <div className="detail-meta">
                <span className="dif-tag" data-difficulty={currentScenario.difficulty}>
                  {t(`scenario.${currentScenario.difficulty.toLowerCase()}`)}
                </span>
                <span>{t('scenario.starting_capital')}: ${(currentScenario.startCash / 1000000).toFixed(0)}M</span>
              </div>
              <p className="desc">{t(`scenario.${currentScenario.id}.description`)}</p>
              
              <div className="cities-preview">
                <h4>{t('scenario.available_regions')}:</h4>
                <div className="city-tags">
                  {currentScenario.cityIds.map(cid => (
                    <span key={cid} className="tag">{cid.replace('city_', 'City ')}</span>
                  ))}
                </div>
              </div>

              <button className="start-btn" onClick={() => onStartScenario(currentScenario.id)}>
                {t('scenario.start_enterprise')}
              </button>
            </>
          ) : (
            <div className="empty-state">
              <p>{t('scenario.select_scenario')}</p>
            </div>
          )}
        </div>
      </div>
      
      <button className="back-btn" onClick={onBack}>{t('scenario.back')}</button>
    </div>
  );
}
