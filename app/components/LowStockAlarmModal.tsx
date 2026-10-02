"use client";

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Volume2, VolumeX, Package } from 'lucide-react'

export interface LowStockAlarmItem {
  id: string | number
  name: string
  category?: string
  stock: number
  alertLimit: number
}

interface LowStockAlarmModalProps {
  items: LowStockAlarmItem[]
  onAcknowledge: () => void
}

export default function LowStockAlarmModal({ items, onAcknowledge }: LowStockAlarmModalProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (items.length > 0 && soundEnabled) {
      try {
        const audio = new Audio('/alarm-buzzer.wav')
        audio.loop = true
        audioRef.current = audio
        audio.play().catch(() => {
          // Autoplay blocked by browser policy until interaction
        })
      } catch {
        // ignore audio failure
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [items.length, soundEnabled])

  const handleSilence = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSoundEnabled(false)
    onAcknowledge()
  }

  if (items.length === 0) return null

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
              <p className="text-white font-black text-[15px] leading-tight">Low Stock Alarm Active</p>
              <p className="text-white/85 text-[12px] font-semibold leading-tight mt-0.5">
                {items.length} item{items.length === 1 ? '' : 's'} require{items.length === 1 ? 's' : ''} restocking
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
            The audible alarm and visual alert will sound until acknowledged.
          </p>

          <div className="space-y-2.5 max-h-[45vh] overflow-y-auto hide-scrollbar pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-red-200 text-red-600">
                    <Package size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-[#111111] break-words">{item.name}</p>
                    {item.category && <p className="text-[11px] text-[#9CA3AF]">{item.category}</p>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${item.stock <= 0 ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-700'}`}>
                    {item.stock} in stock
                  </span>
                  <p className="text-[10px] text-[#9CA3AF] mt-1">Alert limit: {item.alertLimit}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#9CA3AF] font-medium max-w-[45%]">
              Silences sound until next low-stock alert.
            </p>
            <button
              onClick={handleSilence}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black text-[13px] px-5 py-3 rounded-xl shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
            >
              <VolumeX size={16} /> Silence Alarm &amp; Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
