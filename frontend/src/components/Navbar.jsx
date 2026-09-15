import { NavLink } from 'react-router-dom'
import { ShoppingCart, BarChart3, Lightbulb, Bell, RotateCcw, Database } from 'lucide-react'
import { resetMockData } from '../api/mockData'

const links = [
  { to: '/pos',             label: 'POS',             Icon: ShoppingCart },
  { to: '/dashboard',       label: 'Dashboard',        Icon: BarChart3    },
  { to: '/recommendations', label: 'Recommendations',  Icon: Lightbulb    },
  { to: '/alerts',          label: 'Alerts',           Icon: Bell         },
]

export default function Navbar() {
  const handleReset = () => {
    if (window.confirm('Reset all mock inventory data, sales, and batches to defaults?')) {
      resetMockData()
      window.location.reload()
    }
  }

  return (
    <nav className="glass border-b border-surface-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-900/50">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-gradient leading-none">IntelliPOS</span>
              <span className="text-[10px] text-brand-400 font-medium tracking-wide">SMART INVENTORY</span>
            </div>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {links.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ` +
                  (isActive
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-surface-700')
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right Status Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
              <Database size={12} />
              <span>Standalone Mock Data</span>
            </div>

            <button
              onClick={handleReset}
              className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 text-gray-400 hover:text-gray-200"
              title="Reset mock database to initial state"
            >
              <RotateCcw size={12} />
              <span className="hidden md:inline">Reset Mock Data</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
