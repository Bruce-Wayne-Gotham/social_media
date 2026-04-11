'use client'

import { useReducer, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClient } from '@/lib/client-context'
import { useToast } from '@/components/ui'
import { PLATFORM_COLORS, PLATFORM_CONSTRAINTS } from '@/constants'
import { getSocialProfiles, createPost, adaptPost, saveAdaptation, submitPost } from '@/lib/api'
import { Button, Skeleton } from '@/components/ui'
import ComposerEditor from '@/components/compose/ComposerEditor'
import PlatformSelector from '@/components/compose/PlatformSelector'
import ProfilePicker from '@/components/compose/ProfilePicker'
import ScheduleSection from '@/components/compose/ScheduleSection'
import PreviewPanel from '@/components/compose/PreviewPanel'
import AdaptationPanel from '@/components/compose/AdaptationPanel'

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState = {
  content: '',
  selectedPlatforms: [],
  selectedProfileIds: {},   // { [platform]: profileId }
  scheduleMode: 'now',      // 'now' | 'later'
  scheduledAt: null,
  status: 'idle',           // 'idle' | 'adapting' | 'adapted' | 'submitting'
  postId: null,
  targets: [],
  adaptations: [],
  targetStates: {},         // { [targetId]: { state, content, title } }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONTENT':
      return { ...state, content: action.payload }

    case 'TOGGLE_PLATFORM': {
      const platform = action.payload
      const isSelected = state.selectedPlatforms.includes(platform)
      if (isSelected) {
        const { [platform]: _removed, ...rest } = state.selectedProfileIds
        return {
          ...state,
          selectedPlatforms: state.selectedPlatforms.filter((p) => p !== platform),
          selectedProfileIds: rest,
        }
      }
      return { ...state, selectedPlatforms: [...state.selectedPlatforms, platform] }
    }

    case 'SET_PROFILE':
      return {
        ...state,
        selectedProfileIds: {
          ...state.selectedProfileIds,
          [action.payload.platform]: action.payload.profileId,
        },
      }

    case 'SET_SCHEDULE_MODE':
      return {
        ...state,
        scheduleMode: action.payload,
        scheduledAt: action.payload === 'now' ? null : state.scheduledAt,
      }

    case 'SET_SCHEDULED_AT':
      return { ...state, scheduledAt: action.payload }

    case 'SET_STATUS':
      return { ...state, status: action.payload }

    case 'SET_POST':
      return { ...state, postId: action.payload.postId, targets: action.payload.targets }

    case 'SET_ADAPTATIONS': {
      const targetStates = {}
      action.payload.forEach((a) => {
        targetStates[a.targetId] = { state: 'suggested', content: a.content, title: a.title ?? null }
      })
      return { ...state, adaptations: action.payload, targetStates, status: 'adapted' }
    }

    case 'SET_TARGET_STATE': {
      const { targetId, newState } = action.payload
      return {
        ...state,
        targetStates: {
          ...state.targetStates,
          [targetId]: { ...state.targetStates[targetId], state: newState },
        },
      }
    }

    case 'SET_TARGET_CONTENT': {
      const { targetId, content, title } = action.payload
      return {
        ...state,
        targetStates: {
          ...state.targetStates,
          [targetId]: { ...state.targetStates[targetId], content, title },
        },
      }
    }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComposePage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { selectedClientId, selectedClient } = useClient()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [errors, setErrors] = useState({})
  const [titleErrors, setTitleErrors] = useState({})

  useEffect(() => {
    document.title = 'Compose — SocialHub'
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    setProfilesLoading(true)
    getSocialProfiles(selectedClientId)
      .then(({ data }) => setProfiles(data))
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false))
  }, [selectedClientId])

  function validate() {
    const e = {}
    if (!state.content.trim()) e.content = 'Content is required.'
    if (state.selectedPlatforms.length === 0) e.platforms = 'Select at least one platform.'
    const missingProfile = state.selectedPlatforms.find((p) => !state.selectedProfileIds[p])
    if (missingProfile) {
      e.platforms = `Select a profile for ${PLATFORM_COLORS[missingProfile].label}.`
    }
    if (state.scheduleMode === 'later') {
      if (!state.scheduledAt) {
        e.scheduledAt = 'Select a date and time.'
      } else if (new Date(state.scheduledAt) <= new Date()) {
        e.scheduledAt = 'Must be a future date and time.'
      }
    }
    return e
  }

  function buildPostBody() {
    const profileIds = state.selectedPlatforms
      .map((p) => state.selectedProfileIds[p])
      .filter(Boolean)
    return {
      originalContent: state.content,
      scheduledAt:
        state.scheduleMode === 'later' && state.scheduledAt
          ? new Date(state.scheduledAt).toISOString()
          : null,
      publishImmediately: false,
      targetProfileIds: profileIds,
    }
  }

  async function handleSaveDraft() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    dispatch({ type: 'SET_STATUS', payload: 'submitting' })
    try {
      await createPost(selectedClientId, buildPostBody())
      addToast('Draft saved', 'success')
      router.push('/approvals')
    } catch (err) {
      addToast(err.message ?? 'Failed to save draft', 'error')
      dispatch({ type: 'SET_STATUS', payload: 'idle' })
    }
  }

  async function handleGetSuggestions() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    dispatch({ type: 'SET_STATUS', payload: 'adapting' })
    try {
      const { data: post } = await createPost(selectedClientId, buildPostBody())
      dispatch({ type: 'SET_POST', payload: { postId: post.id, targets: post.targets } })
      const { data: adaptResult } = await adaptPost(post.id)
      dispatch({ type: 'SET_ADAPTATIONS', payload: adaptResult.adaptations })
    } catch (err) {
      addToast(err.message ?? 'Failed to get suggestions', 'error')
      dispatch({ type: 'SET_STATUS', payload: 'idle' })
    }
  }

  async function handleSubmitForApproval() {
    // Validate required titles on accepted/editing platforms
    const newTitleErrors = {}
    state.adaptations.forEach((adaptation) => {
      const ts = state.targetStates[adaptation.targetId]
      if (!ts || !['accepted', 'editing'].includes(ts.state)) return
      const constraints = PLATFORM_CONSTRAINTS[adaptation.platform]
      if (constraints.hasTitle && !ts.title?.trim()) {
        newTitleErrors[adaptation.targetId] = 'Title is required for this platform.'
      }
    })
    if (Object.keys(newTitleErrors).length > 0) {
      setTitleErrors(newTitleErrors)
      return
    }
    setTitleErrors({})
    dispatch({ type: 'SET_STATUS', payload: 'submitting' })
    try {
      // Save adaptations for accepted/editing platforms
      for (const adaptation of state.adaptations) {
        const ts = state.targetStates[adaptation.targetId]
        if (!ts || !['accepted', 'editing'].includes(ts.state)) continue
        await saveAdaptation(state.postId, adaptation.targetId, {
          adaptedContent: ts.content,
          ...(ts.title ? { adaptedTitle: ts.title } : {}),
        })
      }
      await submitPost(state.postId, { comment: '' })
      addToast('Submitted for approval', 'success')
      router.push('/approvals')
    } catch (err) {
      addToast(err.message ?? 'Failed to submit', 'error')
      dispatch({ type: 'SET_STATUS', payload: 'adapted' })
    }
  }

  const canAdapt = Boolean(state.content.trim()) && state.selectedPlatforms.length > 0
  const isSubmitting = state.status === 'submitting'
  const isAdapting = state.status === 'adapting'
  const isAdapted = state.status === 'adapted'

  const acceptedCount = Object.values(state.targetStates).filter(
    (ts) => ['accepted', 'editing'].includes(ts.state)
  ).length

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compose</h1>
        {selectedClient && (
          <p className="mt-0.5 text-sm text-gray-500">Creating for {selectedClient.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* ── Left panel (55%) ── */}
        <div className="min-w-0 flex-[55] space-y-5">
          <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
            {/* Content textarea */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Content</label>
              <ComposerEditor
                content={state.content}
                onChange={(v) => dispatch({ type: 'SET_CONTENT', payload: v })}
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content}</p>
              )}
            </div>

            {/* Platform selector */}
            <PlatformSelector
              selectedPlatforms={state.selectedPlatforms}
              onToggle={(p) => dispatch({ type: 'TOGGLE_PLATFORM', payload: p })}
              error={errors.platforms}
            />

            {/* Profile picker */}
            {profilesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <ProfilePicker
                selectedPlatforms={state.selectedPlatforms}
                profiles={profiles}
                selectedProfileIds={state.selectedProfileIds}
                onProfileSelect={(platform, profileId) =>
                  dispatch({ type: 'SET_PROFILE', payload: { platform, profileId } })
                }
                clientId={selectedClientId}
              />
            )}

            {/* Schedule section */}
            <ScheduleSection
              scheduleMode={state.scheduleMode}
              scheduledAt={state.scheduledAt}
              onModeChange={(m) => dispatch({ type: 'SET_SCHEDULE_MODE', payload: m })}
              onDateChange={(d) => dispatch({ type: 'SET_SCHEDULED_AT', payload: d })}
              error={errors.scheduledAt}
            />

            {/* Action row */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                loading={isSubmitting && !isAdapting}
                disabled={isSubmitting || isAdapting}
              >
                Save draft
              </Button>
              <Button
                variant="primary"
                onClick={handleGetSuggestions}
                disabled={!canAdapt || isAdapted}
                loading={isAdapting}
              >
                {isAdapted ? 'Suggestions loaded' : 'Get AI suggestions'}
              </Button>
            </div>
          </div>

          {/* Adaptation panel — shown after adapt */}
          {isAdapted && state.adaptations.length > 0 && (
            <AdaptationPanel
              originalContent={state.content}
              adaptations={state.adaptations}
              targetStates={state.targetStates}
              titleErrors={titleErrors}
              onStateChange={(targetId, newState) =>
                dispatch({ type: 'SET_TARGET_STATE', payload: { targetId, newState } })
              }
              onContentChange={(targetId, content, title) =>
                dispatch({ type: 'SET_TARGET_CONTENT', payload: { targetId, content, title } })
              }
            />
          )}

          {/* Submit for approval button */}
          {isAdapted && acceptedCount > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleSubmitForApproval}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Submit for approval ({acceptedCount} platform{acceptedCount !== 1 ? 's' : ''})
              </Button>
            </div>
          )}
        </div>

        {/* ── Right panel (45%) ── */}
        <div className="sticky top-6 min-w-0 flex-[45]">
          <div className="min-h-96 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Preview</h2>
            <PreviewPanel
              selectedPlatforms={state.selectedPlatforms}
              content={state.content}
              profiles={profiles}
              selectedProfileIds={state.selectedProfileIds}
              adaptations={state.adaptations}
              targetStates={state.targetStates}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
