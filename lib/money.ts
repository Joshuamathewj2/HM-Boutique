/**
 * Single source of truth for all monetary math, GST calculations, and currency formatting.
 * Works in integer paise internally to eliminate floating-point drift and 3-decimal artifacts.
 */

export type TaxMode = 'exclusive' | 'inclusive';

export interface TaxCalculationResult {
  taxable: number;    // In Rupees, rounded to 2 decimal places
  gst: number;        // In Rupees, rounded to 2 decimal places
  cgst: number;       // In Rupees, floor(gst/2) to the paisa
  sgst: number;       // In Rupees, gst - cgst to the paisa
  delivery: number;   // In Rupees, rounded to 2 decimal places
  grand: number;      // In Rupees, strictly matches taxable + gst + delivery in exclusive
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format any number or numeric string to exactly 2 decimals in Indian Rupee format.
 * Never outputs values like 228.814.
 */
export function formatINR(val: number | string | undefined | null): string {
  const num = typeof val === 'number' ? val : Number(val || 0);
  return inrFormatter.format(isNaN(num) ? 0 : num);
}

/**
 * Calculates GST, CGST, SGST, Taxable Base, and Grand Total.
 * All math is conducted in integer paise.
 *
 * Exclusive GST:
 *  taxable = subtotal
 *  gst = round(subtotal * rate / 100)
 *  grand = subtotal + gst + delivery
 *
 * Inclusive GST:
 *  taxable = round(subtotal / (1 + rate / 100))
 *  gst = subtotal - taxable
 *  grand = subtotal + delivery
 *
 * Guarantee:
 *  cgst = floor(gst / 2)
 *  sgst = gst - cgst
 *  cgst + sgst === gst strictly to the paisa.
 */
export function calculateTaxAndTotals(
  subtotal: number,
  rate: number,
  delivery: number = 0,
  mode: TaxMode = 'exclusive'
): TaxCalculationResult {
  const subtotalPaise = Math.round(Math.max(0, subtotal) * 100);
  const deliveryPaise = Math.round(Math.max(0, delivery) * 100);
  const validRate = Math.max(0, rate);

  let taxablePaise: number;
  let gstPaise: number;
  let grandPaise: number;

  if (mode === 'inclusive') {
    if (validRate > 0) {
      taxablePaise = Math.round(subtotalPaise / (1 + validRate / 100));
      gstPaise = subtotalPaise - taxablePaise;
    } else {
      taxablePaise = subtotalPaise;
      gstPaise = 0;
    }
    grandPaise = subtotalPaise + deliveryPaise;
  } else {
    // Exclusive mode
    taxablePaise = subtotalPaise;
    gstPaise = validRate > 0 ? Math.round((subtotalPaise * validRate) / 100) : 0;
    grandPaise = taxablePaise + gstPaise + deliveryPaise;
  }

  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;

  return {
    taxable: taxablePaise / 100,
    gst: gstPaise / 100,
    cgst: cgstPaise / 100,
    sgst: sgstPaise / 100,
    delivery: deliveryPaise / 100,
    grand: grandPaise / 100,
  };
}
