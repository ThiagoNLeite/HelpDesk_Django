// api.js — Centraliza todas as chamadas para o backend Django

const BASE_URL = '/api'

// Pega o token Firebase do usuário atual (injetado pelo AuthContext)
let _getToken = null
export function setTokenProvider(fn) {
  _getToken = fn
}

async function getHeaders(requireAuth = false) {
  const headers = { 'Content-Type': 'application/json' }
  if (requireAuth && _getToken) {
    const token = await _getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
  return data
}

// ── Usuários ────────────────────────────────────────────
export async function registerUser(nome, cargo) {
  const res = await fetch(`${BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: await getHeaders(true),
    body: JSON.stringify({ nome, cargo }),
  })
  return handleResponse(res)
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/usuarios/me/`, {
    headers: await getHeaders(true),
  })
  return handleResponse(res)
}

// ── Chamados ────────────────────────────────────────────
export async function getChamados() {
  const res = await fetch(`${BASE_URL}/chamados/`, {
    headers: await getHeaders(false),
  })
  return handleResponse(res)
}

export async function createChamado(titulo, descricao, categoria) {
  const res = await fetch(`${BASE_URL}/chamados/`, {
    method: 'POST',
    headers: await getHeaders(true),
    body: JSON.stringify({ titulo, descricao, categoria }),
  })
  return handleResponse(res)
}

export async function updateChamadoStatus(id, status) {
  const res = await fetch(`${BASE_URL}/chamados/${id}/`, {
    method: 'PUT',
    headers: await getHeaders(true),
    body: JSON.stringify({ status }),
  })
  return handleResponse(res)
}

export async function deleteChamado(id) {
  const res = await fetch(`${BASE_URL}/chamados/${id}/`, {
    method: 'DELETE',
    headers: await getHeaders(true),
  })
  return handleResponse(res)
}

export async function getChamadoDetail(id) {
  const res = await fetch(`${BASE_URL}/chamados/${id}/`, {
    headers: await getHeaders(false),
  })
  return handleResponse(res)
}

// ── Dashboard ────────────────────────────────────────────
export async function getDashboardStats() {
  const res = await fetch(`${BASE_URL}/dashboard/stats/`, {
    headers: await getHeaders(false),
  })
  return handleResponse(res)
}
