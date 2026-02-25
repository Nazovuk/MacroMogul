import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PersistenceService } from '../../core/services/PersistenceService';
import './SystemMenu.css';

interface LoadGameModalProps {
  onLoad: (slotName: string) => void;
  onClose: () => void;
}

export function LoadGameModal({ onLoad, onClose }: LoadGameModalProps) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<any[]>([]);

  useEffect(() => {
    setSlots(PersistenceService.getAvailableSaves());
  }, []);

  return (
    <div className="system-menu-overlay">
      <div className="system-menu-container">
        <div className="save-load-panel" style={{ display: 'block' }}>
          <div className="panel-header">
            <button className="back-btn" onClick={onClose}>
              <span>←</span>
              {t('common.back', { defaultValue: 'Back' })}
            </button>
            <h3>{t('system_menu.load_game')}</h3>
          </div>
          
          <div className="saves-list" style={{ marginTop: '20px' }}>
            {slots.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <span>{t('system_menu.no_saves')}</span>
              </div>
            ) : (
              slots.map((slot) => (
                <div key={slot.slot} className="save-slot">
                  <div className="slot-info">
                    <div className="slot-icon">📂</div>
                    <div className="slot-details">
                      <span className="slot-name">{slot.slot}</span>
                      <span className="slot-meta">
                        {new Date(slot.meta.timestamp).toLocaleDateString()} • {t('scenario.year')} {slot.meta.date.year}
                      </span>
                    </div>
                  </div>
                  <div className="slot-actions">
                    <button 
                      className="action-btn primary"
                      onClick={() => onLoad(slot.slot)}
                    >
                      {t('system_menu.load_button')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
