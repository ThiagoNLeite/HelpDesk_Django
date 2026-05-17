import React from 'react'
const MAP = {
  'Aberto':        { cls: 'badge-aberto',    label: 'Aberto' },
  'Em andamento':  { cls: 'badge-andamento', label: 'Em andamento' },
  'Fechado':       { cls: 'badge-fechado',   label: 'Fechado' },
}

export default function StatusBadge({ status }) {
  const config = MAP[status] || { cls: 'badge-aberto', label: status || '—' }
  return <span className={`badge ${config.cls}`}>{config.label}</span>
}
