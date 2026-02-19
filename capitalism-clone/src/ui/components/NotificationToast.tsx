
import React, { useEffect, useState } from 'react';

export interface GameNotification {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    timestamp: number;
}

export const NotificationToast: React.FC = () => {
    const [notifications, setNotifications] = useState<GameNotification[]>([]);

    useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent;
            const newNote: GameNotification = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: Date.now(),
                ...customEvent.detail
            };

            setNotifications(prev => [newNote, ...prev].slice(0, 5)); // Keep max 5

            // Auto-dismiss
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newNote.id));
            }, 5000);
        };

        window.addEventListener('game-notification', handler);
        return () => window.removeEventListener('game-notification', handler);
    }, []);

    if (notifications.length === 0) return null;

    return (
        <div className="notification-container" style={{
            position: 'fixed',
            bottom: '80px', // Above bottom toolbar
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none' // Click through
        }}>
            {notifications.map(note => (
                <div key={note.id} className={`notification-toast type-${note.type}`} style={{
                    background: 'rgba(20, 24, 32, 0.95)',
                    borderLeft: `4px solid ${getColorForType(note.type)}`,
                    padding: '12px 16px',
                    borderRadius: '4px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    minWidth: '300px',
                    maxWidth: '400px',
                    animation: 'slideIn 0.3s ease-out',
                    backdropFilter: 'blur(8px)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pointerEvents: 'auto'
                }}>
                    <span>{note.message}</span>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

function getColorForType(type: string): string {
    switch(type) {
        case 'success': return '#2ecc71';
        case 'warning': return '#f1c40f';
        case 'danger': return '#e74c3c';
        case 'info': default: return '#3498db';
    }
}
