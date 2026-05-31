import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import StudyMarket from './pages/StudyMarket'
import Settings from './pages/Settings'
import Logs from './pages/Logs'
import ChartVisualizer from './pages/ChartVisualizer'
import { useBinancePrices } from './hooks/useBinancePrices'

function AppInner() {
  useBinancePrices();
  return null;
}

export default function App() {
  return (
    <>
      <AppInner />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/study" element={<StudyMarket />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/chart" element={<ChartVisualizer />} />
        </Routes>
      </Layout>
    </>
  )
}
