"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, RotateCcw, Save, Store, Sparkles, Check, Phone, Mail, MapPin } from 'lucide-react';
import {
  BRAND_ADDRESS,
  BRAND_EMAIL,
  BRAND_EN,
  BRAND_INSTAGRAM,
  BRAND_LOGO,
  BRAND_OWNER_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_SUBTITLE,
  DEFAULT_SHOP_PROFILE,
  toInstagramLink,
} from '@/lib/brand';
import { fetchStoreSettings, saveStoreSettings } from '@/app/pos/actions';

type FormState = {
  logoUrl: string;
  ownerName: string;
  name: string;
  businessType: string;
  phone: string;
  shopContact: string;
  email: string;
  address: string;
  instagramId: string;
  cardColor: string;
};

const toForm = (settings: any): FormState => ({
  logoUrl: settings?.logo_url || settings?.logoUrl || BRAND_LOGO,
  ownerName: settings?.owner_name || settings?.ownerName || DEFAULT_SHOP_PROFILE.ownerName,
  name: settings?.name || DEFAULT_SHOP_PROFILE.name,
  businessType: settings?.business_type || settings?.businessType || DEFAULT_SHOP_PROFILE.businessType,
  phone: settings?.phone || DEFAULT_SHOP_PROFILE.phone,
  shopContact: settings?.shop_contact || settings?.shopContact || DEFAULT_SHOP_PROFILE.shopContact,
  email: settings?.email || DEFAULT_SHOP_PROFILE.email,
  address: settings?.address || DEFAULT_SHOP_PROFILE.address,
  instagramId: settings?.instagram_id || settings?.instagramId || DEFAULT_SHOP_PROFILE.instagramId,
  cardColor: settings?.card_color || settings?.cardColor || '#F500A0',
});

const digitsOf = (value: string) => value.replace(/\D/g, '');

const SectionTitle = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) => (
  <div className="mb-4 flex items-start gap-2.5">
    <span className="mt-0.5 text-[#F500A0]">{icon}</span>
    <div>
      <h3 className="text-base sm:text-lg font-bold text-[#111111]">{title}</h3>
      {hint && <p className="text-xs font-medium text-gray-500">{hint}</p>}
    </div>
  </div>
);

const Field = ({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-800">{label}</span>
    {children}
    {error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}
  </label>
);

interface StoreSettingsProps {
  productsCount?: number;
  categoriesList?: { name: string; count: number }[];
}

export default function StoreSettings({ productsCount = 221, categoriesList = [] }: StoreSettingsProps) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(null));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchStoreSettings();
        if (isMounted) {
          if (data) {
            setSettings(data);
            setForm(toForm(data));
          }
        }
      } catch (err) {
        console.error('Failed to load store settings:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const instagramLink = useMemo(() => toInstagramLink(form.instagramId), [form.instagramId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setFeedback(null);
  };

  const handleReset = () => {
    setForm(toForm(settings));
    setErrors({});
    setFeedback(null);
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.ownerName.trim()) errs.ownerName = 'Full name is required';
    if (!form.name.trim()) errs.name = 'Shop name is required';

    const pDigits = digitsOf(form.phone);
    if (!pDigits) errs.phone = 'Phone number is required';
    else if (pDigits.length < 10 || pDigits.length > 15) errs.phone = 'Enter a valid 10-digit phone number';

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      errs.email = 'Enter a valid email address';
    }

    if (!form.address.trim()) errs.address = 'Shop address is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      setFeedback({ type: 'error', message: 'Please fix the highlighted fields' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await saveStoreSettings({
        name: form.name,
        ownerName: form.ownerName,
        businessType: form.businessType,
        phone: form.phone,
        shopContact: form.shopContact,
        email: form.email,
        address: form.address,
        instagramId: form.instagramId,
        logoUrl: BRAND_LOGO,
        cardColor: '#F500A0',
      });

      if (res.success) {
        setFeedback({ type: 'success', message: 'Store profile saved successfully!' });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to save store settings' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[26px] font-black text-[#111111] tracking-tight leading-tight">
            <span className="w-1.5 h-7 rounded-full bg-[#F500A0] flex-shrink-0 inline-block" />
            <span>Store Settings</span>
          </h2>
          <p className="text-sm font-medium text-gray-600 leading-snug">
            Shop profile used across invoices, receipts, and the app header.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#F500A0] px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:brightness-95 active:scale-95 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? <Check size={18} /> : null}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* SHOP PROFILE */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionTitle icon={<Store size={18} />} title="Shop Profile" hint="Brand emblem, owner, and business title" />
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-shopSoft bg-white p-1.5 shadow-sm">
                <img src={BRAND_LOGO} alt="HM Boutique logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Official Brand Logo</p>
                <p className="text-xs font-medium text-gray-500">
                  Permanently locked brand emblem for receipts, invoices & billing
                </p>
              </div>
            </div>

            <Field label="Full Name / Proprietor" error={errors.ownerName}>
              <input
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.ownerName}
                onChange={e => set('ownerName', e.target.value)}
                placeholder="Malini Suresh"
              />
            </Field>

            <Field label="Shop Name" error={errors.name}>
              <input
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="HM School of Fashion Designing and Tailoring"
              />
            </Field>

            <Field label="Business Type / Tagline">
              <input
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.businessType}
                onChange={e => set('businessType', e.target.value)}
                placeholder="The joy of dressing is an art"
              />
            </Field>
          </div>
        </div>

        {/* CONTACT DETAILS */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionTitle icon={<Phone size={18} />} title="Contact Details" hint="Official contact numbers displayed on bills" />
          <div className="space-y-4">
            <Field label="Primary Phone Number" error={errors.phone}>
              <input
                type="tel"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="80560 86113"
              />
            </Field>

            <Field label="Secondary / Shop Contact Number">
              <input
                type="tel"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.shopContact}
                onChange={e => set('shopContact', e.target.value)}
                placeholder="80560 86113"
              />
            </Field>

            <Field label="Email Address" error={errors.email}>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="malinisuresh6612@gmail.com"
              />
            </Field>
          </div>
        </div>

        {/* SHOP LOCATION & SOCIAL */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
          <SectionTitle icon={<MapPin size={18} />} title="Shop Location & Social" hint="Physical address printed on invoices" />
          <div className="space-y-4">
            <Field label="Shop Address" error={errors.address}>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="No: 82, Mahalakshmi Nagar, 2nd Main Road, Adambakkam, Chennai - 600088"
              />
            </Field>

            <Field label="Instagram ID">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <AtSign size={16} />
                </span>
                <input
                  className="w-full pl-9 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition-colors focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/25"
                  value={form.instagramId}
                  onChange={e => set('instagramId', e.target.value)}
                  placeholder="HM FASHION DESIGNING SCHOOL"
                />
              </div>
            </Field>

            {form.instagramId.trim() && (
              <a
                href={instagramLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F500A0] hover:underline"
              >
                <span>Visit Instagram Profile: {instagramLink}</span>
              </a>
            )}
          </div>
        </div>

        {/* CATALOGUE OVERVIEW */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
          <SectionTitle
            icon={<Sparkles size={18} />}
            title="Fashion & Tailoring Catalogue Overview"
            hint="Live synchronized inventory from Supabase database"
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#FFF0F8] border border-[#F500A0]/30 px-3.5 py-1 text-xs font-bold text-[#F500A0]">
              {productsCount} Items in Live Catalogue
            </span>
          </div>
          {categoriesList.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {categoriesList.map(cat => (
                <span
                  key={cat.name}
                  className="rounded-full border border-shopSoft bg-gray-50 px-3 py-1 text-xs font-bold text-gray-700"
                >
                  {cat.name} ({cat.count})
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500 font-medium">
            Items, SKU codes, prices, GST rates, and stock adjustments are managed on the Inventory screen.
          </p>
        </div>
      </div>
    </div>
  );
}
