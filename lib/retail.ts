export const formatCurrency = (val: number | string | null | undefined): string => {
  const n = Number(val || 0);
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatInvoiceNo = (invNo: unknown): string => {
  const raw = String(invNo || '').trim();
  if (!raw) return 'INV-2026-00001';
  if (raw.startsWith('INV')) return raw;
  return `INV-${raw}`;
};
