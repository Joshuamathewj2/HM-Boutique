const { createClient } = require('@supabase/supabase-js');
const url = 'https://aybfklpejvsphkxmetpn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg';
const supabase = createClient(url, key);

async function inspect() {
  const tables = ['orders', 'order_items', 'advance_orders', 'customers', 'products', 'categories'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`TABLE: ${t} ERROR:`, error.message);
    } else if (data && data[0]) {
      console.log(`\n=== TABLE: ${t} ===`);
      for (const [k, v] of Object.entries(data[0])) {
        const valPreview = JSON.stringify(v);
        console.log(`  ${k} (${typeof v}): ${valPreview && valPreview.length > 50 ? valPreview.slice(0, 50) + '...' : valPreview}`);
      }
    } else {
      console.log(`\n=== TABLE: ${t} (EMPTY) ===`);
    }
  }

  // Let's also check distinct status values in orders and advance_orders
  console.log('\n=== DISTINCT VALUES IN ORDERS ===');
  const { data: ords } = await supabase.from('orders').select('status, payment_method, payment_mode, is_advance, is_credit, credit_status');
  if (ords) {
    const statuses = new Set(ords.map(o => o.status));
    const payMethods = new Set(ords.map(o => o.payment_method));
    const payModes = new Set(ords.map(o => o.payment_mode));
    const creditStatuses = new Set(ords.map(o => o.credit_status));
    console.log('statuses in orders:', [...statuses]);
    console.log('payment_methods in orders:', [...payMethods]);
    console.log('payment_modes in orders:', [...payModes]);
    console.log('credit_statuses in orders:', [...creditStatuses]);
  }

  console.log('\n=== DISTINCT VALUES IN ADVANCE_ORDERS ===');
  const { data: advs } = await supabase.from('advance_orders').select('status');
  if (advs) {
    console.log('statuses in advance_orders:', [...new Set(advs.map(a => a.status))]);
  }
}
inspect();
