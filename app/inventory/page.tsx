"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { Search, Filter, X, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
};

type SortOption = "name_asc" | "name_desc" | "stock_asc" | "stock_desc";
type StockFilter = "all" | "out_of_stock" | "low_stock" | "healthy";

export default function InventoryPage() {
  const { data: products, error, isLoading } = useSWR("inventoryData", fetcher);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("name_asc");
  const [showFilters, setShowFilters] = useState(false);

  // Derive categories from data
  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats) as String[];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!products) return [];

    return products
      .filter((p) => {
        // Search
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
            !(p.barcode && p.barcode.includes(searchQuery))) return false;
        
        // Category
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;

        // Stock Level
        const stock = p.stock_quantity || 0;
        const minStock = p.min_stock_level || 5; 
        
        if (stockFilter === "out_of_stock" && stock > 0) return false;
        if (stockFilter === "low_stock" && (stock === 0 || stock > minStock)) return false;
        if (stockFilter === "healthy" && stock <= minStock) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "name_asc") return a.name.localeCompare(b.name);
        if (sortOption === "name_desc") return b.name.localeCompare(a.name);
        
        const stockA = a.stock_quantity || 0;
        const stockB = b.stock_quantity || 0;
        if (sortOption === "stock_asc") return stockA - stockB;
        if (sortOption === "stock_desc") return stockB - stockA;
        
        return 0;
      });
  }, [products, searchQuery, categoryFilter, stockFilter, sortOption]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div className="h-10 bg-muted rounded w-full animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 h-64 bg-muted rounded animate-pulse hidden md:block"></div>
          <div className="md:col-span-3 h-96 bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-destructive text-center">
        <h2 className="text-xl font-bold">Error loading inventory</h2>
        <p className="mt-2">{error.message}</p>
      </div>
    );
  }

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between lg:hidden mb-4">
        <h3 className="font-bold text-lg">Filters</h3>
        <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-accent rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat as string} value={cat as string}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stock Level</label>
          <select 
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="all">All Levels</option>
            <option value="healthy">Healthy</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sort By</label>
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="stock_desc">Highest Stock</option>
            <option value="stock_asc">Lowest Stock</option>
          </select>
        </div>
      </div>

      <button 
        onClick={() => {
          setCategoryFilter("all");
          setStockFilter("all");
          setSortOption("name_asc");
          setSearchQuery("");
        }}
        className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto">
      
      {/* Filters Sidebar - Desktop */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-24">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center mb-6">
            <Filter className="w-4 h-4 mr-2" /> Refine Products
          </h3>
          <FilterContent />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Search product or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl text-base sm:text-sm placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowFilters(true)}
            className="lg:hidden flex items-center justify-center px-6 py-3 bg-card border border-border rounded-2xl font-medium text-sm hover:bg-accent transition-colors w-full sm:w-auto shadow-sm"
          >
            <Filter className="w-4 h-4 mr-2" /> Filters
          </button>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-muted-foreground uppercase bg-muted/30 tracking-wider">
                <tr>
                  <th className="px-6 py-5 font-bold">Product Information</th>
                  <th className="px-6 py-5 font-bold">Category</th>
                  <th className="px-6 py-5 font-bold text-right">Unit Price</th>
                  <th className="px-6 py-5 font-bold text-right">Available</th>
                  <th className="px-6 py-5 font-bold text-center">Inventory Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSortedProducts.map((product) => {
                  const stock = product.stock_quantity || 0;
                  const minStock = product.min_stock_level || 5;
                  
                  let statusColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                  let statusText = "Healthy";
                  
                  if (stock === 0) {
                    statusColor = "bg-destructive/10 text-destructive";
                    statusText = "Out of Stock";
                  } else if (stock <= minStock) {
                    statusColor = "bg-orange-500/10 text-orange-600 dark:text-orange-400";
                    statusText = "Low Stock";
                  }

                  return (
                    <tr key={product.id} className="transition-all hover:bg-muted/30 group">
                      <td className="px-6 py-5">
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">{product.barcode || "---"}</div>
                      </td>
                      <td className="px-6 py-5 text-muted-foreground">{product.category || "Uncategorized"}</td>
                      <td className="px-6 py-5 text-right font-bold text-foreground">
                        KSh {parseFloat(product.retail_price || "0").toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-right font-bold">
                        {stock}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={cn("px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide", statusColor)}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-border">
            {filteredAndSortedProducts.map((product) => {
              const stock = product.stock_quantity || 0;
              const minStock = product.min_stock_level || 5;
              let statusText = "Healthy";
              let statusDot = "bg-emerald-500";
              
              if (stock === 0) {
                statusText = "Out of Stock";
                statusDot = "bg-destructive";
              } else if (stock <= minStock) {
                statusText = "Low Stock";
                statusDot = "bg-orange-500";
              }

              return (
                <div key={product.id} className="p-5 space-y-4 hover:bg-muted/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <h4 className="font-bold text-lg text-foreground leading-tight">{product.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{product.barcode || "No Barcode"}</p>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1 bg-muted/50 rounded-lg shrink-0">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", statusDot)}></div>
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">{statusText}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Stock Level</span>
                      <span className="text-lg font-bold">{stock} <span className="text-xs font-normal text-muted-foreground ml-1">units</span></span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Retail Price</span>
                      <span className="text-lg font-bold text-primary">KSh {parseFloat(product.retail_price || "0").toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground bg-accent/30 px-3 py-2 rounded-lg inline-block">
                    Category: <span className="text-foreground font-medium">{product.category || "Uncategorized"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAndSortedProducts.length === 0 && (
            <div className="p-20 text-center text-muted-foreground bg-muted/5">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-medium">No matches found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md" onClick={() => setShowFilters(false)} />
          <div className="fixed inset-x-0 bottom-0 max-h-[90vh] bg-card border-t border-border rounded-t-[32px] shadow-2xl overflow-y-auto p-8 animate-in slide-in-from-bottom duration-300">
            <FilterContent />
          </div>
        </div>
      )}
      
    </div>
  );
}
