import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './BottomToolbar.css';

interface BottomToolbarProps {
  onBuildMenu: () => void;
  onManagement: () => void;
  onMapOverlay: () => void;
  onWorldMap: () => void;
}

export function BottomToolbar({ 
  onBuildMenu, 
  onManagement, 
  onMapOverlay, 
  onWorldMap 
}: BottomToolbarProps) {
  const { t } = useTranslation();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menuItems = [
    {
      id: 'build',
      icon: '🏗️',
      label: t('menu.build'),
      description: t('menu.build_desc'),
      color: '#00d9a5',
      shortcut: 'B',
      onClick: onBuildMenu,
    },
    {
      id: 'manage',
      icon: '📊',
      label: t('menu.dashboard'),
      description: t('menu.manage_desc'),
      color: '#70a1ff',
      shortcut: 'P',
      onClick: onManagement,
    },
    {
      id: 'overlays',
      icon: '🗺️',
      label: t('menu.overlays'),
      description: t('menu.overlays_desc'),
      color: '#ffa502',
      shortcut: 'M',
      onClick: onMapOverlay,
    },
    {
      id: 'world',
      icon: '🌍',
      label: t('menu.world'),
      description: t('menu.world_desc'),
      color: '#e94560',
      shortcut: 'W',
      onClick: onWorldMap,
    },
  ];

  return (
    <div className="bottom-toolbar">
      <div className="toolbar-glass">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`toolbar-btn ${activeMenu === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu(item.id);
              item.onClick();
            }}
            style={{ '--btn-color': item.color } as React.CSSProperties}
          >
            <div className="btn-icon-wrapper">
              <span className="btn-icon">{item.icon}</span>
              <div className="btn-glow" style={{ background: item.color }}></div>
            </div>
            <div className="btn-content">
              <span className="btn-label">{item.label}</span>
              <span className="btn-desc">{item.description}</span>
            </div>
            <span className="btn-shortcut">{item.shortcut}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
