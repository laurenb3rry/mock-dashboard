import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, TableProperties } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import TradingDay from './pages/TradingDay'
import Tables from './pages/Tables'

const NAV_ITEMS = [
  { to: '/',            end: true,  icon: LayoutDashboard,  label: 'Dashboard'       },
  { to: '/trading-day', end: false, icon: TrendingUp,        label: 'Trading Day'     },
  { to: '/tables',      end: false, icon: TableProperties,   label: 'Signal Results'  },
]

function NavItem({ to, end, icon: Icon, label }: { to: string; end: boolean; icon: any; label: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <NavLink
        to={to}
        end={end}
        style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 10,
          marginBottom: 4,
          color: isActive ? '#00d4aa' : 'rgba(255,255,255,0.35)',
          backgroundColor: isActive ? 'rgba(0,212,170,0.1)' : 'transparent',
          transition: 'all 0.15s',
          textDecoration: 'none',
        })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Icon size={20} strokeWidth={1.8} />
      </NavLink>

      {hovered && (
        <div style={{
          position: 'absolute',
          left: 52,
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: '#16161f',
          color: '#fff',
          fontSize: 12,
          padding: '6px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          {label}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg)', overflow: 'hidden' }}>

        {/* Sidebar */}
        <nav style={{
          width: 64,
          backgroundColor: '#0a0a0f',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
          flexShrink: 0,
        }}>
          {/* Logo mark */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: '#00d4aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0a0a0f', lineHeight: 1 }}>$</span>
          </div>

          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 48px 48px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trading-day" element={<TradingDay />} />
              <Route path="/tables" element={<Tables />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
