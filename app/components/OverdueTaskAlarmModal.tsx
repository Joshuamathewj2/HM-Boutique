"use client";

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Volume2, VolumeX, Clock, BellOff, X } from 'lucide-react'

export interface OverdueTaskAlarmItem {
  id: string
  jobTitle: string
  staffCode: string
  staffName: string
  remainingQuantity: number
  totalQuantity: number
  completedQuantity: number
  unit: string
  deadline: string
}

interface OverdueTaskAlarmModalProps {
  items: OverdueTaskAlarmItem[]
  onAcknowledge: () => void
  onSnooze?: (minutes?: number) => void
  onDismiss?: () => void
}

export default function OverdueTaskAlarmModal({
  items,
  onAcknowledge,
  onSnooze,
  onDismiss,
}: OverdueTaskAlarmModalProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (items.length > 0 && soundEnabled) {
      try {
        const audio = new Audio('/alarm-buzzer.wav')
        audio.loop = true
        audioRef.current = audio
        audio.play().catch(() => {})
      } catch {}
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [items.length, soundEnabled])

  if (items.length === 0) return null

  const handleAcknowledge = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSoundEnabled(false)
    onAcknowledge()
  }

  const handleSnooze = (mins = 10) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSoundEnabled(false)
    if (onSnooze) onSnooze(mins)
    else onAcknowledge()
  }

  const handleDismiss = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSoundEnabled(false)
    if (onDismiss) onDismiss()
    else onAcknowledge()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border-2 border-red-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <AlertTriangle size={18} className="text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-white font-black text-[15px] leading-tight">Overdue Task Alert</p>
              <p className="text-white/85 text-[12px] font-semibold leading-tight mt-0.5">
                {items.length} assignment{items.length === 1 ? '' : 's'} require{items.length === 1 ? 's' : ''} attention
              </p>
            </div>
          </div>
          <span className="shrink-0 flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-full whitespace-nowrap">
            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {soundEnabled ? 'Alarm Sounding' : 'Sound Muted'}
          </span>
        </div>

        <div className="px-5 py-4">
          <p className="text-[12px] text-[#6B7280] font-semibold mb-4">
            The audible alarm and visual alert will sound until acknowledged or snoozed.
          </p>

          <div className="space-y-2.5 max-h-[45vh] overflow-y-auto hide-scrollbar pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-red-200 text-red-600">
                    <Clock size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-[#111111] break-words">{item.jobTitle}</p>
                    <p className="text-[11px] text-[#4B5563] font-semibold mt-0.5">
                      Staff: <span className="font-bold text-gray-800">{item.staffCode} - {item.staffName}</span>
                    </p>
                    {item.deadline && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5">Due: {item.deadline}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-600 text-white whitespace-nowrap">
                    {item.remainingQuantity} / {item.totalQuantity} {item.unit} remaining
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSnooze(10)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[12px] transition-colors cursor-pointer"
                title="Snooze alert for 10 minutes"
              >
                <BellOff size={13} /> Snooze 10m
              </button>
              {onDismiss && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-[12px] transition-colors cursor-pointer"
                  title="Dismiss modal"
                >
                  <X size={13} /> Dismiss
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleAcknowledge}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black text-[13px] px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
            >
              <VolumeX size={16} /> Silence &amp; Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
