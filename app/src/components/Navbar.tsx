import { Link, useLocation } from 'react-router-dom';
import { BookOpen, LayoutDashboard, BarChart3, ScrollText, Settings } from 'lucide-react';
import { useAlexStore } from '@/store/useAlexStore';
export default function Navbar() {
  const path = useLocation().pathname;
  const { settings, mood, positions, isRunning, marketStudyComplete } = useAlexStore();
  const open = positions.filter(p => p.status === 'open').length;
  const links = [
    { to: '/study', label: 'Study', icon: <BookOpen size={14} /> },
    { to: '/', label: 'Dash', icon: <LayoutDashboard size={14} /> },
    { to: '/chart', label: 'Chart', icon: <BarChart3 size={14} /> },
    { to: '/logs', label: 'Logs', icon: <ScrollText size={14} />, badge: open },
    { to: '/settings', label: 'Settings', icon: <Settings size={14} /> },
  ];
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] sm:text-xs shadow-[0_0_15px_rgba(34,197,94,0.3)]">{mood === 'sharp' ? '⚡' : mood === 'focused' ? '🎯' : mood === 'confident' ? '💪' : '🤖'}</div>
          <span className="text-white font-semibold text-xs sm:text-sm">{settings.name}</span>
          <span className="text-[8px] sm:text-[9px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded hidden xs:inline">FUTURES</span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {links.map(l => (
            <Link key={l.to} to={l.to} className={`relative flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${path === l.to ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {l.icon}<span className="hidden sm:inline">{l.label}</span>
              {l.to === '/study' && !marketStudyComplete && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] text-white font-bold flex items-center justify-center animate-pulse">!</span>}
              {l.badge !== undefined && l.badge > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-[8px] text-black font-bold flex items-center justify-center">{l.badge}</span>}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'animate-pulse bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-[9px] sm:text-[10px] font-mono text-gray-500 hidden sm:inline">{isRunning ? 'Active' : 'Off'}</span>
        </div>
      </div>
    </nav>
  );
}
