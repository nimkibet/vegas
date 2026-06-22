"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { 
  ArrowDownToLine, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Package, 
  Search, 
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const fetcher = async () => {
  const { data, error } = await supabase
    .from("supplier_transactions")
    .select("*")
    .order("transaction_date", { ascending: false });

  if (error) throw error;
  return data;
};

type SupplierTransaction = {
  id: string;
  supplier_name: string;
  total_cost: string;
  cash_paid: string;
  debtor_offset: string;
  transaction_date: string;
  created_at: string;
  payment_source?: string; // Potential field
  notes?: string;
};

export default function StockInPage() {
  const { data: transactions, error, isLoading } = useSWR("stockInData", fetcher, { refreshInterval: 300000 });
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      const matchesSearch = tx.supplier_name.toLowerCase().includes(searchQuery.toLowerCase());
      if (filter === "all") return matchesSearch;
      
      const totalCost = parseFloat(tx.total_cost || "0");
      const cashPaid = parseFloat(tx.cash_paid || "0");
      
      if (filter === "paid") return matchesSearch && cashPaid >= totalCost;
      if (filter === "credit") return matchesSearch && cashPaid < totalCost;
      return matchesSearch;
    });
  }, [transactions, searchQuery, filter]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, SupplierTransaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.transaction_date || tx.created_at).toLocaleDateString("en-GB", {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    });
    return Object.entries(groups);
  }, [filteredTransactions]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div className="h-10 bg-muted rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-destructive text-center">
        <h2 className="text-xl font-bold">Error loading stock-in data</h2>
        <p className="mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <ArrowDownToLine className="w-6 h-6 mr-2 text-primary" />
            Stock In Management
          </h2>
          <p className="text-sm text-muted-foreground">Monitor daily stock updates and payment status.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none w-full sm:w-64"
            />
          </div>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="all">All Payments</option>
            <option value="paid">Fully Paid</option>
            <option value="credit">On Credit</option>
          </select>
        </div>
      </div>

      {groupedTransactions.length === 0 ? (
        <div className="p-20 text-center text-muted-foreground bg-card border border-border rounded-3xl">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
          <p className="text-lg font-medium">No stock-in records found</p>
        </div>
      ) : (
        groupedTransactions.map(([date, txs]) => (
          <div key={date} className="space-y-4">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-widest">{date}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {txs.map((tx) => {
                const total = parseFloat(tx.total_cost || "0");
                const paid = parseFloat(tx.cash_paid || "0");
                const offset = parseFloat(tx.debtor_offset || "0");
                const isFullyPaid = paid >= total;
                const isOnCredit = paid === 0;
                const isPartial = paid > 0 && paid < total;

                return (
                  <div key={tx.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                    {/* Status Badge */}
                    <div className="absolute top-0 right-0 p-3">
                      {isFullyPaid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : isOnCredit ? (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <Clock className="w-5 h-5 text-orange-500" />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate pr-6">
                          {tx.supplier_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Cost</span>
                          <span className="text-lg font-bold">KSh {total.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Status</span>
                          <span className={cn(
                            "text-xs font-bold px-2 py-1 rounded-lg inline-block self-end",
                            isFullyPaid ? "bg-emerald-500/10 text-emerald-600" : 
                            isOnCredit ? "bg-destructive/10 text-destructive" : 
                            "bg-orange-500/10 text-orange-600"
                          )}>
                            {isFullyPaid ? "Fully Paid" : isOnCredit ? "On Credit" : "Partial"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <DollarSign className="w-3 h-3 mr-1" />
                            <span>Cash Paid</span>
                          </div>
                          <span className="font-bold text-foreground">KSh {paid.toLocaleString()}</span>
                        </div>
                        
                        {offset > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center text-muted-foreground">
                              <CreditCard className="w-3 h-3 mr-1" />
                              <span>Debtor Offset</span>
                            </div>
                            <span className="font-bold text-primary">KSh {offset.toLocaleString()}</span>
                          </div>
                        )}

                        <div className="mt-4 p-3 bg-muted/30 rounded-xl">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Source / Method</p>
                          <p className="text-sm font-medium">
                            {paid > 0 ? (tx.payment_source || "Drawer Cash") : "N/A - Credit"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
