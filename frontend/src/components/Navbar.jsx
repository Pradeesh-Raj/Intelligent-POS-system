import { NavLink } from 'react-router-dom'
import { ShoppingCart, BarChart3, Lightbulb, Bell } from 'lucide-react'

const links = [
  { to: '/pos',             label: 'POS',             Icon: ShoppingCart },
  { to: '/dashboard',       label: 'Dashboard',        Icon: BarChart3    },
  { to: '/recommendations', label: 'Recommendations',  Icon: Lightbulb    },
  { to: '/alerts',          label: 'Alerts',           Icon: Bell         },
]

export default function Navbar() {
  return (
    <nav className="glass border-b border-surface-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-900/50">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gradient">IntelliPOS</span>
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
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-surface-700')
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            Live • Updates every 60s
          </div>
        </div>
      </div>
    </nav>
  )
}
