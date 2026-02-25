import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles.css';
import './MainMenu.css';
import { LoadGameModal } from './LoadGameModal';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: (slotName: string) => void;
  onSettings: () => void;
  onExit: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  color: string;
}

export function MainMenu({ onNewGame, onLoadGame, onSettings, onExit }: MainMenuProps) {
  const { t, i18n } = useTranslation();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showLoadGame, setShowLoadGame] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);

  // Language toggle helper
  const toggleLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Helper function to convert hex to rgba
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  const createParticle = useCallback((x: number, y: number): Particle => {
    const colors = ['#e94560', '#70a1ff', '#00d9a5', '#ffa502', '#ffffff'];
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.5;
    
    return {
      id: Math.random(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.8 + 0.2,
      life: 0,
      maxLife: Math.random() * 150 + 100,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    for (let i = 0; i < 100; i++) {
      particlesRef.current.push(createParticle(
        Math.random() * canvas.width,
        Math.random() * canvas.height
      ));
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      
      // Create trail particles
      if (Math.random() > 0.8) {
        particlesRef.current.push(createParticle(e.clientX, e.clientY));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 15, 30, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.life++;
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Fade out
        const lifeRatio = particle.life / particle.maxLife;
        const currentOpacity = particle.opacity * (1 - lifeRatio);

        // Mouse interaction
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150) {
          const force = (150 - dist) / 150;
          particle.vx -= (dx / dist) * force * 0.5;
          particle.vy -= (dy / dist) * force * 0.5;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(particle.color, currentOpacity);
        ctx.fill();

        // Draw glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        );
        gradient.addColorStop(0, hexToRgba(particle.color, currentOpacity * 0.4));
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();

        return particle.life < particle.maxLife;
      });

      // Spawn new particles randomly
      if (particlesRef.current.length < 150 && Math.random() > 0.9) {
        particlesRef.current.push(createParticle(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        ));
      }

      // Draw connecting lines between nearby particles
      ctx.strokeStyle = 'rgba(233, 69, 96, 0.1)';
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const distance = Math.sqrt(
            Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
          );
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [createParticle]);

  return (
    <div className="main-menu">
      {/* Animated Background Canvas */}
      <canvas ref={canvasRef} className="particle-canvas" />
      
      {/* Gradient Overlay */}
      <div className="menu-background">
        <div className="gradient-overlay"></div>
        <div className="grid-pattern"></div>
      </div>

      {/* Language Switcher Overlay */}
      <div className="language-switcher">
        <button 
          className={i18n.language.startsWith('en') ? 'active' : ''} 
          onClick={() => toggleLanguage('en')}
        >
          EN
        </button>
        <button 
          className={i18n.language.startsWith('tr') ? 'active' : ''} 
          onClick={() => toggleLanguage('tr')}
        >
          TR
        </button>
      </div>

      {/* Main Content */}
      <div className="menu-content">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-icon animate-float">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* SVG Definitions */}
              <defs>
                <linearGradient id="logoGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e94560" />
                  <stop offset="100%" stopColor="#ff6b6b" />
                </linearGradient>
                <linearGradient id="logoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#70a1ff" />
                  <stop offset="100%" stopColor="#5352ed" />
                </linearGradient>
                <linearGradient id="logoGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d9a5" />
                  <stop offset="100%" stopColor="#2ed573" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="24" height="56" rx="4" fill="url(#logoGradient1)" />
              <rect x="36" y="20" width="24" height="40" rx="4" fill="url(#logoGradient2)" />
              <rect x="20" y="36" width="24" height="24" rx="4" fill="url(#logoGradient3)" />
            </svg>
          </div>
          <h1 className="game-title animate-glow">{t('app.title').toUpperCase()}</h1>
          <h2 className="game-subtitle">{t('app.subtitle')}</h2>
          <p className="game-tagline">{t('app.tagline')}</p>
        </div>

        {/* Menu Buttons */}
        <nav className="menu-nav">
          <MenuButton
            label={t('menu.new_game')}
            description={t('menu.new_game_desc')}
            icon="🚀"
            onClick={onNewGame}
            isHovered={hoveredButton === 'new'}
            onHover={() => setHoveredButton('new')}
            onLeave={() => setHoveredButton(null)}
          />
          
          <MenuButton
            label={t('menu.load_game')}
            description={t('menu.load_game_desc')}
            icon="💾"
            onClick={() => setShowLoadGame(true)}
            isHovered={hoveredButton === 'load'}
            onHover={() => setHoveredButton('load')}
            onLeave={() => setHoveredButton(null)}
          />
          
          <MenuButton
            label={t('menu.settings')}
            description={t('menu.settings_desc')}
            icon="⚙️"
            onClick={onSettings}
            isHovered={hoveredButton === 'settings'}
            onHover={() => setHoveredButton('settings')}
            onLeave={() => setHoveredButton(null)}
          />
          
          <MenuButton
            label={t('menu.exit')}
            description={t('menu.exit_desc')}
            icon="🚪"
            onClick={onExit}
            isHovered={hoveredButton === 'exit'}
            onHover={() => setHoveredButton('exit')}
            onLeave={() => setHoveredButton(null)}
            variant="secondary"
          />
        </nav>

        {/* Version Info */}
        <div className="version-info">
          <span>v1.0.0</span>
          <span className="divider">|</span>
          <span>BTO Edition</span>
          <span className="divider">|</span>
          <span>ECS Architecture</span>
          <span className="divider">|</span>
          <span>Open i18n Sync</span>
        </div>
      </div>
      
      {showLoadGame && (
        <LoadGameModal 
          onLoad={(slotName) => {
            setShowLoadGame(false);
            onLoadGame(slotName);
          }}
          onClose={() => setShowLoadGame(false)} 
        />
      )}
    </div>
  );
}

interface MenuButtonProps {
  label: string;
  description: string;
  icon: string;
  onClick: () => void;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  variant?: 'primary' | 'secondary';
}

function MenuButton({ 
  label, 
  description, 
  icon, 
  onClick, 
  isHovered, 
  onHover, 
  onLeave,
  variant = 'primary' 
}: MenuButtonProps) {
  return (
    <button
      className={`menu-button ${variant} ${isHovered ? 'hovered' : ''}`}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="button-shine"></div>
      <span className="button-icon">{icon}</span>
      <div className="button-content">
        <span className="button-label">{label}</span>
        <span className="button-description">{description}</span>
      </div>
      <div className="button-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}
