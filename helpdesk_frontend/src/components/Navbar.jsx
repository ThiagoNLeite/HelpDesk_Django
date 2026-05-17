import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useState } from 'react'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { path: '/chamados',  label: 'Chamados',  icon: '⊞' },
]

export default function Navbar() {
  const { perfil, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login')
  }

  const initials = perfil?.nome
    ? perfil.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || '?').toUpperCase()

  return (
    <nav style={{
      background: 'rgba(9,14,26,0.95)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0 1.5rem',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: '58px', gap: '2rem' }}>

        {/* Logo */}
        <Link to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, background: 'var(--cyan)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'var(--bg-void)', fontFamily: 'var(--font-mono)',
          }}>HD</div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Helpdesk <span style={{ color: 'var(--cyan)' }}>TI</span>
          </span>
        </Link>

        {/* Nav items */}
        <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path} style={{
                textDecoration: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--cyan)' : 'var(--text-secondary)',
                background: active ? 'var(--cyan-glow)' : 'transparent',
                border: active ? '1px solid rgba(0,201,255,0.2)' : '1px solid transparent',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                transition: 'all var(--transition)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* User area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <Link to="/chamados/novo" className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
            + Novo Chamado
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Link to="/perfil" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--border-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan)',
                fontFamily: 'var(--font-mono)',
              }}>{initials}</div>
              {perfil && (
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{perfil.nome.split(' ')[0]}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{perfil.cargo}</div>
                </div>
              )}
            </Link>

            <button onClick={handleLogout} disabled={loggingOut}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem', borderRadius: 4, transition: 'color var(--transition)' }}
              title="Sair"
            >⏻</button>
          </div>
        </div>
      </div>
    </nav>
  )
}
