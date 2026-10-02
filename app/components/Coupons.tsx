"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Tag, CheckCircle2, Repeat, RefreshCw, Edit2, Trash2, Plus, Sparkles } from 'lucide-react';
import { fetchCoupons, saveCoupon, deleteCoupon as removeCouponAction, toggleCouponActive } from '@/app/pos/actions';

export interface CouponItem {
  id: number;
  code: string;
  percentage: number;
  is_active: boolean;
  expiry_date?: string | null;
  usage_limit?: number | null;
  usage_count?: number;
  min_order_value?: number;
}

export default function Coupons() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [couponSaveError, setCouponSaveError] = useState('');
  const [couponSaveSuccess, setCouponSaveSuccess] = useState('');
  const [couponForm, setCouponForm] = useState({
    code: '',
    percentage: 10,
    expiry_date: '',
    usage_limit: '',
    min_order_value: '',
  });

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCoupons();
      setCoupons(data as CouponItem[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const generateCouponCode = () => {
    const prefixes = ['HM', 'DISC', 'SAVE', 'BOUTIQUE', 'RANI'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    setCouponForm(f => ({ ...f, code: `${p}${num}` }));
    setCouponSaveError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      setCouponSaveError('Coupon code is required');
      return;
    }
    if (couponForm.percentage < 1 || couponForm.percentage > 100) {
      setCouponSaveError('Percentage must be between 1 and 100');
      return;
    }

    const payload = {
      id: editingCouponId,
      code: couponForm.code,
      percentage: Number(couponForm.percentage) || 10,
      expiry_date: couponForm.expiry_date || null,
      usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : null,
      min_order_value: couponForm.min_order_value ? Number(couponForm.min_order_value) : 0,
    };

    const res = await saveCoupon(payload);
    if (!res.success) {
      setCouponSaveError(res.error || 'Failed to save coupon');
    } else {
      setCouponForm({ code: '', percentage: 10, expiry_date: '', usage_limit: '', min_order_value: '' });
      setEditingCouponId(null);
      setCouponSaveSuccess(editingCouponId !== null ? 'Coupon updated!' : 'Coupon created!');
      await loadCoupons();
      setTimeout(() => setCouponSaveSuccess(''), 4000);
    }
  };

  const startEditCoupon = (coupon: CouponItem) => {
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code,
      percentage: coupon.percentage,
      expiry_date: coupon.expiry_date ? coupon.expiry_date.slice(0, 10) : '',
      usage_limit: coupon.usage_limit !== null && coupon.usage_limit !== undefined ? String(coupon.usage_limit) : '',
      min_order_value: coupon.min_order_value ? String(coupon.min_order_value) : '',
    });
    setCouponSaveError('');
    setCouponSaveSuccess('');
  };

  const cancelEditCoupon = () => {
    setEditingCouponId(null);
    setCouponForm({ code: '', percentage: 10, expiry_date: '', usage_limit: '', min_order_value: '' });
    setCouponSaveError('');
    setCouponSaveSuccess('');
  };

  const handleDelete = async (coupon: CouponItem) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    await removeCouponAction(coupon.id);
    await loadCoupons();
  };

  const handleToggle = async (coupon: CouponItem) => {
    await toggleCouponActive(coupon.id, coupon.is_active);
    await loadCoupons();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2.5 text-[26px] font-black text-[#111111] tracking-tight leading-tight">
              <span className="w-1.5 h-7 rounded-full bg-[#F500A0] flex-shrink-0 inline-block" />
              <span>Coupon Management</span>
            </h2>
            <p className="max-w-2xl text-sm font-medium text-gray-600 leading-snug">
              Create and manage discount codes for HM Boutique. Applies to product subtotal only.
            </p>
          </div>
          <button
            onClick={() => void loadCoupons()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-shopSoft bg-shopTint px-4 py-2 text-xs sm:text-sm font-bold text-[#F500A0] shadow-sm transition-colors hover:bg-[#FFE5F4] active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total Coupons', value: coupons.length, Icon: Tag, iconBg: 'bg-[#FFF0F8]', iconColor: 'text-[#F500A0]' },
            { label: 'Active', value: coupons.filter(c => c.is_active).length, Icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
            { label: 'Total Used', value: coupons.reduce((acc, c) => acc + (c.usage_count || 0), 0), Icon: Repeat, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-shopSoft bg-white px-5 py-4 shadow-sm hover:border-[#F500A0]/30 transition-colors">
              <span className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ${c.iconBg} ${c.iconColor}`}>
                <c.Icon size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{c.label}</p>
                <p className="text-2xl font-black text-[#111111]">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#F500A0]/30 bg-[#FFF0F8] px-4 py-2.5 text-xs font-semibold text-gray-900 shadow-sm flex items-center gap-2">
          <Sparkles size={15} className="text-[#F500A0] shrink-0" />
          <span>Coupon discount applies directly to subtotal and syncs instantly with billing and offline POS.</span>
        </div>
      </div>

      {/* FORM & LIST */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* CREATE / EDIT FORM */}
        <form onSubmit={handleSave} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 h-fit">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[#F500A0] font-bold text-xs tracking-wider uppercase">
                {editingCouponId !== null ? 'EDIT MODE' : 'NEW COUPON'}
              </p>
              <h3 className="mt-1 text-black font-extrabold text-xl">
                {editingCouponId !== null ? 'Edit Coupon' : 'Create Coupon'}
              </h3>
            </div>
            {editingCouponId !== null && (
              <button
                type="button"
                onClick={cancelEditCoupon}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>

          {couponSaveError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">
              {couponSaveError}
            </div>
          )}
          {couponSaveSuccess && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-xs font-bold text-green-700">
              {couponSaveSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-gray-800 font-bold uppercase tracking-wider text-xs">Coupon Code *</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25 placeholder:text-sm placeholder:text-gray-400"
                placeholder="WELCOME10"
                value={couponForm.code}
                disabled={editingCouponId !== null}
                onChange={e => {
                  setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }));
                  setCouponSaveError('');
                  setCouponSaveSuccess('');
                }}
              />
              {editingCouponId === null && (
                <button
                  type="button"
                  onClick={generateCouponCode}
                  className="shrink-0 rounded-xl bg-[#F500A0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.99]"
                >
                  Generate
                </button>
              )}
            </div>
            {editingCouponId !== null && (
              <p className="text-xs font-medium text-gray-500">Code cannot be changed when editing</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-gray-800 font-bold uppercase tracking-wider text-xs">Discount % *</label>
              <input
                type="number"
                min="1"
                max="100"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25 placeholder:text-sm placeholder:text-gray-400"
                placeholder="10"
                value={couponForm.percentage}
                onChange={e => setCouponForm(f => ({ ...f, percentage: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-gray-800 font-bold uppercase tracking-wider text-xs">Min Order (₹)</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25 placeholder:text-sm placeholder:text-gray-400"
                placeholder="0 = none"
                value={couponForm.min_order_value}
                onChange={e => setCouponForm(f => ({ ...f, min_order_value: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-gray-800 font-bold uppercase tracking-wider text-xs">Expiry Date</label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={couponForm.expiry_date}
                onChange={e => setCouponForm(f => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-gray-800 font-bold uppercase tracking-wider text-xs">Usage Limit</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25 placeholder:text-sm placeholder:text-gray-400"
                placeholder="Unlimited"
                value={couponForm.usage_limit}
                onChange={e => setCouponForm(f => ({ ...f, usage_limit: e.target.value }))}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#F500A0] py-3 text-sm font-bold text-white shadow-md transition-all hover:brightness-95 active:scale-[0.99]"
          >
            {editingCouponId !== null ? 'Update Coupon' : 'Create Coupon'}
          </button>
        </form>

        {/* COUPON LIST TABLE / CARDS */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[#F500A0] font-bold text-xs tracking-wider uppercase">Coupon Roster</p>
              <h3 className="mt-1 text-black font-extrabold text-xl">
                All Coupons <span className="text-gray-500 font-normal">({coupons.length})</span>
              </h3>
            </div>
            <span className="rounded-full border border-[#F500A0]/20 bg-[#FFF0F8] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#F500A0]">
              Admin only
            </span>
          </div>

          <div className="space-y-2.5 max-h-[36rem] overflow-y-auto pr-1">
            {coupons.map((coupon) => {
              const isExpired = coupon.expiry_date ? new Date(coupon.expiry_date) < new Date() : false;
              const isExhausted = coupon.usage_limit !== null && coupon.usage_limit !== undefined && (coupon.usage_count || 0) >= coupon.usage_limit;
              const isEditing = editingCouponId === coupon.id;

              return (
                <div
                  key={coupon.id}
                  className={`rounded-xl border p-4 shadow-sm transition-all ${
                    isEditing
                      ? 'border-[#F500A0] bg-[#FFF0F8] ring-1 ring-[#F500A0]/20'
                      : 'border-gray-200 bg-white hover:border-[#F500A0]/40'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-black uppercase tracking-[0.14em] text-black">
                          {coupon.code}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            coupon.is_active
                              ? 'bg-[#FFF0F8] text-[#F500A0] border border-[#F500A0]/20'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {isExpired && (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-700">
                            Expired
                          </span>
                        )}
                        {!isExpired && isExhausted && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-orange-700">
                            Limit reached
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-[#F500A0]">
                        {coupon.percentage}% off
                        {coupon.min_order_value ? ` • min order ₹${coupon.min_order_value}` : ''}
                      </p>

                      <p className="text-xs text-gray-600 font-medium">
                        Used {coupon.usage_count || 0}{coupon.usage_limit ? `/${coupon.usage_limit}` : ''} times
                        {coupon.expiry_date ? ` • expires ${new Date(coupon.expiry_date).toLocaleDateString()}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => void handleToggle(coupon)}
                        className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                          coupon.is_active
                            ? 'bg-[#FFF0F8] text-[#F500A0] border border-[#F500A0]/30 hover:bg-[#FFE5F4]'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {coupon.is_active ? 'Active' : 'Off'}
                      </button>
                      <button
                        onClick={() => startEditCoupon(coupon)}
                        className="rounded-full border border-gray-200 bg-white p-2 text-gray-700 transition-colors hover:border-[#F500A0] hover:text-[#F500A0]"
                        title="Edit coupon"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => void handleDelete(coupon)}
                        className="rounded-full border border-red-200 bg-white p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                        title="Delete coupon"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {coupons.length === 0 && !loading && (
              <div className="py-12 text-center text-gray-500 font-medium text-sm">
                No coupons yet. Create your first coupon using the form on the left!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
