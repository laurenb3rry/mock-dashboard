import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TradingDay from './pages/TradingDay'
import Tables from './pages/Tables'

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="6" height="6" rx="1.5" />
      <rect x="9" y="0" width="6" height="6" rx="1.5" />
      <rect x="0" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="13" height="13" rx="2" />
      <line x1="1" y1="5.5" x2="14" y2="5.5" />
      <line x1="1" y1="9.5" x2="14" y2="9.5" />
      <line x1="5.5" y1="5.5" x2="5.5" y2="14" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="1,12 5,7 8,9 12,4 14,2" />
      <line x1="1" y1="14" x2="14" y2="14" />
    </svg>
  )
}

function NavItem({ to, end, icon, label }: { to: string; end?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '8px',
        marginBottom: '2px',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--text)' : 'var(--muted)',
        backgroundColor: isActive ? 'var(--accent-dim)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.15s',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
      })}
    >
      {icon}
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg)', overflow: 'hidden' }}>

        {/* Sidebar */}
        <nav style={{
          width: '196px',
          backgroundColor: '#0b0e18',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 12px',
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 10px', marginBottom: '36px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
              Trading Dashboard
            </p>
          </div>

          <NavItem to="/" end icon={<GridIcon />} label="Dashboard" />
          <NavItem to="/trading-day" icon={<ChartIcon />} label="Trading Day" />
          <NavItem to="/tables" icon={<TableIcon />} label="Tables" />
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trading-day" element={<TradingDay />} />
            <Route path="/tables" element={<Tables />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
