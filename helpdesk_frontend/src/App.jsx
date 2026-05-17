import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Chamados from './pages/Chamados'
import NovoChamado from './pages/NovoChamado'
import CompleteProfile from './pages/CompleteProfile'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-center" style={{ minHeight: '100vh' }}>
      <span className="spinner" />
      <span className="text-muted mono">Verificando autenticação...</span>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  const { user } = useAuth()

  return (
    <div style={{ minHeight: '100vh' }}>
      {user && <Navbar />}
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/chamados"      element={<ProtectedRoute><Chamados /></ProtectedRoute>} />
        <Route path="/chamados/novo" element={<ProtectedRoute><NovoChamado /></ProtectedRoute>} />
        <Route path="/perfil"        element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </div>
  )
}
