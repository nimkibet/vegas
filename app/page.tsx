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
  ShieldCheck,
  Calendar,
  Users,
  FileText,
  Activity,
  ArrowDownLeft,
  ArrowRight,
  Clock,
  ShieldAlert,
  CreditCard
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

const fetcher = async ([key, startDate, endDate]: [string, string, string]) => {
  const [salesRes, itemsRes, supplierRes, productsRes, adjustmentsRes, cashDrawingsRes, productDrawingsRes, customersRes, activityLogsRes, shiftsRes, paymentsRes] = await Promise.all([
    supabase.from("cloud_sales").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }),
    supabase.from("cloud_sale_items").select("*").gte("created_at", startDate).lte("created_at", endDate),
    supabase.from("supplier_transactions").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("stock_adjustments").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }).limit(100),
    supabase.from("cloud_cash_drawings").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }),
    supabase.from("cloud_product_drawings").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }),
    supabase.from("customers").select("*").order("name", { ascending: true }),
    supabase.from("activity_logs").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }).limit(200),
    supabase.from("shifts").select("*").gte("start_time", startDate).order("start_time", { ascending: false }).limit(50),
    supabase.from("customer_payments").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false }).limit(200)
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
    customers: customersRes.data || [],
    activityLogs: activityLogsRes.data || [],
    shifts: shiftsRes.data || [],
    customerPayments: paymentsRes.data || [],
  };
};

const CHART_COLORS = ["#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#f59e0b"];

export default function OverviewPage() {
  const [dateFilter, setDateFilter] = useState("today");
  
  // Calculate start/end dates
  const getDates = () => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    if (dateFilter === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === "yesterday") {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === "last7days") {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter.includes("|")) {
      const parts = dateFilter.split("|");
      start = new Date(parts[0]);
      start.setHours(0, 0, 0, 0);
      end = new Date(parts[1]);
      end.setHours(23, 59, 59, 999);
    }
    
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  const { startDate, endDate } = getDates();

  const { data, error, isLoading, mutate } = useSWR(["overviewData", startDate, endDate], fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 10000,
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

  const { sales, saleItems, supplierTransactions, products, stockAdjustments, cashDrawings, productDrawings, customers, activityLogs, shifts, customerPayments } = data!;

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
      {/* Header with Supabase Realtime Sync Status & Date Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
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

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
            <button
              onClick={() => setDateFilter("today")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateFilter === "today" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter("yesterday")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateFilter === "yesterday" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter("last7days")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateFilter === "last7days" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Last 7 Days
            </button>
          </div>
          
          <div className="flex items-center space-x-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input 
              type="date" 
              className="bg-transparent text-sm font-medium text-foreground outline-none border-none cursor-pointer"
              onChange={(e) => {
                if (e.target.value) {
                  // Set to a custom single date for now, could be expanded to range
                  setDateFilter(`${e.target.value}|${e.target.value}`);
                }
              }}
            />
          </div>

          <button
            onClick={() => mutate()}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
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

      {/* Row 4: Detailed Sales Ledger & Debtors / Customer Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-foreground">Detailed Sales Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Method</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.slice(0, 10).map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{s.id?.substring(0, 8) || "N/A"}</td>
                    <td className="px-4 py-3">{s.user_name || "Terminal"}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">KSh {parseFloat(s.total || "0").toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-accent-foreground">{s.payment_method || "CASH"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-400 font-bold">
                      {s.is_manual_override ? "MANUAL OVERRIDE" : ""}
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(s.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-6">No sales found for selected period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-foreground">Debtors & Customer Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Current Balance</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.slice(0, 10).map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-xs">{c.phone || c.contact_info || "N/A"}</td>
                    <td className={`px-4 py-3 text-right font-bold ${parseFloat(c.current_balance || "0") > 0 ? "text-red-500" : "text-emerald-500"}`}>
                      KSh {parseFloat(c.current_balance || "0").toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">KSh {parseFloat(c.credit_limit || "0").toLocaleString()}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6">No debtors found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 5: Supplier Transactions & Stock Adjustments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-foreground">Supplier Transactions Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-right">Cash Paid</th>
                  <th className="px-4 py-3 text-center">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {supplierTransactions.slice(0, 10).map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{tx.supplier_name || "Unknown"}</td>
                    <td className="px-4 py-3 text-right font-medium text-destructive">KSh {parseFloat(tx.total_cost || "0").toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">KSh {parseFloat(tx.cash_paid || "0").toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {supplierTransactions.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6">No supplier transactions for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-foreground">Stock Adjustments History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Product ID</th>
                  <th className="px-4 py-3 text-center">Added / Removed</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockAdjustments.slice(0, 10).map((adj) => (
                  <tr key={adj.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{adj.product_id?.substring(0, 8)}</td>
                    <td className="px-4 py-3 text-center font-bold">
                      <span className={parseFloat(adj.stock_added || "0") > 0 ? "text-emerald-500" : "text-destructive"}>
                        {parseFloat(adj.stock_added || "0") > 0 ? "+" : ""}{adj.stock_added}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{adj.reason || "Manual Adjustment"}</td>
                    <td className="px-4 py-3 text-xs">{new Date(adj.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {stockAdjustments.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6">No stock adjustments for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 6: Cashier Shifts & System Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-foreground">Cashier Shifts Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Cashier ID</th>
                  <th className="px-4 py-3">Start Time</th>
                  <th className="px-4 py-3">End Time</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shifts.slice(0, 10).map((shift: any) => {
                  const expected = parseFloat(shift.expected_cash || "0");
                  const actual = parseFloat(shift.actual_cash || "0");
                  const diff = actual - expected;
                  return (
                    <tr key={shift.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{shift.user_id}</td>
                      <td className="px-4 py-3 text-xs">{new Date(shift.start_time).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">{shift.end_time ? new Date(shift.end_time).toLocaleString() : <span className="text-emerald-500">Active</span>}</td>
                      <td className="px-4 py-3 text-right text-xs">KSh {expected.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold">
                        {shift.end_time ? (
                          <span className={diff < 0 ? "text-destructive" : diff > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                            KSh {actual.toLocaleString()}
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
                {shifts.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6">No shifts recorded for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-foreground">System Activity Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activityLogs.slice(0, 10).map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{log.user_name || log.user_id}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={
                        log.action_type === 'VOID_SALE' || log.action_type === 'VOID_ITEM' ? 'text-destructive bg-destructive/10 px-2 py-0.5 rounded-full' :
                        log.action_type === 'MANUAL_OVERRIDE' ? 'text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full' :
                        'text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full'
                      }>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs truncate max-w-[150px]" title={log.target_description}>{log.target_description}</td>
                    <td className="px-4 py-3 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {activityLogs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6">No activity logs for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 7: Customer Payments */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mt-6">
        <div className="p-5 border-b border-border bg-muted/20 flex items-center space-x-2">
          <CreditCard className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-foreground">Customer Payments (Debt Settlements)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-muted/10 text-xs uppercase font-semibold text-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3 text-right">Amount Paid</th>
                <th className="px-4 py-3 text-center">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customerPayments.slice(0, 10).map((payment: any) => (
                <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{payment.customer_id}</td>
                  <td className="px-4 py-3 text-xs">{payment.payment_method || 'Cash'}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">KSh {parseFloat(payment.amount_paid || "0").toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-xs">{new Date(payment.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {customerPayments.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6">No customer payments recorded for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

