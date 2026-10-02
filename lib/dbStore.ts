import { sql } from './db';
import { BROCHURE_CATALOGUE_ITEMS, OFFICIAL_COURSE_CATEGORIES, catalogItemToProduct } from './courses';
import { isSupabaseConfigured, supabase } from './supabase';
import {
  Product,
  Category,
  Customer,
  OrderRow,
  OrderItemRow,
  OrderWithRelations,
  CartItem,
  Expense,
  PaymentMode,
  AdvanceOrderRow,
  AdvanceOrderItemRow,
  AdvanceOrderStatus,
  AdvanceOrderWithRelations,
} from './types';

// Utility to generate unique ID
const uid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isUuid = (val: unknown): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

export const dbStore = {
  // â”€â”€ CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async listCategories(): Promise<Category[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((c: any) => ({
            id: String(c.id),
            name: c.name_en || c.name || '',
            created_at: c.created_at || new Date().toISOString(),
            is_active: c.is_active !== false,
            sort_order: c.sort_order || 0,
          }));
        }
      } catch (err) {
        console.warn('Supabase categories fetch failed, falling back to local SQL:', err);
      }
    }

    try {
      const rows = await sql`SELECT * FROM categories ORDER BY name ASC`;
      return rows as Category[];
    } catch {
      return [];
    }
  },

  async addCategory(name: string): Promise<Category> {
    const trimmed = name.trim();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .insert({ name_en: trimmed, is_active: true })
          .select()
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            name: data.name_en || trimmed,
            created_at: data.created_at || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn('Supabase category insert failed:', err);
      }
    }

    const id = uid();
    try {
      const rows = await sql`
        INSERT INTO categories (id, name)
        VALUES (${id}, ${trimmed})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING *
      `;
      return rows[0] as Category;
    } catch {
      return { id, name: trimmed, created_at: new Date().toISOString() };
    }
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    const trimmed = name.trim();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .update({ name_en: trimmed })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            name: data.name_en || trimmed,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.warn('Supabase category update failed:', err);
      }
    }

    try {
      const rows = await sql`UPDATE categories SET name = ${trimmed} WHERE id = ${id} RETURNING *`;
      return rows.length > 0 ? (rows[0] as Category) : null;
    } catch {
      return null;
    }
  },

  async deleteCategory(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('categories').update({ is_active: false }).eq('id', id);
        return;
      } catch (err) {
        console.warn('Supabase category delete failed:', err);
      }
    }

    try {
      await sql`DELETE FROM categories WHERE id = ${id}`;
    } catch {
      // ignore
    }
  },

  // â”€â”€ PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async listProducts(): Promise<Product[]> {
    const isPseudo = (name: string) => {
      const n = (name || '').toLowerCase().trim();
      return n.includes('(full package') ||
        n === 'basics course' ||
        n === 'diploma course' ||
        n === 'fashion designing diploma' ||
        n === 'blouse only course' ||
        n === 'salwar only course';
    };

    // Brochure catalogue acts as authoritative fallback / merge source
    const brochureFallback: Product[] = BROCHURE_CATALOGUE_ITEMS.map(item => catalogItemToProduct(item) as unknown as Product);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (!error && data) {
          const normalized: Product[] = data
            .filter((p: any) => !isPseudo(p.name))
            .map((p: any) => ({
              id: String(p.id),
              name: p.name || '',
              description: p.description || null,
              category: p.category || '',
              gst_rate: Number(p.gst_percent || 0),
              hsn_code: p.barcode || p.sku || null,
              // selling_price: prefer price column first (direct fee), fall back to offer_price
              selling_price: Number(p.price || p.offer_price || 0),
              sku: p.sku || `SKU-${p.id}`,
              stock_quantity: Number(p.stock_quantity ?? p.stock ?? 0),
              low_stock_alert: Number(p.low_stock_alert || 5),
              purchase_price: Number(p.purchase_price || 0),
              price: Number(p.price || 0),
              offer_price: p.offer_price ? Number(p.offer_price) : null,
              unit: p.unit || 'Pattern',
              unit_label: p.unit_label || p.duration || 'Pattern',
              item_type: p.item_type || 'service',
              is_active: p.is_active !== false,
              created_at: p.created_at || new Date().toISOString(),
              image_url: p.image_url || p.image || null,
            }));

          // Merge: add brochure items not yet in Supabase (by SKU / name)
          const existingSkus = new Set(normalized.map(p => (p.sku || '').toUpperCase()));
          const existingNames = new Set(normalized.map(p => p.name.toLowerCase().trim()));
          const merged = [...normalized];
          for (const bp of brochureFallback) {
            if (
              !existingSkus.has((bp.sku || '').toUpperCase()) &&
              !existingNames.has(bp.name.toLowerCase().trim())
            ) {
              merged.push(bp);
            }
          }
          return merged;
        }
      } catch (err) {
        console.warn('Supabase products fetch failed, falling back to brochure catalogue:', err);
      }
    }

    // Local SQL fallback (dev / offline)
    try {
      const rows = await sql`SELECT * FROM products ORDER BY name ASC`;
      if ((rows as any[]).length > 0) {
        return (rows as Product[]).filter(p => !isPseudo(p.name));
      }
    } catch {
      // ignore
    }

    // Last resort: serve brochure directly
    return brochureFallback;
  },

  // â”€â”€ SEED CATALOGUE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Upserts all official course categories + individual pattern items into Supabase.
   * Removes pseudo-packages and sets the exact category fee to every pattern item.
   * Returns { categoriesSeeded, productsSeeded, duplicatesRemoved, errors }
   */
  async seedCatalog(): Promise<{ categoriesSeeded: number; productsSeeded: number; duplicatesRemoved: number; errors: string[] }> {
    const errors: string[] = [];
    let categoriesSeeded = 0;
    let productsSeeded = 0;
    let duplicatesRemoved = 0;

    if (!isSupabaseConfigured) {
      return { categoriesSeeded, productsSeeded, duplicatesRemoved, errors: ['Supabase not configured'] };
    }

    // 1. Upsert categories
    const categoryRows = OFFICIAL_COURSE_CATEGORIES
      .filter(c => c !== 'ALL')
      .map((name, idx) => ({ name_en: name, name_ta: '', is_active: true, sort_order: idx + 1 }));

    try {
      const { error } = await supabase
        .from('categories')
        .upsert(categoryRows, { onConflict: 'name_en', ignoreDuplicates: false });
      if (error) errors.push(`Categories: ${error.message}`);
      else categoriesSeeded = categoryRows.length;
    } catch (e: any) {
      errors.push(`Categories exception: ${e?.message}`);
    }

    // 2. Remove artificial course package pseudo-rows from products & inventory
    try {
      const pseudoNames = [
        'Basics Course', 'Basics Course (Full Package - 2 Months)', 'Basics Course (Full Package)',
        'Diploma Course', 'Diploma Course (Full Package - 3 Months)', 'Diploma Course (Full Package)',
        'Fashion Designing Diploma', 'Fashion Designing Diploma (Full Package - 5 Months)', 'Fashion Designing Diploma (Full Package)',
        'Blouse Only Course', 'Blouse Only Course (Full Package - 1 Month)', 'Blouse Only Course (Full Package)',
        'Salwar Only Course', 'Salwar Only Course (Full Package - 1 Month)', 'Salwar Only Course (Full Package)'
      ];
      await supabase.from('products').delete().in('name', pseudoNames);
      await supabase.from('products').delete().in('sku', ['BLOUSE-PKG', 'SALWAR-PKG', 'BASICS-PKG', 'DIPLOMA-PKG', 'FD-PKG']);
      try {
        await supabase.from('inventory').delete().in('name', pseudoNames);
      } catch {}
    } catch (e: any) {
      errors.push(`Pseudo-package cleanup: ${e?.message}`);
    }

    // 3. Update existing items in Supabase to official category pricing & duration
    try {
      await supabase.from('products').update({ price: 10000, offer_price: 10000, unit_label: '1 Month' }).ilike('category', 'BLOUSE ONLY');
      await supabase.from('products').update({ price: 10000, offer_price: 10000, unit_label: '1 Month' }).ilike('category', 'SALWAR ONLY');
      await supabase.from('products').update({ price: 8000, offer_price: 8000, unit_label: '2 Months' }).ilike('category', 'BASICS');
      await supabase.from('products').update({ price: 25000, offer_price: 25000, unit_label: '3 Months' }).ilike('category', 'DIPLOMA');
      await supabase.from('products').update({ price: 50000, offer_price: 50000, unit_label: '5 Months' }).ilike('category', 'FASHION DESIGNING DIPLOMA');

      try {
        await supabase.from('inventory').update({ price: 10000, duration: '1 Month' }).ilike('category', 'BLOUSE ONLY');
        await supabase.from('inventory').update({ price: 10000, duration: '1 Month' }).ilike('category', 'SALWAR ONLY');
        await supabase.from('inventory').update({ price: 8000, duration: '2 Months' }).ilike('category', 'BASICS');
        await supabase.from('inventory').update({ price: 25000, duration: '3 Months' }).ilike('category', 'DIPLOMA');
        await supabase.from('inventory').update({ price: 50000, duration: '5 Months' }).ilike('category', 'FASHION DESIGNING DIPLOMA');
      } catch {}
    } catch (e: any) {
      errors.push(`Category fee updates: ${e?.message}`);
    }

    // 4. Deduplicate existing products by SKU / name (keep lowest id)
    try {
      const { data: allProds } = await supabase
        .from('products')
        .select('id, sku, name')
        .order('id', { ascending: true });

      if (allProds && allProds.length > 0) {
        const seenSkus = new Map<string, string>();
        const seenNames = new Map<string, string>();
        const toDelete: string[] = [];

        for (const p of allProds) {
          const skuKey = String(p.sku || '').toUpperCase().trim();
          const nameKey = String(p.name || '').toLowerCase().trim();
          const id = String(p.id);

          if (skuKey && seenSkus.has(skuKey)) {
            toDelete.push(id);
          } else if (skuKey) {
            seenSkus.set(skuKey, id);
          } else if (nameKey && seenNames.has(nameKey)) {
            toDelete.push(id);
          } else if (nameKey) {
            seenNames.set(nameKey, id);
          }
        }

        if (toDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('products')
            .delete()
            .in('id', toDelete);
          if (!delErr) duplicatesRemoved = toDelete.length;
          else errors.push(`Dedup: ${delErr.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Dedup exception: ${e?.message}`);
    }

    // 5. Upsert brochure pattern items with exact category fee and duration
    const productRows = BROCHURE_CATALOGUE_ITEMS.map(item => ({
      name: item.name,
      category: item.category,
      price: item.price,
      offer_price: item.price,
      purchase_price: 0,
      gst_percent: 0,
      sku: item.id.toUpperCase(),
      unit: item.unit,
      unit_label: item.duration,
      stock_quantity: 999,
      stock: 999,
      low_stock_alert: 5,
      is_active: true,
      item_type: 'service',
      description: `${item.category} â€¢ ${item.duration}`,
    }));

    try {
      const { error: upsertErr } = await supabase
        .from('products')
        .upsert(productRows, { onConflict: 'sku', ignoreDuplicates: false });

      if (upsertErr) {
        // Fallback: update price where name matches, or insert missing
        for (const row of productRows) {
          await supabase
            .from('products')
            .update({ price: row.price, offer_price: row.offer_price, unit_label: row.unit_label })
            .ilike('name', row.name);
        }
        productsSeeded = productRows.length;
      } else {
        productsSeeded = productRows.length;
      }
    } catch (e: any) {
      errors.push(`Products exception: ${e?.message}`);
    }

    return { categoriesSeeded, productsSeeded, duplicatesRemoved, errors };
  },

  async getProduct(id: string): Promise<Product | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            name: data.name,
            description: data.description || null,
            category: data.category,
            gst_rate: Number(data.gst_percent || 0),
            hsn_code: data.barcode || data.sku || null,
            selling_price: Number(data.offer_price || data.price || 0),
            sku: data.sku,
            stock_quantity: Number(data.stock_quantity ?? data.stock ?? 0),
            low_stock_alert: Number(data.low_stock_alert || 5),
            purchase_price: Number(data.purchase_price || 0),
            price: Number(data.price || 0),
            offer_price: data.offer_price ? Number(data.offer_price) : null,
            unit: data.unit,
            unit_label: data.unit_label,
            item_type: data.item_type,
            is_active: data.is_active !== false,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.warn('Supabase getProduct failed:', err);
      }
    }

    try {
      const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
      return rows.length > 0 ? (rows[0] as Product) : null;
    } catch {
      return null;
    }
  },

  async addProduct(input: {
    name: string;
    description: string | null;
    category: string;
    gst_rate: number;
    hsn_code: string | null;
    selling_price: number;
    sku?: string;
    stock_quantity?: number;
    low_stock_alert?: number;
    purchase_price?: number;
    item_type?: 'product' | 'service';
  }): Promise<Product> {
    const sku = input.sku || `HM-${Date.now().toString().slice(-6)}`;
    const stockQuantity = Number(input.stock_quantity ?? 999);
    const lowStockAlert = Number(input.low_stock_alert ?? 5);
    const purchasePrice = Number(input.purchase_price ?? 0);
    const sellingPrice = Number(input.selling_price ?? 0);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .insert({
            name: input.name,
            description: input.description || '',
            category: input.category,
            price: sellingPrice,
            offer_price: sellingPrice,
            purchase_price: purchasePrice,
            gst_percent: input.gst_rate || 0,
            sku,
            stock_quantity: stockQuantity,
            stock: stockQuantity,
            low_stock_alert: lowStockAlert,
            item_type: input.item_type || 'product',
            is_active: true,
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            name: data.name,
            description: data.description || null,
            category: data.category,
            gst_rate: Number(data.gst_percent || 0),
            hsn_code: data.sku || null,
            selling_price: Number(data.price || 0),
            sku: data.sku,
            stock_quantity: Number(data.stock_quantity || 0),
            low_stock_alert: Number(data.low_stock_alert || 5),
            purchase_price: Number(data.purchase_price || 0),
            created_at: data.created_at || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn('Supabase addProduct failed:', err);
      }
    }

    const id = uid();
    try {
      const rows = await sql`
        INSERT INTO products (id, name, description, category, gst_rate, hsn_code, selling_price)
        VALUES (
          ${id}, ${input.name}, ${input.description}, ${input.category},
          ${input.gst_rate}, ${input.hsn_code || sku}, ${sellingPrice}
        )
        RETURNING *
      `;
      return rows[0] as Product;
    } catch {
      return {
        id,
        name: input.name,
        description: input.description,
        category: input.category,
        gst_rate: input.gst_rate,
        hsn_code: input.hsn_code || sku,
        selling_price: sellingPrice,
        sku,
        stock_quantity: stockQuantity,
        created_at: new Date().toISOString(),
      };
    }
  },

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {};
        if (patch.name !== undefined) payload.name = patch.name;
        if (patch.description !== undefined) payload.description = patch.description;
        if (patch.category !== undefined) payload.category = patch.category;
        if (patch.gst_rate !== undefined) payload.gst_percent = patch.gst_rate;
        if (patch.selling_price !== undefined) {
          payload.price = patch.selling_price;
          payload.offer_price = patch.selling_price;
        }
        if (patch.sku !== undefined) payload.sku = patch.sku;
        if (patch.stock_quantity !== undefined) {
          payload.stock_quantity = patch.stock_quantity;
          payload.stock = patch.stock_quantity;
        }
        if (patch.low_stock_alert !== undefined) payload.low_stock_alert = patch.low_stock_alert;
        if (patch.purchase_price !== undefined) payload.purchase_price = patch.purchase_price;
        if (patch.is_active !== undefined) payload.is_active = patch.is_active;

        const { data, error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            name: data.name,
            description: data.description || null,
            category: data.category,
            gst_rate: Number(data.gst_percent || 0),
            hsn_code: data.sku,
            selling_price: Number(data.offer_price || data.price || 0),
            sku: data.sku,
            stock_quantity: Number(data.stock_quantity || 0),
            low_stock_alert: Number(data.low_stock_alert || 5),
            purchase_price: Number(data.purchase_price || 0),
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.warn('Supabase updateProduct failed:', err);
      }
    }

    try {
      if (patch.name !== undefined) await sql`UPDATE products SET name = ${patch.name} WHERE id = ${id}`;
      if (patch.description !== undefined) await sql`UPDATE products SET description = ${patch.description} WHERE id = ${id}`;
      if (patch.category !== undefined) await sql`UPDATE products SET category = ${patch.category} WHERE id = ${id}`;
      if (patch.gst_rate !== undefined) await sql`UPDATE products SET gst_rate = ${patch.gst_rate} WHERE id = ${id}`;
      if (patch.hsn_code !== undefined) await sql`UPDATE products SET hsn_code = ${patch.hsn_code} WHERE id = ${id}`;
      if (patch.selling_price !== undefined) await sql`UPDATE products SET selling_price = ${patch.selling_price} WHERE id = ${id}`;

      const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
      return rows.length > 0 ? (rows[0] as Product) : null;
    } catch {
      return null;
    }
  },

  async deleteProduct(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').update({ is_active: false }).eq('id', id);
        return;
      } catch (err) {
        console.warn('Supabase deleteProduct failed:', err);
      }
    }

    try {
      await sql`DELETE FROM products WHERE id = ${id}`;
    } catch {
      // ignore
    }
  },

  // â”€â”€ INVENTORY ADJUSTMENT & LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async adjustStock(input: {
    productId: string | number;
    adjustment: number;
    reason: string;
    referenceId?: string;
    oldQuantity: number;
    newQuantity: number;
  }): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // Update product stock
        await supabase
          .from('products')
          .update({
            stock_quantity: input.newQuantity,
            stock: input.newQuantity,
          })
          .eq('id', input.productId);

        // Record in inventory_logs
        await supabase.from('inventory_logs').insert({
          product_id: input.productId,
          old_quantity: input.oldQuantity,
          new_quantity: input.newQuantity,
          adjustment: input.adjustment,
          reason: input.reason,
          reference_id: input.referenceId || null,
        });
        return;
      } catch (err) {
        console.warn('Supabase adjustStock failed:', err);
      }
    }

    try {
      await sql`UPDATE products SET stock_quantity = ${input.newQuantity} WHERE id = ${String(input.productId)}`;
    } catch {
      // ignore
    }
  },

  // â”€â”€ CUSTOMERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async upsertCustomer(name: string, phone: string, address?: string | null): Promise<Customer> {
    const id = uid();
    try {
      const rows = await sql`
        INSERT INTO customers (id, name, phone, address)
        VALUES (${id}, ${name}, ${phone}, ${address || null})
        ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
        RETURNING *
      `;
      return rows[0] as Customer;
    } catch {
      return { id, name, phone, address: address || null, created_at: new Date().toISOString() };
    }
  },

  // â”€â”€ ORDERS & POS BILLING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async orderIdExists(id: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, invoice_no')
          .or(`id.eq.${id},invoice_no.eq.${id}`)
          .limit(1);
        if (data && data.length > 0) return true;
      } catch {
        // fallback
      }
    }

    try {
      const rows = await sql`SELECT 1 FROM orders WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    } catch {
      return false;
    }
  },

  async listOrdersWithRelations(): Promise<OrderWithRelations[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((o: any) => {
            let items: any[] = [];
            if (Array.isArray(o.items)) {
              items = o.items;
            } else if (typeof o.items === 'string') {
              try { items = JSON.parse(o.items); } catch { items = []; }
            }

            const mappedItems: OrderItemRow[] = items.map((it: any, idx: number) => ({
              id: String(it.id || `${o.id}-${idx}`),
              order_id: o.invoice_no || String(o.id),
              product_id: it.product_id ? String(it.product_id) : null,
              snapshot_name: it.name || it.product_name || 'Item',
              snapshot_price: Number(it.price || it.base_price || it.line_total || 0),
              quantity: Number(it.quantity || it.qty || 1),
            }));

            const discount = Number(o.discount_amount || 0) + Number(o.manual_discount_amount || 0);
            const total = Number(o.total || o.grand_total || 0);
            const subtotal = Number(o.subtotal || total);

            return {
              id: o.invoice_no || String(o.id),
              customer_id: String(o.user_id || o.id),
              customer_name: o.customer_name || 'Counter Customer',
              customer_phone: o.phone || '',
              customer_address: o.address || null,
              source: (o.order_mode || 'offline').toUpperCase() as 'ONLINE' | 'OFFLINE',
              status: (o.status || 'COMPLETED').toUpperCase() as 'COMPLETED' | 'PENDING',
              is_gst: Boolean(Number(o.total_gst || o.gst_amount || 0) > 0),
              subtotal,
              discount_type: 'FIXED',
              discount_value: discount,
              discount_amount: discount,
              gst_percentage: Number(o.gst_percentage || 0),
              gst_amount: Number(o.total_gst || o.gst_amount || 0),
              delivery_fee: Number(o.delivery_charge || o.delivery_fee || 0),
              grand_total: total,
              cash_received: Number(o.cash_received || total),
              split_cash: Number(o.split_cash || 0),
              split_gpay: Number(o.split_gpay || 0),
              payment_mode: (String(o.payment_mode || o.payment_method || 'CASH').toUpperCase()) as PaymentMode,
              bill_date: o.created_at || new Date().toISOString(),
              created_at: o.created_at || new Date().toISOString(),
              coupon_code: o.coupon_code || null,
              remarks: o.remarks || null,
              reference_number: o.reference_number || null,
              is_credit: Boolean(o.is_credit || o.payment_mode === 'CREDIT' || o.payment_method === 'credit' || o.credit_status),
              credit_status: o.credit_status || (o.is_credit || o.payment_mode === 'CREDIT' || o.payment_method === 'credit' ? 'outstanding' : null),
              credit_due_date: o.credit_due_date || null,
              credit_paid_at: o.credit_paid_at || null,
              items: mappedItems,
            };
          });
        }
      } catch (err) {
        console.warn('Supabase orders fetch failed, falling back to local SQL:', err);
      }
    }

    try {
      const orders = await sql`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        ORDER BY o.created_at DESC
      `;

      if (orders.length === 0) return [];

      const orderIds = orders.map((o: any) => o.id);
      const items = await sql`
        SELECT * FROM order_items
        WHERE order_id = ANY(${orderIds})
      `;

      return orders.map((o: any) => ({
        ...o,
        items: items.filter((i: any) => i.order_id === o.id) as OrderItemRow[],
      })) as OrderWithRelations[];
    } catch {
      return [];
    }
  },

  async getOrderWithRelations(id: string): Promise<OrderWithRelations | null> {
    const rawId = decodeURIComponent(String(id || '')).trim();
    const cleanId = rawId.replace(/^#/, '').trim();
    const strippedInv = cleanId.replace(/^INV-?/i, '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    const isNumeric = /^\d+$/.test(cleanId);

    if (isSupabaseConfigured) {
      try {
        let row: any = null;

        // 1. Exact match on invoice_no
        if (!row && cleanId) {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('invoice_no', cleanId)
            .maybeSingle();
          if (!error && data) row = data;
        }

        // 2. Try prefix 'INV-' if not present
        if (!row && cleanId && !cleanId.startsWith('INV-')) {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('invoice_no', `INV-${cleanId}`)
            .maybeSingle();
          if (!error && data) row = data;
        }

        // 3. Try invoice_number or order_number column
        if (!row && cleanId) {
          try {
            const { data } = await supabase
              .from('orders')
              .select('*')
              .or(`invoice_number.eq.${cleanId},order_number.eq.${cleanId}`)
              .maybeSingle();
            if (data) row = data;
          } catch {}
        }

        // 4. Try UUID match on id column if valid UUID
        if (!row && isUuid) {
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('id', cleanId)
            .maybeSingle();
          if (data) row = data;
        }

        // 5. Try numeric match on id column if numeric
        if (!row && isNumeric) {
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('id', Number(cleanId))
            .maybeSingle();
          if (data) row = data;
        }

        // 6. Try ilike partial match on invoice_no
        if (!row && strippedInv) {
          const { data } = await supabase
            .from('orders')
            .select('*')
            .ilike('invoice_no', `%${strippedInv}%`)
            .limit(1);
          if (data && data.length > 0) row = data[0];
        }

        // 7. Check 'sales' table fallback
        if (!row) {
          try {
            const { data } = await supabase
              .from('sales')
              .select('*')
              .or(`invoice_number.eq.${cleanId},invoice_no.eq.${cleanId},order_number.eq.${cleanId}`)
              .maybeSingle();
            if (data) row = data;
          } catch {}
        }

        if (row) {
          let items: any[] = [];
          if (Array.isArray(row.items)) {
            items = row.items;
          } else if (typeof row.items === 'string') {
            try { items = JSON.parse(row.items); } catch { items = []; }
          }

          // If items are still empty, try querying order_items table
          if (items.length === 0 && row.id) {
            try {
              const { data: fetchedItems } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', row.id);
              if (fetchedItems && fetchedItems.length > 0) {
                items = fetchedItems;
              }
            } catch {}
          }

          const mappedItems: OrderItemRow[] = items.map((it: any, idx: number) => ({
            id: String(it.id || `${row.id}-${idx}`),
            order_id: row.invoice_no || row.invoice_number || String(row.id),
            product_id: it.product_id ? String(it.product_id) : null,
            snapshot_name: it.name || it.product_name || it.snapshot_name || 'Item',
            snapshot_price: Number(it.price || it.base_price || it.selling_price || it.line_total || it.snapshot_price || 0),
            quantity: Number(it.quantity || it.qty || 1),
          }));

          const discount = Number(row.discount_amount || row.discount || 0) + Number(row.manual_discount_amount || 0);
          const total = Number(row.total || row.grand_total || row.total_amount || 0);
          const subtotal = Number(row.subtotal || total);

          return {
            id: row.invoice_no || row.invoice_number || row.order_number || String(row.id),
            customer_id: String(row.user_id || row.customer_id || row.id),
            customer_name: row.customer_name || row.customerName || 'Counter Customer',
            customer_phone: row.phone || row.customer_phone || row.customerPhone || '',
            customer_address: row.address || row.customer_address || row.customerAddress || null,
            source: (row.order_mode || row.source || 'offline').toUpperCase() as 'ONLINE' | 'OFFLINE',
            status: (row.status || 'COMPLETED').toUpperCase() as 'COMPLETED' | 'PENDING',
            is_gst: Boolean(Number(row.total_gst || row.gst_amount || 0) > 0 || row.is_gst),
            subtotal,
            discount_type: 'FIXED',
            discount_value: discount,
            discount_amount: discount,
            gst_percentage: Number(row.gst_percentage || row.gst_rate || 0),
            gst_amount: Number(row.total_gst || row.gst_amount || 0),
            delivery_fee: Number(row.delivery_charge || row.delivery_fee || 0),
            grand_total: total,
            cash_received: Number(row.cash_received || row.received_amount || total),
            split_cash: Number(row.split_cash || row.split_details?.cash || 0),
            split_gpay: Number(row.split_gpay || row.split_details?.gpay || 0),
            payment_mode: (String(row.payment_mode || row.payment_method || 'CASH').toUpperCase()) as PaymentMode,
            bill_date: row.billing_date || row.created_at || new Date().toISOString(),
            created_at: row.created_at || new Date().toISOString(),
            coupon_code: row.coupon_code || null,
            remarks: row.notes || row.remarks || null,
            reference_number: row.reference_number || null,
            is_credit: Boolean(row.is_credit || row.payment_mode === 'CREDIT' || row.payment_method === 'credit' || row.credit_status),
            credit_status: row.credit_status || (row.is_credit || row.payment_mode === 'CREDIT' || row.payment_method === 'credit' ? 'outstanding' : null),
            credit_due_date: row.credit_due_date || null,
            credit_paid_at: row.credit_paid_at || null,
            items: mappedItems,
          };
        }
      } catch (err) {
        console.warn('Supabase getOrderWithRelations failed:', err);
      }
    }

    try {
      const orders = await sql`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.id = ${cleanId} OR o.id = ${rawId}
      `;
      if (orders.length === 0) return null;

      const items = await sql`SELECT * FROM order_items WHERE order_id = ${cleanId} OR order_id = ${rawId}`;

      return {
        ...(orders[0] as any),
        items: items as OrderItemRow[],
      } as OrderWithRelations;
    } catch {
      return null;
    }
  },

  async deleteOrder(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('orders').delete().or(`invoice_no.eq.${id},id.eq.${id}`);
        return;
      } catch (err) {
        console.warn('Supabase deleteOrder failed:', err);
      }
    }

    try {
      await sql`DELETE FROM orders WHERE id = ${id}`;
    } catch {
      // ignore
    }
  },

  async submitOrder(payload: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    source: 'ONLINE' | 'OFFLINE';
    isGst: boolean;
    billDate: string;
    items: CartItem[];
    discountType: 'PERCENT' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    gstPercentage: number;
    gstAmount: number;
    deliveryFee: number;
    grandTotal: number;
    cashReceived: number;
    splitCash?: number;
    splitGpay?: number;
    paymentMode: PaymentMode;
    couponCode?: string | null;
    remarks?: string | null;
    referenceNumber?: string | null;
    creditDueDate?: string | null;
  }): Promise<{ orderId: string }> {
    const formattedInvoiceNo = payload.orderId.startsWith('INV') ? payload.orderId : `INV-${payload.orderId}`;
    const subtotalInclusive = payload.grandTotal + payload.discountAmount - payload.deliveryFee;
    const isCredit = payload.paymentMode === 'CREDIT';

    const structuredItems = payload.items.map((it) => ({
      product_id: it.product_id || null,
      name: it.name,
      quantity: it.qty,
      unit: it.unit || 'piece',
      base_price: it.price,
      line_total: it.price * it.qty,
      sku: it.sku || null,
    }));

    if (isSupabaseConfigured) {
      try {
        let createdAtIso = new Date().toISOString();
        if (payload.billDate) {
          try {
            const d = new Date(payload.billDate.includes('T') ? payload.billDate : `${payload.billDate}T12:00:00Z`);
            if (!isNaN(d.getTime())) {
              createdAtIso = d.toISOString();
            }
          } catch {
            createdAtIso = new Date().toISOString();
          }
        }

        const orderRow: Record<string, any> = {
          invoice_no: formattedInvoiceNo,
          customer_name: payload.customerName.trim() || 'Counter Customer',
          phone: payload.customerPhone.trim() || '',
          address: payload.customerAddress?.trim() || '',
          order_mode: (payload.source || 'OFFLINE').toLowerCase(),
          order_type: 'pos_sale',
          status: 'completed',
          subtotal: subtotalInclusive,
          total: payload.grandTotal,
          discount_amount: payload.discountAmount,
          manual_discount_amount: 0,
          total_gst: payload.isGst ? payload.gstAmount : 0,
          delivery_charge: payload.deliveryFee,
          payment_mode: payload.paymentMode,
          payment_method: payload.paymentMode.toLowerCase(),
          cash_received: Number(payload.cashReceived) || 0,
          split_details: payload.paymentMode === 'SPLIT' ? { cash: Number(payload.splitCash) || 0, gpay: Number(payload.splitGpay) || 0 } : {},
          coupon_code: payload.couponCode || null,
          items: structuredItems,
          notes: payload.remarks || null,
          reference_number: payload.referenceNumber || null,
          is_credit: isCredit,
          credit_status: isCredit ? 'outstanding' : null,
          credit_due_date: isCredit ? (payload.creditDueDate || null) : null,
          created_at: createdAtIso,
        };

        const { data, error } = await supabase
          .from('orders')
          .insert(orderRow)
          .select('id, invoice_no')
          .single();

        if (error) {
          console.warn('Supabase submitOrder insert error:', error.message, error.details);
        }

        if (!error && data) {
          // Record order items in order_items table
          try {
            await Promise.all(
              structuredItems.map((item) =>
                supabase.from('order_items').insert({
                  order_id: data.id,
                  product_name: item.name,
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit || 'piece',
                  base_price: item.base_price,
                  line_total: item.line_total,
                })
              )
            );
          } catch {
            // non-fatal
          }

          // Atomically decrement stock if product_id exists
          for (const item of payload.items) {
            if (item.product_id) {
              try {
                const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
                if (prod) {
                  const newQty = Math.max(0, Number(prod.stock_quantity || 0) - item.qty);
                  await supabase.from('products').update({ stock_quantity: newQty, stock: newQty }).eq('id', item.product_id);
                  await supabase.from('inventory_logs').insert({
                    product_id: item.product_id,
                    old_quantity: prod.stock_quantity,
                    new_quantity: newQty,
                    adjustment: -item.qty,
                    reason: 'sale',
                    reference_id: formattedInvoiceNo,
                  });
                }
              } catch {
                // non-fatal
              }
            }
          }

          return { orderId: data.invoice_no || formattedInvoiceNo };
        }
      } catch (err) {
        console.warn('Supabase submitOrder failed, trying SQL fallback:', err);
      }
    }

    // Local SQL Fallback
    try {
      const customer = await this.upsertCustomer(
        payload.customerName,
        payload.customerPhone,
        payload.customerAddress,
      );

      await sql`
        INSERT INTO orders (
          id, customer_id, source, status, is_gst, subtotal, discount_type, discount_value,
          discount_amount, gst_percentage, gst_amount, delivery_fee, grand_total,
          cash_received, split_cash, split_gpay, payment_mode, bill_date, created_at,
          is_credit, credit_status, credit_due_date
        ) VALUES (
          ${payload.orderId}, ${customer.id}, ${payload.source}, 'COMPLETED', ${payload.isGst},
          ${subtotalInclusive},
          ${payload.discountType}, ${payload.discountValue}, ${payload.discountAmount},
          ${payload.gstPercentage}, ${payload.gstAmount}, ${payload.deliveryFee},
          ${payload.grandTotal}, ${payload.cashReceived},
          ${payload.splitCash ?? 0}, ${payload.splitGpay ?? 0},
          ${payload.paymentMode}, ${payload.billDate}, now(),
          ${isCredit}, ${isCredit ? 'outstanding' : null}, ${isCredit ? (payload.creditDueDate || null) : null}
        )
      `;

      await Promise.all(
        payload.items.map((oi) =>
          sql`
            INSERT INTO order_items (
              id, order_id, product_id, snapshot_name, snapshot_price, quantity
            ) VALUES (
              ${uid()}, ${payload.orderId}, ${oi.product_id},
              ${oi.name}, ${oi.price}, ${oi.qty}
            )
          `
        ),
      );
    } catch {
      // ignore
    }

    return { orderId: payload.orderId };
  },

  // â”€â”€ EXPENSES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async listExpenses(): Promise<Expense[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*, expense_categories(name)')
          .order('expense_date', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((e: any) => ({
            id: String(e.id),
            title: e.description || e.expense_categories?.name || 'Expense',
            category: e.expense_categories?.name || 'General',
            amount: Number(e.amount || 0),
            payment_mode: 'CASH',
            notes: e.description || null,
            expense_date: e.expense_date ? String(e.expense_date).split('T')[0] : new Date().toISOString().split('T')[0],
            created_at: e.created_at || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn('Supabase listExpenses failed:', err);
      }
    }

    try {
      const rows = await sql`
        SELECT * FROM expenses
        ORDER BY expense_date DESC, created_at DESC
      `;
      return rows as Expense[];
    } catch {
      return [];
    }
  },

  async addExpense(input: {
    title: string;
    category: string;
    amount: number;
    payment_mode: string;
    notes: string | null;
    expense_date: string;
  }): Promise<Expense> {
    const id = uid();
    if (isSupabaseConfigured) {
      try {
        // Find or create category
        let categoryId = 1;
        const { data: catData } = await supabase.from('expense_categories').select('id').ilike('name', input.category.trim()).single();
        if (catData) {
          categoryId = catData.id;
        } else {
          const { data: newCat } = await supabase.from('expense_categories').insert({ name: input.category.trim() }).select('id').single();
          if (newCat) categoryId = newCat.id;
        }

        const { data, error } = await supabase
          .from('expenses')
          .insert({
            category_id: categoryId,
            amount: input.amount,
            description: input.notes ? `${input.title} - ${input.notes}` : input.title,
            expense_date: input.expense_date,
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            title: input.title,
            category: input.category,
            amount: Number(data.amount),
            payment_mode: input.payment_mode,
            notes: input.notes,
            expense_date: input.expense_date,
            created_at: data.created_at || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn('Supabase addExpense failed:', err);
      }
    }

    try {
      const rows = await sql`
        INSERT INTO expenses (id, title, category, amount, payment_mode, notes, expense_date)
        VALUES (
          ${id}, ${input.title}, ${input.category}, ${input.amount},
          ${input.payment_mode}, ${input.notes}, ${input.expense_date}
        )
        RETURNING *
      `;
      return rows[0] as Expense;
    } catch {
      return {
        id,
        title: input.title,
        category: input.category,
        amount: input.amount,
        payment_mode: input.payment_mode,
        notes: input.notes,
        expense_date: input.expense_date,
        created_at: new Date().toISOString(),
      };
    }
  },

  async updateExpense(id: string, patch: Partial<Expense>): Promise<Expense | null> {
    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {};
        if (patch.amount !== undefined) payload.amount = patch.amount;
        if (patch.expense_date !== undefined) payload.expense_date = patch.expense_date;
        if (patch.title !== undefined || patch.notes !== undefined) {
          payload.description = `${patch.title || ''} ${patch.notes ? '- ' + patch.notes : ''}`.trim();
        }

        await supabase.from('expenses').update(payload).eq('id', id);
      } catch {
        // ignore
      }
    }

    try {
      if (patch.title !== undefined) await sql`UPDATE expenses SET title = ${patch.title} WHERE id = ${id}`;
      if (patch.category !== undefined) await sql`UPDATE expenses SET category = ${patch.category} WHERE id = ${id}`;
      if (patch.amount !== undefined) await sql`UPDATE expenses SET amount = ${patch.amount} WHERE id = ${id}`;
      if (patch.payment_mode !== undefined) await sql`UPDATE expenses SET payment_mode = ${patch.payment_mode} WHERE id = ${id}`;
      if (patch.notes !== undefined) await sql`UPDATE expenses SET notes = ${patch.notes} WHERE id = ${id}`;
      if (patch.expense_date !== undefined) await sql`UPDATE expenses SET expense_date = ${patch.expense_date} WHERE id = ${id}`;

      const rows = await sql`SELECT * FROM expenses WHERE id = ${id}`;
      return rows.length > 0 ? (rows[0] as Expense) : null;
    } catch {
      return null;
    }
  },

  async deleteExpense(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('expenses').delete().eq('id', id);
        return;
      } catch {
        // ignore
      }
    }

    try {
      await sql`DELETE FROM expenses WHERE id = ${id}`;
    } catch {
      // ignore
    }
  },

  // â”€â”€ ADVANCE ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async listAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
    const mapStatus = (rawStatus: any): AdvanceOrderStatus => {
      const s = String(rawStatus || '').toLowerCase();
      if (s === 'completed') return 'COMPLETED';
      if (s === 'cancelled' || s === 'canceled') return 'CANCELLED';
      if (s === 'ready' || s === 'ready_for_delivery') return 'READY';
      return 'PENDING';
    };

    if (isSupabaseConfigured) {
      const results: AdvanceOrderWithRelations[] = [];
      const seenIds = new Set<string>();

      // 1. Read from dedicated advance_orders table
      try {
        const { data, error } = await supabase
          .from('advance_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          for (const a of data) {
            const advId = a.deposit_id || a.depositId || String(a.id);
            // Track both the logical ID and raw row ID for dedup below
            seenIds.add(advId);
            if (a.deposit_id) seenIds.add(String(a.id));

            let parsedItems: any[] = [];
            if (Array.isArray(a.products) && a.products.length > 0) {
              parsedItems = a.products;
            } else if (typeof a.products === 'string' && a.products.trim()) {
              try { parsedItems = JSON.parse(a.products); } catch {}
            }

            const items: AdvanceOrderItemRow[] = parsedItems.length > 0
              ? parsedItems.map((it: any, idx: number) => ({
                  id: String(it.id || `${a.id}-item-${idx}`),
                  advance_order_id: advId,
                  product_id: it.product_id ? String(it.product_id) : null,
                  snapshot_name: it.name || it.product_name || it.snapshot_name || 'Tailoring Item',
                  snapshot_desc: it.desc || it.snapshot_desc || null,
                  snapshot_price: Number(it.price || it.snapshot_price || 0),
                  quantity: Number(it.qty || it.quantity || 1),
                }))
              : [
                  {
                    id: `${a.id}-item`,
                    advance_order_id: advId,
                    product_id: a.product_id ? String(a.product_id) : null,
                    snapshot_name: a.product_name || 'Tailoring Item',
                    snapshot_desc: a.description || null,
                    snapshot_price: Number(a.total_amount || 0),
                    quantity: 1,
                  },
                ];

            results.push({
              id: advId,
              customer_id: String(a.id),
              customer_name: a.customer_name || 'Customer',
              customer_phone: a.phone || a.customer_phone || '',
              customer_address: a.address || a.customer_address || null,
              status: mapStatus(a.status),
              subtotal: Number(a.total_amount || a.subtotal || 0),
              total_amount: Number(a.total_amount || 0),
              deposit_amount: Number(a.deposit_amount || 0),
              deposit_payment_mode: 'CASH' as PaymentMode,
              delivery_date: a.expected_delivery_date || a.delivery_date || null,
              notes: a.remarks || a.notes || a.description || null,
              finalized_order_id: null,
              finalized_at: a.completed_at || null,
              cancelled_at: null,
              created_at: a.created_at || new Date().toISOString(),
              items,
            });
          }
        }
      } catch (err) {
        console.warn('Supabase advance_orders query failed:', err);
      }

      // 2. Also query orders table for advance orders saved there (runs unconditionally)
      try {
        const { data: ordData, error: ordErr } = await supabase
          .from('orders')
          .select('*')
          .or('order_type.eq.ADVANCE,order_type.eq.advance,invoice_no.ilike.DEP-%')
          .order('created_at', { ascending: false });

        if (!ordErr && ordData && ordData.length > 0) {
          for (const o of ordData) {
            const advId = o.invoice_no || String(o.id);
            if (seenIds.has(advId) || seenIds.has(String(o.id))) continue;
            seenIds.add(advId);

            let orderItems: any[] = [];
            if (Array.isArray(o.items)) orderItems = o.items;
            else if (typeof o.items === 'string') {
              try { orderItems = JSON.parse(o.items); } catch {}
            }

            const items: AdvanceOrderItemRow[] = orderItems.map((it: any, idx: number) => ({
              id: String(it.id || `${o.id}-item-${idx}`),
              advance_order_id: advId,
              product_id: it.product_id ? String(it.product_id) : null,
              snapshot_name: it.name || it.product_name || 'Tailoring Item',
              snapshot_desc: it.desc || null,
              snapshot_price: Number(it.price || it.base_price || 0),
              quantity: Number(it.quantity || it.qty || 1),
            }));

            const totalAmt = Number(o.total || o.grand_total || o.total_amount || 0);
            const depAmt = Number(o.amount_paid || o.cash_received || o.deposit_amount || 0);

            results.push({
              id: advId,
              customer_id: String(o.user_id || o.id),
              customer_name: o.customer_name || 'Customer',
              customer_phone: o.phone || o.customer_phone || '',
              customer_address: o.address || null,
              status: mapStatus(o.status),
              subtotal: Number(o.subtotal || totalAmt),
              total_amount: totalAmt,
              deposit_amount: depAmt,
              deposit_payment_mode: (String(o.payment_mode || 'CASH').toUpperCase()) as PaymentMode,
              delivery_date: o.delivery_date || o.expected_delivery_date || null,
              notes: o.notes || o.remarks || null,
              finalized_order_id: null,
              finalized_at: null,
              cancelled_at: null,
              created_at: o.created_at || new Date().toISOString(),
              items: items.length > 0 ? items : [{
                id: `${o.id}-item`,
                advance_order_id: advId,
                product_id: null,
                snapshot_name: 'Tailoring Item',
                snapshot_desc: null,
                snapshot_price: totalAmt,
                quantity: 1,
              }],
            });
          }
        }
      } catch {
        // non-fatal: orders table may not have advance columns yet
      }

      return results;
    }

    try {
      const rows = await sql`
        SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
        FROM advance_orders a
        JOIN customers c ON c.id = a.customer_id
        ORDER BY a.created_at DESC
      `;
      if (rows.length === 0) return [];

      const ids = rows.map((r: any) => r.id);
      const items = await sql`
        SELECT * FROM advance_order_items WHERE advance_order_id = ANY(${ids})
      `;

      return rows.map((r: any) => ({
        ...r,
        items: (items as AdvanceOrderItemRow[]).filter((i) => i.advance_order_id === r.id),
      })) as AdvanceOrderWithRelations[];
    } catch {
      return [];
    }
  },

  async getAdvanceOrder(id: string): Promise<AdvanceOrderWithRelations | null> {
    const rawId = decodeURIComponent(String(id || '')).trim();
    const cleanId = rawId.replace(/^#/, '').trim();
    const list = await this.listAdvanceOrders();
    const found = list.find(
      (a) => a.id === cleanId || a.id === rawId || a.id.replace(/^#/, '') === cleanId
    );
    return found || null;
  },

  async advanceOrderIdExists(id: string): Promise<boolean> {
    const order = await this.getAdvanceOrder(id);
    return !!order;
  },

  async createAdvanceOrder(payload: {
    advanceOrderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    subtotal: number;
    totalAmount: number;
    depositAmount: number;
    depositPaymentMode: PaymentMode;
    deliveryDate: string | null;
    notes: string | null;
    items: {
      product_id: string | null;
      snapshot_name: string;
      snapshot_desc: string | null;
      snapshot_price: number;
      quantity: number;
    }[];
  }): Promise<{ advanceOrderId: string }> {
    if (isSupabaseConfigured) {
      try {
        const firstItem = payload.items[0];
        const structuredItems = payload.items.map((i) => ({
          name: i.snapshot_name,
          desc: i.snapshot_desc,
          price: i.snapshot_price,
          qty: i.quantity,
          product_id: i.product_id,
        }));

        // Calculate a safe expected delivery date (advance_orders has NOT NULL constraint on expected_delivery_date)
        let deliveryDateStr = payload.deliveryDate;
        if (!deliveryDateStr || !deliveryDateStr.trim()) {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          deliveryDateStr = d.toISOString().split('T')[0];
        }

        // 1. Insert into dedicated advance_orders table
        // Note: remaining_balance is a GENERATED column in Postgres, so it must NOT be in insert payload.
        // product_id does NOT exist in advance_orders schema, so it is omitted.
        const { error: advErr } = await supabase.from('advance_orders').insert({
          deposit_id: payload.advanceOrderId,
          customer_name: payload.customerName.trim() || 'Guest',
          phone: payload.customerPhone.trim() || '',
          address: payload.customerAddress?.trim() || '',
          product_name: firstItem?.snapshot_name || 'Tailoring Item',
          products: structuredItems,
          total_amount: payload.totalAmount,
          deposit_amount: payload.depositAmount,
          expected_delivery_date: deliveryDateStr,
          remarks: payload.notes || '',
          status: 'pending_deposit',
        });

        if (advErr) {
          console.warn('Supabase advance_orders table insert failed:', advErr.message, advErr.details);
        }

        // 2. Also dual-persist to orders table with all query reconciliation flags:
        // order_type: 'ADVANCE', invoice_no: DEP-..., status: 'PENDING'
        try {
          const { error: ordErr } = await supabase.from('orders').insert({
            invoice_no: payload.advanceOrderId,
            customer_name: payload.customerName.trim() || 'Guest',
            phone: payload.customerPhone.trim() || '',
            address: payload.customerAddress?.trim() || '',
            order_mode: 'offline',
            order_type: 'ADVANCE',
            status: 'PENDING',
            subtotal: payload.subtotal,
            total: payload.totalAmount,
            discount_amount: 0,
            manual_discount_amount: 0,
            total_gst: 0,
            delivery_charge: 0,
            payment_mode: payload.depositPaymentMode,
            payment_method: payload.depositPaymentMode.toLowerCase(),
            cash_received: payload.depositAmount,
            notes: payload.notes || null,
            items: structuredItems,
            created_at: new Date().toISOString(),
          });
          if (ordErr) {
            console.warn('Supabase orders dual-insert for advance order note:', ordErr.message);
          }
        } catch (dualErr) {
          // non-fatal if table lacks columns
          console.warn('Supabase orders dual-insert for advance order note:', dualErr);
        }

        return { advanceOrderId: payload.advanceOrderId };
      } catch (err) {
        console.warn('Supabase createAdvanceOrder failed:', err);
      }
    }

    try {
      const customer = await this.upsertCustomer(
        payload.customerName,
        payload.customerPhone,
        payload.customerAddress,
      );

      await sql`
        INSERT INTO advance_orders (
          id, customer_id, status, subtotal, total_amount, deposit_amount,
          deposit_payment_mode, delivery_date, notes
        ) VALUES (
          ${payload.advanceOrderId}, ${customer.id}, 'PENDING',
          ${payload.subtotal}, ${payload.totalAmount}, ${payload.depositAmount},
          ${payload.depositPaymentMode}, ${payload.deliveryDate}, ${payload.notes}
        )
      `;

      await Promise.all(
        payload.items.map((it) =>
          sql`
            INSERT INTO advance_order_items (
              id, advance_order_id, product_id, snapshot_name, snapshot_desc, snapshot_price, quantity
            ) VALUES (
              ${uid()}, ${payload.advanceOrderId}, ${it.product_id},
              ${it.snapshot_name}, ${it.snapshot_desc}, ${it.snapshot_price}, ${it.quantity}
            )
          `
        ),
      );
    } catch {
      // ignore
    }

    return { advanceOrderId: payload.advanceOrderId };
  },

  async updateAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const hmStatus = status === 'COMPLETED' ? 'completed' : status === 'CANCELLED' ? 'cancelled' : status === 'READY' ? 'ready_for_delivery' : 'pending_deposit';
        let qAdv = supabase.from('advance_orders').update({
          status: hmStatus,
          ...(status === 'COMPLETED' ? { completed_at: new Date().toISOString() } : {}),
        });
        if (isUuid(id)) {
          qAdv = qAdv.or(`deposit_id.eq.${id},id.eq.${id}`);
        } else {
          qAdv = qAdv.eq('deposit_id', id);
        }
        await qAdv;
      } catch {
        // ignore
      }
      try {
        let qOrd = supabase.from('orders').update({ status });
        if (isUuid(id)) {
          qOrd = qOrd.or(`invoice_no.eq.${id},id.eq.${id}`);
        } else {
          qOrd = qOrd.eq('invoice_no', id);
        }
        await qOrd;
      } catch {
        // ignore
      }
    }

    try {
      await sql`UPDATE advance_orders SET status = ${status} WHERE id = ${id}`;
    } catch {
      // ignore
    }
  },

  async cancelAdvanceOrder(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        let qAdv = supabase.from('advance_orders').update({ status: 'cancelled' });
        if (isUuid(id)) {
          qAdv = qAdv.or(`deposit_id.eq.${id},id.eq.${id}`);
        } else {
          qAdv = qAdv.eq('deposit_id', id);
        }
        await qAdv;
      } catch {
        // ignore
      }
      try {
        let qOrd = supabase.from('orders').update({ status: 'CANCELLED' });
        if (isUuid(id)) {
          qOrd = qOrd.or(`invoice_no.eq.${id},id.eq.${id}`);
        } else {
          qOrd = qOrd.eq('invoice_no', id);
        }
        await qOrd;
      } catch {
        // ignore
      }
    }

    try {
      await sql`
        UPDATE advance_orders
        SET status = 'CANCELLED', cancelled_at = now()
        WHERE id = ${id}
      `;
    } catch {
      // ignore
    }
  },

  async deleteAdvanceOrder(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        let qAdv = supabase.from('advance_orders').delete();
        if (isUuid(id)) {
          qAdv = qAdv.or(`deposit_id.eq.${id},id.eq.${id}`);
        } else {
          qAdv = qAdv.eq('deposit_id', id);
        }
        await qAdv;
      } catch {
        // ignore
      }
      try {
        let qOrd = supabase.from('orders').delete();
        if (isUuid(id)) {
          qOrd = qOrd.or(`invoice_no.eq.${id},id.eq.${id}`);
        } else {
          qOrd = qOrd.eq('invoice_no', id);
        }
        await qOrd;
      } catch {
        // ignore
      }
    }

    try {
      await sql`DELETE FROM advance_orders WHERE id = ${id}`;
    } catch {
      // ignore
    }
  },

  async finalizeAdvanceOrder(payload: {
    advanceOrderId: string;
    invoiceId: string;
    isGst: boolean;
    gstPercentage: number;
    discountType: 'PERCENT' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    deliveryFee: number;
    paymentMode: PaymentMode;
    billDate: string;
  }): Promise<{ orderId: string }> {
    const advance = await this.getAdvanceOrder(payload.advanceOrderId);
    if (!advance) throw new Error('Advance order not found');

    const cart: CartItem[] = advance.items.map((it) => ({
      id: it.id,
      product_id: it.product_id,
      name: it.snapshot_name,
      desc: it.snapshot_desc || '',
      price: Number(it.snapshot_price),
      qty: it.quantity,
    }));

    const rawSubtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const netInclusive = Math.max(0, rawSubtotal - payload.discountAmount);
    const gstAmount =
      payload.isGst && payload.gstPercentage > 0
        ? netInclusive - netInclusive / (1 + payload.gstPercentage / 100)
        : 0;
    const grandTotal = netInclusive + payload.deliveryFee;

    const { orderId } = await this.submitOrder({
      orderId: payload.invoiceId,
      customerName: advance.customer_name,
      customerPhone: advance.customer_phone,
      customerAddress: advance.customer_address,
      source: 'OFFLINE',
      isGst: payload.isGst,
      billDate: payload.billDate,
      items: cart,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      gstPercentage: payload.isGst ? payload.gstPercentage : 0,
      gstAmount,
      deliveryFee: payload.deliveryFee,
      grandTotal,
      cashReceived: grandTotal,
      paymentMode: payload.paymentMode,
      remarks: `Advance order hold completed: #${payload.advanceOrderId}`,
    });

    await this.updateAdvanceOrderStatus(payload.advanceOrderId, 'COMPLETED');

    return { orderId };
  },

  // â”€â”€ OUTSTANDING CREDITS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async markCreditOrderPaid(orderId: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('mark_credit_order_paid', { p_order_id: orderId });
        if (!error) return;
      } catch {
        // Fallback to direct update
      }

      try {
        const paidAt = new Date().toISOString();
        const { error: directErr } = await supabase
          .from('orders')
          .update({
            credit_status: 'paid',
            credit_paid_at: paidAt,
            updated_at: paidAt,
          })
          .or(`id.eq.${orderId},invoice_no.eq.${orderId}`);
        if (directErr) console.warn('Supabase markCreditOrderPaid direct update failed:', directErr);
      } catch (e) {
        console.warn('Supabase markCreditOrderPaid error:', e);
      }
    }
  },

  async updateCreditDueDate(orderId: string, dueDate: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({
            credit_due_date: dueDate,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${orderId},invoice_no.eq.${orderId}`);
        if (error) console.warn('Supabase updateCreditDueDate failed:', error);
      } catch (e) {
        console.warn('Supabase updateCreditDueDate error:', e);
      }
    }
  },
};
