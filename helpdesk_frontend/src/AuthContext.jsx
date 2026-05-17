import React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from './firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { setTokenProvider } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil]   = useState(null) // dados do SQL Server

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        // Injeta o token provider no módulo de API
        setTokenProvider(() => firebaseUser.getIdToken())

        // Tenta buscar perfil do backend
        try {
          const { getMe } = await import('./api')
          const data = await getMe()
          setPerfil(data)
        } catch {
          setPerfil(null) // usuário ainda não registrou perfil
        }
      } else {
        setTokenProvider(null)
        setPerfil(null)
      }

      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)

  const signup = (email, password) => createUserWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const refreshPerfil = async () => {
    try {
      const { getMe } = await import('./api')
      const data = await getMe()
      setPerfil(data)
      return data
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider value={{ user, perfil, loading, login, signup, logout, refreshPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
