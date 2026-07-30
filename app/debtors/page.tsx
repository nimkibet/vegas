"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { supabase } from "@/lib/supabase";
import { Pencil, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = async () => {
  const { data, error } = await supabase
    .from("debtors")
    .select("*")
    .order("current_balance", { ascending: false });

  if (error) throw error;
  return data;
};

export default function DebtorsPage() {
  const { data: debtors, error, isLoading } = useSWR("debtorsData", fetcher);
  const [editingDebtor, setEditingDebtor] = useState<any>(null);
  const [newLimit, setNewLimit] = useState("");

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4"></div>
        <div className="h-96 bg-muted rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-destructive">
        <h2 className="text-lg font-semibold">Error loading debtors</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  const getRowClass = (balance: number, limit: number) => {
    if (!limit || limit === 0) return ""; // No limit set
    const ratio = balance / limit;
    if (ratio > 0.9) return "bg-red-500/10 dark:bg-red-900/20"; // At risk
    if (ratio > 0.5) return "bg-yellow-500/10 dark:bg-yellow-900/20"; // Warning
    return "";
  };

  const handleEditClick = (debtor: any) => {
    setEditingDebtor(debtor);
    setNewLimit(debtor.credit_limit?.toString() || "0");
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtor) return;

    const limitValue = parseFloat(newLimit);
    if (isNaN(limitValue)) return;

    // Optimistic Update
    mutate(
      "debtorsData",
      (currentData: any) => {
        return currentData.map((d: any) =>
          d.id === editingDebtor.id ? { ...d, credit_limit: limitValue } : d
        );
      },
      false // don't revalidate immediately
    );

    setEditingDebtor(null);

    // Actual Supabase update
    const { error } = await supabase
      .from("debtors")
      .update({ credit_limit: limitValue })
      .eq("id", editingDebtor.id);

    if (error) {
      console.error("Failed to update credit limit:", error);
      // Revert if error
      mutate("debtorsData"); 
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 relative max-w-7xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Debtors Management</h2>
        <p className="text-sm text-muted-foreground">Monitor and manage customer credit accounts.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] text-muted-foreground uppercase bg-muted/30 tracking-wider">
              <tr>
                <th className="px-6 py-5 font-bold">Customer Name</th>
                <th className="px-6 py-5 font-bold">Contact Info</th>
                <th className="px-6 py-5 font-bold text-right">Current Balance</th>
                <th className="px-6 py-5 font-bold text-right">Credit Limit</th>
                <th className="px-6 py-5 font-bold text-right">Status Ratio</th>
                <th className="px-6 py-5 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {debtors?.map((debtor) => {
                const balance = parseFloat(debtor.current_balance || "0");
                const limit = parseFloat(debtor.credit_limit || "0");
                const ratio = limit > 0 ? (balance / limit) * 100 : 0;
                
                return (
                  <tr 
                    key={debtor.id} 
                    className={cn(
                      "transition-all hover:bg-muted/40 group",
                      getRowClass(balance, limit)
                    )}
                  >
                    <td className="px-6 py-5 font-bold text-foreground group-hover:text-primary transition-colors">{debtor.name}</td>
                    <td className="px-6 py-5 text-muted-foreground">{debtor.contact_info || "N/A"}</td>
                    <td className="px-6 py-5 text-right font-bold text-foreground font-mono">KSh {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-5 text-right font-medium text-muted-foreground">KSh {limit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-5 text-right">
                      {limit > 0 ? (
                        <span className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          ratio > 90 ? "bg-destructive/10 text-destructive" : ratio > 50 ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {ratio.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest opacity-50">No Limit</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={() => handleEditClick(debtor)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-200"
                        title="Edit Credit Limit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-border">
          {debtors?.map((debtor) => {
            const balance = parseFloat(debtor.current_balance || "0");
            const limit = parseFloat(debtor.credit_limit || "0");
            const ratio = limit > 0 ? (balance / limit) * 100 : 0;

            return (
              <div 
                key={debtor.id} 
                className={cn(
                  "p-5 space-y-4 hover:bg-muted/10 transition-colors",
                  getRowClass(balance, limit)
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg text-foreground leading-tight">{debtor.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{debtor.contact_info || "No Contact Info"}</p>
                  </div>
                  <button
                    onClick={() => handleEditClick(debtor)}
                    className="p-2.5 bg-accent/50 text-foreground rounded-xl shadow-sm"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Current Balance</span>
                    <span className="text-lg font-bold text-foreground">KSh {balance.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Credit Limit</span>
                    <span className="text-lg font-bold text-muted-foreground">KSh {limit.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex-1 bg-muted/50 h-2 rounded-full overflow-hidden mr-4">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        ratio > 90 ? "bg-destructive" : ratio > 50 ? "bg-orange-500" : "bg-emerald-500"
                      )} 
                      style={{ width: `${Math.min(ratio, 100)}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                    ratio > 90 ? "text-destructive" : ratio > 50 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {limit > 0 ? `${ratio.toFixed(1)}% Usage` : "No Limit"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {debtors?.length === 0 && (
          <div className="p-20 text-center text-muted-foreground bg-muted/5">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="text-lg font-medium">No debtors listed</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingDebtor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md" onClick={() => setEditingDebtor(null)} />
          <div className="bg-card w-full max-w-md rounded-[32px] shadow-2xl border border-border overflow-hidden relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border bg-muted/20">
              <h3 className="font-bold text-xl">Edit Credit Limit</h3>
              <button onClick={() => setEditingDebtor(null)} className="p-2 hover:bg-accent rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateLimit} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Customer
                </label>
                <div className="text-lg font-bold text-foreground">{editingDebtor.name}</div>
              </div>
              <div>
                <label htmlFor="limit" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  New Credit Limit (KSh)
                </label>
                <input
                  id="limit"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-4 text-lg font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingDebtor(null)}
                  className="flex-1 py-4 text-sm font-bold border border-border rounded-2xl hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 text-sm font-bold bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
