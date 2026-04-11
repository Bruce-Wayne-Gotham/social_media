'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { getClients } from './api'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientIdState] = useState(null)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  useEffect(() => {
    getClients().then(({ data }) => {
      setClients(data)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('socialhub_client') : null
      const valid = stored && data.find((c) => c.id === stored)
      const defaultId = valid ? stored : (data[0]?.id ?? null)
      setSelectedClientIdState(defaultId)
    })
  }, [])

  function setSelectedClientId(id) {
    setSelectedClientIdState(id)
    if (typeof window !== 'undefined') localStorage.setItem('socialhub_client', id)
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null

  return (
    <ClientContext.Provider value={{
      selectedClientId, setSelectedClientId, selectedClient, clients,
      pendingApprovalCount, setPendingApprovalCount,
    }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClient must be used within ClientProvider')
  return ctx
}
