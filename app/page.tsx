"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { 
  RefreshCw, 
  TrendingUp, 
  Wallet, 
  ShoppingCart, 
  DollarSign, 
  Package, 
  AlertTriangle,
  Radio,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const fetcher = async () => {
  const [salesRes, itemsRes, supplierRes, productsRes, adjustmentsRes, cashDrawingsRes, productDrawingsRes] = await Promise.all([
    supabase.from("cloud_sales").select("*").order("created_at", { ascending: false }),
    supabase.from("cloud_sale_items").select("*"),
    supabase.from("supplier_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("stock_adjustments").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("cloud_cash_drawings").select("*").order("created_at", { ascending: false }),
    supabase.from("cloud_product_drawings").select("*").order("created_at", { ascending: false }),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (supplierRes.error) throw supplierRes.error;
  if (productsRes.error) throw productsRes.error;

  return {
    sales: salesRes.data || [],
    saleItems: itemsRes.data || [],
    supplierTransactions: supplierRes.data || [],
    products: productsRes.data || [],
    stockAdjustments: adjustmentsRes.data || [],
    cashDrawings: cashDrawingsRes.data || [],
    productDrawings: productDrawingsRes.data || [],
  };
};

const CHART_COLORS = ["#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#f59e0b"];

export default function OverviewPage() {
  const { data, error, isLoading, mutate } = useSWR("overviewData", fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 10000, // Fallback polling every 10s
  });
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string>("Initializing...");

  // Setup Supabase Realtime Postgres Changes Subscription
  useEffect(() => {
    setLastLiveUpdate(new Date().toLocaleTimeString());

    const channel = supabase
      .channel("pos_realtime_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cloud_sales" },
        (payload) => {
          setLastLiveUpdate(`Sales updated (${new Date().toLocaleTimeString()})`);
          mutate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cloud_sale_items" },
        (payload) => {
          setLastLiveUpdate(`Sale items updated (${new Date().toLocaleTimeString()})`);
          mutate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          setLastLiveUpdate(`Stock updated (${new Date().toLocaleTimeString()})`);
          mutate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "supplier_transactions" },
        (payload) => {
          setLastLiveUpdate(`Supplier tx updated (${new Date().toLocaleTimeString()})`);
          mutate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_adjustments" },
        (payload) => {
          setLastLiveUpdate(`Stock adjustments (${new Date().toLocaleTimeString()})`);
          mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl"></div>
          ))}
        </div>
        <div className="h-80 bg-muted rounded-2xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-destructive max-w-7xl mx-auto">
        <h2 className="text-xl font-bold">Failed to load Supabase Dashboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => mutate()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { sales, saleItems, supplierTransactions, products, stockAdjustments, cashDrawings, productDrawings } = data!;

  // 1. AMOUNT OF MONEY IN PHYSICAL CASH DRAWER & DRAWINGS
  // FIX: Only count CASH transactions for the drawer (excluding M-PESA/CARD) to match reality
  const totalCashSales = sales.reduce((acc, s) => {
    if (!s.payment_method || s.payment_method === "CASH") {
      return acc + (parseFloat(s.cash_amount || s.total || "0"));
    }
    return acc;
  }, 0);
  const totalCashPaidToSuppliers = supplierTransactions.reduce(
    (acc, tx) => acc + (parseFloat(tx.cash_paid || "0")),
    0
  );
  const totalCashDrawnOut = (cashDrawings || []).reduce(
    (acc, cd) => acc + (parseFloat(cd.amount || "0")),
    0
  );
  const totalProductDrawnValue = (productDrawings || []).reduce(
    (acc, pd) => acc + (parseFloat(pd.total_cost || "0")),
    0
  );
  const moneyInCashDrawer = totalCashSales - totalCashPaidToSuppliers - totalCashDrawnOut;

  // 2. SALES MADE (Total Completed Transactions & Total Item Qty Sold) & Average Order Value (AOV)
  const totalSalesCount = sales.length;
  const totalItemsSoldQty = saleItems.reduce(
    (acc, item) => acc + (parseFloat(item.quantity || "0")),
    0
  );
  
  // FEATURE ADDITION: Average Order Value (AOV)
  const averageOrderValue = totalSalesCount > 0 ? (totalCashSales + sales.reduce((acc, s) => {
    if (s.payment_method && s.payment_method !== "CASH") return acc + parseFloat(s.total || "0");
    return acc;
  }, 0)) / totalSalesCount : 0;

  // 3. REVENUE IN (Total Gross Earnings)
  const totalRevenueIn = sales.reduce((acc, s) => acc + parseFloat(s.total || "0"), 0);

  // Payment Breakdown
  const paymentBreakdown = sales.reduce((acc, s) => {
    const method = s.payment_method || "CASH";
    acc[method] = (acc[method] || 0) + parseFloat(s.total || "0");
    return acc;
  }, {} as Record<string, number>);

  const pieData: { name: string; value: number }[] = Object.entries(paymentBreakdown).map(([name, value]) => ({
    name,
    value: Number(value),
  }));

  // 4. PROFITS MADE (Net Profit = Revenue - COGS)
  // FIX: Aligned perfectly with POS AnalyticsService.java which does SUM((unit_price - unit_cogs) * qty)
  // Maps product cogs/buying price for quick lookup
  const productCostMap: Record<string, number> = {};
  products.forEach((p) => {
    const cost = parseFloat(p.last_buying_price || p.wholesale_price || "0");
    if (p.id) productCostMap[p.id] = cost;
    if (p.barcode) productCostMap[p.barcode] = cost;
  });

  let profitsMade = 0;
  saleItems.forEach((item) => {
    const qty = parseFloat(item.quantity || "0");
    const unitPrice = parseFloat(item.unit_price || "0");
    let unitCost = parseFloat(item.unit_cogs || "0");
    
    if (unitCost <= 0) {
      unitCost = productCostMap[item.product_id] || productCostMap[item.product_barcode] || 0;
    }
    
    profitsMade += (unitPrice - unitCost) * qty;
  });
  const profitMarginPct = totalRevenueIn > 0 ? (profitsMade / totalRevenueIn) * 100 : 0;

  // 5. REALTIME STOCK CHANGES & LOW STOCK ALERTS
  const activeProductsCount = products.length;
  const lowStockProducts = products.filter((p) => {
    const stock = p.stock_quantity || 0;
    const min = p.min_stock_level || 5;
    return stock <= min;
  });
  const outOfStockCount = products.filter((p) => (p.stock_quantity || 0) <= 0).length;

  // Revenue trend (last 7 dates)
  const revenueTrendMap = sales.reduce((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    acc[date] = (acc[date] || 0) + parseFloat(s.total || "0");
    return acc;
  }, {} as Record<string, number>);

  const lineData = Object.entries(revenueTrendMap)
    .slice(0, 7)
    .reverse()
    .map(([date, total]) => ({ date, total }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header with Supabase Realtime Sync Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Realtime Supabase Intelligence
            </h2>
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Realtime synchronization with Supabase Cloud DB — <span className="font-mono text-xs">{lastLiveUpdate}</span>
          </p>
        </div>

        <button
          onClick={() => mutate()}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold hover:bg-accent transition-all shadow-sm w-fit"
        >
          <RefreshCw className="w-4 h-4 text-primary" />
          <span>Manual Sync</span>
        </button>
      </div>

      {/* 5 Realtime Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Money in Cash Drawer */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Drawer Cash
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground truncate">
            KSh {moneyInCashDrawer.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 shrink-0"></span>
            Sales Cash − Supplier Outflow
          </p>
        </div>

        {/* Card 2: Revenue In */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Revenue In
            </span>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-primary truncate">
            KSh {totalRevenueIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground truncate">
            Gross earnings across all channels
          </p>
        </div>

        {/* Card 3: Profits Made */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Profits Made
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
            KSh {profitsMade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
            Margin: {profitMarginPct.toFixed(1)}%
          </p>
        </div>

        {/* Card 4: Sales Made */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Sales Made
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {totalSalesCount} <span className="text-sm font-normal text-muted-foreground">tickets</span>
          </div>
          <p className="mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-semibold truncate">
            Avg Basket: KSh {averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Card 5: Realtime Stock Changes & Alerts */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Stock Status
            </span>
            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {activeProductsCount} <span className="text-xs font-normal text-muted-foreground">items</span>
          </div>
          <p className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 font-semibold truncate">
            {lowStockProducts.length} low stock ({outOfStockCount} out)
          </p>
        </div>
      </div>

      {/* Row 2: Realtime Revenue Trend & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Realtime Revenue Trend</h3>
              <p className="text-xs text-muted-foreground">Daily gross revenue breakdown</p>
            </div>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg">
              Live Feed
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)", fontSize: "12px" }}
                  formatter={(val: number) => [`KSh ${val.toLocaleString()}`, "Revenue"]}
                />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">Payment Distribution</h3>
            <p className="text-xs text-muted-foreground mb-6">Revenue split by payment type</p>
            <div className="h-52 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={6} dataKey="value" stroke="none">
                    {pieData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)", fontSize: "12px" }}
                    formatter={(val: number) => [`KSh ${val.toLocaleString()}`, "Amount"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            {pieData.map((entry, idx) => (
              <div key={entry.name} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></span>
                  <span>{entry.name}</span>
                </div>
                <span className="font-mono text-muted-foreground">
                  KSh {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Realtime Stock Changes & Low Stock Alert Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime Low Stock Alert Feed */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-foreground">Realtime Low Stock Alerts</h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-orange-500/10 text-orange-600 rounded-lg">
              {lowStockProducts.length} Needs Restock
            </span>
          </div>

          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {lowStockProducts.slice(0, 8).map((p) => {
              const isOut = (p.stock_quantity || 0) <= 0;
              return (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="font-bold text-sm text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.barcode || "No Barcode"} — Category: {p.category || "General"}</div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full ${isOut ? "bg-destructive/10 text-destructive" : "bg-orange-500/10 text-orange-600"}`}>
                      {p.stock_quantity || 0} in stock
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Min level: {p.min_stock_level || 5}</div>
                  </div>
                </div>
              );
            })}
            {lowStockProducts.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                All inventory levels are healthy!
              </div>
            )}
          </div>
        </div>

        {/* Live Recent Sales Stream Table */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">Live Sales Transaction Feed</h3>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {sales.length} Total Sales
            </span>
          </div>

          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {sales.slice(0, 8).map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <div className="font-bold text-sm text-foreground flex items-center space-x-2">
                    <span>KSh {parseFloat(s.total || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-accent text-accent-foreground rounded-md uppercase">
                      {s.payment_method || "CASH"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.created_at || Date.now()).toLocaleTimeString()} — Cashier: {s.user_name || "Terminal"}
                  </div>
                </div>
                <div className="text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                  <span>Completed</span>
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No sales recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

