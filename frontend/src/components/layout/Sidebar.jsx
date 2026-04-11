'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  CheckSquare,
  Users,
  BarChart2,
  Settings,
  LogOut,
} from 'lucide-react'
import ClientSwitcher from './ClientSwitcher'
import { useClient } from '@/lib/client-context'
import { getCurrentWorkspace, getClientStats } from '@/lib/api'

const NAV_ITEMS = [
  { label: 'Dashboard',  icon: LayoutDashboard, href: '/' },
  { label: 'Compose',    icon: PenSquare,        href: '/compose' },
  { label: 'Calendar',   icon: CalendarDays,     href: '/calendar' },
  { label: 'Approvals',  icon: CheckSquare,      href: '/approvals', badge: true },
  { label: 'Clients',    icon: Users,            href: '/clients' },
]

const DISABLED_ITEMS = [
  { label: 'Reports',   icon: BarChart2, title: 'Coming soon' },
  { label: 'Settings',  icon: Settings },
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()
  const { selectedClientId, pendingApprovalCount, setPendingApprovalCount } = useClient()
  const [workspace, setWorkspace] = useState(null)

  useEffect(() => {
    getCurrentWorkspace().then(({ data }) => setWorkspace(data))
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    getClientStats(selectedClientId).then(({ data }) => {
      setPendingApprovalCount(data.pendingApprovals ?? 0)
    })
  }, [selectedClientId, setPendingApprovalCount])

  function isActive(href) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-white border-r border-gray-200">
      {/* Workspace name */}
      <div className="px-4 pt-5 pb-3">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-400">
          Workspace
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-gray-900">
          {workspace?.name ?? '…'}
        </p>
      </div>

      {/* Client switcher */}
      <div className="px-2 pb-3">
        <ClientSwitcher />
      </div>

      <div className="mx-4 border-t border-gray-100" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, icon: Icon, href, badge }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && pendingApprovalCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
                  {pendingApprovalCount}
                </span>
              )}
            </Link>
          )
        })}

        {DISABLED_ITEMS.map(({ label, icon: Icon, title }) => (
          <div
            key={label}
            title={title}
            className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
            V
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">Vishal Sharma</p>
            <p className="truncate text-xs text-gray-400">Admin</p>
          </div>
        </div>
        <button
          onClick={() => console.log('sign out')}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
