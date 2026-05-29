import React from 'react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '../api'
import { useAuth } from '../AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

const COLORS_PIE  = ['#FF4757', '#FFB800', '#00CC84']
const COLORS_CAT  = ['#00C9FF', '#7C5CFF', '#FF6B9D', '#00CC84', '#FFB800', '#FF4757']

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0D1526', border: '1px solid #1C2E4A',
    borderRadius: 8, fontFamily: "'Sora', sans-serif", fontSize: 12,
  },
  labelStyle: { color: '#7A95B8' },
  itemStyle: { color: '#E8F0FE' },
}

function StatCard({ value, label, color, icon, sub }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 0.75rem', fontSize: '1.1rem',
      }}>{icon}</div>
      <div className="stat-number" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-muted mono" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>{sub}</div>}
    </div>
  )
}

function CustomTooltipBar({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0D1526', border: '1px solid #1C2E4A', borderRadius: 8, padding: '0.6rem 0.9rem' }}>
      <p style={{ color: '#7A95B8', fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#00C9FF', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{payload[0].value} chamado(s)</p>
    </div>
  )
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="loading-center" style={{ minHeight: '60vh' }}>
      <span className="spinner" />
      <span className="text-muted mono">Carregando dados do banco de leitura...</span>
    </div>
  )

  // Banco de leitura (SQLite) fora do ar: mensagem simples, painel zerado.
  // Decisão de projeto: o dashboard NÃO faz fallback para o SQL Server.
  if (error || !stats) return (
    <div className="page-container animate-in">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: '1rem' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--red, #FF4757)18', border: '1px solid #FF475740',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem',
        }}>⚠</div>
        <h1 style={{ marginBottom: 0 }}>Painel indisponível</h1>
        <p className="text-secondary" style={{ maxWidth: 460, fontSize: '0.9rem' }}>
          O banco de leitura (SQLite) está fora do ar, então o painel analítico
          não pode ser exibido no momento. As demais funções do sistema continuam
          operando normalmente.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          ↻ Tentar novamente
        </button>
      </div>
    </div>
  )

  const pieData = stats ? [
    { name: 'Aberto',        value: stats.abertos },
    { name: 'Em andamento',  value: stats.em_andamento },
    { name: 'Fechado',       value: stats.fechados },
  ].filter(d => d.value > 0) : []

  const taxa = stats?.total > 0
    ? Math.round((stats.fechados / stats.total) * 100)
    : 0

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="page-container animate-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>
            {saudacao}{perfil ? `, ${perfil.nome.split(' ')[0]}` : ''}
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            Painel Analítico · Dados em tempo real do banco de leitura
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {stats?.aviso && (
            <div className="badge badge-andamento" style={{ padding: '0.35rem 0.75rem' }}>
              ⚠ Fallback ativo
            </div>
          )}
          <div className="mono text-muted" style={{ fontSize: '0.72rem', textAlign: 'right', lineHeight: 1.5 }}>
            <div>Fonte: {stats?.fonte || '—'}</div>
            <div>{new Date().toLocaleString('pt-BR')}</div>
          </div>
          <Link to="/chamados/novo" className="btn btn-primary">+ Novo Chamado</Link>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>⚠ {error}</div>}
      {stats?.aviso && <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>⚠ {stats.aviso}</div>}

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <StatCard value={stats?.total ?? '—'}        label="Total de Chamados"   color="var(--cyan)"   icon="📋" sub="todos os registros" />
        <StatCard value={stats?.abertos ?? '—'}       label="Em Aberto"           color="var(--red)"    icon="🔴" sub="aguardando atendimento" />
        <StatCard value={stats?.em_andamento ?? '—'}  label="Em Andamento"        color="var(--yellow)" icon="⚡" sub="em atendimento" />
        <StatCard value={stats?.fechados ?? '—'}      label="Resolvidos"          color="var(--green)"  icon="✓"  sub={`${taxa}% de resolução`} />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Pie chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Distribuição por status</span>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3} stroke="none">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-center" style={{ height: 220, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sem dados
            </div>
          )}
        </div>

        {/* Line chart - últimos 7 dias */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Chamados — últimos 7 dias</span>
            <span className="badge badge-fechado" style={{ fontSize: '0.65rem' }}>Banco de Leitura</span>
          </div>
          {stats?.ultimos_7_dias?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.ultimos_7_dias} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="data"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  tickFormatter={d => d.slice(5)}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltipBar />} />
                <Line type="monotone" dataKey="total" stroke="var(--cyan)" strokeWidth={2}
                  dot={{ fill: 'var(--cyan)', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'var(--cyan)', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-center" style={{ height: 220, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sem dados dos últimos 7 dias
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem' }}>

        {/* Bar chart - por categoria */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Chamados por categoria</span>
          </div>
          {stats?.por_categoria?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.por_categoria} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                <XAxis dataKey="categoria"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltipBar />} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {stats.por_categoria.map((_, i) => (
                    <Cell key={i} fill={COLORS_CAT[i % COLORS_CAT.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-center" style={{ height: 220, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Abra chamados com categorias para ver este gráfico
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ações rápidas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { to: '/chamados/novo', label: 'Abrir novo chamado',         icon: '✚', color: 'var(--cyan)' },
              { to: '/chamados',      label: 'Ver todos os chamados',       icon: '≡', color: 'var(--text-secondary)' },
              { to: '/perfil',        label: 'Editar meu perfil',           icon: '◉', color: 'var(--text-secondary)' },
            ].map(item => (
              <Link key={item.to} to={item.to} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                textDecoration: 'none', color: 'var(--text-secondary)',
                transition: 'all var(--transition)', fontSize: '0.875rem',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-glow)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <span style={{ color: item.color, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            {/* Architecture info */}
            <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <p className="text-muted mono" style={{ fontSize: '0.7rem', lineHeight: 1.6 }}>
                <span className="text-cyan">●</span> Firebase Auth<br />
                <span style={{ color: 'var(--yellow)' }}>●</span> SQL Server (escrita)<br />
                <span style={{ color: 'var(--green)' }}>●</span> SQLite (leitura/DW)
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
