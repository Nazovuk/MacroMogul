import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './SystemMenu.css';

interface SystemMenuProps {
  onCheckSaveSlots: () => any[];
  onSave: (slotName: string) => void;
  onLoad: (slotName: string) => void;
  onResume: () => void;
  onExit: () => void;
}

export function SystemMenu({
  onCheckSaveSlots,
  onSave,
  onLoad,
  onResume,
  onExit
}: SystemMenuProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'main' | 'save' | 'load'>('main');
  const [slots, setSlots] = useState<any[]>([]);
  const [newSaveName, setNewSaveName] = useState('');

  useEffect(() => {
    if (activeTab === 'save' || activeTab === 'load') {
      setSlots(onCheckSaveSlots());
    }
  }, [activeTab, onCheckSaveSlots]);

  const handleSave = () => {
    if (!newSaveName) return;
    onSave(newSaveName);
    setNewSaveName('');
    setActiveTab('main');
  };

  return (
    <div className="system-menu-overlay">
      <div className="system-menu-container">
        <div className="menu-header">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
          </div>
          <h2 className="menu-title">{t('system_menu.title')}</h2>
        </div>
        
        {activeTab === 'main' && (
          <div className="menu-grid">
            <button className="menu-card save-card" onClick={() => setActiveTab('save')}>
              <div className="card-icon">💾</div>
              <div className="card-content">
                <span className="card-label">{t('system_menu.save_game')}</span>
                <span className="card-desc">{t('system_menu.save_desc')}</span>
              </div>
              <div className="card-arrow">→</div>
            </button>
            
            <button className="menu-card load-card" onClick={() => setActiveTab('load')}>
              <div className="card-icon">📂</div>
              <div className="card-content">
                <span className="card-label">{t('system_menu.load_game')}</span>
                <span className="card-desc">{t('system_menu.load_desc')}</span>
              </div>
              <div className="card-arrow">→</div>
            </button>
            
            <button className="menu-card github-card" onClick={() => window.open('https://github.com/nazov/macromogul', '_blank')}>
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div className="card-content">
                <span className="card-label">{t('system_menu.github_help')}</span>
                <span className="card-desc">GitHub / Docs</span>
              </div>
              <div className="card-arrow">↗</div>
            </button>
            
            <div className="menu-divider"></div>
            
            <button className="menu-card resume-card primary" onClick={onResume}>
              <div className="card-icon">▶</div>
              <div className="card-content">
                <span className="card-label">{t('system_menu.resume_game')}</span>
              </div>
            </button>
            
            <button className="menu-card exit-card danger" onClick={onExit}>
              <div className="card-icon">🚪</div>
              <div className="card-content">
                <span className="card-label">{t('system_menu.exit_to_menu')}</span>
              </div>
            </button>
          </div>
        )}
        
        {(activeTab === 'save' || activeTab === 'load') && (
          <div className="save-load-panel">
            <div className="panel-header">
              <button className="back-btn" onClick={() => setActiveTab('main')}>
                <span>←</span>
                {t('system_menu.back')}
              </button>
              <h3>{activeTab === 'save' ? t('system_menu.save_game') : t('system_menu.load_game')}</h3>
            </div>
            
            {activeTab === 'save' && (
              <div className="new-save-section">
                <input
                  type="text"
                  placeholder={t('system_menu.new_save_name')}
                  value={newSaveName}
                  onChange={(e) => setNewSaveName(e.target.value)}
                  className="save-input"
                />
                <button 
                  className="action-btn primary"
                  onClick={handleSave}
                  disabled={!newSaveName}
                >
                  {t('system_menu.save')}
                </button>
              </div>
            )}
            
            <div className="saves-list">
              {slots.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <span>{t('system_menu.no_saves')}</span>
                </div>
              ) : (
                slots.map((slot) => (
                  <div key={slot.slot} className="save-slot">
                    <div className="slot-info">
                      <div className="slot-icon">💾</div>
                      <div className="slot-details">
                        <span className="slot-name">{slot.slot}</span>
                        <span className="slot-meta">
                          {new Date(slot.meta.timestamp).toLocaleDateString()} • {t('scenario.year')} {slot.meta.date.year}
                        </span>
                      </div>
                    </div>
                    <div className="slot-actions">
                      {activeTab === 'save' && (
                        <button 
                          className="action-btn secondary"
                          onClick={() => onSave(slot.slot)}
                        >
                          {t('system_menu.overwrite')}
                        </button>
                      )}
                      {activeTab === 'load' && (
                        <button 
                          className="action-btn primary"
                          onClick={() => onLoad(slot.slot)}
                        >
                          {t('system_menu.load_button')}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
