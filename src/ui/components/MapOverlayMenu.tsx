import { useTranslation } from 'react-i18next';
import './MapOverlayMenu.css';

interface MapOverlayMenuProps {
  onSelectOverlay: (overlayId: string | null) => void;
  activeOverlay: string | null;
  onClose: () => void;
}

export function MapOverlayMenu({ onSelectOverlay, activeOverlay, onClose }: MapOverlayMenuProps) {
  const { t } = useTranslation();

  const overlays = [
    { id: 'pollution', label: t('overlays.pollution'), icon: '🏭', color: '#ff4757', desc: t('overlays.pollution_desc') },
    { id: 'traffic', label: t('overlays.traffic'), icon: '🚦', color: '#ffa502', desc: t('overlays.traffic_desc') },
    { id: 'land_value', label: t('overlays.land_value'), icon: '💰', color: '#2ed573', desc: t('overlays.land_value_desc') },
    { id: 'sales_volume', label: t('overlays.sales_volume'), icon: '🛒', color: '#1e90ff', desc: t('overlays.sales_volume_desc') },
    { id: 'brand_awareness', label: t('overlays.brand_power'), icon: '⭐', color: '#a55eea', desc: t('overlays.brand_power_desc') }
  ];

  return (
    <div className="overlay-menu animate-slideUp">
      <div className="overlay-header">
        <h3>{t('overlays.title')}</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="overlay-grid">
        {overlays.map(item => (
          <button
            key={item.id}
            className={`overlay-card ${activeOverlay === item.id ? 'active' : ''}`}
            onClick={() => onSelectOverlay(activeOverlay === item.id ? null : item.id)}
            style={{ '--overlay-color': item.color } as React.CSSProperties}
          >
            <div className="overlay-icon-wrapper">
              <span className="overlay-icon">{item.icon}</span>
            </div>
            <div className="overlay-info">
              <span className="overlay-label">{item.label}</span>
              <span className="overlay-desc">{item.desc}</span>
            </div>
            {activeOverlay === item.id && <div className="active-indicator"></div>}
          </button>
        ))}
      </div>
    </div>
  );
}
