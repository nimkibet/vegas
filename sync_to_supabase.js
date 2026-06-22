const { execSync } = require('child_process');

const supabaseUrl = "https://gtjwctckznenodikmgye.supabase.co";
const apiKey = "sb_publishable_nenFH56WRAtYgBaXPjrywQ_ExtvVz3a";
const dbPath = "C:\\Users\\Nextgen\\AppData\\VegasSupermarket\\pos_system.db";

function querySqlite(table) {
  try {
    const stdout = execSync(`sqlite3 -json "${dbPath}" "SELECT * FROM ${table}"`).toString();
    return JSON.parse(stdout || "[]");
  } catch (e) {
    console.error(`Error querying table ${table}:`, e.message);
    return [];
  }
}

async function uploadToSupabase(endpoint, data) {
  if (data.length === 0) return;
  console.log(`Uploading ${data.length} records to ${endpoint}...`);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      console.log(`Successfully uploaded to ${endpoint}`);
    } else {
      const text = await res.text();
      console.error(`Failed to upload to ${endpoint}:`, res.statusText, text);
    }
  } catch (e) {
    console.error(`Error uploading to ${endpoint}:`, e.message);
  }
}

async function sync() {
  const products = querySqlite('products').map(p => {
    return {
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      retail_price: parseFloat(p.retail_price),
      wholesale_price: parseFloat(p.wholesale_price),
      stock_quantity: parseFloat(p.stock_quantity),
      min_stock_level: parseFloat(p.min_stock_level),
      unit_type: p.unit_type,
      is_active: p.is_active === 1,
      parent_barcode: p.parent_barcode,
      parent_wholesale_barcode: p.parent_wholesale_barcode,
      conversion_yield: parseInt(p.conversion_yield || 0),
      raw_piece_yield: parseInt(p.raw_piece_yield || 0),
      deduction_ratio: parseFloat(p.deduction_ratio || 1.0),
      created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString()
    };
  });
  await uploadToSupabase('products', products);

  // Sync sales, sale items, and transactions as well
  const sales = querySqlite('sales').map(s => {
    return {
      id: s.id,
      user_id: s.user_id,
      subtotal: parseFloat(s.subtotal),
      tax_amount: parseFloat(s.tax_amount),
      discount_amount: parseFloat(s.discount_amount),
      total: parseFloat(s.total),
      amount_paid: parseFloat(s.amount_paid),
      change_given: parseFloat(s.change_given),
      payment_method: s.payment_method,
      status: s.status,
      notes: s.notes,
      cash_amount: parseFloat(s.cash_amount),
      mpesa_amount: parseFloat(s.mpesa_amount),
      secondary_payment_method: s.secondary_payment_method,
      created_at: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
      updated_at: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
    };
  });
  await uploadToSupabase('cloud_sales', sales);

  const saleItems = querySqlite('sale_items').map(si => {
    return {
      id: si.id,
      sale_id: si.sale_id,
      product_id: si.product_id,
      product_name: si.product_name,
      product_barcode: si.product_barcode,
      quantity: parseFloat(si.quantity),
      unit_price: parseFloat(si.unit_price),
      total_price: parseFloat(si.total_price),
      created_at: si.created_at ? new Date(si.created_at).toISOString() : new Date().toISOString(),
    };
  });
  await uploadToSupabase('cloud_sale_items', saleItems);

  const supplierTransactions = querySqlite('supplier_transactions').map(st => {
    return {
      id: st.id,
      supplier_name: st.supplier_name,
      total_cost: parseFloat(st.total_cost),
      debtor_offset: parseFloat(st.debtor_offset),
      cash_paid: parseFloat(st.cash_paid),
      debtor_id: st.debtor_id,
      transaction_date: st.transaction_date ? new Date(st.transaction_date).toISOString() : new Date().toISOString(),
      notes: st.notes
    };
  });
  await uploadToSupabase('supplier_transactions', supplierTransactions);
}

sync();
