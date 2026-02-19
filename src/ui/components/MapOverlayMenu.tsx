import './MapOverlayMenu.css';

interface MapOverlayMenuProps {
  onSelectOverlay: (overlayId: string | null) => void;
  activeOverlay: string | null;
  onClose: () => void;
}

export function MapOverlayMenu({ onSelectOverlay, activeOverlay, onClose }: MapOverlayMenuProps) {
  // const { t } = useTranslation();

  const overlays = [
    { id: 'pollution', label: 'Pollution', icon: '🏭', color: '#ff4757', desc: 'View air and water pollution levels' },
    { id: 'traffic', label: 'Traffic', icon: '🚦', color: '#ffa502', desc: 'View traffic congestion' },
    { id: 'land_value', label: 'Land Value', icon: '💰', color: '#2ed573', desc: 'Property prices and desirability' },
    { id: 'sales_volume', label: 'Sales Volume', icon: '🛒', color: '#1e90ff', desc: 'Retail activity heatmap' },
    { id: 'brand_awareness', label: 'Brand Power', icon: '⭐', color: '#a55eea', desc: 'Local brand recognition' }
  ];

  return (
    <div className="overlay-menu animate-slideUp">
      <div className="overlay-header">
        <h3>Map Layers</h3>
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
