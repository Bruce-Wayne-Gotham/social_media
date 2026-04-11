'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useClient } from '@/lib/client-context'

export default function ClientSwitcher({ onNewClient }) {
  const { selectedClient, clients, setSelectedClientId } = useClient()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!selectedClient) return null

  const initials = selectedClient.name.charAt(0).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-50 transition-colors"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-900 text-xs font-bold text-white">
          {initials}
        </span>
        <span className="flex-1 truncate text-left font-medium text-gray-900">
          {selectedClient.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => {
                setSelectedClientId(client.id)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                client.id === selectedClient.id ? 'font-medium text-gray-900' : 'text-gray-600'
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-900 text-xs font-bold text-white">
                {client.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{client.name}</span>
            </button>
          ))}
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => {
              setOpen(false)
              onNewClient?.()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New client
          </button>
        </div>
      )}
    </div>
  )
}
