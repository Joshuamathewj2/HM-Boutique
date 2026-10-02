"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  AlertTriangle,
  Plus,
  X,
  Edit2,
  LogIn,
  LogOut,
  Trash2,
  Download,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Clock,
  Users,
  CheckCircle2,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/retail'

interface Staff {
  id: string
  name: string
  role: string
  phone: string | null
  base_salary: number
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

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function getMonthRange(yearMonth: string) {
  if (!yearMonth) {
    const now = new Date()
    yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  const [yStr, mStr] = yearMonth.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const from = `${yearMonth}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export default function Attendance() {
  const [tab, setTab] = useState<'today' | 'staff' | 'report'>('today')
  const [staff, setStaff] = useState<Staff[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({})
  const [clockMap, setClockMap] = useState<Record<string, { clock_in: string | null; clock_out: string | null }>>({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Staff Add / Edit Modal
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [form, setForm] = useState({ name: '', role: '', phone: '', base_salary: '' })
  const [submitting, setSubmitting] = useState(false)

  // Staff Deletion Modal
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Monthly Report
  const initialMonth = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const initialRange = useMemo(() => getMonthRange(initialMonth), [initialMonth])
  const [reportMonth, setReportMonth] = useState(initialMonth)
  const [filterFrom, setFilterFrom] = useState(initialRange.from)
  const [filterTo, setFilterTo] = useState(initialRange.to)
  const [reportData, setReportData] = useState<Record<string, { present: number; half: number; absent: number; leave: number; total: number }>>({})
  const [reportLoading, setReportLoading] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      const { data: s } = await supabase.from('staff').select('*').order('name')
      if (s) setStaff(s as Staff[])

      const { data: a } = await supabase.from('attendance').select('*').eq('date', selectedDate)
      if (a) {
        const statusMap: Record<string, string> = {}
        const clkMap: Record<string, { clock_in: string | null; clock_out: string | null }> = {}
        a.forEach((r: AttendanceRecord) => {
          statusMap[r.staff_id] = r.status
          clkMap[r.staff_id] = { clock_in: r.clock_in, clock_out: r.clock_out }
        })
        setAttendanceMap(statusMap)
        setClockMap(clkMap)
      }
    } catch (e) {
      console.error('Attendance fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchReport = useCallback(async (start: string, end: string) => {
    if (!isSupabaseConfigured) return
    setReportLoading(true)
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', start)
        .lte('date', end)

      if (data) {
        const stats: Record<string, { present: number; half: number; absent: number; leave: number; total: number }> = {}
        data.forEach((r: AttendanceRecord) => {
          if (!stats[r.staff_id]) stats[r.staff_id] = { present: 0, half: 0, absent: 0, leave: 0, total: 0 }
          if (r.status === 'present') stats[r.staff_id].present++
          else if (r.status === 'half_day') stats[r.staff_id].half++
          else if (r.status === 'absent') stats[r.staff_id].absent++
          else if (r.status === 'leave') stats[r.staff_id].leave++
          stats[r.staff_id].total++
        })
        setReportData(stats)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setReportLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (tab === 'report') {
      void fetchReport(filterFrom, filterTo)
    }
  }, [tab, filterFrom, filterTo, fetchReport])

  const markStatus = async (staffId: string, status: string) => {
    const currentStatus = attendanceMap[staffId]
    const newStatus = currentStatus === status ? '' : status

    setAttendanceMap((prev) => {
      const next = { ...prev }
      if (newStatus) next[staffId] = newStatus
      else delete next[staffId]
      return next
    })

    if (!isSupabaseConfigured) return

    try {
      if (newStatus) {
        await supabase.from('attendance').upsert(
          {
            staff_id: staffId,
            date: selectedDate,
            status: newStatus,
          },
          { onConflict: 'staff_id,date' }
        )
      } else {
        await supabase.from('attendance').delete().match({ staff_id: staffId, date: selectedDate })
      }
      showToast('Attendance recorded')
    } catch (e) {
      console.error(e)
    }
  }

  const markClock = async (staffId: string, type: 'clock_in' | 'clock_out') => {
    const nowIso = new Date().toISOString()
    setClockMap((prev) => ({
      ...prev,
      [staffId]: {
        clock_in: prev[staffId]?.clock_in || (type === 'clock_in' ? nowIso : null),
        clock_out: type === 'clock_out' ? nowIso : prev[staffId]?.clock_out || null,
      },
    }))

    if (!isSupabaseConfigured) return

    try {
      const existing = clockMap[staffId]
      const payload: any = {
        staff_id: staffId,
        date: selectedDate,
        status: attendanceMap[staffId] || 'present',
        [type]: nowIso,
      }
      if (type === 'clock_out' && existing?.clock_in) payload.clock_in = existing.clock_in
      if (type === 'clock_in' && existing?.clock_out) payload.clock_out = existing.clock_out

      await supabase.from('attendance').upsert(payload, { onConflict: 'staff_id,date' })
      showToast(type === 'clock_in' ? 'Clock In recorded' : 'Clock Out recorded')
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.role.trim()) return
    setSubmitting(true)

    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim(),
        phone: form.phone.trim() || null,
        base_salary: parseFloat(form.base_salary) || 0,
        is_active: true,
      }

      if (editingStaff) {
        await supabase.from('staff').update(payload).eq('id', editingStaff.id)
        showToast('Staff member updated')
      } else {
        await supabase.from('staff').insert({
          ...payload,
          staff_code: `STAFF-${String(staff.length + 1).padStart(3, '0')}`,
        })
        showToast('Staff member added')
      }

      setShowModal(false)
      setEditingStaff(null)
      setForm({ name: '', role: '', phone: '', base_salary: '' })
      void fetchData()
    } catch (err) {
      console.error(err)
      alert('Failed to save staff')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return
    setDeleting(true)
    try {
      await supabase.from('staff').delete().eq('id', staffToDelete.id)
      setStaffToDelete(null)
      showToast('Staff deleted')
      void fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const exportReportCSV = () => {
    const headers = ['Staff Code', 'Staff Name', 'Role', 'Present Days', 'Half Days', 'Absent Days', 'Leave Days', 'Total Marked']
    const rows = staff.map((s, idx) => {
      const st = reportData[s.id] || { present: 0, half: 0, absent: 0, leave: 0, total: 0 }
      return [
        `STAFF-${String(idx + 1).padStart(3, '0')}`,
        `"${s.name}"`,
        `"${s.role}"`,
        st.present,
        st.half,
        st.absent,
        st.leave,
        st.total,
      ]
    })
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_${filterFrom}_to_${filterTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[300] bg-[#111111] text-white px-4 py-2.5 rounded-xl shadow-xl border border-white/20 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} className="text-[#F500A0]" />
          {toastMessage}
        </div>
      )}

      {/* Header & Sub-Tabs */}
      <div className="bg-white rounded-2xl p-5 border border-[#F500A0]/20 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#111111] flex items-center gap-2.5">
            <Users className="text-[#F500A0]" size={24} />
            Staff Attendance &amp; Roster
          </h2>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            Daily clock-in, punch register, and monthly payroll attendance tracking
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#FFF0F8] p-1 rounded-xl border border-[#F500A0]/20">
          <button
            onClick={() => setTab('today')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              tab === 'today' ? 'bg-[#F500A0] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today's Attendance
          </button>
          <button
            onClick={() => setTab('staff')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              tab === 'staff' ? 'bg-[#F500A0] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Staff Directory ({staff.length})
          </button>
          <button
            onClick={() => setTab('report')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              tab === 'report' ? 'bg-[#F500A0] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly Report
          </button>
        </div>
      </div>

      {/* ── TAB: TODAY'S PUNCH REGISTER ── */}
      {tab === 'today' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-[#F500A0]/15 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-[#F500A0]" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Attendance Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#F500A0]"
              />
            </div>
            <p className="text-xs text-gray-500 font-semibold">
              Mark status or record punch times for each staff member
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#F500A0]/20 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FFF0F8] text-[#111111] border-b border-[#F500A0]/20 uppercase tracking-wider font-black text-[11px]">
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Clock In</th>
                    <th className="py-3.5 px-4 text-center">Clock Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                        No active staff members found. Add staff in the "Staff Directory" tab.
                      </td>
                    </tr>
                  ) : (
                    staff.map((s, idx) => {
                      const currentStatus = attendanceMap[s.id] || ''
                      const clock = clockMap[s.id] || { clock_in: null, clock_out: null }

                      return (
                        <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900 text-[13px]">{s.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">STAFF-{String(idx + 1).padStart(3, '0')}</div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-600">{s.role}</td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 p-1 bg-gray-50 rounded-xl border border-gray-200">
                              <button
                                onClick={() => markStatus(s.id, 'present')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                Present
                              </button>
                              <button
                                onClick={() => markStatus(s.id, 'half_day')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                                  currentStatus === 'half_day'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                Half Day
                              </button>
                              <button
                                onClick={() => markStatus(s.id, 'absent')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                                  currentStatus === 'absent'
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'text-red-700 hover:bg-red-50'
                                }`}
                              >
                                Absent
                              </button>
                              <button
                                onClick={() => markStatus(s.id, 'leave')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                                  currentStatus === 'leave'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-purple-700 hover:bg-purple-50'
                                }`}
                              >
                                Leave
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {clock.clock_in ? (
                              <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded-md text-[11px]">
                                {formatTime(clock.clock_in)}
                              </span>
                            ) : (
                              <button
                                onClick={() => markClock(s.id, 'clock_in')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] hover:bg-emerald-100 cursor-pointer"
                              >
                                <LogIn size={11} /> Punch In
                              </button>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {clock.clock_out ? (
                              <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded-md text-[11px]">
                                {formatTime(clock.clock_out)}
                              </span>
                            ) : (
                              <button
                                onClick={() => markClock(s.id, 'clock_out')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 font-bold text-[10px] hover:bg-orange-100 cursor-pointer"
                              >
                                <LogOut size={11} /> Punch Out
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: STAFF DIRECTORY ── */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white rounded-2xl p-4 border border-[#F500A0]/15 shadow-sm">
            <p className="text-xs font-semibold text-gray-500">
              Manage employees, tailoring staff, and base pay rates
            </p>
            <button
              onClick={() => {
                setEditingStaff(null)
                setForm({ name: '', role: '', phone: '', base_salary: '' })
                setShowModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F500A0] hover:bg-[#D8008D] text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={14} /> Add Staff Member
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((s, idx) => (
              <div key={s.id} className="bg-white rounded-2xl p-4 border border-[#F500A0]/20 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                        STAFF-{String(idx + 1).padStart(3, '0')}
                      </span>
                      <h3 className="font-bold text-gray-900 text-base mt-0.5">{s.name}</h3>
                      <p className="text-xs font-semibold text-[#F500A0]">{s.role}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                    <p className="flex justify-between">
                      <span className="text-gray-400">Phone:</span>
                      <span className="font-semibold text-gray-800">{s.phone || '—'}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-400">Base Salary:</span>
                      <span className="font-bold text-gray-900">{formatCurrency(s.base_salary)}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingStaff(s)
                      setForm({
                        name: s.name,
                        role: s.role,
                        phone: s.phone || '',
                        base_salary: String(s.base_salary || ''),
                      })
                      setShowModal(true)
                    }}
                    className="p-1.5 text-gray-500 hover:text-[#F500A0] hover:bg-[#FFF0F8] rounded-lg transition-colors cursor-pointer"
                    title="Edit Staff"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setStaffToDelete(s)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Staff"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: MONTHLY REPORT ── */}
      {tab === 'report' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-[#F500A0]/15 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">From:</span>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">To:</span>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
                />
              </div>
              <button
                onClick={() => fetchReport(filterFrom, filterTo)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Apply Range
              </button>
            </div>

            <button
              onClick={exportReportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F500A0] hover:bg-[#D8008D] text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#F500A0]/20 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FFF0F8] text-[#111111] border-b border-[#F500A0]/20 uppercase tracking-wider font-black text-[11px]">
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 text-center text-emerald-700">Present Days</th>
                    <th className="py-3.5 px-4 text-center text-amber-700">Half Days</th>
                    <th className="py-3.5 px-4 text-center text-red-700">Absent Days</th>
                    <th className="py-3.5 px-4 text-center text-purple-700">Leave Days</th>
                    <th className="py-3.5 px-4 text-center">Total Marked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staff.map((s, idx) => {
                    const st = reportData[s.id] || { present: 0, half: 0, absent: 0, leave: 0, total: 0 }
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-gray-900 text-[13px]">{s.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono ml-2">STAFF-{String(idx + 1).padStart(3, '0')}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-600">{s.role}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-700">{st.present}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-amber-700">{st.half}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-red-700">{st.absent}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-purple-700">{st.leave}</td>
                        <td className="py-3.5 px-4 text-center font-black text-gray-900">{st.total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT STAFF ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#F500A0]/30 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-black text-gray-900 text-lg">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Priya S"
                  className="w-full bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#F500A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Role / Specialization *
                </label>
                <input
                  type="text"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Senior Tailor / Aari Specialist"
                  className="w-full bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#F500A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#F500A0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Monthly Base Salary (₹)
                </label>
                <input
                  type="number"
                  value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                  placeholder="e.g. 18000"
                  className="w-full bg-[#FFF0F8] border border-[#F500A0]/30 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#F500A0]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#F500A0] hover:bg-[#D8008D] text-white transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingStaff ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ── */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-red-200 animate-in fade-in zoom-in-95">
            <h3 className="font-black text-gray-900 text-lg">Delete Staff Member?</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Are you sure you want to remove <strong className="text-gray-900">{staffToDelete.name}</strong>?
              Past attendance logs will remain, but this staff member will no longer appear on daily punch rosters.
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
