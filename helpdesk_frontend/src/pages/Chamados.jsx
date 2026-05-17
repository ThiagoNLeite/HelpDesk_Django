import React from 'react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getChamados, updateChamadoStatus, deleteChamado } from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'

const STATUS_OPTIONS = ['Todos', 'Aberto', 'Em andamento', 'Fechado']

export default function Chamados() {
  const { perfil } = useAuth()
  const isTech = perfil?.cargo && ['Técnico de TI', 'Analista de Sistemas', 'Coordenador de TI', 'Administrador'].includes(perfil.cargo)

  const [chamados,  setChamados]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [aviso,     setAviso]     = useState('')
  const [filter,    setFilter]    = useState('Todos')
  const [search,    setSearch]    = useState('')
  const [updating,  setUpdating]  = useState(null) // id em atualização
  const [deleting,  setDeleting]  = useState(null)
  const [confirm,   setConfirm]   = useState(null) // id para confirmar exclusão

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await getChamados()
      setChamados(data.chamados || [])
      if (data.aviso) setAviso(data.aviso)
    } catch (err) {
      setError(err.message || 'Erro ao carregar chamados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleStatus = async (id, novoStatus) => {
    setUpdating(id)
    try {
      await updateChamadoStatus(id, novoStatus)
      setChamados(prev => prev.map(c =>
        c.id === id ? { ...c, status_atual: novoStatus } : c
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id); setConfirm(null)
    try {
      await deleteChamado(id)
      setChamados(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = chamados.filter(c => {
    const matchStatus = filter === 'Todos' || c.status_atual === filter
    const matchSearch = !search || c.titulo.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = {
    Todos: chamados.length,
    Aberto: chamados.filter(c => c.status_atual === 'Aberto').length,
    'Em andamento': chamados.filter(c => c.status_atual === 'Em andamento').length,
    Fechado: chamados.filter(c => c.status_atual === 'Fechado').length,
  }

  return (
    <div className="page-container animate-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Chamados Técnicos</h2>
          <p className="text-secondary" style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Lidos do banco de leitura (SQLite) · {chamados.length} registro(s)
          </p>
        </div>
        <Link to="/chamados/novo" className="btn btn-primary">+ Novo Chamado</Link>
      </div>

      {error  && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>⚠ {error}</div>}
      {aviso  && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>⚠ {aviso}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.25rem', gap: '0.15rem' }}>
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? 'var(--bg-elevated)' : 'transparent',
              border: filter === s ? '1px solid var(--border-glow)' : '1px solid transparent',
              color: filter === s ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '0.35rem 0.75rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              transition: 'all var(--transition)',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              {s}
              <span className="mono" style={{ fontSize: '0.7rem', color: filter === s ? 'var(--cyan)' : 'var(--text-muted)' }}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input className="form-input" type="text" placeholder="Buscar por título..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260, padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
        />

        <button onClick={load} className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
          ↻ Atualizar
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-center" style={{ padding: '3rem' }}>
            <span className="spinner" />
            <span className="text-muted mono">Consultando banco de leitura...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-center" style={{ flexDirection: 'column', gap: '0.5rem', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem' }}>📭</div>
            <div>Nenhum chamado encontrado</div>
            {filter !== 'Todos' && (
              <button onClick={() => setFilter('Todos')} className="btn btn-ghost" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Título</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Data</th>
                  {isTech && <th style={{ width: 200 }}>Ação</th>}
                  {isTech && <th style={{ width: 80 }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{c.id}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.titulo}
                      </div>
                    </td>
                    <td>
                      {c.categoria
                        ? <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--cyan)', background: 'var(--cyan-glow)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>{c.categoria}</span>
                        : <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>
                      }
                    </td>
                    <td><StatusBadge status={c.status_atual} /></td>
                    <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>

                    {isTech && (
                      <td>
                        {updating === c.id ? (
                          <span className="spinner" style={{ width: 16, height: 16 }} />
                        ) : (
                          <select
                            className="form-select"
                            value={c.status_atual}
                            onChange={e => handleStatus(c.id, e.target.value)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', width: 'auto' }}
                          >
                            <option value="Aberto">Aberto</option>
                            <option value="Em andamento">Em andamento</option>
                            <option value="Fechado">Fechado</option>
                          </select>
                        )}
                      </td>
                    )}

                    {isTech && (
                      <td>
                        {confirm === c.id ? (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button className="btn btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => handleDelete(c.id)} disabled={deleting === c.id}>
                              {deleting === c.id ? '...' : 'Sim'}
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => setConfirm(null)}>Não</button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--red)' }}
                            onClick={() => setConfirm(c.id)} title="Excluir">✕</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-muted mono" style={{ marginTop: '1rem', fontSize: '0.72rem' }}>
        Exibindo {filtered.length} de {chamados.length} chamados · Fonte: banco de leitura (SQLite)
        {aviso && ' · ⚠ modo fallback ativo'}
      </p>
    </div>
  )
}
