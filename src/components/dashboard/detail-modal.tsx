'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DetailModal({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-[#fcfaf8] shadow-[0_30px_80px_rgba(15,23,42,0.18)]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#eadfdb] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d6fff]">
              상세 보기
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(90vh-104px)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
