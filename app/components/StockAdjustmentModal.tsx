"use client";

import React, { useState } from 'react';
import { X, Boxes, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, Check } from 'lucide-react';
import { adjustProductStock } from '@/app/pos/actions';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: {
    id: string;
    name: string;
    sku?: string;
    stockQuantity?: number;
    price?: number;
  } | null;
}

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: StockAdjustmentModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<'RESTOCK' | 'DAMAGE' | 'RETURN' | 'CORRECTION'>('RESTOCK');
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !product) return null;

  const currentStock = product.stockQuantity ?? 0;
  const numQty = typeof qty === 'number' ? qty : 0;

  let calculatedNewStock = currentStock;
  if (adjustmentType === 'RESTOCK' || adjustmentType === 'RETURN') {
    calculatedNewStock = currentStock + numQty;
  } else if (adjustmentType === 'DAMAGE') {
    calculatedNewStock = Math.max(0, currentStock - numQty);
  } else if (adjustmentType === 'CORRECTION') {
    calculatedNewStock = numQty;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty === '' || (typeof qty === 'number' && qty < 0)) {
      setError('Please enter a valid positive quantity');
      return;
    }

    const netChange = calculatedNewStock - currentStock;
    if (netChange === 0) {
      setError('No net stock change specified');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await adjustProductStock({
        productId: product.id,
        adjustment: netChange,
        reason: `${adjustmentType}: ${reason.trim() || 'Manual stock adjustment'}`,
        oldQuantity: currentStock,
        newQuantity: calculatedNewStock,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-black/10 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-black/10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#FFF0F8] text-[#F500A0]">
              <Boxes size={18} />
            </span>
            <div>
              <h3 className="text-base font-black text-black tracking-tight">Stock Adjustment</h3>
              <p className="text-[11px] font-semibold text-gray-500">Record stock movement with audit trail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs font-bold text-gray-900">{product.name}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>SKU: {product.sku || 'N/A'}</span>
              <span>•</span>
              <span>Current Stock: <strong className="text-gray-900">{currentStock}</strong></span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'RESTOCK', label: 'Restock / Purchase', icon: ArrowUpRight, color: 'text-emerald-700' },
                { type: 'DAMAGE', label: 'Damaged / Loss', icon: ArrowDownRight, color: 'text-red-700' },
                { type: 'RETURN', label: 'Customer Return', icon: RefreshCw, color: 'text-blue-700' },
                { type: 'CORRECTION', label: 'Audit Correction', icon: Check, color: 'text-[#F500A0]' },
              ].map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setAdjustmentType(opt.type as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    adjustmentType === opt.type
                      ? 'border-[#F500A0] bg-[#FFF0F8] text-[#F500A0] shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <opt.icon size={14} className={opt.color} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {adjustmentType === 'CORRECTION' ? 'Exact New Total Count *' : 'Quantity Units *'}
            </label>
            <input
              type="number"
              min="0"
              className="w-full bg-white border border-gray-200 focus:border-[#F500A0] focus:ring-2 focus:ring-[#F500A0]/20 rounded-xl px-3.5 py-2.5 text-sm font-bold text-black outline-none"
              placeholder={adjustmentType === 'CORRECTION' ? 'e.g. 50' : 'e.g. 10'}
              value={qty}
              onChange={e => setQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason / Reference Notes
            </label>
            <input
              type="text"
              className="w-full bg-white border border-gray-200 focus:border-[#F500A0] rounded-xl px-3.5 py-2.5 text-xs font-medium text-black outline-none"
              placeholder="e.g., Supplier Batch #821 or Annual Audit"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="p-3 bg-shopTint border border-[#F500A0]/20 rounded-xl flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">Projected Stock Level:</span>
            <span className="font-black text-[#F500A0] text-sm">{calculatedNewStock} units</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-[#F500A0] text-white font-bold text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Confirm Adjust'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
