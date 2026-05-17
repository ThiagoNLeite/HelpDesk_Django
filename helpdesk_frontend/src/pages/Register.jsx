import React from 'react'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { registerUser } from '../api'

const CARGOS = ['Usuário', 'Técnico de TI', 'Analista de Sistemas', 'Coordenador de TI', 'Administrador']

export default function Register() {
  const { signup, login } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]   = useState(1) // 1 = conta Firebase, 2 = perfil SQL Server
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [nome,     setNome]     = useState('')
  const [cargo,    setCargo]    = useState('Usuário')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Etapa 1: criar conta no Firebase
  const handleStep1 = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)  { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    try {
      await signup(email, password)
      setStep(2)
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Este e-mail já está cadastrado.'
                : err.code === 'auth/invalid-email'        ? 'E-mail inválido.'
                : 'Erro ao criar conta. Tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Etapa 2: salvar perfil no SQL Server via Django
  const handleStep2 = async (e) => {
    e.preventDefault()
    setError('')
    if (!nome.trim()) { setError('O nome é obrigatório.'); return }
    setLoading(true)
    try {
      await registerUser(nome.trim(), cargo)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Erro ao salvar perfil. O token pode ainda estar sendo processado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{
        position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(0,201,255,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-in" style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52, background: 'var(--bg-elevated)',
            border: '2px solid var(--border-glow)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--cyan)',
          }}>HD</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>
            {step === 1 ? 'Criar conta' : 'Completar perfil'}
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            {step === 1 ? 'Etapa 1 de 2 — Autenticação Firebase' : 'Etapa 2 de 2 — Registro no sistema'}
          </p>

          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? 28 : 10, height: 6, borderRadius: 3,
                background: s <= step ? 'var(--cyan)' : 'var(--border)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>

          {step === 1 && (
            <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="usuario@instituicao.edu.br"
                  value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>

              <div className="form-group">
                <label className="form-label">Senha</label>
                <input className="form-input" type="password" placeholder="Mínimo 6 caracteres"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar senha</label>
                <input className="form-input" type="password" placeholder="Repita a senha"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Criando conta...</> : 'Criar conta →'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="alert alert-success" style={{ marginBottom: 0 }}>
                ✓ Conta Firebase criada! Agora complete seu perfil.
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-input" type="text" placeholder="João da Silva"
                  value={nome} onChange={e => setNome(e.target.value)} required autoFocus />
              </div>

              <div className="form-group">
                <label className="form-label">Cargo / Função</label>
                <select className="form-select" value={cargo} onChange={e => setCargo(e.target.value)}>
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="alert alert-info" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                ℹ Este perfil será salvo no banco transacional (SQL Server) e sincronizado com o banco de leitura.
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Salvando...</> : 'Concluir cadastro'}
              </button>
            </form>
          )}

          <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
              Já tem conta?{' '}
              <Link to="/login" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 500 }}>
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
