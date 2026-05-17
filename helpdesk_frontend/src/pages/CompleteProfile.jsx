import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { registerUser } from '../api'

const CARGOS = ['Usuário', 'Técnico de TI', 'Analista de Sistemas', 'Coordenador de TI', 'Administrador']

export default function CompleteProfile() {
  const { perfil, refreshPerfil, user } = useAuth()
  const navigate = useNavigate()

  const [nome,    setNome]    = useState(perfil?.nome  || '')
  const [cargo,   setCargo]   = useState(perfil?.cargo || 'Usuário')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!nome.trim()) { setError('O nome é obrigatório.'); return }
    setLoading(true)
    try {
      await registerUser(nome.trim(), cargo)
      await refreshPerfil()
      setSuccess('Perfil atualizado com sucesso!')
    } catch (err) {
      setError(err.message || 'Erro ao salvar perfil.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2>Configurações de Perfil</h2>
          <p className="text-secondary" style={{ marginTop: '0.35rem', fontSize: '0.875rem' }}>
            {user?.email}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="form-group">
              <label className="form-label">Nome completo</label>
              <input className="form-input" type="text" placeholder="Seu nome"
                value={nome} onChange={e => setNome(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Cargo / Função</label>
              <select className="form-select" value={cargo} onChange={e => setCargo(e.target.value)}>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                ← Voltar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ flex: 1, justifyContent: 'center' }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Salvando...</> : 'Salvar perfil'}
              </button>
            </div>
          </form>
        </div>

        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          ℹ Os dados de perfil são armazenados no banco transacional (SQL Server) e sincronizados automaticamente com o banco de leitura (SQLite).
        </div>
      </div>
    </div>
  )
}
