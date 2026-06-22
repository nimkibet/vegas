"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { 
  RefreshCw, 
  LayoutDashboard, 
  Package, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Layers, 
  ChevronRight, 
  Search,
  ArrowRight
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// Fetch all necessary data for overview, profit margins, and breakdowns
const fetcher = async () => {
  const [salesRes, supplierRes, itemsRes, productsRes] = await Promise.all([
    supabase.from("cloud_sales").select("*").order("created_at", { ascending: false }),
    supabase.from("supplier_transactions").select("*").order("transaction_date", { ascending: false }),
    supabase.from("cloud_sale_items").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*")
  ]);

  if (salesRes.error) throw salesRes.error;
  if (supplierRes.error) throw supplierRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (productsRes.error) throw productsRes.error;

  return { 
    sales: salesRes.data || [], 
    supplierTransactions: supplierRes.data || [],
    saleItems: itemsRes.data || [],
    products: productsRes.data || []
  };
};

const COLORS = ["#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function OverviewPage() {
  const { data, error, isLoading, mutate } = useSWR("overviewData", fetcher, { refreshInterval: 300000 });
  
  // Tabs: 'overview' | 'profit' | 'breakdown'
  const [activeTab, setActiveTab] = useState<"overview" | "profit" | "breakdown">("overview");

  // Date Range State
  const [dateRangeOption, setDateRangeOption] = useState<"today" | "yesterday" | "last7" | "last30" | "custom">("today");
  
  // Canadians format 'YYYY-MM-DD' is the cleanest way to get local date string
  const todayStr = new Date().toLocaleDateString("en-CA");
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Profit Margins breakdown search filter
  const [profitSearchQuery, setProfitSearchQuery] = useState("");

  // Daily/Weekly toggle in breakdown tab
  const [breakdownInterval, setBreakdownInterval] = useState<"daily" | "weekly">("daily");

  // ----------------------------------------------------
  // DATA DESTRUCTURING & FALLBACKS
  // ----------------------------------------------------
  const sales = data?.sales || [];
  const supplierTransactions = data?.supplierTransactions || [];
  const saleItems = data?.saleItems || [];
  const products = data?.products || [];

  // Create products map for quick lookup
  const productsMap = useMemo(() => new Map(products.map(p => [p.barcode, p])), [products]);

  // Date Range Filtering Logic
  const filteredData = useMemo(() => {
    let start: Date;
    let end: Date = new Date();
    end.setHours(23, 59, 59, 999); // Include up to end of today

    const today = new Date();
    
    if (dateRangeOption === "today") {
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
    } else if (dateRangeOption === "yesterday") {
      start = new Date(today);
      start.setDate(today.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      
      end = new Date(today);
      end.setDate(today.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateRangeOption === "last7") {
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (dateRangeOption === "last30") {
      start = new Date(today);
      start.setDate(today.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else { // Custom
      start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
    }

    const filteredSales = sales.filter(s => {
      const date = new Date(s.created_at);
      return date >= start && date <= end;
    });

    const filteredSuppliers = supplierTransactions.filter(tx => {
      const date = new Date(tx.transaction_date || tx.created_at);
      return date >= start && date <= end;
    });

    return { filteredSales, filteredSuppliers };
  }, [sales, supplierTransactions, dateRangeOption, customStartDate, customEndDate]);

  const { filteredSales, filteredSuppliers } = filteredData;

  // ----------------------------------------------------
  // OVERVIEW TAB CALCULATIONS
  // ----------------------------------------------------
  const totalCashSales = useMemo(() => filteredSales.reduce(
    (acc, sale) => acc + (parseFloat(sale.cash_amount || "0")),
    0
  ), [filteredSales]);

  const totalCashPaidToSuppliers = useMemo(() => filteredSuppliers.reduce(
    (acc, tx) => acc + (parseFloat(tx.cash_paid || "0")),
    0
  ), [filteredSuppliers]);

  const drawerCash = useMemo(() => totalCashSales - totalCashPaidToSuppliers, [totalCashSales, totalCashPaidToSuppliers]);
  const totalRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + parseFloat(s.total), 0), [filteredSales]);

  // Revenue trend (aggregated based on date range)
  const lineData = useMemo(() => {
    const revenueTrend = filteredSales.reduce((acc, sale) => {
      const date = new Date(sale.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      acc[date] = (acc[date] || 0) + parseFloat(sale.total);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(revenueTrend)
      .reverse()
      .map(([date, total]) => ({ date, total }));
  }, [filteredSales]);

  // Payment Methods Doughnut
  const pieData = useMemo(() => {
    const paymentMethods = filteredSales.reduce((acc, sale) => {
      const method = sale.payment_method || "UNKNOWN";
      acc[method] = (acc[method] || 0) + parseFloat(sale.total);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(paymentMethods).map(([name, value]) => ({
      name: name.replace("_", " "),
      value,
    }));
  }, [filteredSales]);

  // ----------------------------------------------------
  // PROFIT MARGIN TAB CALCULATIONS
  // ----------------------------------------------------
  const calculateMargins = useCallback((salesList: typeof sales) => {
    let totalRev = 0;
    let totalCost = 0;
    const itemBreakdownMap = new Map<string, { name: string, category: string, qty: number, revenue: number, cost: number }>();

    salesList.forEach(sale => {
      const items = saleItems.filter(si => si.sale_id === sale.id);
      
      items.forEach(item => {
        const prod = productsMap.get(item.product_barcode);
        let wholesalePrice = 0;

        if (prod) {
          wholesalePrice = parseFloat(prod.wholesale_price || "0");
        } else {
          if (item.product_barcode && (item.product_barcode.endsWith("-05") || item.product_barcode.endsWith("-025"))) {
            const baseBarcode = item.product_barcode.split("-")[0];
            const baseProd = productsMap.get(baseBarcode);
            if (baseProd) {
              const ratio = item.product_barcode.endsWith("-05") ? 0.5 : 0.25;
              wholesalePrice = parseFloat(baseProd.wholesale_price || "0") * ratio;
            }
          }
          
          if (wholesalePrice === 0) {
            wholesalePrice = item.unit_price * 0.9;
          }
        }

        const cost = item.quantity * wholesalePrice;
        const rev = item.total_price;

        totalRev += rev;
        totalCost += cost;

        const existing = itemBreakdownMap.get(item.product_name);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += rev;
          existing.cost += cost;
        } else {
          itemBreakdownMap.set(item.product_name, {
            name: item.product_name,
            category: prod?.category || "General",
            qty: item.quantity,
            revenue: rev,
            cost: cost
          });
        }
      });
    });

    const expectedProfit = totalRev - totalCost;
    const overallMargin = totalRev > 0 ? (expectedProfit / totalRev) * 100 : 0;

    const productsProfitList = Array.from(itemBreakdownMap.values()).map(p => {
      const profit = p.revenue - p.cost;
      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
      return {
        ...p,
        profit,
        margin
      };
    }).sort((a, b) => b.profit - a.profit);

    return { totalRev, totalCost, expectedProfit, overallMargin, productsProfitList };
  }, [saleItems, productsMap]);

  const allTimeMargins = useMemo(() => calculateMargins(sales), [sales, calculateMargins]);
  const filteredMargins = useMemo(() => calculateMargins(filteredSales), [filteredSales, calculateMargins]);

  const filteredProductProfitList = useMemo(() => {
    return filteredMargins.productsProfitList.filter(p => 
      p.name.toLowerCase().includes(profitSearchQuery.toLowerCase()) || 
      p.category.toLowerCase().includes(profitSearchQuery.toLowerCase())
    );
  }, [filteredMargins, profitSearchQuery]);

  // ----------------------------------------------------
  // BREAKDOWN ANALYSIS TAB CALCULATIONS
  // ----------------------------------------------------
  const breakdownData = useMemo(() => {
    if (breakdownInterval === "daily") {
      const dailyMap = {} as Record<string, { date: string, revenue: number, cost: number, profit: number, salesCount: number }>;
      
      filteredSales.forEach(sale => {
        const dateStr = new Date(sale.created_at).toLocaleDateString("en-CA");
        
        const items = saleItems.filter(si => si.sale_id === sale.id);
        let saleCost = 0;
        items.forEach(item => {
          const prod = productsMap.get(item.product_barcode);
          let wsPrice = 0;
          if (prod) wsPrice = parseFloat(prod.wholesale_price || "0");
          else if (item.product_barcode && (item.product_barcode.endsWith("-05") || item.product_barcode.endsWith("-025"))) {
            const baseBarcode = item.product_barcode.split("-")[0];
            const baseProd = productsMap.get(baseBarcode);
            if (baseProd) {
              const ratio = item.product_barcode.endsWith("-05") ? 0.5 : 0.25;
              wsPrice = parseFloat(baseProd.wholesale_price || "0") * ratio;
            }
          }
          if (wsPrice === 0) wsPrice = item.unit_price * 0.9;
          saleCost += item.quantity * wsPrice;
        });

        const rev = parseFloat(sale.total);
        const profit = rev - saleCost;

        if (dailyMap[dateStr]) {
          dailyMap[dateStr].revenue += rev;
          dailyMap[dateStr].cost += saleCost;
          dailyMap[dateStr].profit += profit;
          dailyMap[dateStr].salesCount += 1;
        } else {
          dailyMap[dateStr] = {
            date: new Date(sale.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            revenue: rev,
            cost: saleCost,
            profit,
            salesCount: 1
          };
        }
      });

      return Object.values(dailyMap).reverse();
    } else {
      const weeklyMap = {} as Record<string, { weekLabel: string, revenue: number, cost: number, profit: number, salesCount: number }>;
      
      filteredSales.forEach(sale => {
        const d = new Date(sale.created_at);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const weekStart = new Date(d.setDate(diff));
        const weekLabel = "W/C " + weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const items = saleItems.filter(si => si.sale_id === sale.id);
        let saleCost = 0;
        items.forEach(item => {
          const prod = productsMap.get(item.product_barcode);
          let wsPrice = 0;
          if (prod) wsPrice = parseFloat(prod.wholesale_price || "0");
          else if (item.product_barcode && (item.product_barcode.endsWith("-05") || item.product_barcode.endsWith("-025"))) {
            const baseBarcode = item.product_barcode.split("-")[0];
            const baseProd = productsMap.get(baseBarcode);
            if (baseProd) {
              const ratio = item.product_barcode.endsWith("-05") ? 0.5 : 0.25;
              wsPrice = parseFloat(baseProd.wholesale_price || "0") * ratio;
            }
          }
          if (wsPrice === 0) wsPrice = item.unit_price * 0.9;
          saleCost += item.quantity * wsPrice;
        });

        const rev = parseFloat(sale.total);
        const profit = rev - saleCost;

        if (weeklyMap[weekLabel]) {
          weeklyMap[weekLabel].revenue += rev;
          weeklyMap[weekLabel].cost += saleCost;
          weeklyMap[weekLabel].profit += profit;
          weeklyMap[weekLabel].salesCount += 1;
        } else {
          weeklyMap[weekLabel] = {
            weekLabel,
            revenue: rev,
            cost: saleCost,
            profit,
            salesCount: 1
          };
        }
      });

      return Object.values(weeklyMap).reverse();
    }
  }, [filteredSales, saleItems, productsMap, breakdownInterval]);

  // ----------------------------------------------------
  // EARLY RETURNS FOR LOADING & ERROR STATES
  // ----------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-10 bg-muted rounded w-1/4"></div>
        <div className="flex space-x-3">
          <div className="h-10 bg-muted rounded w-28"></div>
          <div className="h-10 bg-muted rounded w-28"></div>
          <div className="h-10 bg-muted rounded w-28"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-36 bg-muted rounded-2xl"></div>
          <div className="h-36 bg-muted rounded-2xl"></div>
          <div className="h-36 bg-muted rounded-2xl"></div>
        </div>
        <div className="h-80 bg-muted rounded-3xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-destructive text-center max-w-xl mx-auto mt-20 border border-destructive/20 rounded-3xl bg-destructive/5">
        <h2 className="text-xl font-bold">Error loading dashboard</h2>
        <p className="mt-2 text-sm">{error.message}</p>
        <button onClick={() => mutate()} className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-semibold shadow hover:scale-[1.02] transition-transform">
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto select-none">
      
      {/* Title & Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Vegas Dashboard</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Synced with Native POS App
          </p>
        </div>
        
        {/* Date Filter Widget */}
        <div className="flex flex-wrap items-center gap-2 bg-card border border-border p-1.5 rounded-2xl shadow-sm self-start md:self-auto">
          {(["today", "yesterday", "last7", "last30", "custom"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setDateRangeOption(opt)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all ${
                dateRangeOption === opt
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {opt === "last7" ? "7 Days" : opt === "last30" ? "30 Days" : opt}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Fields (Conditional) */}
      {dateRangeOption === "custom" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-center gap-4 bg-muted/20 border border-border p-5 rounded-2xl animate-in slide-in-from-top duration-300">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Start Date
            </label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              max={todayStr}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> End Date
            </label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              min={customStartDate}
              max={todayStr}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="flex h-full items-end pt-5 sm:pt-0">
            <button
              onClick={() => mutate()}
              className="w-full bg-accent text-accent-foreground border border-border font-bold text-sm px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh Scope
            </button>
          </div>
        </div>
      )}

      {/* Tabs Selector Navigation */}
      <div className="flex border-b border-border/80 gap-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-4 text-base font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Performance Overview
        </button>
        
        <button
          onClick={() => setActiveTab("profit")}
          className={`pb-4 text-base font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "profit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Percent className="w-4 h-4" /> Expected Profit Margin
        </button>

        <button
          onClick={() => setActiveTab("breakdown")}
          className={`pb-4 text-base font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "breakdown"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" /> Interval Breakdown
        </button>
      </div>

      {/* -------------------------------------------------------------------------------- */}
      {/* 1. PERFORMANCE OVERVIEW TAB */}
      {/* -------------------------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Main Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Drawer Cash Watcher */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Drawer Cash</h3>
                <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <RefreshCw className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                KSh {drawerCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Cash Sales - Cash Supplier Payments
              </p>
            </div>

            {/* Total Revenue */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Total Revenue</h3>
                <span className="p-2 bg-primary/10 text-primary rounded-xl">
                  <TrendingUp className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-primary tracking-tight">
                KSh {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Invoiced amount for selected range
              </p>
            </div>

            {/* Transactions Count */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Sales Count</h3>
                <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Package className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                {filteredSales.length}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Completed invoices
              </p>
            </div>

          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Revenue Trend Chart */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-6">Revenue Trend</h3>
              <div className="h-72 sm:h-80">
                {lineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)', fontSize: '12px' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for selected period</div>
                )}
              </div>
            </div>

            {/* Payment Methods Chart */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-6">Payment Splits</h3>
              <div className="h-72 flex justify-center items-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={6}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)', fontSize: '12px' }}
                        formatter={(value: number) => [`KSh ${value.toLocaleString()}`, 'Total Revenue']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">No data for selected period</div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-muted-foreground">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center">
                    <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Supplier Restock insight Table */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-muted/20">
              <h3 className="text-lg font-bold text-foreground">Restock Feed</h3>
              <p className="text-xs text-muted-foreground mt-1">Supplier transactions and payment logs</p>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                  <tr>
                    <th className="px-6 py-4 font-bold tracking-wider">Date</th>
                    <th className="px-6 py-4 font-bold tracking-wider">Supplier</th>
                    <th className="px-6 py-4 font-bold tracking-wider text-right">Total Cost</th>
                    <th className="px-6 py-4 font-bold tracking-wider text-right text-destructive">Cash Paid</th>
                    <th className="px-6 py-4 font-bold tracking-wider text-right text-primary">Debtor Offset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSuppliers.slice(0, 15).map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors duration-150">
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {new Date(tx.transaction_date || tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">{tx.supplier_name}</td>
                      <td className="px-6 py-4 text-right font-bold">KSh {parseFloat(tx.total_cost || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-destructive font-bold">KSh {parseFloat(tx.cash_paid || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-primary font-bold">KSh {parseFloat(tx.debtor_offset || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredSuppliers.length === 0 && (
              <div className="p-16 text-center text-muted-foreground bg-muted/5">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                No supplier events recorded in this range
              </div>
            )}
          </div>

        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* 2. EXPECTED PROFIT MARGIN TAB */}
      {/* -------------------------------------------------------------------------------- */}
      {activeTab === "profit" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Profit Margin % */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Expected Profit Margin</h3>
                <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <Percent className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-emerald-500 tracking-tight">
                {filteredMargins.overallMargin.toFixed(2)}%
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                All-time average is <strong className="text-foreground">{allTimeMargins.overallMargin.toFixed(2)}%</strong>
              </p>
            </div>

            {/* Expected Profit */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Expected Profit</h3>
                <span className="p-2 bg-primary/10 text-primary rounded-xl">
                  <DollarSign className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-primary tracking-tight">
                KSh {filteredMargins.expectedProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Revenue minus expected cost of goods
              </p>
            </div>

            {/* Cost of Goods Sold */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Expected COGS</h3>
                <span className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                  <Package className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                KSh {filteredMargins.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Total wholesale cost of items sold
              </p>
            </div>

            {/* Total Revenue under profit scope */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Period Revenue</h3>
                <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <TrendingUp className="w-4.5 h-4.5" />
                </span>
              </div>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                KSh {filteredMargins.totalRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Sum of item totals sold
              </p>
            </div>

          </div>

          {/* Margins Breakdown Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Top Products Profit Contribution Bar Chart */}
            <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-6">Top Profit Contributors</h3>
              <div className="h-80">
                {filteredMargins.productsProfitList.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredMargins.productsProfitList.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)', fontSize: '12px' }}
                        formatter={(value: number) => [`KSh ${value.toLocaleString()}`, 'Profit Contribution']}
                      />
                      <Bar dataKey="profit" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No profit data</div>
                )}
              </div>
            </div>

            {/* Profit Margin Info Card */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4">Profit Strategy Insight</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The profit margins listed are **expected values** calculated using the native app sales and the wholesale prices stored in your database.
                  <br /><br />
                  If margins look lower than expected, review:
                </p>
                <ul className="mt-4 space-y-2 text-xs text-muted-foreground list-disc list-inside">
                  <li>Wholesale price updates in inventory management.</li>
                  <li>Discounts applied during native app sales.</li>
                  <li>Portion sales deduction accuracy (e.g. halves and quarters).</li>
                </ul>
              </div>

              <div className="bg-accent/40 border border-border p-4 rounded-2xl mt-6">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  <span>Target Margin</span>
                  <span className="text-emerald-500">15.00%</span>
                </div>
                <div className="w-full bg-border h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((filteredMargins.overallMargin / 15.0) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Detailed Product Margin Breakdown Table */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Product Profit Margins</h3>
                <p className="text-xs text-muted-foreground mt-1">Wholesale vs Retail Margin Breakdown</p>
              </div>
              
              {/* Product Margin Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter products..."
                  value={profitSearchQuery}
                  onChange={(e) => setProfitSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                  <tr>
                    <th className="px-6 py-4 font-bold">Product Name</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold text-right">Units Sold</th>
                    <th className="px-6 py-4 font-bold text-right">Revenue</th>
                    <th className="px-6 py-4 font-bold text-right">Wholesale Cost</th>
                    <th className="px-6 py-4 font-bold text-right text-emerald-500">Est. Profit</th>
                    <th className="px-6 py-4 font-bold text-center">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProductProfitList.map((prod) => (
                    <tr key={prod.name} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{prod.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{prod.category}</td>
                      <td className="px-6 py-4 text-right font-semibold">{prod.qty}</td>
                      <td className="px-6 py-4 text-right font-semibold">KSh {prod.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">KSh {prod.cost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-6 py-4 text-right text-emerald-500 font-extrabold">KSh {prod.profit.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          prod.margin > 10 ? "bg-emerald-500/10 text-emerald-600" : prod.margin > 5 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"
                        }`}>
                          {prod.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProductProfitList.length === 0 && (
              <div className="p-16 text-center text-muted-foreground bg-muted/5">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                No matching product sales found
              </div>
            )}
          </div>

        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* 3. INTERVAL BREAKDOWN TAB */}
      {/* -------------------------------------------------------------------------------- */}
      {activeTab === "breakdown" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Sales & Margin Trends</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Track financial performance in intervals</p>
            </div>
            
            <div className="flex bg-muted/65 border border-border p-1 rounded-xl">
              <button
                onClick={() => setBreakdownInterval("daily")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  breakdownInterval === "daily" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setBreakdownInterval("weekly")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  breakdownInterval === "weekly" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          {/* Interval Trend Chart */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-6">
              {breakdownInterval === "daily" ? "Daily" : "Weekly"} Sales & Profits Trend
            </h3>
            <div className="h-80 sm:h-96">
              {breakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey={breakdownInterval === "daily" ? "date" : "weekLabel"} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)', fontSize: '12px' }}
                      formatter={(value: number) => [`KSh ${value.toLocaleString()}`, '']}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Bar dataKey="revenue" name="Total Revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" name="Expected Profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No interval data</div>
              )}
            </div>
          </div>

          {/* Grid Breakdown Table */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-muted/20">
              <h3 className="text-lg font-bold text-foreground">Historical Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-1">Detailed table of revenue and profits by interval</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                  <tr>
                    <th className="px-6 py-4 font-bold">{breakdownInterval === "daily" ? "Date" : "Week Commencing"}</th>
                    <th className="px-6 py-4 font-bold text-right">Transactions</th>
                    <th className="px-6 py-4 font-bold text-right">Total Revenue</th>
                    <th className="px-6 py-4 font-bold text-right text-muted-foreground">Cost of Goods</th>
                    <th className="px-6 py-4 font-bold text-right text-emerald-500">Expected Profit</th>
                    <th className="px-6 py-4 font-bold text-center">Profit Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {breakdownData.map((row: any) => {
                    const rev = row.revenue;
                    const profit = row.profit;
                    const margin = rev > 0 ? (profit / rev) * 100 : 0;
                    return (
                      <tr key={row.date || row.weekLabel} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">{row.date || row.weekLabel}</td>
                        <td className="px-6 py-4 text-right font-semibold">{row.salesCount}</td>
                        <td className="px-6 py-4 text-right font-bold">KSh {rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-right text-muted-foreground font-medium">KSh {row.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-right text-emerald-500 font-extrabold">KSh {profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            margin > 10 ? "bg-emerald-500/10 text-emerald-600" : margin > 5 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"
                          }`}>
                            {margin.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {breakdownData.length === 0 && (
              <div className="p-16 text-center text-muted-foreground bg-muted/5">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                No data available in this range
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
