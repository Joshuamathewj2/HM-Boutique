import { isUuid } from './ids';
import { STATUS } from './orderStatus';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function completeOrder(
  supabase: SupabaseClient,
  row: { id?: string; invoice_no?: string; invoiceNo?: string; total?: number; grand_total?: number; grandTotal?: number; [key: string]: any }
) {
  let targetId = row?.id;
  const invoiceNo = row?.invoice_no || row?.invoiceNo;

  if (!targetId || !isUuid(targetId)) {
    const lookupVal = targetId || invoiceNo;
    if (lookupVal) {
      const cleanVal = String(lookupVal).trim();
      const { data: found } = await supabase
        .from('orders')
        .select('id, total, grand_total')
        .or(isUuid(cleanVal) ? `id.eq.${cleanVal},invoice_no.eq.${cleanVal}` : `invoice_no.eq.${cleanVal}`)
        .limit(1)
        .maybeSingle();

      if (found?.id) {
        targetId = found.id;
        if (!row.total && !row.grand_total && !row.grandTotal) {
          row.total = found.total ?? found.grand_total;
        }
      }
    }
  }

  if (!targetId || !isUuid(targetId)) {
    throw new Error(`Row has no valid UUID and could not be resolved from invoice_no: received "${row?.id}"`);
  }

  const orderTotal = Number(row.total ?? row.grand_total ?? row.grandTotal ?? 0);

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: STATUS.COMPLETED,
      credit_status: 'paid',
      balance_due: 0,
      amount_paid: orderTotal,
      cash_received: orderTotal,
      credit_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .select()
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? 'Update affected 0 rows (check RLS UPDATE policy)');
  }

  const { data: check, error: checkErr } = await supabase
    .from('orders')
    .select('status, balance_due')
    .eq('id', targetId)
    .single();

  if (checkErr || check?.status !== STATUS.COMPLETED) {
    throw new Error('Status was reverted by a trigger or second writer');
  }

  return data;
}
