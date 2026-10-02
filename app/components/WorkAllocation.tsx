"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import OverdueTaskAlarmModal, { type OverdueTaskAlarmItem } from './OverdueTaskAlarmModal'
import {
  Briefcase,
  Users,
  ClipboardList,
  Plus,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  BarChart2,
  Play,
  Pause,
  Check,
  Circle,
  Minus,
  RefreshCw,
  AlertTriangle,
  Volume2,
  BellOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  ChevronDown,
  Filter,
} from 'lucide-react'

// ─── Data Models ──────────────────────────────────────────────────────────────

export type Job = {
  id: string
  title: string
  createdAt: string
}

export type StaffMember = {
  id: string
  staffCode: string
  name: string
  experience: string
  createdAt: string
}

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold'

export type Assignment = {
  id: string
  jobId: string
  staffId: string
  totalQuantity: number
  completedQuantity: number
  unit: string
  deadline: string
  due_datetime?: string
  notes: string
  status: AssignmentStatus
  createdAt: string
  updatedAt: string
}

// ─── LocalStorage helpers (Offline Fallback & Cache) ──────────────────────────

const LS_JOBS = 'hm_wa_jobs'
const LS_STAFF = 'hm_wa_staff'
const LS_ASSIGNMENTS = 'hm_wa_assignments'

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nextCode(existing: StaffMember[]): string {
  const nums = existing
    .map(s => parseInt(s.staffCode.replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n))
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `STAFF-${String(next).padStart(3, '0')}`
}

function normalizeAssignment(row: Record<string, unknown>): Assignment {
  const total = Math.max(1, Number(row.total_quantity ?? row.totalQuantity ?? row.quantity ?? 1))
  let completed = Number(row.completed_quantity ?? row.completedQuantity ?? 0)
  if (row.progressPct !== undefined && row.completed_quantity === undefined && row.completedQuantity === undefined) {
    completed = Math.round((Number(row.progressPct) / 100) * total)
  }
  completed = Math.max(0, Math.min(total, completed))

  const dueRaw = row.due_datetime ?? row.deadline ?? ''

  return {
    id: String(row.id),
    jobId: String(row.job_id ?? row.jobId ?? ''),
    staffId: String(row.staff_id ?? row.staffId ?? ''),
    totalQuantity: total,
    completedQuantity: completed,
    unit: String(row.unit || 'pcs'),
    deadline: row.deadline ? String(row.deadline).split('T')[0] : (dueRaw ? String(dueRaw).split('T')[0] : ''),
    due_datetime: dueRaw ? String(dueRaw) : undefined,
    notes: String(row.notes || ''),
    status: (row.status as AssignmentStatus) || 'pending',
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
  }
}

// ─── Status meta ──────────────────────────────────────────────────────────────

type StatusMeta = { label: string; color: string; bg: string; icon: React.ReactNode }

const STATUS_META: Record<AssignmentStatus, StatusMeta> = {
  pending:     { label: 'Pending',     color: '#9A6700', bg: '#FFF8EC', icon: <Circle size={13} /> },
  in_progress: { label: 'In Progress', color: '#1D6FB8', bg: '#EFF6FF', icon: <Play size={13} /> },
  completed:   { label: 'Completed',   color: '#15803D', bg: '#F0FDF4', icon: <Check size={13} /> },
  on_hold:     { label: 'On Hold',     color: '#6B7280', bg: '#F3F4F6', icon: <Pause size={13} /> },
}

function Badge({ status }: { status: AssignmentStatus }) {
  const m = STATUS_META[status] || STATUS_META.pending
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ color: m.color, background: m.bg }}
    >
      {m.icon}{m.label}
    </span>
  )
}

function ProgressBar({ completed, total, unit }: { completed: number; total: number; unit?: string }) {
  const safeTotal = Math.max(1, total)
  const pct = Math.round((Math.max(0, Math.min(safeTotal, completed)) / safeTotal) * 100)
  const color = pct === 100 ? '#15803D' : pct >= 50 ? '#1D6FB8' : '#F500A0'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-gray-700">{completed} / {safeTotal} {unit || ''}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorkAllocationProps {
  role?: string
}

export default function WorkAllocation({ role = 'admin' }: WorkAllocationProps) {
  const isAdmin = role === 'admin'

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const [activeView, setActiveView] = useState<'dashboard' | 'jobs' | 'staff' | 'assignments' | 'portal'>(() =>
    isAdmin ? 'dashboard' : 'portal'
  )

  // ── Data state ───────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>(() => loadLS(LS_JOBS, []))
  const [staff, setStaff] = useState<StaffMember[]>(() => loadLS(LS_STAFF, []))
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const raw = loadLS<Record<string, unknown>[]>(LS_ASSIGNMENTS, [])
    return raw.map(normalizeAssignment)
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [dbNotice, setDbNotice] = useState<string | null>(null)

  // Overdue audio alert controls (reuses exact inventory buzzer sound & popup modal)
  const [snoozeUntil, setSnoozeUntil] = useState<number>(0)
  const [ackedOverdueIds, setAckedOverdueIds] = useState<Set<string>>(new Set())
  const [modalDismissed, setModalDismissed] = useState(false)

  // Cache to localStorage
  useEffect(() => saveLS(LS_JOBS, jobs), [jobs])
  useEffect(() => saveLS(LS_STAFF, staff), [staff])
  useEffect(() => saveLS(LS_ASSIGNMENTS, assignments), [assignments])

  // ── Supabase Fetchers ─────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
      if (!error && Array.isArray(data)) {
        setJobs(data.map(j => ({
          id: String(j.id),
          title: String(j.title || ''),
          createdAt: String(j.created_at || new Date().toISOString())
        })))
      }
    } catch (e) {
      console.warn('Jobs fetch error:', e)
    }
  }, [])

  const fetchStaff = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase.from('staff').select('*').order('name', { ascending: true })
      if (!error && Array.isArray(data)) {
        setStaff(data.map(s => ({
          id: String(s.id),
          staffCode: String(s.staff_code || `STAFF-${String(s.id).slice(0, 3)}`),
          name: String(s.name || ''),
          experience: String(s.experience || ''),
          createdAt: String(s.created_at || new Date().toISOString())
        })))
      }
    } catch (e) {
      console.warn('Staff fetch error:', e)
    }
  }, [])

  const fetchAssignments = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01') {
          setDbNotice('Work allocation database tables not yet initialized in Supabase.')
        }
      } else if (Array.isArray(data)) {
        setAssignments(data.map(normalizeAssignment))
        setDbNotice(null)
      }
    } catch (e) {
      console.warn('Assignments fetch error:', e)
    }
  }, [])

  const reloadAll = useCallback(async () => {
    setIsSyncing(true)
    await Promise.all([fetchJobs(), fetchStaff(), fetchAssignments()])
    setIsSyncing(false)
  }, [fetchJobs, fetchStaff, fetchAssignments])

  // Initial load
  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  // ── Supabase Realtime Subscriptions ───────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('job_assignments_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_assignments' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newAsgn = normalizeAssignment(payload.new as Record<string, unknown>)
            setAssignments(prev => [newAsgn, ...prev.filter(a => a.id !== newAsgn.id)])
          } else if (payload.eventType === 'UPDATE') {
            const updated = normalizeAssignment(payload.new as Record<string, unknown>)
            setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a))
          } else if (payload.eventType === 'DELETE') {
            const oldId = String(payload.old?.id)
            if (oldId) setAssignments(prev => prev.filter(a => a.id !== oldId))
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => void fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => void fetchStaff())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchJobs, fetchStaff])

  // ── Overdue Task Detection & Alarm Popup Alert ────────────────────────────

  const isAssignmentOverdue = useCallback((a: Assignment) => {
    // 1. Status check: assignment.status !== 'Completed' (case-insensitive)
    const normStatus = String(a.status || '').trim().toLowerCase()
    if (normStatus === 'completed') return false

    // 2. Quantity check: assignment.completed_quantity < assignment.total_quantity
    const completed = Number(a.completedQuantity) || 0
    const total = Number(a.totalQuantity) || 1
    if (completed >= total) return false

    // 3. Deadline check: new Date(assignment.due_datetime) < new Date()
    const dueRaw = a.due_datetime || a.deadline
    if (!dueRaw) return false

    const deadlineStr = String(dueRaw).includes('T') ? String(dueRaw) : `${dueRaw}T23:59:59`
    const deadlineDate = new Date(deadlineStr)
    return !isNaN(deadlineDate.getTime()) && deadlineDate.getTime() < Date.now()
  }, [])

  const overdueAssignments = useMemo(() => {
    return assignments.filter(isAssignmentOverdue)
  }, [assignments, isAssignmentOverdue])

  // Map overdue assignments to modal items with Job Name, Assigned Staff (Code & Name), and Remaining Units
  const overdueAlarmItems = useMemo<OverdueTaskAlarmItem[]>(() => {
    return overdueAssignments.map(a => {
      const staffMember = staff.find(s => s.id === a.staffId)
      const jobItem = jobs.find(j => j.id === a.jobId)
      const remaining = Math.max(0, a.totalQuantity - a.completedQuantity)
      return {
        id: a.id,
        jobTitle: jobItem ? jobItem.title : (a.jobId || 'Assigned Job'),
        staffCode: staffMember ? staffMember.staffCode : 'STAFF',
        staffName: staffMember ? staffMember.name : 'Staff Member',
        remainingQuantity: remaining,
        totalQuantity: a.totalQuantity,
        completedQuantity: a.completedQuantity,
        unit: a.unit || 'pcs',
        deadline: a.deadline || (a.due_datetime ? a.due_datetime.split('T')[0] : ''),
      }
    })
  }, [overdueAssignments, staff, jobs])

  const unackedOverdueItems = useMemo(() => {
    return overdueAlarmItems.filter(i => !ackedOverdueIds.has(i.id))
  }, [overdueAlarmItems, ackedOverdueIds])

  const isSnoozed = Date.now() < snoozeUntil
  const showOverdueModal = unackedOverdueItems.length > 0 && !isSnoozed && !modalDismissed

  // Re-open modal if new overdue assignments appear
  const prevOverdueCountRef = useRef(0)
  useEffect(() => {
    if (overdueAssignments.length > prevOverdueCountRef.current) {
      setModalDismissed(false)
    }
    prevOverdueCountRef.current = overdueAssignments.length
  }, [overdueAssignments.length])

  const handleAcknowledgeOverdue = () => {
    setAckedOverdueIds(prev => new Set([...prev, ...unackedOverdueItems.map(i => i.id)]))
    setModalDismissed(false)
  }

  const handleSnoozeOverdue = (minutes = 10) => {
    setSnoozeUntil(Date.now() + minutes * 60 * 1000)
    setModalDismissed(false)
    showToast(`Buzzer snoozed for ${minutes} minutes`, 'info')
  }

  const handleDismissOverdue = () => {
    setModalDismissed(true)
  }

  // ── Jobs CRUD ────────────────────────────────────────────────────────────
  const [jobForm, setJobForm] = useState({ title: '' })
  const [jobEditId, setJobEditId] = useState<string | null>(null)
  const [jobError, setJobError] = useState('')

  const saveJob = async () => {
    const trimmed = jobForm.title.trim()
    if (!trimmed) { setJobError('Job title is required'); return }
    setJobError('')

    if (jobEditId) {
      setJobs(prev => prev.map(j => j.id === jobEditId ? { ...j, title: trimmed } : j))
      if (isSupabaseConfigured) {
        await supabase.from('jobs').update({ title: trimmed }).eq('id', jobEditId)
      }
      showToast('Job updated')
      setJobEditId(null)
    } else {
      const newId = uid()
      const newJob: Job = { id: newId, title: trimmed, createdAt: new Date().toISOString() }
      setJobs(prev => [newJob, ...prev])
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('jobs').insert({ title: trimmed }).select().single()
        if (!error && data) {
          setJobs(prev => prev.map(j => j.id === newId ? { id: String(data.id), title: data.title, createdAt: data.created_at } : j))
        }
      }
      showToast('Job created')
    }
    setJobForm({ title: '' })
  }

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job type? Existing assignments will keep their record.')) return
    setJobs(prev => prev.filter(j => j.id !== id))
    if (isSupabaseConfigured) {
      await supabase.from('jobs').delete().eq('id', id)
    }
    showToast('Job deleted', 'info')
  }

  const startEditJob = (j: Job) => {
    setJobEditId(j.id)
    setJobForm({ title: j.title })
    setJobError('')
  }

  // ── Staff CRUD ────────────────────────────────────────────────────────────
  const [staffForm, setStaffForm] = useState({ name: '', experience: '' })
  const [staffEditId, setStaffEditId] = useState<string | null>(null)
  const [staffError, setStaffError] = useState('')
  const [staffSearch, setStaffSearch] = useState('')

  const saveStaff = async () => {
    const nameTrimmed = staffForm.name.trim()
    if (!nameTrimmed) { setStaffError('Staff name is required'); return }
    setStaffError('')

    if (staffEditId) {
      setStaff(prev => prev.map(s => s.id === staffEditId ? { ...s, name: nameTrimmed, experience: staffForm.experience.trim() } : s))
      if (isSupabaseConfigured) {
        await supabase.from('staff').update({
          name: nameTrimmed,
          experience: staffForm.experience.trim(),
          updated_at: new Date().toISOString()
        }).eq('id', staffEditId)
      }
      showToast('Staff profile updated')
      setStaffEditId(null)
    } else {
      const code = nextCode(staff)
      const newId = uid()
      const newStaff: StaffMember = {
        id: newId,
        staffCode: code,
        name: nameTrimmed,
        experience: staffForm.experience.trim(),
        createdAt: new Date().toISOString()
      }
      setStaff(prev => [newStaff, ...prev])
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('staff').insert({
          staff_code: code,
          name: nameTrimmed,
          experience: staffForm.experience.trim(),
        }).select().single()
        if (!error && data) {
          setStaff(prev => prev.map(s => s.id === newId ? {
            id: String(data.id),
            staffCode: data.staff_code,
            name: data.name,
            experience: data.experience || '',
            createdAt: data.created_at
          } : s))
        }
      }
      showToast('Staff added')
    }
    setStaffForm({ name: '', experience: '' })
  }

  const deleteStaff = async (id: string) => {
    if (!confirm('Delete this staff member?')) return
    setStaff(prev => prev.filter(s => s.id !== id))
    if (isSupabaseConfigured) {
      await supabase.from('staff').delete().eq('id', id)
    }
    showToast('Staff removed', 'info')
  }

  const startEditStaff = (s: StaffMember) => {
    setStaffEditId(s.id)
    setStaffForm({ name: s.name, experience: s.experience })
    setStaffError('')
  }

  type StaffSortField = 'staff_code' | 'name' | 'tasks_count' | 'remaining_work'
  const [staffSortBy, setStaffSortBy] = useState<StaffSortField>('staff_code')
  const [staffSortOrder, setStaffSortOrder] = useState<'asc' | 'desc'>('asc')

  const filteredStaff = useMemo(() =>
    staff.filter(s => !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()) || s.staffCode.toLowerCase().includes(staffSearch.toLowerCase())),
    [staff, staffSearch]
  )

  const sortedStaff = useMemo(() => {
    const list = [...filteredStaff]
    list.sort((a, b) => {
      let comparison = 0
      if (staffSortBy === 'staff_code') {
        comparison = a.staffCode.localeCompare(b.staffCode, undefined, { numeric: true, sensitivity: 'base' })
      } else if (staffSortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (staffSortBy === 'tasks_count') {
        const countA = assignments.filter(asg => asg.staffId === a.id).length
        const countB = assignments.filter(asg => asg.staffId === b.id).length
        comparison = countA - countB
      } else if (staffSortBy === 'remaining_work') {
        const remA = assignments.filter(asg => asg.staffId === a.id).reduce((sum, asg) => sum + Math.max(0, asg.totalQuantity - asg.completedQuantity), 0)
        const remB = assignments.filter(asg => asg.staffId === b.id).reduce((sum, asg) => sum + Math.max(0, asg.totalQuantity - asg.completedQuantity), 0)
        comparison = remA - remB
      }
      return staffSortOrder === 'desc' ? -comparison : comparison
    })
    return list
  }, [filteredStaff, staffSortBy, staffSortOrder, assignments])

  // ── Assignments CRUD with Direct Numeric Typing ───────────────────────────
  const blankAsgn = {
    jobId: '',
    staffId: '',
    totalQuantity: '1' as string | number,
    completedQuantity: '0' as string | number,
    unit: 'sets',
    deadline: '',
    notes: '',
    status: 'pending' as AssignmentStatus
  }
  const [asgnForm, setAsgnForm] = useState(blankAsgn)
  const [asgnEditId, setAsgnEditId] = useState<string | null>(null)
  const [asgnError, setAsgnError] = useState('')
  const [asgnShowModal, setAsgnShowModal] = useState(false)
  const [asgnFilterStatus, setAsgnFilterStatus] = useState<'all' | AssignmentStatus>('all')
  const [asgnFilterStaff, setAsgnFilterStaff] = useState('')
  const [asgnSearch, setAsgnSearch] = useState('')

  // Computed values for Modal
  const modalTotal = Math.max(1, parseInt(String(asgnForm.totalQuantity)) || 1)
  const modalCompleted = Math.max(0, parseInt(String(asgnForm.completedQuantity)) || 0)
  const modalRemaining = Math.max(0, modalTotal - modalCompleted)

  const openNewAsgn = () => {
    setAsgnEditId(null)
    setAsgnForm(blankAsgn)
    setAsgnError('')
    setAsgnShowModal(true)
  }

  const startEditAsgn = (a: Assignment) => {
    setAsgnEditId(a.id)
    setAsgnForm({
      jobId: a.jobId,
      staffId: a.staffId,
      totalQuantity: a.totalQuantity,
      completedQuantity: a.completedQuantity,
      unit: a.unit,
      deadline: a.deadline,
      notes: a.notes,
      status: a.status
    })
    setAsgnError('')
    setAsgnShowModal(true)
  }

  // Smooth direct-typing handler for Total Quantity
  const handleTotalQuantityChange = (valStr: string) => {
    if (valStr === '') {
      setAsgnForm(f => ({ ...f, totalQuantity: '' }))
      return
    }
    const safeTotal = Math.max(0, parseInt(valStr) || 0)
    const compNum = parseInt(String(asgnForm.completedQuantity)) || 0
    const clampedComp = safeTotal > 0 ? Math.min(compNum, safeTotal) : compNum
    let autoStatus: AssignmentStatus = asgnForm.status
    if (clampedComp === 0) autoStatus = 'pending'
    else if (safeTotal > 0 && clampedComp >= safeTotal) autoStatus = 'completed'
    else if (clampedComp > 0) autoStatus = 'in_progress'

    setAsgnForm(f => ({
      ...f,
      totalQuantity: valStr,
      completedQuantity: clampedComp,
      status: autoStatus
    }))
  }

  // Smooth direct-typing handler for Completed Quantity
  const handleCompletedQuantityChange = (valStr: string) => {
    if (valStr === '') {
      setAsgnForm(f => ({ ...f, completedQuantity: '' }))
      return
    }
    const val = parseInt(valStr) || 0
    const totalNum = Math.max(1, parseInt(String(asgnForm.totalQuantity)) || 1)
    const clamped = Math.max(0, Math.min(totalNum, val))
    let autoStatus: AssignmentStatus = asgnForm.status
    if (clamped === 0) autoStatus = 'pending'
    else if (clamped >= totalNum) autoStatus = 'completed'
    else autoStatus = 'in_progress'

    setAsgnForm(f => ({ ...f, completedQuantity: valStr, status: autoStatus }))
  }

  const saveAsgn = async () => {
    if (!asgnForm.jobId) { setAsgnError('Please select a job'); return }
    if (!asgnForm.staffId) { setAsgnError('Please select a staff member'); return }
    setAsgnError('')

    const totalNum = Math.max(1, parseInt(String(asgnForm.totalQuantity)) || 1)
    const compNum = Math.max(0, Math.min(totalNum, parseInt(String(asgnForm.completedQuantity)) || 0))
    const now = new Date().toISOString()

    const payload = {
      job_id: asgnForm.jobId,
      staff_id: asgnForm.staffId,
      total_quantity: totalNum,
      completed_quantity: compNum,
      unit: asgnForm.unit,
      deadline: asgnForm.deadline || null,
      notes: asgnForm.notes,
      status: asgnForm.status,
      updated_at: now
    }

    if (asgnEditId) {
      setAssignments(prev => prev.map(a => a.id === asgnEditId ? {
        ...a,
        ...asgnForm,
        totalQuantity: totalNum,
        completedQuantity: compNum,
        updatedAt: now
      } : a))

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('job_assignments').update(payload).eq('id', asgnEditId)
        if (error) console.error('Supabase assignment update error:', error)
      }
      showToast('Assignment updated')
      setAsgnEditId(null)
    } else {
      const tempId = uid()
      const newAsgn: Assignment = {
        id: tempId,
        ...asgnForm,
        totalQuantity: totalNum,
        completedQuantity: compNum,
        createdAt: now,
        updatedAt: now
      }
      setAssignments(prev => [newAsgn, ...prev])

      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('job_assignments').insert(payload).select().single()
        if (!error && data) {
          const remoteNormalized = normalizeAssignment(data)
          setAssignments(prev => prev.map(a => a.id === tempId ? remoteNormalized : a))
        }
      }
      showToast('New task assigned')
    }

    setAsgnShowModal(false)
    setAsgnForm(blankAsgn)
  }

  const deleteAsgn = async (id: string) => {
    if (!confirm('Delete this assignment?')) return
    setAssignments(prev => prev.filter(a => a.id !== id))
    if (isSupabaseConfigured) {
      await supabase.from('job_assignments').delete().eq('id', id)
    }
    showToast('Assignment deleted', 'info')
  }

  // Quick live-update of completed units
  const updateCompletedUnits = async (id: string, newCompleted: number) => {
    const target = assignments.find(a => a.id === id)
    if (!target) return
    const clamped = Math.max(0, Math.min(target.totalQuantity, newCompleted))
    let newStatus: AssignmentStatus = target.status
    if (clamped === 0) newStatus = 'pending'
    else if (clamped === target.totalQuantity) newStatus = 'completed'
    else newStatus = 'in_progress'

    const now = new Date().toISOString()
    setAssignments(prev => prev.map(a => a.id === id ? {
      ...a,
      completedQuantity: clamped,
      status: newStatus,
      updatedAt: now
    } : a))

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('job_assignments').update({
        completed_quantity: clamped,
        status: newStatus,
        updated_at: now
      }).eq('id', id)
      if (error) console.error('Error updating completed quantity:', error)
    }
    showToast(`Progress saved: ${clamped} / ${target.totalQuantity} ${target.unit}`)
  }

  const updateAsgnStatus = async (id: string, status: AssignmentStatus) => {
    const target = assignments.find(a => a.id === id)
    if (!target) return
    const now = new Date().toISOString()
    const completed = status === 'completed'
      ? target.totalQuantity
      : (status === 'pending' ? 0 : target.completedQuantity)

    setAssignments(prev => prev.map(a => a.id === id ? {
      ...a,
      status,
      completedQuantity: completed,
      updatedAt: now
    } : a))

    if (isSupabaseConfigured) {
      await supabase.from('job_assignments').update({
        status,
        completed_quantity: completed,
        updated_at: now
      }).eq('id', id)
    }
  }

  type AdminSortField = 'due_datetime' | 'remaining_quantity' | 'total_quantity' | 'staff_code' | 'created_at'
  const [asgnSortBy, setAsgnSortBy] = useState<AdminSortField>('due_datetime')
  const [asgnSortOrder, setAsgnSortOrder] = useState<'asc' | 'desc'>('asc')

  type StaffPortalSortField = 'deadline' | 'remaining' | 'total' | 'status'
  const [portalSortBy, setPortalSortBy] = useState<StaffPortalSortField>('deadline')
  const [portalSortOrder, setPortalSortOrder] = useState<'asc' | 'desc'>('asc')

  // ── Dashboard Date Filter State ───────────────────────────────────────────
  type DashDatePreset = 'all' | 'today' | 'tomorrow' | 'week' | 'overdue'
  const [dashSelectedDate, setDashSelectedDate] = useState('')
  const [dashDatePreset, setDashDatePreset] = useState<DashDatePreset>('all')
  const [dashSortOrder, setDashSortOrder] = useState<'asc' | 'desc' | 'recent'>('asc')

  const filteredAndSortedDashboardAssignments = useMemo(() => {
    let list = [...assignments]
    const now = new Date()

    if (dashSelectedDate) {
      const targetDateStr = dashSelectedDate
      list = list.filter(item => {
        if (!item.deadline && !item.due_datetime) return false
        const raw = item.due_datetime || (item.deadline ? `${item.deadline}T00:00:00` : '')
        return raw.startsWith(targetDateStr)
      })
    } else if (dashDatePreset === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      list = list.filter(item => {
        const raw = item.due_datetime || item.deadline || ''
        return raw.startsWith(todayStr)
      })
    } else if (dashDatePreset === 'tomorrow') {
      const tmr = new Date(now); tmr.setDate(now.getDate() + 1)
      const tmrStr = tmr.toISOString().split('T')[0]
      list = list.filter(item => {
        const raw = item.due_datetime || item.deadline || ''
        return raw.startsWith(tmrStr)
      })
    } else if (dashDatePreset === 'week') {
      const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7)
      list = list.filter(item => {
        const raw = item.due_datetime || (item.deadline ? `${item.deadline}T23:59:59` : '')
        if (!raw) return false
        const d = new Date(raw)
        return d >= now && d <= weekEnd
      })
    } else if (dashDatePreset === 'overdue') {
      list = list.filter(item => {
        if (item.status === 'completed') return false
        if ((item.completedQuantity || 0) >= item.totalQuantity) return false
        const raw = item.due_datetime || (item.deadline ? `${item.deadline}T23:59:59` : '')
        if (!raw) return false
        return new Date(raw) < now
      })
    }

    list.sort((a, b) => {
      if (dashSortOrder === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      const getTime = (x: Assignment) => {
        const raw = x.due_datetime || (x.deadline ? `${x.deadline}T23:59:59` : '')
        return raw ? new Date(raw).getTime() : (dashSortOrder === 'asc' ? Infinity : -Infinity)
      }
      return dashSortOrder === 'asc' ? getTime(a) - getTime(b) : getTime(b) - getTime(a)
    })

    return list
  }, [assignments, dashSelectedDate, dashDatePreset, dashSortOrder])

  // ── Portal Date Filter State ───────────────────────────────────────────────
  type PortalDatePreset = 'all' | 'today' | 'tomorrow' | 'week' | 'overdue'
  const [portalSelectedDate, setPortalSelectedDate] = useState('')
  const [portalDatePreset, setPortalDatePreset] = useState<PortalDatePreset>('all')
  const [portalDateSortOrder, setPortalDateSortOrder] = useState<'asc' | 'desc' | 'recent'>('asc')

  const filteredAssignments = useMemo(() => {
    let res = assignments
    if (asgnFilterStatus !== 'all') res = res.filter(a => a.status === asgnFilterStatus)
    if (asgnFilterStaff) res = res.filter(a => a.staffId === asgnFilterStaff)
    if (asgnSearch) {
      const q = asgnSearch.toLowerCase()
      res = res.filter(a => {
        const j = jobs.find(j => j.id === a.jobId)?.title || ''
        const s = staff.find(s => s.id === a.staffId)?.name || ''
        return j.toLowerCase().includes(q) || s.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
      })
    }
    return res
  }, [assignments, asgnFilterStatus, asgnFilterStaff, asgnSearch, jobs, staff])

  const sortedAssignments = useMemo(() => {
    const list = [...filteredAssignments]
    list.sort((a, b) => {
      let comparison = 0
      if (asgnSortBy === 'staff_code') {
        const sA = staff.find(s => s.id === a.staffId)?.staffCode || ''
        const sB = staff.find(s => s.id === b.staffId)?.staffCode || ''
        comparison = sA.localeCompare(sB, undefined, { numeric: true, sensitivity: 'base' })
      } else if (asgnSortBy === 'total_quantity') {
        comparison = a.totalQuantity - b.totalQuantity
      } else if (asgnSortBy === 'remaining_quantity') {
        const remA = Math.max(0, a.totalQuantity - a.completedQuantity)
        const remB = Math.max(0, b.totalQuantity - b.completedQuantity)
        comparison = remA - remB
      } else if (asgnSortBy === 'due_datetime') {
        const timeA = a.deadline ? new Date(a.deadline.includes('T') ? a.deadline : `${a.deadline}T23:59:59`).getTime() : Infinity
        const timeB = b.deadline ? new Date(b.deadline.includes('T') ? b.deadline : `${b.deadline}T23:59:59`).getTime() : Infinity
        comparison = timeA - timeB
      } else if (asgnSortBy === 'created_at') {
        const timeA = new Date(a.createdAt).getTime()
        const timeB = new Date(b.createdAt).getTime()
        comparison = timeA - timeB
      }
      return asgnSortOrder === 'desc' ? -comparison : comparison
    })
    return list
  }, [filteredAssignments, asgnSortBy, asgnSortOrder, staff])

  // ── Staff Portal ──────────────────────────────────────────────────────────
  const [portalStaffId, setPortalStaffId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hm_wa_current_staff_id') || ''
    }
    return ''
  })

  // Auto-select staff member when staff list loads
  useEffect(() => {
    if (staff.length > 0 && !portalStaffId) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('hm_wa_current_staff_id') : ''
      if (saved && staff.some(s => s.id === saved)) {
        setPortalStaffId(saved)
      } else {
        setPortalStaffId(staff[0].id)
      }
    }
  }, [staff, portalStaffId])

  const handleSelectStaff = (id: string) => {
    setPortalStaffId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('hm_wa_current_staff_id', id)
    }
  }

  const [localCounters, setLocalCounters] = useState<Record<string, number>>({})

  const portalAssignments = useMemo(() =>
    portalStaffId ? assignments.filter(a => a.staffId === portalStaffId) : [],
    [assignments, portalStaffId]
  )

  const filteredAndSortedPortalAssignments = useMemo(() => {
    let list = [...portalAssignments]
    const now = new Date()

    if (portalSelectedDate) {
      list = list.filter(item => {
        if (!item.deadline && !item.due_datetime) return false
        const raw = item.due_datetime || (item.deadline ? `${item.deadline}T00:00:00` : '')
        return raw.startsWith(portalSelectedDate)
      })
    } else if (portalDatePreset === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      list = list.filter(item => {
        const raw = item.due_datetime || item.deadline || ''
        return raw.startsWith(todayStr)
      })
    } else if (portalDatePreset === 'tomorrow') {
      const tmr = new Date(now); tmr.setDate(now.getDate() + 1)
      const tmrStr = tmr.toISOString().split('T')[0]
      list = list.filter(item => {
        const raw = item.due_datetime || item.deadline || ''
        return raw.startsWith(tmrStr)
      })
    } else if (portalDatePreset === 'week') {
      const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7)
      list = list.filter(item => {
        const raw = item.due_datetime || (item.deadline ? `${item.deadline}T23:59:59` : '')
        if (!raw) return false
        const d = new Date(raw)
        return d >= now && d <= weekEnd
      })
    } else if (portalDatePreset === 'overdue') {
      list = list.filter(item => {
        if (item.status === 'completed') return false
        if ((item.completedQuantity || 0) >= item.totalQuantity) return false
        const raw = item.due_datetime || (item.deadline ? `${item.deadline}T23:59:59` : '')
        if (!raw) return false
        return new Date(raw) < now
      })
    }

    list.sort((a, b) => {
      if (portalDateSortOrder === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      const getTime = (x: Assignment) => {
        const raw = x.due_datetime || (x.deadline ? `${x.deadline}T23:59:59` : '')
        return raw ? new Date(raw).getTime() : (portalDateSortOrder === 'asc' ? Infinity : -Infinity)
      }
      return portalDateSortOrder === 'asc' ? getTime(a) - getTime(b) : getTime(b) - getTime(a)
    })

    return list
  }, [portalAssignments, portalSelectedDate, portalDatePreset, portalDateSortOrder])

  const STATUS_FLOW: Record<AssignmentStatus, number> = {
    pending: 1,
    in_progress: 2,
    on_hold: 3,
    completed: 4,
  }

  const sortedPortalAssignments = useMemo(() => {
    const list = [...portalAssignments]
    list.sort((a, b) => {
      let comparison = 0
      if (portalSortBy === 'deadline') {
        const timeA = a.deadline ? new Date(a.deadline.includes('T') ? a.deadline : `${a.deadline}T23:59:59`).getTime() : Infinity
        const timeB = b.deadline ? new Date(b.deadline.includes('T') ? b.deadline : `${b.deadline}T23:59:59`).getTime() : Infinity
        comparison = timeA - timeB
      } else if (portalSortBy === 'remaining') {
        const remA = Math.max(0, a.totalQuantity - a.completedQuantity)
        const remB = Math.max(0, b.totalQuantity - b.completedQuantity)
        comparison = remB - remA // Default most remaining first
      } else if (portalSortBy === 'total') {
        comparison = b.totalQuantity - a.totalQuantity // Default highest quantity first
      } else if (portalSortBy === 'status') {
        comparison = (STATUS_FLOW[a.status] || 0) - (STATUS_FLOW[b.status] || 0)
      }
      return portalSortOrder === 'desc' ? -comparison : comparison
    })
    return list
  }, [portalAssignments, portalSortBy, portalSortOrder])

  useEffect(() => {
    setLocalCounters(prev => {
      const next = { ...prev }
      assignments.forEach(a => {
        if (next[a.id] === undefined) {
          next[a.id] = a.completedQuantity
        }
      })
      return next
    })
  }, [assignments])

  // ── Dashboard stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalUnitsAssigned = assignments.reduce((s, a) => s + a.totalQuantity, 0)
    const totalUnitsDone = assignments.reduce((s, a) => s + a.completedQuantity, 0)
    return {
      totalJobs: jobs.length,
      totalStaff: staff.length,
      totalAssignments: assignments.length,
      pending: assignments.filter(a => a.status === 'pending').length,
      inProgress: assignments.filter(a => a.status === 'in_progress').length,
      completed: assignments.filter(a => a.status === 'completed').length,
      onHold: assignments.filter(a => a.status === 'on_hold').length,
      totalUnitsAssigned,
      totalUnitsDone,
    }
  }, [jobs, staff, assignments])

  const views = isAdmin
    ? [
        { id: 'dashboard',   label: 'Dashboard',    icon: <BarChart2 size={15} /> },
        { id: 'jobs',        label: 'Jobs',          icon: <Briefcase size={15} /> },
        { id: 'staff',       label: 'Staff',         icon: <Users size={15} /> },
        { id: 'assignments', label: 'Assignments',   icon: <ClipboardList size={15} /> },
        { id: 'portal',      label: 'Staff Portal',  icon: <CheckCircle2 size={15} /> },
      ]
    : [{ id: 'portal', label: 'My Tasks', icon: <ClipboardList size={15} /> }]

  const getJobTitle = useCallback((id: string) => jobs.find(j => j.id === id)?.title || '—', [jobs])
  const getStaffName = useCallback((id: string) => staff.find(s => s.id === id)?.name || '—', [staff])

  // ── Views ──────────────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-5">
      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs',        value: stats.totalJobs,        bg: 'from-pink-50 to-rose-50',     icon: <Briefcase size={18} className="text-[#F500A0]" /> },
          { label: 'Total Staff',       value: stats.totalStaff,       bg: 'from-purple-50 to-violet-50', icon: <Users size={18} className="text-purple-500" /> },
          { label: 'Assignments',      value: stats.totalAssignments, bg: 'from-blue-50 to-indigo-50',   icon: <ClipboardList size={18} className="text-blue-500" /> },
          { label: 'Units Completed',   value: `${stats.totalUnitsDone} / ${stats.totalUnitsAssigned}`, bg: 'from-emerald-50 to-teal-50', icon: <BarChart2 size={18} className="text-emerald-500" /> },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.bg} rounded-2xl border border-white/60 p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold tracking-wider text-gray-700 uppercase">{c.label}</p>
              {c.icon}
            </div>
            <p className="text-xl font-extrabold sm:text-2xl sm:font-black text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Assignment Status Breakdown Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wider">Assignment Status Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['pending', 'in_progress', 'completed', 'on_hold'] as AssignmentStatus[]).map(status => {
            const count = assignments.filter(a => a.status === status).length
            const m = STATUS_META[status]
            return (
              <div key={status} className="rounded-xl p-3 flex flex-col gap-1.5 border" style={{ background: m.bg, borderColor: `${m.color}25` }}>
                <div className="flex items-center gap-1.5" style={{ color: m.color }}>
                  {m.icon}
                  <span className="text-xs font-bold uppercase tracking-wider">{m.label}</span>
                </div>
                <p className="text-xl font-extrabold sm:text-2xl sm:font-black" style={{ color: m.color }}>{count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* RECENT UNIT PROGRESS with Date Filter Toolbar */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          {/* Header Row: Title | Date Controls | Live Sync */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h3 className="text-base font-bold text-gray-900 uppercase tracking-wider shrink-0">Recent Unit Progress</h3>

            {/* Date filter controls */}
            <div className="flex items-center gap-1.5 flex-wrap ml-auto mr-2">
              {/* Calendar Date Picker */}
              <div className="relative flex items-center gap-1.5 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-gray-50 hover:bg-white hover:border-[#F500A0]/40 transition-colors cursor-pointer">
                <Calendar size={13} className="text-[#F500A0] shrink-0" />
                <input
                  type="date"
                  value={dashSelectedDate}
                  onChange={e => {
                    setDashSelectedDate(e.target.value)
                    setDashDatePreset('all')
                  }}
                  className="text-xs font-bold text-gray-700 bg-transparent outline-none cursor-pointer w-28"
                  title="Pick a specific date to filter"
                />
                {dashSelectedDate && (
                  <button
                    onClick={() => { setDashSelectedDate(''); setDashDatePreset('all') }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Clear date filter"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Quick Preset Pills */}
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-0.5">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'today', label: 'Today' },
                  { id: 'tomorrow', label: 'Tmrw' },
                  { id: 'week', label: 'Week' },
                  { id: 'overdue', label: 'Overdue' },
                ] as const).map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setDashDatePreset(p.id); setDashSelectedDate('') }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                      dashDatePreset === p.id && !dashSelectedDate
                        ? (p.id === 'overdue' ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-[#F500A0] shadow-sm')
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Sort Order */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50">
                <ChevronDown size={11} className="text-gray-400 shrink-0" />
                <select
                  value={dashSortOrder}
                  onChange={e => setDashSortOrder(e.target.value as typeof dashSortOrder)}
                  className="bg-transparent text-[10px] font-bold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="asc">Due: Nearest First</option>
                  <option value="desc">Due: Furthest First</option>
                  <option value="recent">Recently Assigned</option>
                </select>
              </div>
            </div>

            {/* Live Sync indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-gray-500">Live Sync Active</span>
            </div>
          </div>

          {/* Active filter indicator */}
          {(dashSelectedDate || dashDatePreset !== 'all') && (
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#F500A0]">
              <Filter size={11} />
              <span>Showing {filteredAndSortedDashboardAssignments.length} of {assignments.length} assignments</span>
              <button
                onClick={() => { setDashSelectedDate(''); setDashDatePreset('all') }}
                className="text-gray-400 hover:text-gray-700 underline ml-1 transition-colors"
              >Clear filter</button>
            </div>
          )}

          <div className="space-y-3">
            {filteredAndSortedDashboardAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No assignments match the selected filter.</p>
              </div>
            ) : filteredAndSortedDashboardAssignments.slice(0, 8).map(a => {
              const remaining = Math.max(0, a.totalQuantity - a.completedQuantity)
              const isOverdue = isAssignmentOverdue(a)
              return (
                <div key={a.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 ${isOverdue ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm sm:text-base font-bold text-gray-900 truncate">{getJobTitle(a.jobId)}</p>
                      {isOverdue && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">OVERDUE</span>}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 font-semibold">{getStaffName(a.staffId)}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-xs sm:text-sm font-semibold">
                      <span className="text-gray-500">Total: </span>
                      <span className="text-gray-900 font-black">{a.totalQuantity} {a.unit}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-emerald-600 font-black">Done: {a.completedQuantity}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-[#F500A0] font-black">Left: {remaining}</span>
                    </div>
                    <div className="w-32 hidden md:block">
                      <ProgressBar completed={a.completedQuantity} total={a.totalQuantity} />
                    </div>
                    <Badge status={a.status} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const renderJobs = () => (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wider">
          {jobEditId ? 'Edit Job Type' : 'Add New Job Type'}
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
            placeholder="e.g. A-Line Kurti Stitching, Blouse Hand Embroidery…"
            value={jobForm.title}
            onChange={e => { setJobForm({ title: e.target.value }); setJobError('') }}
            onKeyDown={e => e.key === 'Enter' && void saveJob()}
          />
          <div className="flex gap-2">
            <button onClick={saveJob}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: '#F500A0' }}>
              {jobEditId ? <><Edit2 size={14} /> Save</> : <><Plus size={14} /> Add Job</>}
            </button>
            {jobEditId && (
              <button onClick={() => { setJobEditId(null); setJobForm({ title: '' }); setJobError('') }}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 cursor-pointer">
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
        {jobError && <p className="mt-2 text-xs font-bold text-red-600">{jobError}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 uppercase tracking-wider">All Job Types ({jobs.length})</h3>
        </div>
        {jobs.length === 0 ? (
          <div className="p-10 text-center">
            <Briefcase size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">No jobs added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {jobs.map(j => (
              <div key={j.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF0F8' }}>
                  <Briefcase size={15} style={{ color: '#F500A0' }} />
                </div>
                <p className="flex-1 text-sm sm:text-base font-bold text-gray-900">{j.title}</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEditJob(j)}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-[#F500A0] hover:text-[#F500A0] transition-colors cursor-pointer">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => void deleteJob(j.id)}
                    className="rounded-lg border border-red-100 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderStaff = () => (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wider">
          {staffEditId ? 'Edit Staff Member' : 'Add New Staff Member'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
            placeholder="Full Name (e.g. Priya S)"
            value={staffForm.name}
            onChange={e => { setStaffForm(f => ({ ...f, name: e.target.value })); setStaffError('') }}
          />
          <input
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
            placeholder="Experience (e.g. 5 Years – Blouse Specialist)"
            value={staffForm.experience}
            onChange={e => setStaffForm(f => ({ ...f, experience: e.target.value }))}
          />
        </div>
        {staffError && <p className="mt-2 text-xs font-bold text-red-600">{staffError}</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={saveStaff}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: '#F500A0' }}>
            {staffEditId ? <><Edit2 size={14} /> Save</> : <><Plus size={14} /> Add Staff</>}
          </button>
          {staffEditId && (
            <button onClick={() => { setStaffEditId(null); setStaffForm({ name: '', experience: '' }); setStaffError('') }}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 cursor-pointer">
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] transition-all"
            placeholder="Search staff by name or code…"
            value={staffSearch}
            onChange={e => setStaffSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-2xs shrink-0">
          <ArrowUpDown size={13} className="text-[#F500A0] shrink-0" />
          <select
            className="bg-transparent text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer"
            value={staffSortBy}
            onChange={e => setStaffSortBy(e.target.value as StaffSortField)}
          >
            <option value="staff_code">Sort: Staff Code</option>
            <option value="name">Sort: Staff Name</option>
            <option value="tasks_count">Sort: Total Tasks</option>
            <option value="remaining_work">Sort: Remaining Work</option>
          </select>
          <button
            type="button"
            onClick={() => setStaffSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            title={staffSortOrder === 'asc' ? 'Ascending (Click for Descending)' : 'Descending (Click for Ascending)'}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors cursor-pointer"
          >
            {staffSortOrder === 'asc' ? <ArrowUp size={13} className="text-[#F500A0]" /> : <ArrowDown size={13} className="text-[#F500A0]" />}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 uppercase tracking-wider">All Staff ({sortedStaff.length})</h3>
          <span className="text-xs font-medium text-gray-500">Sorted by {staffSortBy.replace('_', ' ')} ({staffSortOrder})</span>
        </div>
        {sortedStaff.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">{staff.length === 0 ? 'No staff added yet' : 'No results found'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedStaff.map(s => {
              const myAssignments = assignments.filter(a => a.staffId === s.id)
              const active = myAssignments.filter(a => a.status === 'in_progress').length
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm text-white shadow-sm"
                    style={{ background: '#F500A0' }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm sm:text-base font-bold text-gray-900">{s.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">{s.staffCode}</span>
                    </div>
                    {s.experience && <p className="text-xs text-gray-600 font-medium truncate">{s.experience}</p>}
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs sm:text-sm font-bold text-gray-900">{myAssignments.length} assignments</p>
                    {active > 0 && <p className="text-xs font-semibold text-blue-600">{active} in progress</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => startEditStaff(s)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-[#F500A0] hover:text-[#F500A0] transition-colors cursor-pointer">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => void deleteStaff(s.id)}
                      className="rounded-lg border border-red-100 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const renderAssignments = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={openNewAsgn}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
          style={{ background: '#F500A0' }}>
          <Plus size={14} /> New Assignment
        </button>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] transition-all"
            placeholder="Search…"
            value={asgnSearch}
            onChange={e => setAsgnSearch(e.target.value)}
          />
        </div>

        <select
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#F500A0]"
          value={asgnFilterStatus}
          onChange={e => setAsgnFilterStatus(e.target.value as typeof asgnFilterStatus)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </select>

        <select
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#F500A0]"
          value={asgnFilterStaff}
          onChange={e => setAsgnFilterStaff(e.target.value)}
        >
          <option value="">All Staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
          <ArrowUpDown size={13} className="text-[#F500A0] shrink-0" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:inline">Sort:</span>
          <select
            className="bg-transparent text-xs sm:text-sm font-semibold text-gray-800 focus:outline-none cursor-pointer"
            value={asgnSortBy}
            onChange={e => setAsgnSortBy(e.target.value as AdminSortField)}
          >
            <option value="due_datetime">Deadline (Urgent First)</option>
            <option value="remaining_quantity">Most Work Remaining</option>
            <option value="total_quantity">Total Work Assigned</option>
            <option value="staff_code">Staff ID / Code</option>
            <option value="created_at">Date Created</option>
          </select>
          <button
            onClick={() => setAsgnSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="p-1 rounded-lg hover:bg-white text-gray-600 hover:text-[#F500A0] transition-colors border border-transparent hover:border-gray-200 cursor-pointer"
            title={`Toggle direction (${asgnSortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
          >
            {asgnSortOrder === 'asc' ? <ArrowUp size={12} className="text-[#F500A0]" /> : <ArrowDown size={12} className="text-[#F500A0]" />}
          </button>
        </div>

        {(asgnSearch || asgnFilterStatus !== 'all' || asgnFilterStaff) && (
          <button onClick={() => { setAsgnSearch(''); setAsgnFilterStatus('all'); setAsgnFilterStaff('') }}
            className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-500 hover:bg-gray-50 cursor-pointer">
            <X size={12} /> Clear
          </button>
        )}

        <button
          onClick={reloadAll}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 ml-auto cursor-pointer"
          title="Refresh assignments"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#F500A0]' : ''} />
          <span className="hidden sm:inline">Sync</span>
        </button>

        <span className="text-xs font-medium text-gray-500">{sortedAssignments.length} record{sortedAssignments.length !== 1 ? 's' : ''}</span>
      </div>

      {dbNotice && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold">
          <AlertCircle size={15} className="shrink-0 text-amber-600" />
          <span>{dbNotice}</span>
        </div>
      )}

      {sortedAssignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <ClipboardList size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">
            {assignments.length === 0 ? 'No assignments yet. Click "New Assignment" to get started.' : 'No assignments match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map(a => {
            const remaining = Math.max(0, a.totalQuantity - a.completedQuantity)
            const pct = a.totalQuantity > 0 ? Math.round((a.completedQuantity / a.totalQuantity) * 100) : 0
            const isOverdue = isAssignmentOverdue(a)

            return (
              <div key={a.id} className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm sm:text-base font-bold text-gray-900">{getJobTitle(a.jobId)}</p>
                      <Badge status={a.status} />
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                          <AlertTriangle size={11} /> OVERDUE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-900 font-semibold flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-[#F500A0]" /> {getStaffName(a.staffId)}
                      </span>
                      {a.deadline && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-700 font-black' : 'text-gray-600'}`}>
                          <Clock size={12} className={isOverdue ? 'text-red-600' : 'text-[#F500A0]'} />
                          Due: {new Date(a.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {/* Numerical Unit Metrics Display */}
                    <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex-wrap text-xs sm:text-sm font-semibold">
                      <div>
                        <span className="text-gray-500 font-medium">Total: </span>
                        <span className="text-gray-900 font-black">{a.totalQuantity} {a.unit}</span>
                      </div>
                      <span className="text-gray-300">|</span>
                      <div>
                        <span className="text-emerald-700 font-medium">Completed: </span>
                        <span className="text-emerald-700 font-black">{a.completedQuantity} {a.unit}</span>
                      </div>
                      <span className="text-gray-300">|</span>
                      <div>
                        <span className="text-[#F500A0] font-medium">Remaining: </span>
                        <span className="text-[#F500A0] font-black">{remaining} {a.unit}</span>
                      </div>
                      <span className="text-gray-300">|</span>
                      <div>
                        <span className="text-gray-500 font-medium">Progress: </span>
                        <span className="text-gray-900 font-black">{pct}%</span>
                      </div>
                    </div>

                    {a.notes && <p className="text-xs sm:text-sm text-gray-500 italic">{a.notes}</p>}

                    <div className="pt-1">
                      <ProgressBar completed={a.completedQuantity} total={a.totalQuantity} unit={a.unit} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Stepper quick controls for Admin */}
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white mr-1 shadow-2xs">
                      <button
                        onClick={() => void updateCompletedUnits(a.id, a.completedQuantity - 1)}
                        disabled={a.completedQuantity <= 0}
                        title="Decrement completed units"
                        className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent text-gray-700 transition-colors cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="px-2 text-xs sm:text-sm font-bold text-gray-900">
                        {a.completedQuantity}
                      </span>
                      <button
                        onClick={() => void updateCompletedUnits(a.id, a.completedQuantity + 1)}
                        disabled={a.completedQuantity >= a.totalQuantity}
                        title="Increment completed units"
                        className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent text-gray-700 transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {a.status !== 'in_progress' && (
                      <button onClick={() => void updateAsgnStatus(a.id, 'in_progress')} title="Mark In Progress"
                        className="rounded-lg border border-blue-100 bg-blue-50 p-1.5 text-blue-500 hover:bg-blue-100 transition-colors cursor-pointer">
                        <Play size={13} />
                      </button>
                    )}
                    {a.status !== 'completed' && (
                      <button onClick={() => void updateAsgnStatus(a.id, 'completed')} title="Mark Completed"
                        className="rounded-lg border border-emerald-100 bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer">
                        <Check size={13} />
                      </button>
                    )}
                    {a.status !== 'on_hold' && (
                      <button onClick={() => void updateAsgnStatus(a.id, 'on_hold')} title="Mark On Hold"
                        className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer">
                        <Pause size={13} />
                      </button>
                    )}
                    <button onClick={() => startEditAsgn(a)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-[#F500A0] hover:text-[#F500A0] transition-colors cursor-pointer">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => void deleteAsgn(a.id)}
                      className="rounded-lg border border-red-100 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assignment modal with direct typing inputs */}
      {asgnShowModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity"
          onClick={e => { if (e.target === e.currentTarget) setAsgnShowModal(false) }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{asgnEditId ? 'Edit Assignment' : 'New Assignment'}</h2>
              <button onClick={() => setAsgnShowModal(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {asgnError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-600">
                  <AlertCircle size={14} />{asgnError}
                </div>
              )}

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Job Type *</span>
                <select
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
                  value={asgnForm.jobId}
                  onChange={e => setAsgnForm(f => ({ ...f, jobId: e.target.value }))}
                >
                  <option value="">Select a job…</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Assign To *</span>
                <select
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
                  value={asgnForm.staffId}
                  onChange={e => setAsgnForm(f => ({ ...f, staffId: e.target.value }))}
                >
                  <option value="">Select staff…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.staffCode})</option>)}
                </select>
              </label>

              {/* Direct-typing Quantity & Unit Row */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Quantity (Total) *</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
                    value={asgnForm.totalQuantity}
                    onChange={e => handleTotalQuantityChange(e.target.value)}
                    onBlur={() => {
                      setAsgnForm(f => {
                        const num = Math.max(1, parseInt(String(f.totalQuantity)) || 1)
                        return { ...f, totalQuantity: num }
                      })
                    }}
                    placeholder="e.g. 12"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Unit</span>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
                    value={asgnForm.unit}
                    onChange={e => setAsgnForm(f => ({ ...f, unit: e.target.value }))}
                  >
                    <option value="sets">sets</option>
                    <option value="pieces">pieces</option>
                    <option value="pairs">pairs</option>
                    <option value="meters">meters</option>
                    <option value="sarees">sarees</option>
                    <option value="orders">orders</option>
                    <option value="hrs">hrs</option>
                  </select>
                </label>
              </div>

              {/* Direct-typing Completed Quantity & Auto-calculated Remaining Badge */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Completed Quantity</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#FFF0F8] text-[#F500A0] border border-[#F500A0]/20">
                    Remaining: {modalRemaining} {asgnForm.unit}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={modalTotal}
                    step="1"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm sm:text-base font-bold text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] transition-all"
                    value={asgnForm.completedQuantity}
                    onChange={e => handleCompletedQuantityChange(e.target.value)}
                    onBlur={() => {
                      setAsgnForm(f => {
                        const totalNum = Math.max(1, parseInt(String(f.totalQuantity)) || 1)
                        const comp = Math.max(0, Math.min(totalNum, parseInt(String(f.completedQuantity)) || 0))
                        return { ...f, completedQuantity: comp }
                      })
                    }}
                    placeholder="0"
                  />
                  <div className="text-right shrink-0">
                    <span className="text-sm sm:text-base font-black text-gray-900">/ {modalTotal}</span>
                    <span className="text-xs font-bold text-gray-500 ml-1">{asgnForm.unit}</span>
                  </div>
                </div>

                {/* Auto Calculated Progress Bar */}
                <div className="pt-1">
                  <ProgressBar completed={modalCompleted} total={modalTotal} unit={asgnForm.unit} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Deadline</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
                    value={asgnForm.deadline}
                    onChange={e => setAsgnForm(f => ({ ...f, deadline: e.target.value }))}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Status (Auto-Synced)</span>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
                    value={asgnForm.status}
                    onChange={e => setAsgnForm(f => ({ ...f, status: e.target.value as AssignmentStatus }))}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5 block">Notes / Instructions</span>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all resize-none"
                  placeholder="Optional customer specifications, pattern notes…"
                  value={asgnForm.notes}
                  onChange={e => setAsgnForm(f => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setAsgnShowModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={saveAsgn}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                style={{ background: '#F500A0' }}>
                {asgnEditId ? 'Save Changes' : 'Create Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderPortal = () => (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 uppercase tracking-wider mb-3">Staff Portal — Select Your Profile</h3>
        <select
          className="w-full sm:max-w-xs rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/15 transition-all"
          value={portalStaffId}
          onChange={e => handleSelectStaff(e.target.value)}
        >
          <option value="">— Select your name —</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.staffCode})</option>)}
        </select>
        {staff.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 font-medium">No staff members found. Add staff in the Staff tab first.</p>
        )}
      </div>

      {portalStaffId && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['pending', 'in_progress', 'completed', 'on_hold'] as AssignmentStatus[]).map(status => {
              const count = portalAssignments.filter(a => a.status === status).length
              const m = STATUS_META[status]
              return (
                <div key={status} className="rounded-2xl p-4 flex flex-col gap-1.5 border shadow-sm" style={{ background: m.bg, borderColor: `${m.color}20` }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: m.color }}>{m.label}</p>
                  <p className="text-xl font-extrabold sm:text-2xl sm:font-black" style={{ color: m.color }}>{count}</p>
                </div>
              )
            })}
          </div>

          {sortedPortalAssignments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <ClipboardList size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No tasks assigned to you yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-2xs space-y-3">
                {/* Row 1: Title + Sort controls */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 uppercase tracking-wider">My Tasks ({filteredAndSortedPortalAssignments.length})</h3>
                    <span className="text-xs font-medium text-gray-500">Update completed units below</span>
                  </div>

                  {/* Staff Portal Sorting Controls */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:inline">Sort:</span>
                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                      {(
                        [
                          { id: 'deadline', label: 'Deadline' },
                          { id: 'remaining', label: 'Remaining' },
                          { id: 'total', label: 'Total Sets' },
                          { id: 'status', label: 'Status' }
                        ] as const
                      ).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setPortalSortBy(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            portalSortBy === tab.id
                              ? 'bg-white text-[#F500A0] shadow-2xs font-black'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPortalSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white text-xs font-bold text-gray-700 hover:text-[#F500A0] transition-colors cursor-pointer"
                      title={`Direction: ${portalSortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                    >
                      {portalSortOrder === 'asc' ? <ArrowUp size={12} className="text-[#F500A0]" /> : <ArrowDown size={12} className="text-[#F500A0]" />}
                      <span className="hidden md:inline uppercase text-[9px]">{portalSortOrder}</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: Date Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
                  <Calendar size={13} className="text-[#F500A0] shrink-0" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider shrink-0">Filter by Due:</span>

                  {/* Calendar Date Picker */}
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-gray-50 hover:border-[#F500A0]/40 transition-colors">
                    <input
                      type="date"
                      value={portalSelectedDate}
                      onChange={e => {
                        setPortalSelectedDate(e.target.value)
                        setPortalDatePreset('all')
                      }}
                      className="text-xs font-bold text-gray-700 bg-transparent outline-none cursor-pointer w-28"
                      title="Pick a specific date"
                    />
                    {portalSelectedDate && (
                      <button
                        onClick={() => { setPortalSelectedDate(''); setPortalDatePreset('all') }}
                        className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Quick Preset Pills */}
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-0.5">
                    {([
                      { id: 'all', label: 'All' },
                      { id: 'today', label: 'Today' },
                      { id: 'tomorrow', label: 'Tmrw' },
                      { id: 'week', label: 'This Week' },
                      { id: 'overdue', label: 'Overdue' },
                    ] as const).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setPortalDatePreset(p.id); setPortalSelectedDate('') }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                          portalDatePreset === p.id && !portalSelectedDate
                            ? (p.id === 'overdue' ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-[#F500A0] shadow-sm')
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Date Sort */}
                  <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50 ml-auto">
                    <ChevronDown size={11} className="text-gray-400 shrink-0" />
                    <select
                      value={portalDateSortOrder}
                      onChange={e => setPortalDateSortOrder(e.target.value as typeof portalDateSortOrder)}
                      className="bg-transparent text-[10px] font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                      <option value="asc">Due: Nearest First</option>
                      <option value="desc">Due: Furthest First</option>
                      <option value="recent">Recently Assigned</option>
                    </select>
                  </div>
                </div>

                {/* Active filter chip */}
                {(portalSelectedDate || portalDatePreset !== 'all') && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F500A0]">
                    <Filter size={11} />
                    <span>Filtered: {filteredAndSortedPortalAssignments.length} of {portalAssignments.length} tasks</span>
                    <button
                      onClick={() => { setPortalSelectedDate(''); setPortalDatePreset('all') }}
                      className="text-gray-400 hover:text-gray-700 underline ml-1 cursor-pointer"
                    >Clear</button>
                  </div>
                )}
              </div>

              {filteredAndSortedPortalAssignments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                  <Calendar size={30} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">No tasks match the selected date filter.</p>
                  <button onClick={() => { setPortalSelectedDate(''); setPortalDatePreset('all') }} className="mt-2 text-xs font-bold text-[#F500A0] hover:underline cursor-pointer">Clear filter</button>
                </div>
              ) : filteredAndSortedPortalAssignments.map(a => {
                const isOverdue = isAssignmentOverdue(a)
                const currentCounter = localCounters[a.id] ?? a.completedQuantity
                const remaining = Math.max(0, a.totalQuantity - a.completedQuantity)
                const pct = a.totalQuantity > 0 ? Math.round((a.completedQuantity / a.totalQuantity) * 100) : 0
                const isUnsaved = currentCounter !== a.completedQuantity

                return (
                  <div key={a.id} className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 ${isOverdue ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'}`}>
                    {/* Header with Title, Status & Deadline */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base sm:text-lg font-bold text-gray-900">{getJobTitle(a.jobId)}</p>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                              <AlertTriangle size={11} /> OVERDUE
                            </span>
                          )}
                        </div>
                        {a.deadline && (
                          <p className={`mt-1 text-xs sm:text-sm font-semibold flex items-center gap-1 ${isOverdue ? 'text-red-600 font-black' : 'text-gray-600'}`}>
                            <Clock size={13} className={isOverdue ? 'text-red-600' : 'text-[#F500A0]'} />
                            Due: {new Date(a.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                        {a.notes && <p className="mt-1 text-xs sm:text-sm text-gray-500 italic">{a.notes}</p>}
                      </div>
                      <Badge status={a.status} />
                    </div>

                    {/* Structured Numerical Metric Display */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                      <div className="p-2 bg-white rounded-xl shadow-2xs border border-gray-100">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Total</span>
                        <span className="text-base sm:text-lg font-black text-gray-900">{a.totalQuantity} {a.unit}</span>
                      </div>
                      <div className="p-2 bg-emerald-50/70 rounded-xl shadow-2xs border border-emerald-100">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">Completed</span>
                        <span className="text-base sm:text-lg font-black text-emerald-700">{a.completedQuantity} {a.unit}</span>
                      </div>
                      <div className="p-2 bg-[#FFF0F8] rounded-xl shadow-2xs border border-[#F500A0]/20">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#F500A0] block">Remaining</span>
                        <span className="text-base sm:text-lg font-black text-[#F500A0]">{remaining} {a.unit}</span>
                      </div>
                    </div>

                    {/* Visual Progress Bar with Ratio & Percentage */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                        <span className="text-gray-700">{a.completedQuantity} / {a.totalQuantity} {a.unit} ({pct}%)</span>
                        <span style={{ color: pct === 100 ? '#15803D' : '#F500A0' }}>{pct}% Done</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? '#15803D' : '#F500A0'
                          }}
                        />
                      </div>
                    </div>

                    {/* Interactive Stepper / Direct Input Widget for Staff */}
                    <div className="p-4 rounded-2xl border border-gray-100 bg-white shadow-2xs flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-800">Update Done:</span>
                        <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(0, currentCounter - 1)
                              setLocalCounters(prev => ({ ...prev, [a.id]: next }))
                            }}
                            disabled={currentCounter <= 0}
                            className="p-2 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-gray-700 transition-colors cursor-pointer"
                          >
                            <Minus size={15} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={a.totalQuantity}
                            step="1"
                            inputMode="numeric"
                            value={currentCounter}
                            onChange={e => {
                              const val = Math.max(0, Math.min(a.totalQuantity, parseInt(e.target.value) || 0))
                              setLocalCounters(prev => ({ ...prev, [a.id]: val }))
                            }}
                            className="w-16 text-center py-1.5 bg-transparent text-sm sm:text-base font-bold text-gray-900 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(a.totalQuantity, currentCounter + 1)
                              setLocalCounters(prev => ({ ...prev, [a.id]: next }))
                            }}
                            disabled={currentCounter >= a.totalQuantity}
                            className="p-2 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-gray-700 transition-colors cursor-pointer"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-gray-500">{a.unit}</span>
                      </div>

                      <button
                        onClick={() => void updateCompletedUnits(a.id, currentCounter)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer ${
                          isUnsaved ? 'scale-102 ring-2 ring-[#F500A0]/40' : 'opacity-90'
                        }`}
                        style={{ background: '#F500A0' }}
                      >
                        <Check size={14} />
                        {isUnsaved ? 'Save Completed Units' : 'Updated'}
                      </button>
                    </div>

                    {/* Status Pill Buttons */}
                    <div className="flex gap-2 flex-wrap pt-1">
                      {(['pending', 'in_progress', 'on_hold', 'completed'] as AssignmentStatus[]).map(s => {
                        const m = STATUS_META[s]
                        const active = a.status === s
                        return (
                          <button key={s}
                            onClick={() => void updateAsgnStatus(a.id, s)}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer"
                            style={active ? { background: m.color, color: '#fff', borderColor: m.color } : { background: m.bg, color: m.color, borderColor: `${m.color}30` }}
                          >
                            {m.icon}{m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 animate-bounce ${
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
          toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' :
          'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[28px] md:text-3xl font-black text-[#111111] tracking-tight leading-tight">
            <span className="w-1.5 h-8 rounded-full bg-[#F500A0] flex-shrink-0 inline-block" />
            <span>{isAdmin ? "Work Allocation" : "Work Allocation — My Tasks"}</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 leading-snug mt-1 ml-4">
            {isAdmin
              ? "Assign stitching & embroidery tasks to staff with live unit tracking"
              : "Track assigned stitching jobs, deadline dates, and update completed units in real-time"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && stats.inProgress > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-2xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {stats.inProgress} active now
            </div>
          )}
          <button
            onClick={reloadAll}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#F500A0]' : ''} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Overdue Task Modal Alarm */}
      {showOverdueModal && (
        <OverdueTaskAlarmModal
          items={unackedOverdueItems}
          onAcknowledge={handleAcknowledgeOverdue}
          onSnooze={handleSnoozeOverdue}
          onDismiss={handleDismissOverdue}
        />
      )}

      {/* Overdue Task Alert Banner */}
      {overdueAssignments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-red-50/90 border-2 border-red-300 rounded-2xl text-red-950 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-200/80 flex items-center justify-center shrink-0 text-red-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-950">
                ⚠️ Overdue Task Alert: {overdueAssignments.length} assignment{overdueAssignments.length > 1 ? 's have' : ' has'} passed deadline!
              </p>
              <p className="text-xs text-red-800 font-medium">
                {overdueAssignments.map(o => `${getJobTitle(o.jobId)} (${getStaffName(o.staffId)})`).slice(0, 3).join(', ')}
                {overdueAssignments.length > 3 ? ` +${overdueAssignments.length - 3} more` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalDismissed(false)
                setSnoozeUntil(0)
                setAckedOverdueIds(new Set())
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              title="Open overdue alert popup and sound alarm"
            >
              <Volume2 size={13} /> View Alert &amp; Alarm
            </button>
            <button
              onClick={() => handleSnoozeOverdue(10)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-300 hover:bg-red-50 text-red-900 text-xs font-bold transition-colors cursor-pointer"
              title="Silence / snooze buzzer for 10 minutes"
            >
              <BellOff size={13} /> Snooze 10m
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Tabs Navigation Bar */}
      <div className="flex overflow-x-auto gap-1 rounded-2xl bg-gray-100 p-1.5 hide-scrollbar">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id as typeof activeView)}
            className={[
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer',
              activeView === v.id ? 'bg-white shadow-sm text-[#F500A0]' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {v.icon}{v.label}
          </button>
        ))}
      </div>

      {activeView === 'dashboard'   && renderDashboard()}
      {activeView === 'jobs'        && renderJobs()}
      {activeView === 'staff'       && renderStaff()}
      {activeView === 'assignments' && renderAssignments()}
      {activeView === 'portal'      && renderPortal()}
    </div>
  )
}
