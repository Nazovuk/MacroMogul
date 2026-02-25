import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface GameNotification {
    id: string;
    title?: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    timestamp: number;
}

export const NotificationToast: React.FC = () => {
    const { t } = useTranslation();
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
            bottom: '100px',
            right: '25px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            {notifications.map(note => (
                <div key={note.id} className={`notification-toast type-${note.type}`} style={{
                    background: 'linear-gradient(135deg, rgba(26, 31, 46, 0.95), rgba(18, 22, 33, 0.98))',
                    borderLeft: `4px solid ${getColorForType(note.type)}`,
                    padding: '16px 20px',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                    minWidth: '320px',
                    maxWidth: '450px',
                    animation: 'notificationSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    backdropFilter: 'blur(12px)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    pointerEvents: 'auto',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {note.title && (
                        <div style={{
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 700,
                            color: getColorForType(note.type),
                            opacity: 0.9
                        }}>
                            {note.title}
                        </div>
                    )}
                    <div style={{
                        fontSize: '14px',
                        lineHeight: '1.5',
                        fontWeight: 400,
                        color: 'rgba(255, 255, 255, 0.95)'
                    }}>
                        {(() => {
                            if (!note.message) return '';
                            if (note.message.includes('|')) {
                                const [key, paramsStr] = note.message.split('|');
                                try {
                                    const params = JSON.parse(paramsStr);
                                    return t(key, params) as string;
                                } catch (e) {
                                    return t(key) as string;
                                }
                            }
                            return t(note.message) as string;
                        })()}
                    </div>
                </div>
            ))}
            <style>{`
                @keyframes notificationSlideIn {
                    from { transform: translateX(120%); opacity: 0; filter: blur(10px); }
                    to { transform: translateX(0); opacity: 1; filter: blur(0); }
                }
                .notification-toast::after {
                    content: "";
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 2px;
                    background: currentColor;
                    opacity: 0.3;
                    width: 100%;
                    animation: lifeSpan 5s linear forwards;
                }
                @keyframes lifeSpan {
                    from { width: 100%; }
                    to { width: 0%; }
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
