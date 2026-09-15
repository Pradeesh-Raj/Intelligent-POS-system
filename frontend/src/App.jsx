import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import POS from './pages/POS'
import Dashboard from './pages/Dashboard'
import Recommendations from './pages/Recommendations'
import Alerts from './pages/Alerts'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Routes>
          <Route path="/"                 element={<Navigate to="/pos" replace />} />
          <Route path="/pos"              element={<POS />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/recommendations"  element={<Recommendations />} />
          <Route path="/alerts"           element={<Alerts />} />
        </Routes>
      </main>
    </div>
  )
}
