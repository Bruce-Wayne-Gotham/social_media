'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { ClientProvider } from '@/lib/client-context'
import { ToastProvider, ErrorBoundary } from '@/components/ui'
import Sidebar from './Sidebar'
import MobileDrawer from './MobileDrawer'

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <ToastProvider>
    <ClientProvider>
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56">
        <Sidebar />
      </div>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-gray-900">SocialHub</span>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main content */}
      <main className="min-h-screen bg-gray-50 md:ml-56 overflow-y-auto">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </ClientProvider>
    </ToastProvider>
  )
}
