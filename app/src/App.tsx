import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import StudyMarket from './pages/StudyMarket';
import ChartVisualizer from './pages/ChartVisualizer';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import { useBinancePrices } from './hooks/useBinancePrices';
import { useTradingEngine } from './hooks/useTradingEngine';
function Engine() { useBinancePrices(); useTradingEngine(); return null; }
export default function App() {
  return (<><Engine /><Routes><Route element={<Layout />}><Route path="/" element={<Dashboard />} /><Route path="/study" element={<StudyMarket />} /><Route path="/chart" element={<ChartVisualizer />} /><Route path="/logs" element={<Logs />} /><Route path="/settings" element={<Settings />} /></Route></Routes></>);
}
