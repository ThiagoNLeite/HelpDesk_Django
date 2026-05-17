import React from 'react'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.'
                : err.code === 'auth/user-not-found'     ? 'Usuário não encontrado.'
                : err.code === 'auth/too-many-requests'  ? 'Muitas tentativas. Tente novamente mais tarde.'
                : 'Erro ao entrar. Verifique suas credenciais.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>

      {/* Glow radial behind the card */}
      <div style={{
        position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(0,201,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-in" style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, var(--cyan), var(--cyan-dim))',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem',
            color: 'var(--bg-void)',
            boxShadow: '0 0 30px rgba(0,201,255,0.3)',
          }}>HD</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>Bem-vindo de volta</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            Sistema de Auditoria de TI — Helpdesk Analítico
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">E-mail institucional</label>
              <input
                className="form-input"
                type="email"
                placeholder="usuario@instituicao.edu.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Entrando...</> : 'Entrar no sistema'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
              Não tem conta?{' '}
              <Link to="/register" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 500 }}>
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-muted mono" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.72rem' }}>
          Autenticação via Firebase · Dados no SQL Server
        </p>
      </div>
    </div>
  )
}
