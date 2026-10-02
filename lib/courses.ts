import { Product } from './types';

export interface CatalogItem {
  id: string;
  name: string;
  category: 'BLOUSE ONLY' | 'SALWAR ONLY' | 'BASICS' | 'DIPLOMA' | 'FASHION DESIGNING DIPLOMA';
  price: number;
  unit: 'Pattern';
  duration: string;
  description?: string;
}

export const OFFICIAL_COURSE_CATEGORIES = [
  'ALL',
  'BLOUSE ONLY',
  'SALWAR ONLY',
  'BASICS',
  'DIPLOMA',
  'FASHION DESIGNING DIPLOMA',
] as const;

export type OfficialCourseCategory = (typeof OFFICIAL_COURSE_CATEGORIES)[number];

export const BROCHURE_CATALOGUE_ITEMS: CatalogItem[] = [
  /* --- CATEGORY: BLOUSE ONLY (₹10,000 | 1 Month) --- */
  { id: "bl-01", name: "Normal Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Standard stitching pattern for normal blouse" },
  { id: "bl-02", name: "Lining Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Pattern & stitching for lining blouse" },
  { id: "bl-03", name: "Cross Cut Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Cross cut tailoring pattern" },
  { id: "bl-04", name: "Back Open Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Back open style blouse pattern" },
  { id: "bl-05", name: "Collar Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Collar blouse stitching pattern" },
  { id: "bl-06", name: "'I' Neck Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "'I' Neck pattern and tailoring" },
  { id: "bl-07", name: "Boat Neck Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Boat neck designer pattern" },
  { id: "bl-08", name: "Princess Cut Blouse - 1", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Princess cut pattern tailoring" },
  { id: "bl-09", name: "Single Katori Cut Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Single katori cut pattern" },
  { id: "bl-10", name: "Double Katori Cut Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Double katori cut pattern" },
  { id: "bl-11", name: "Designer Blouse - 1", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Designer blouse pattern style 1" },
  { id: "bl-12", name: "Designer Blouse - 2", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Designer blouse pattern style 2" },
  { id: "bl-13", name: "Zip Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Concealed/side zip blouse pattern" },
  { id: "bl-14", name: "Bridal Blouse", category: "BLOUSE ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Handcrafted bridal blouse pattern with aari/maggam work" },

  /* --- CATEGORY: SALWAR ONLY (₹10,000 | 1 Month) --- */
  { id: "sl-01", name: "Normal Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Classic straight-cut salwar" },
  { id: "sl-02", name: "Lining Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Lining salwar stitching & pattern" },
  { id: "sl-03", name: "Kali Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Traditional pleated kali salwar" },
  { id: "sl-04", name: "Anarkali Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Flared anarkali suit pattern" },
  { id: "sl-05", name: "A-line Top", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Modern A-line kurta top pattern" },
  { id: "sl-06", name: "High Neck Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "High neck tailored salwar suit" },
  { id: "sl-07", name: "Collar Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Chinese/mandarin collar salwar suit" },
  { id: "sl-08", name: "Short Top / Bell Bottom", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Indo-western short top with bell bottom" },
  { id: "sl-09", name: "Designer Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Boutique designer salwar suit" },
  { id: "sl-10", name: "Pattern Salwar", category: "SALWAR ONLY", price: 10000, unit: "Pattern", duration: "1 Month", description: "Contemporary pattern-cut salwar" },

  /* --- CATEGORY: BASICS (₹8,000 | 2 Months) --- */
  { id: "bs-01", name: "Long Skirt", category: "BASICS", price: 8000, unit: "Pattern", duration: "2 Months", description: "Flared maxi/long skirt pattern" },
  { id: "bs-02", name: "In Skirt", category: "BASICS", price: 8000, unit: "Pattern", duration: "2 Months", description: "Standard petticoat / in-skirt pattern" },
  { id: "bs-03", name: "Zip Salwar", category: "BASICS", price: 8000, unit: "Pattern", duration: "2 Months", description: "Fitted salwar with zipper" },
  { id: "bs-04", name: "Back Open Salwar", category: "BASICS", price: 8000, unit: "Pattern", duration: "2 Months", description: "Back open tailored salwar suit" },
  { id: "bs-05", name: "Frock", category: "BASICS", price: 8000, unit: "Pattern", duration: "2 Months", description: "Girls/kids tailored frock" },
  { id: "bs-06", name: "Nighty", category: "BASICS", price: 8000, unit: "Pattern", duration: "2 Months", description: "Comfort-fit homemade nighty pattern" },

  /* --- CATEGORY: DIPLOMA (₹25,000 | 3 Months) --- */
  { id: "dp-01", name: "Half Skirt", category: "DIPLOMA", price: 25000, unit: "Pattern", duration: "3 Months", description: "Pleated / straight half skirt" },
  { id: "dp-02", name: "Katori Cut Blouse (Single)", category: "DIPLOMA", price: 25000, unit: "Pattern", duration: "3 Months", description: "Professional single katori cut" },
  { id: "dp-03", name: "Katori Cut Blouse (Double)", category: "DIPLOMA", price: 25000, unit: "Pattern", duration: "3 Months", description: "Master-level double katori cut" },
  { id: "dp-04", name: "High Neck Blouse", category: "DIPLOMA", price: 25000, unit: "Pattern", duration: "3 Months", description: "High neck elegant blouse pattern" },
  { id: "dp-05", name: "Designing Salwar", category: "DIPLOMA", price: 25000, unit: "Pattern", duration: "3 Months", description: "Custom designing salwar suit" },
  { id: "dp-06", name: "Highneck Salwar", category: "DIPLOMA", price: 25000, unit: "Pattern", duration: "3 Months", description: "High neck modern salwar" },

  /* --- CATEGORY: FASHION DESIGNING DIPLOMA (₹50,000 | 5 Months) --- */
  { id: "fd-01", name: "Patterns Blouse - 3", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Advanced pattern drafting for blouse" },
  { id: "fd-02", name: "Patch Work Blouse - 1", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Artistic fabric patchwork blouse" },
  { id: "fd-03", name: "Anarkali Model - 1", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Couture flare anarkali model 1" },
  { id: "fd-04", name: "Anarkali Model - 2", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Floor-length bridal anarkali model 2" },
  { id: "fd-05", name: "Dhoti Pant", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Dhoti style pleated drape pants" },
  { id: "fd-06", name: "Pallazo Pant", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Wide-leg flared palazzo trousers" },
  { id: "fd-07", name: "Bombay Cut Blouse", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Classic Bombay cut blouse pattern" },
  { id: "fd-08", name: "Raglan Blouse", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Sporty & seamless raglan sleeve blouse" },
  { id: "fd-09", name: "Frock Model - 1", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Layered Western party frock" },
  { id: "fd-10", name: "Frock Model - 2", category: "FASHION DESIGNING DIPLOMA", price: 50000, unit: "Pattern", duration: "5 Months", description: "Ballgown/princess designer frock" },
];

export function catalogItemToProduct(item: CatalogItem): Product {
  return {
    id: item.id,
    sku: item.id.toUpperCase(),
    name: item.name,
    category: item.category,
    price: item.price,
    offer_price: item.price,
    selling_price: item.price,
    purchase_price: 0,
    gst_rate: 0,
    hsn_code: '9988',
    stock_quantity: 999,
    low_stock_alert: 5,
    unit: 'Pattern',
    unit_label: item.duration,
    item_type: 'service',
    is_active: true,
    created_at: new Date('2026-01-01').toISOString(),
    description: item.description || `${item.category} • ${item.duration}`,
    image_url: null,
  };
}
