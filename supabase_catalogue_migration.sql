-- ============================================================
-- HM BOUTIQUE — OFFICIAL INVENTORY & CATALOGUE PRICING MIGRATION
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Remove artificial course package placeholder rows that were added as items
DELETE FROM inventory 
WHERE name ILIKE '%(Full Package%' 
   OR name IN ('Basics Course', 'Diploma Course', 'Fashion Designing Diploma', 'Blouse Only Course', 'Salwar Only Course');

DELETE FROM products 
WHERE name ILIKE '%(Full Package%' 
   OR name IN ('Basics Course', 'Diploma Course', 'Fashion Designing Diploma', 'Blouse Only Course', 'Salwar Only Course')
   OR sku IN ('BLOUSE-PKG', 'SALWAR-PKG', 'BASICS-PKG', 'DIPLOMA-PKG', 'FD-PKG');

-- Step 2: Set the exact fee and duration for EVERY item under each category
-- BLOUSE ONLY items -> ₹10,000 (1 Month)
UPDATE inventory 
SET price = 10000, 
    duration = '1 Month'
WHERE UPPER(TRIM(category)) = 'BLOUSE ONLY';

UPDATE products 
SET price = 10000, 
    offer_price = 10000, 
    unit_label = '1 Month'
WHERE UPPER(TRIM(category)) = 'BLOUSE ONLY';

-- SALWAR ONLY items -> ₹10,000 (1 Month)
UPDATE inventory 
SET price = 10000, 
    duration = '1 Month'
WHERE UPPER(TRIM(category)) = 'SALWAR ONLY';

UPDATE products 
SET price = 10000, 
    offer_price = 10000, 
    unit_label = '1 Month'
WHERE UPPER(TRIM(category)) = 'SALWAR ONLY';

-- BASICS items -> ₹8,000 (2 Months)
UPDATE inventory 
SET price = 8000, 
    duration = '2 Months'
WHERE UPPER(TRIM(category)) = 'BASICS';

UPDATE products 
SET price = 8000, 
    offer_price = 8000, 
    unit_label = '2 Months'
WHERE UPPER(TRIM(category)) = 'BASICS';

-- DIPLOMA items -> ₹25,000 (3 Months)
UPDATE inventory 
SET price = 25000, 
    duration = '3 Months'
WHERE UPPER(TRIM(category)) = 'DIPLOMA';

UPDATE products 
SET price = 25000, 
    offer_price = 25000, 
    unit_label = '3 Months'
WHERE UPPER(TRIM(category)) = 'DIPLOMA';

-- FASHION DESIGNING DIPLOMA items -> ₹50,000 (5 Months)
UPDATE inventory 
SET price = 50000, 
    duration = '5 Months'
WHERE UPPER(TRIM(category)) = 'FASHION DESIGNING DIPLOMA';

UPDATE products 
SET price = 50000, 
    offer_price = 50000, 
    unit_label = '5 Months'
WHERE UPPER(TRIM(category)) = 'FASHION DESIGNING DIPLOMA';

-- Step 3: Ensure Categories Exist
INSERT INTO categories (name_en, name_ta, is_active, sort_order)
VALUES 
  ('BLOUSE ONLY', 'பிளவுஸ் பயிற்சி', true, 1),
  ('SALWAR ONLY', 'சல்வார் பயிற்சி', true, 2),
  ('BASICS', 'அடிப்படை தையல்', true, 3),
  ('DIPLOMA', 'டிப்ளமோ பயிற்சி', true, 4),
  ('FASHION DESIGNING DIPLOMA', 'பேஷன் டிசைனிங் டிப்ளமோ', true, 5)
ON CONFLICT (name_en) DO UPDATE 
SET is_active = true,
    sort_order = EXCLUDED.sort_order;

-- Step 4: Upsert All Individual Patterns with Exact Category Pricing and Durations
INSERT INTO products (
  sku, name, category, price, offer_price, purchase_price,
  gst_percent, unit, unit_label, stock_quantity, low_stock_alert,
  is_active, item_type, description
) VALUES
  -- BLOUSE ONLY (₹10,000 | 1 Month)
  ('BL-01', 'Normal Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-02', 'Lining Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-03', 'Cross Cut Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-04', 'Back Open Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-05', 'Collar Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-06', '''I'' Neck Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-07', 'Boat Neck Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-08', 'Princess Cut Blouse - 1', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-09', 'Single Katori Cut Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-10', 'Double Katori Cut Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-11', 'Designer Blouse - 1', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-12', 'Designer Blouse - 2', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-13', 'Zip Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),
  ('BL-14', 'Bridal Blouse', 'BLOUSE ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'BLOUSE ONLY • 1 Month'),

  -- SALWAR ONLY (₹10,000 | 1 Month)
  ('SL-01', 'Normal Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-02', 'Lining Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-03', 'Kali Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-04', 'Anarkali Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-05', 'A-line Top', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-06', 'High Neck Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-07', 'Collar Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-08', 'Short Top / Bell Bottom', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-09', 'Designer Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),
  ('SL-10', 'Pattern Salwar', 'SALWAR ONLY', 10000.00, 10000.00, 0, 0, 'Pattern', '1 Month', 999, 5, true, 'service', 'SALWAR ONLY • 1 Month'),

  -- BASICS (₹8,000 | 2 Months)
  ('BS-01', 'Long Skirt', 'BASICS', 8000.00, 8000.00, 0, 0, 'Pattern', '2 Months', 999, 5, true, 'service', 'BASICS • 2 Months'),
  ('BS-02', 'In Skirt', 'BASICS', 8000.00, 8000.00, 0, 0, 'Pattern', '2 Months', 999, 5, true, 'service', 'BASICS • 2 Months'),
  ('BS-03', 'Zip Salwar', 'BASICS', 8000.00, 8000.00, 0, 0, 'Pattern', '2 Months', 999, 5, true, 'service', 'BASICS • 2 Months'),
  ('BS-04', 'Back Open Salwar', 'BASICS', 8000.00, 8000.00, 0, 0, 'Pattern', '2 Months', 999, 5, true, 'service', 'BASICS • 2 Months'),
  ('BS-05', 'Frock', 'BASICS', 8000.00, 8000.00, 0, 0, 'Pattern', '2 Months', 999, 5, true, 'service', 'BASICS • 2 Months'),
  ('BS-06', 'Nighty', 'BASICS', 8000.00, 8000.00, 0, 0, 'Pattern', '2 Months', 999, 5, true, 'service', 'BASICS • 2 Months'),

  -- DIPLOMA (₹25,000 | 3 Months)
  ('DP-01', 'Half Skirt', 'DIPLOMA', 25000.00, 25000.00, 0, 0, 'Pattern', '3 Months', 999, 5, true, 'service', 'DIPLOMA • 3 Months'),
  ('DP-02', 'Katori Cut Blouse (Single)', 'DIPLOMA', 25000.00, 25000.00, 0, 0, 'Pattern', '3 Months', 999, 5, true, 'service', 'DIPLOMA • 3 Months'),
  ('DP-03', 'Katori Cut Blouse (Double)', 'DIPLOMA', 25000.00, 25000.00, 0, 0, 'Pattern', '3 Months', 999, 5, true, 'service', 'DIPLOMA • 3 Months'),
  ('DP-04', 'High Neck Blouse', 'DIPLOMA', 25000.00, 25000.00, 0, 0, 'Pattern', '3 Months', 999, 5, true, 'service', 'DIPLOMA • 3 Months'),
  ('DP-05', 'Designing Salwar', 'DIPLOMA', 25000.00, 25000.00, 0, 0, 'Pattern', '3 Months', 999, 5, true, 'service', 'DIPLOMA • 3 Months'),
  ('DP-06', 'Highneck Salwar', 'DIPLOMA', 25000.00, 25000.00, 0, 0, 'Pattern', '3 Months', 999, 5, true, 'service', 'DIPLOMA • 3 Months'),

  -- FASHION DESIGNING DIPLOMA (₹50,000 | 5 Months)
  ('FD-01', 'Patterns Blouse - 3', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-02', 'Patch Work Blouse - 1', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-03', 'Anarkali Model - 1', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-04', 'Anarkali Model - 2', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-05', 'Dhoti Pant', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-06', 'Pallazo Pant', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-07', 'Bombay Cut Blouse', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-08', 'Raglan Blouse', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-09', 'Frock Model - 1', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months'),
  ('FD-10', 'Frock Model - 2', 'FASHION DESIGNING DIPLOMA', 50000.00, 50000.00, 0, 0, 'Pattern', '5 Months', 999, 5, true, 'service', 'FASHION DESIGNING DIPLOMA • 5 Months')
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  offer_price = EXCLUDED.offer_price,
  unit = EXCLUDED.unit,
  unit_label = EXCLUDED.unit_label,
  is_active = true,
  item_type = EXCLUDED.item_type,
  description = EXCLUDED.description;
