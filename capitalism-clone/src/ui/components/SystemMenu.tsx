
import { useState, useEffect } from 'react';
import './SystemMenu.css';

interface SystemMenuProps {
  onCheckSaveSlots: () => any[]; // Returns list of saves
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

  const renderMain = () => (
      <div className="menu-options">
          <button onClick={() => setActiveTab('save')}>SAVE GAME</button>
          <button onClick={() => setActiveTab('load')}>LOAD GAME</button>
          <button onClick={() => window.open('https://github.com/nazov/macromogul', '_blank')}>GITHUB / HELP</button>
          <div className="divider"></div>
          <button className="resume-btn" onClick={onResume}>RESUME GAME</button>
          <button className="danger-btn" onClick={onExit}>EXIT TO MAIN MENU</button>
      </div>
  );

  const renderSaveLoad = (mode: 'save' | 'load') => (
      <div className="save-load-panel">
          <div className="panel-header">
              <button className="back-btn" onClick={() => setActiveTab('main')}>← BACK</button>
              <h3>{mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'}</h3>
          </div>
          
          <div className="slots-list">
              {mode === 'save' && (
                  <div className="new-save-row">
                      <input 
                        type="text" 
                        placeholder="New Save Name..." 
                        value={newSaveName}
                        onChange={(e) => setNewSaveName(e.target.value)}
                      />
                      <button onClick={handleSave} disabled={!newSaveName}>SAVE</button>
                  </div>
              )}
              
              {slots.length === 0 && <div className="no-saves">No saves found.</div>}

              {slots.map((slot: any) => (
                  <div key={slot.slot} className="slot-item">
                      <div className="slot-info">
                          <span className="slot-name">{slot.slot}</span>
                          <span className="slot-date">
                             {new Date(slot.meta.timestamp).toLocaleString()} • Year {slot.meta.date.year}
                          </span>
                      </div>
                      <div className="slot-actions">
                          {mode === 'save' && (
                              <button onClick={() => onSave(slot.slot)}>OVERWRITE</button>
                          )}
                          {mode === 'load' && (
                              <button onClick={() => onLoad(slot.slot)}>LOAD</button>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="system-menu-overlay">
        <div className="system-menu-container">
            <h2 className="menu-title">SYSTEM MENU</h2>
            {activeTab === 'main' && renderMain()}
            {(activeTab === 'save' || activeTab === 'load') && renderSaveLoad(activeTab)}
        </div>
    </div>
  );
}
