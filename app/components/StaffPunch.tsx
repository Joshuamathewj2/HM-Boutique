"use client";

import React, { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { CheckCircle, LogIn, LogOut, ChevronLeft, Clock, Users, ArrowLeft } from 'lucide-react'
import { BRAND_EN, BRAND_LOGO } from '@/lib/brand'
import Link from 'next/link'

interface Staff {
  id: string
  name: string
  role: string
  is_active: boolean
}

interface AttendanceRecord {
  id: string
  staff_id: string
  date: string
  status: string
  clock_in: string | null
  clock_out: string | null
}

type Step = 'select' | 'punch' | 'done'

function formatTime(ts: string | null) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function getTodayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

export default function StaffPunch({ embedded = false }: { embedded?: boolean }) {
  const [step, setStep] = useState<Step>('select')
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const today = getTodayLocal()
  const [clockString, setClockString] = useState('')

  useEffect(() => {
    const updateTime = () => {
      setClockString(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true)
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.from('staff').select('id, name, role, is_active').eq('is_active', true).order('name')
          if (data) setStaff(data as Staff[])
        } catch {}
      }
      setLoading(false)
    }
    void fetchStaff()
  }, [])

  const selectStaff = async (s: Staff) => {
    setSelectedStaff(s)
    setLoading(true)
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', s.id)
          .eq('date', today)
          .maybeSingle()
        setTodayRecord(data as AttendanceRecord | null)
      } catch {}
    }
    setLoading(false)
    setStep('punch')
  }

  const punchIn = async () => {
    if (!selectedStaff) return
    setSaving(true)
    setNotice('')
    const now = new Date().toISOString()
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .upsert({ staff_id: selectedStaff.id, date: today, status: 'present', clock_in: now }, { onConflict: 'staff_id,date' })
          .select()
          .maybeSingle()
        if (error) {
          setNotice(error.message || 'Something went wrong')
        } else {
          setTodayRecord(data as AttendanceRecord)
          setStep('done')
          setNotice('punch_in')
        }
      } catch (err: any) {
        setNotice(err?.message || 'Failed')
      }
    } else {
      setStep('done')
      setNotice('punch_in')
    }
    setSaving(false)
  }

  const punchOut = async () => {
    if (!selectedStaff || !todayRecord) return
    setSaving(true)
    setNotice('')
    const now = new Date().toISOString()
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .update({ clock_out: now })
          .eq('staff_id', selectedStaff.id)
          .eq('date', today)
          .select()
          .maybeSingle()
        if (error) {
          setNotice(error.message || 'Something went wrong')
        } else {
          setTodayRecord(data as AttendanceRecord)
          setStep('done')
          setNotice('punch_out')
        }
      } catch (err: any) {
        setNotice(err?.message || 'Failed')
      }
    } else {
      setStep('done')
      setNotice('punch_out')
    }
    setSaving(false)
  }

  const reset = () => {
    setSelectedStaff(null)
    setTodayRecord(null)
    setNotice('')
    setStep('select')
  }

  return (
    <div className={`min-h-screen bg-[#FFF0F8] flex flex-col justify-between items-center p-4 sm:p-6 ${embedded ? 'min-h-0' : ''}`}>
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between py-3">
        <Link
          href="/pos/admin/secure/control-panel/hm-boutique"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F500A0] hover:underline"
        >
          <ArrowLeft size={14} /> Back to Terminal
        </Link>
        <div className="text-right">
          <span className="font-mono font-bold text-sm text-[#111111]">{clockString}</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-[#F500A0]/25 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#F500A0] via-pink-400 to-[#F500A0]" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#F500A0]/30 mx-auto mb-3 p-1 overflow-hidden shadow-sm flex items-center justify-center">
            <img src={BRAND_LOGO} alt="HM Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black text-[#111111] uppercase tracking-tight">{BRAND_EN}</h1>
          <p className="text-xs font-bold text-[#F500A0] uppercase tracking-widest mt-0.5">Staff Self-Punch Portal</p>
        </div>

        {/* STEP 1: SELECT STAFF */}
        {step === 'select' && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
              Select Your Name to Punch
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto hide-scrollbar">
              {staff.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-semibold">
                  {loading ? 'Loading staff roster...' : 'No active staff members registered.'}
                </div>
              ) : (
                staff.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => selectStaff(s)}
                    className="w-full text-left p-3.5 rounded-2xl border border-gray-100 bg-[#FFF0F8]/50 hover:bg-[#FFF0F8] hover:border-[#F500A0]/30 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm group-hover:text-[#F500A0] transition-colors">{s.name}</h4>
                      <p className="text-[11px] font-semibold text-gray-400">{s.role}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100">
                      STAFF-{String(idx + 1).padStart(3, '0')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: PUNCH IN / OUT */}
        {step === 'punch' && selectedStaff && (
          <div className="space-y-5 text-center">
            <div className="p-4 rounded-2xl bg-[#FFF0F8] border border-[#F500A0]/20">
              <h3 className="font-black text-gray-900 text-lg">{selectedStaff.name}</h3>
              <p className="text-xs font-bold text-[#F500A0]">{selectedStaff.role}</p>
            </div>

            <div className="space-y-2 text-xs font-semibold text-gray-600 bg-gray-50 p-3.5 rounded-2xl">
              <p className="flex justify-between">
                <span>Today's Clock In:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {todayRecord?.clock_in ? formatTime(todayRecord.clock_in) : 'Not Clocked In'}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Today's Clock Out:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {todayRecord?.clock_out ? formatTime(todayRecord.clock_out) : 'Not Clocked Out'}
                </span>
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {!todayRecord?.clock_in ? (
                <button
                  onClick={punchIn}
                  disabled={saving}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <LogIn size={18} /> {saving ? 'Punching In...' : 'Punch In (Start Shift)'}
                </button>
              ) : !todayRecord?.clock_out ? (
                <button
                  onClick={punchOut}
                  disabled={saving}
                  className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <LogOut size={18} /> {saving ? 'Punching Out...' : 'Punch Out (End Shift)'}
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold">
                  ✓ Shift completed for today!
                </div>
              )}

              <button
                type="button"
                onClick={reset}
                className="w-full py-2.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                ← Back to Staff List
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'done' && selectedStaff && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle size={36} />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900">Attendance Recorded!</h3>
              <p className="text-xs font-semibold text-gray-500 mt-1">
                {notice === 'punch_in'
                  ? `Clock In recorded for ${selectedStaff.name}`
                  : `Clock Out recorded for ${selectedStaff.name}`}
              </p>
            </div>

            <button
              onClick={reset}
              className="w-full py-3 bg-[#F500A0] hover:bg-[#D8008D] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            >
              Done / Next Staff Member
            </button>
          </div>
        )}
      </div>

      <footer className="py-4 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        Powered by Cenexa Systems © 2026
      </footer>
    </div>
  )
}
