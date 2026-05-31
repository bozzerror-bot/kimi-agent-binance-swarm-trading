import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
export default function Layout() {
  return (<div className="min-h-screen bg-[#050507] text-white"><Navbar /><main className="pt-14 sm:pt-16"><Outlet /></main><footer className="text-center py-4 text-[10px] text-gray-700">Alex V7 — Binance Futures Testnet — SMC + Trend AI</footer></div>);
}
