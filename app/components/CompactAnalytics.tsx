"use client";

import React from 'react';
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, Sparkles } from 'lucide-react';
import { formatCurrency, toNumber } from '@/lib/retail';

export type MonthlyPoint = { month: string; revenue: number };
export type ChannelPoint = { name: string; value: number; color: string };
export type CategoryPoint = { name: string; qty: number; revenue: number };
export type WeeklyPoint = { day: string; date: string; revenue: number };

export type CompactAnalyticsModel = {
  monthlyTrend: MonthlyPoint[];
  channelDistribution: ChannelPoint[];
  topCategories: CategoryPoint[];
  weeklySales: WeeklyPoint[];
};

type CompactAnalyticsProps = {
  analytics: CompactAnalyticsModel;
};

function TooltipCard({
  active,
  payload,
  label,
  currency = false,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: Record<string, unknown> }>;
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const rawValue = payload[0]?.value;
  const value = currency
    ? formatCurrency(toNumber(rawValue as number | string, 0))
    : toNumber(rawValue as number | string, 0);

  return (
    <div className="rounded-xl border border-shopSoft bg-white/95 px-3.5 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F500A0]">{String(label || '')}</p>
      <p className="mt-1 text-sm font-black text-[#111111]">{value}</p>
    </div>
  );
}

const chartAxis = { fill: '#6B7280', fontSize: 11 };

export default function CompactAnalytics({ analytics }: CompactAnalyticsProps) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* REVENUE TREND */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-[#111111]">Revenue Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Completed revenue over time</p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-[#FFF0F8] border border-[#F500A0]/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#F500A0]">
              <Sparkles size={12} className="text-[#F500A0]" /> HM Analytics
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyTrend}>
                <CartesianGrid vertical={false} stroke="#F3F4F6" strokeDasharray="3 6" />
                <XAxis dataKey="month" tick={chartAxis} axisLine={false} tickLine={false} />
                <YAxis tick={chartAxis} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<TooltipCard currency />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#F500A0"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#F500A0' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ONLINE VS OFFLINE */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-[#111111]">Channel Distribution</h3>
              <p className="text-xs text-gray-500 mt-0.5">Order mix by sales channel</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.channelDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {analytics.channelDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipCard currency />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
            {analytics.channelDistribution.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-gray-800">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.name}: {formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MORE INSIGHTS COLLAPSIBLE */}
      <details className="group rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#111111]">
          <span>Detailed Breakdown (Categories & Weekly Trends)</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#F500A0] group-open:text-gray-700">
            Insights <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-[#FAFAFA] p-4">
            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3">Top Product Categories</h4>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.topCategories} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid horizontal={false} stroke="#E5E7EB" strokeDasharray="3 6" />
                  <XAxis type="number" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ ...chartAxis, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip content={<TooltipCard />} />
                  <Bar dataKey="qty" fill="#F500A0" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-[#FAFAFA] p-4">
            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3">Weekly Sales Volume</h4>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.weeklySales}>
                  <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 6" />
                  <XAxis dataKey="day" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxis} axisLine={false} tickLine={false} width={35} />
                  <Tooltip
                    content={<TooltipCard currency />}
                    labelFormatter={(_value, payload) => String(payload?.[0]?.payload?.date || '')}
                  />
                  <Bar dataKey="revenue" fill="#10B981" radius={[6, 6, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
