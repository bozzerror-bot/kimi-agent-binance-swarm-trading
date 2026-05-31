import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Settings, ScrollText, BarChart3 } from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';

const navTabs = [
  { to: '/study', label: 'Study', icon: <BookOpen size={16} /> },
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { to: '/chart', label: 'Chart', icon: <BarChart3 size={16} /> },
  { to: '/logs', label: 'Logs', icon: <ScrollText size={16} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={16} /> },
];

export default function Navbar() {
  const location = useLocation();
  const [utcTime, setUtcTime] = useState('');
  const marketStudyComplete = useTradingStore((s) => s.marketStudyComplete);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().slice(11, 19) + ' UTC'
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.06)]"
      style={{
        backgroundColor: 'rgba(12, 12, 18, 0.85)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: Agent identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-8 h-8 rounded-full animate-breathe"
            style={{
              background: 'radial-gradient(circle at 40% 35%, rgba(47, 255, 107, 0.25) 0%, transparent 60%)',
              backgroundColor: '#0C0C12',
              boxShadow: '0 0 12px rgba(47, 255, 107, 0.15), inset 0 0 10px rgba(47, 255, 107, 0.05)',
            }}
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-profit animate-pulse" />
        </div>
        <span className="font-inter text-sm font-semibold text-white">Alex</span>
        <span
          className="text-[11px] font-semibold tracking-[0.04em] uppercase px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#13131F', color: '#2FA3FF' }}
        >
          TESTNET
        </span>
      </div>

      {/* Center: Navigation tabs */}
      <div className="flex items-center gap-1">
        {navTabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          const showBadge = tab.to === '/study' && !marketStudyComplete;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="relative px-4 py-2 font-inter text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
              style={{
                color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
              }}
            >
              {tab.icon}
              {tab.label}
              {showBadge && (
                <span
                  className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold animate-pulse"
                  style={{
                    backgroundColor: '#FF4444',
                    color: '#FFFFFF',
                  }}
                >
                  !
                </span>
              )}
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-profit rounded-full"
                  style={{
                    width: '60%',
                    animation: 'slideIn 0.3s ease forwards',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Right: UTC time + connection */}
      <div className="flex items-center gap-3">
        <span className="font-jetbrains text-sm text-text-muted">{utcTime}</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
          <span className="font-inter text-xs font-medium text-text-muted">Binance Testnet</span>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { width: 0; }
          to { width: 60%; }
        }
      `}</style>
    </nav>
  );
}
