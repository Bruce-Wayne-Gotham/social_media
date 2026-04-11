'use client'

import { useEffect } from 'react'
import Sidebar from './Sidebar'

export default function MobileDrawer({ open, onClose }) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-56 shadow-xl">
        <Sidebar onClose={onClose} />
      </div>
    </>
  )
}
