'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Check,
  Send,
  MessageSquare,
  Youtube,
  Pin,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import {
  getClient,
  updateClient,
  deleteClient,
  getSocialProfiles,
  disconnectSocialProfile,
  connectMockProfile,
} from '@/lib/api'
import { PLATFORM, PLATFORM_COLORS } from '@/constants'
import { formatRelative, cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = [PLATFORM.TELEGRAM, PLATFORM.REDDIT, PLATFORM.YOUTUBE, PLATFORM.PINTEREST]

const PLATFORM_ICONS = {
  telegram:  Send,
  reddit:    MessageSquare,
  youtube:   Youtube,
  pinterest: Pin,
}

function getProfileMeta(profile) {
  const { platform, providerMeta, providerType } = profile
  if (platform === 'telegram')  return providerMeta?.channelUsername ?? providerType
  if (platform === 'reddit')    return providerMeta?.subreddit ?? providerMeta?.username ?? providerType
  if (platform === 'youtube')   return 'YouTube Channel'
  if (platform === 'pinterest') return providerMeta?.boardName ? `Board: ${providerMeta.boardName}` : providerType
  return providerType
}

// ---------------------------------------------------------------------------
// Inline delete confirmation overlay
// ---------------------------------------------------------------------------

function ConfirmOverlay({ open, onClose, title, description, confirmLabel = 'Confirm', onConfirm, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="px-6 py-5">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 1 — Client profile
// ---------------------------------------------------------------------------

function ClientProfileSection({ client, onClientUpdated }) {
  const { addToast } = useToast()

  // Inline name edit
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(client.name)
  const [nameSaving, setNameSaving] = useState(false)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  async function saveName() {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === client.name) {
      setNameValue(client.name)
      setEditingName(false)
      return
    }
    setNameSaving(true)
    try {
      const res = await updateClient(client.id, { name: trimmed })
      onClientUpdated(res.data)
      addToast('Client name updated', 'success')
    } catch (err) {
      addToast(err.message ?? 'Failed to save name', 'error')
      setNameValue(client.name)
    } finally {
      setNameSaving(false)
      setEditingName(false)
    }
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') { setNameValue(client.name); setEditingName(false) }
  }

  // Brand notes
  const [notes, setNotes] = useState(client.brandNotes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const notesDirty = notes !== (client.brandNotes ?? '')

  async function saveNotes() {
    setNotesSaving(true)
    try {
      const res = await updateClient(client.id, { brandNotes: notes })
      onClientUpdated(res.data)
      addToast('Brand notes saved', 'success')
    } catch (err) {
      addToast(err.message ?? 'Failed to save notes', 'error')
    } finally {
      setNotesSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Client profile</h2>

      <div className="flex items-start gap-5">
        {/* Logo placeholder */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed">
          <Upload className="h-5 w-5" />
        </div>

        <div className="flex-1 space-y-4">
          {/* Inline name editor */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Client name</label>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={handleNameKeyDown}
                  disabled={nameSaving}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <button
                  onClick={saveName}
                  disabled={nameSaving}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setNameValue(client.name); setEditingName(true) }}
                className="w-full rounded-lg border border-transparent px-3 py-1.5 text-left text-sm font-medium text-gray-900 hover:border-gray-200 hover:bg-gray-50"
              >
                {client.name}
              </button>
            )}
          </div>

          {/* Brand notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Brand notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
              placeholder="Tone guidelines, competitor restrictions, key messages…"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={saveNotes}
                loading={notesSaving}
                disabled={!notesDirty}
              >
                Save notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 2 — Connected accounts
// ---------------------------------------------------------------------------

function ProfileRow({ profile, onDisconnect }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const { addToast } = useToast()

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await onDisconnect(profile.id)
      addToast(`Disconnected ${profile.displayName}`, 'success')
    } catch (err) {
      addToast(err.message ?? 'Failed to disconnect', 'error')
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Health dot */}
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              profile.isConnected ? 'bg-green-500' : 'bg-red-400'
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{profile.displayName}</p>
            <p className="text-xs text-gray-400">
              {getProfileMeta(profile)} &middot; Last synced:{' '}
              {profile.lastSyncedAt ? formatRelative(profile.lastSyncedAt) : 'Never'}
            </p>
          </div>
        </div>

        {confirmOpen ? (
          <div className="flex shrink-0 items-center gap-2 ml-3">
            <span className="text-xs text-gray-500">Disconnect?</span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={disconnecting}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmOpen(true)}
            className="ml-3 shrink-0 rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-white hover:text-gray-700 border border-transparent hover:border-gray-200"
          >
            Disconnect
          </button>
        )}
      </div>
    </>
  )
}

function PlatformBlock({ platform, profiles, clientName, onDisconnect, onConnect }) {
  const colors = PLATFORM_COLORS[platform]
  const Icon = PLATFORM_ICONS[platform]
  const [connecting, setConnecting] = useState(false)
  const { addToast } = useToast()

  async function handleConnect() {
    setConnecting(true)
    addToast(`Opening ${colors.label} OAuth…`, 'info')
    try {
      const res = await onConnect(platform)
      addToast(`${colors.label} connected — ${res.data.displayName}`, 'success')
    } catch (err) {
      addToast(err.message ?? 'OAuth failed', 'error')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      {/* Platform header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded', colors.bg)}>
          <Icon className={cn('h-3.5 w-3.5', colors.text)} />
        </span>
        <span className="text-sm font-medium text-gray-900">{colors.label}</span>
      </div>

      {profiles.length > 0 ? (
        <div className="space-y-1.5 pl-8">
          {profiles.map((p) => (
            <ProfileRow key={p.id} profile={p} onDisconnect={onDisconnect} />
          ))}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1 pt-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect another {colors.label} account
          </button>
        </div>
      ) : (
        <div className="pl-8">
          <Button size="sm" variant="secondary" onClick={handleConnect} loading={connecting}>
            Connect {colors.label}
          </Button>
        </div>
      )}
    </div>
  )
}

function ConnectedAccountsSection({ client, profiles, onProfilesChanged }) {
  function handleDisconnect(profileId) {
    return disconnectSocialProfile(profileId).then(() => {
      onProfilesChanged((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, isConnected: false, lastSyncedAt: null } : p))
      )
    })
  }

  async function handleConnect(platform) {
    const res = await connectMockProfile(client.id, platform)
    onProfilesChanged((prev) => [...prev, res.data])
    return res
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900">Connected accounts</h2>
      <p className="mt-0.5 mb-5 text-xs text-gray-500">
        Connect accounts to publish on behalf of {client.name}.
      </p>

      <div className="space-y-4">
        {PLATFORMS.map((platform) => (
          <PlatformBlock
            key={platform}
            platform={platform}
            profiles={profiles.filter((p) => p.platform === platform)}
            clientName={client.name}
            onDisconnect={handleDisconnect}
            onConnect={handleConnect}
          />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 3 — Danger zone
// ---------------------------------------------------------------------------

function DangerZoneSection({ client }) {
  const [expanded, setExpanded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { addToast } = useToast()
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteClient(client.id)
      addToast(`${client.name} deleted`, 'info')
      router.push('/clients')
    } catch (err) {
      addToast(err.message ?? 'Failed to delete client', 'error')
      setDeleting(false)
      setModalOpen(false)
    }
  }

  return (
    <>
      <section>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Danger zone
        </button>

        {expanded && (
          <div className="mt-3 rounded-xl border border-red-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete this client</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently removes all posts, profiles, and history for {client.name}.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                Delete client
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmOverlay
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Delete ${client.name}?`}
        description="This will permanently delete all posts and connected accounts. This action cannot be undone."
        confirmLabel="Delete client"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-4 w-32 rounded bg-gray-100 mb-4" />
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-full rounded bg-gray-100" />
            <div className="h-20 w-full rounded bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="h-4 w-40 rounded bg-gray-100" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

export default function ClientSettingsPage() {
  const { clientId } = useParams()
  const [client, setClient] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Settings — SocialHub'
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [clientRes, profilesRes] = await Promise.all([
          getClient(clientId),
          getSocialProfiles(clientId),
        ])
        setClient(clientRes.data)
        setProfiles(profilesRes.data)
        document.title = `Settings — ${clientRes.data.name} — SocialHub`
      } catch (err) {
        setError(err.message ?? 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 h-6 w-48 rounded bg-gray-100" />
        <SettingsSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-800">Failed to load settings</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">{client.name}</p>
      </div>

      <div className="space-y-4">
        <ClientProfileSection
          client={client}
          onClientUpdated={setClient}
        />

        <ConnectedAccountsSection
          client={client}
          profiles={profiles}
          onProfilesChanged={setProfiles}
        />

        <DangerZoneSection client={client} />
      </div>
    </div>
  )
}
