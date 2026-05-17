import React from 'react'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createChamado } from '../api'
import { useAuth } from '../AuthContext'

const CATEGORIAS = [
  'Hardware',
  'Software',
  'Rede / Conectividade',
  'Acesso / Permissão',
  'Email / Comunicação',
  'Impressora / Periféricos',
  'Backup / Dados',
  'Segurança',
  'Outro',
]

const PRIORIDADE_INFO = {
  baixa:  { color: 'var(--green)',  label: 'Baixa',  desc: 'Pode aguardar atendimento regular' },
  media:  { color: 'var(--yellow)', label: 'Média',  desc: 'Impacta produtividade, mas tem contorno' },
  alta:   { color: 'var(--red)',    label: 'Alta',   desc: 'Impacta operações críticas' },
}

export default function NovoChamado() {
  const { perfil } = useAuth()
  const navigate   = useNavigate()

  const [titulo,     setTitulo]     = useState('')
  const [descricao,  setDescricao]  = useState('')
  const [categoria,  setCategoria]  = useState('Hardware')
  const [prioridade, setPrioridade] = useState('media')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!perfil) {
      setError('Você precisa completar seu perfil antes de abrir chamados. Vá em Configurações.')
      return
    }
    if (!titulo.trim())    { setError('O título é obrigatório.'); return }
    if (!descricao.trim()) { setError('A descrição é obrigatória.'); return }
    if (titulo.length > 150) { setError('Título muito longo (máx. 150 caracteres).'); return }

    setLoading(true)
    try {
      const tituloFinal = prioridade === 'alta' ? `[URGENTE] ${titulo}` : titulo
      await createChamado(tituloFinal.trim(), descricao.trim(), categoria)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Erro ao criar chamado. Verifique se seu perfil está registrado.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="page-container animate-in">
      <div style={{ maxWidth: 500, margin: '4rem auto', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64,
          background: 'rgba(0,204,132,0.1)', border: '2px solid var(--green)',
          borderRadius: '50%', margin: '0 auto 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.75rem',
        }}>✓</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Chamado aberto!</h2>
        <p className="text-secondary" style={{ marginBottom: '0.75rem' }}>
          Seu chamado foi registrado no banco transacional (SQL Server) e será sincronizado com o banco de leitura automaticamente.
        </p>
        <div className="alert alert-info" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          ℹ O mecanismo de signal do Django já disparou a sincronização para o SQLite.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link to="/chamados" className="btn btn-primary">Ver chamados</Link>
          <button className="btn btn-ghost" onClick={() => { setSuccess(false); setTitulo(''); setDescricao(''); setPrioridade('media') }}>
            Abrir outro
          </button>
        </div>
      </div>
    </div>
  )

  const pInfo = PRIORIDADE_INFO[prioridade]

  return (
    <div className="page-container animate-in">
      <div style={{ maxWidth: 680 }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/chamados" className="btn btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            ← Voltar
          </Link>
          <div>
            <h2>Abrir Novo Chamado</h2>
            <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
              Será gravado no SQL Server e sincronizado com o SQLite via signal
            </p>
          </div>
        </div>

        {!perfil && (
          <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
            ⚠ Seu perfil não está registrado no sistema. <Link to="/perfil" style={{ color: 'var(--yellow)', fontWeight: 600 }}>Complete aqui</Link> antes de abrir chamados.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>

            {/* Main card */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Informações do chamado</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label className="form-label">Título do chamado <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input className="form-input" type="text"
                    placeholder="Ex: Impressora da sala 203 não responde"
                    value={titulo} onChange={e => setTitulo(e.target.value)}
                    maxLength={150} required autoFocus
                  />
                  <div className="mono" style={{ fontSize: '0.7rem', color: titulo.length > 120 ? 'var(--yellow)' : 'var(--text-muted)', textAlign: 'right' }}>
                    {titulo.length}/150
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição detalhada <span style={{ color: 'var(--red)' }}>*</span></label>
                  <textarea className="form-textarea"
                    placeholder="Descreva o problema com o máximo de detalhes possível. Inclua mensagens de erro, passos para reproduzir, horário que começou, etc."
                    value={descricao} onChange={e => setDescricao(e.target.value)}
                    maxLength={255} required rows={5}
                  />
                  <div className="mono" style={{ fontSize: '0.7rem', color: descricao.length > 220 ? 'var(--yellow)' : 'var(--text-muted)', textAlign: 'right' }}>
                    {descricao.length}/255
                  </div>
                </div>
              </div>
            </div>

            {/* Categoria & Prioridade */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Classificação</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select className="form-select" value={categoria} onChange={e => setCategoria(e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Prioridade</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {Object.entries(PRIORIDADE_INFO).map(([key, info]) => (
                      <button key={key} type="button" onClick={() => setPrioridade(key)} style={{
                        flex: 1, padding: '0.55rem 0.5rem',
                        borderRadius: 'var(--radius-md)',
                        border: prioridade === key ? `2px solid ${info.color}` : '1px solid var(--border)',
                        background: prioridade === key ? `${info.color}15` : 'var(--bg-elevated)',
                        color: prioridade === key ? info.color : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                        fontFamily: 'var(--font-ui)', transition: 'all var(--transition)',
                      }}>
                        {info.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    {pInfo.desc}
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div style={{
                marginTop: '1rem', padding: '0.75rem 1rem',
                background: 'var(--bg-void)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}>
                <p className="text-muted" style={{ fontSize: '0.72rem', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview do chamado</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-aberto">Aberto</span>
                  {categoria && (
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--cyan)', background: 'var(--cyan-glow)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                      {categoria}
                    </span>
                  )}
                  {prioridade === 'alta' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600 }}>⚡ URGENTE</span>
                  )}
                  <span className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                    {titulo || 'Título do chamado...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Solicitante */}
            {perfil && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Solicitante</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--bg-elevated)', border: '2px solid var(--border-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)', fontSize: '0.8rem',
                  }}>
                    {perfil.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{perfil.nome}</div>
                    <div className="mono text-muted" style={{ fontSize: '0.75rem' }}>{perfil.cargo}</div>
                  </div>
                  <div className="mono text-muted" style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>
                    id_firebase: {perfil.id_firebase?.slice(0, 12)}...
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/chamados" className="btn btn-ghost" style={{ flex: '0 0 auto' }}>Cancelar</Link>
              <button type="submit" className="btn btn-primary" disabled={loading || !perfil}
                style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}>
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Abrindo chamado...</>
                  : '↗ Abrir chamado'
                }
              </button>
            </div>

            <p className="mono text-muted" style={{ fontSize: '0.72rem', textAlign: 'center' }}>
              Dados gravados no SQL Server (Banco 2) e sincronizados via signal para o SQLite (Banco 3)
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
