"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { Search, Filter, X, Package, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
};

type SortOption = "name_asc" | "name_desc" | "stock_asc" | "stock_desc";
type StockFilter = "all" | "out_of_stock" | "low_stock" | "healthy";

export default function InventoryPage() {
  const { data: products, error, isLoading } = useSWR("inventoryData", fetcher, { refreshInterval: 300000 });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("name_asc");
  const [showFilters, setShowFilters] = useState(false);

  // Group and format product families
  const groupedProducts = useMemo(() => {
    if (!products) return [];

    // 1. Filter out portion items (Half and Quarter)
    // Halves and Quarters have deduction_ratio < 1.0 OR names ending with " (Half)" or " (Quarter)"
    const baseItemsOnly = products.filter(p => {
      const isPortion = (p.parent_barcode && p.deduction_ratio < 1.0) || 
                        p.name.endsWith(" (Half)") || 
                        p.name.endsWith(" (Quarter)");
      return !isPortion;
    });

    // 2. Group by base family name
    const groups = {} as Record<string, typeof products>;
    baseItemsOnly.forEach(p => {
      let baseName = p.name;
      const suffixes = [" (Single)", " (Packet)", " (Master Box)", " (Master Carton)"];
      for (const suffix of suffixes) {
        if (baseName.endsWith(suffix)) {
          baseName = baseName.substring(0, baseName.length - suffix.length);
          break;
        }
      }
      if (!groups[baseName]) {
        groups[baseName] = [];
      }
      groups[baseName].push(p);
    });

    // 3. For each family group, compute multipliers, total stock and details
    return Object.entries(groups).map(([baseName, items]) => {
      // Sort items by tier: Single (Tier 1) -> Packet (Tier 2) -> Box (Tier 3) -> Carton (Tier 4)
      const getTier = (p: typeof products[0]) => {
        if (p.name.endsWith(" (Master Carton)")) return 4;
        if (p.name.endsWith(" (Master Box)")) return 3;
        if (p.name.endsWith(" (Packet)")) return 2;
        return 1; // Default/Single
      };

      const sortedItems = [...items].sort((a, b) => getTier(a) - getTier(b));

      // Calculate multipliers iteratively from lowest tier (Single) to highest (Carton)
      const multipliers = {} as Record<string, number>;
      if (sortedItems.length > 0) {
        multipliers[sortedItems[0].id] = 1;
      }

      for (let i = 1; i < sortedItems.length; i++) {
        const current = sortedItems[i];
        const previous = sortedItems[i - 1];
        
        // Multiplier of current is previous_multiplier * yield
        const yieldVal = previous.conversion_yield || current.raw_piece_yield || 1;
        multipliers[current.id] = multipliers[previous.id] * yieldVal;
      }

      // Calculate consolidated total stock and list detail parts
      let totalStock = 0;
      const detailsArray: string[] = [];

      // Loop in reverse (Carton first) for better listing layout
      [...sortedItems].reverse().forEach(p => {
        const qty = p.stock_quantity || 0;
        const mult = multipliers[p.id] || 1;
        totalStock += qty * mult;

        const unit = p.unit_type || "Unit";
        let tierLabel = "";

        if (p.name.endsWith(" (Master Carton)")) {
          tierLabel = `${qty} x Carton (${mult} ${unit}s)`;
        } else if (p.name.endsWith(" (Master Box)")) {
          tierLabel = `${qty} x Box (${mult} ${unit}s)`;
        } else if (p.name.endsWith(" (Packet)")) {
          const typeLabel = unit.toLowerCase() === "kg" ? "Bag" : "Packet";
          tierLabel = `${qty} x ${mult} ${unit} ${typeLabel}`;
        } else {
          const typeLabel = unit.toLowerCase() === "kg" ? "Pack" : "Single";
          tierLabel = `${qty} x 1 ${unit} ${typeLabel}`;
        }
        detailsArray.push(tierLabel);
      });

      // Retrieve primary category and status based on base item
      const baseItem = sortedItems[0];
      const minStock = baseItem.min_stock_level || 5;

      return {
        id: baseItem.id,
        baseName,
        category: baseItem.category || "General",
        totalStock,
        minStock,
        unit: baseItem.unit_type || "Kg",
        details: detailsArray.join(", "),
        barcodes: sortedItems.map(p => p.barcode).filter(Boolean).join(", "),
        items: sortedItems,
        multipliers
      };
    });
  }, [products]);

  // Derive categories from grouped data
  const categories = useMemo(() => {
    const cats = new Set(groupedProducts.map(p => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [groupedProducts]);

  // Filter and Sort Grouped Families
  const filteredAndSortedGroups = useMemo(() => {
    return groupedProducts
      .filter((p) => {
        // Search by baseName or barcodes
        if (searchQuery && 
            !p.baseName.toLowerCase().includes(searchQuery.toLowerCase()) && 
            !p.barcodes.includes(searchQuery)) return false;
        
        // Category Filter
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;

        // Stock Level Filter
        const stock = p.totalStock;
        const minStock = p.minStock;
        
        if (stockFilter === "out_of_stock" && stock > 0) return false;
        if (stockFilter === "low_stock" && (stock === 0 || stock > minStock)) return false;
        if (stockFilter === "healthy" && stock <= minStock) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "name_asc") return a.baseName.localeCompare(b.baseName);
        if (sortOption === "name_desc") return b.baseName.localeCompare(a.baseName);
        
        const stockA = a.totalStock;
        const stockB = b.totalStock;
        if (sortOption === "stock_asc") return stockA - stockB;
        if (sortOption === "stock_desc") return stockB - stockA;
        
        return 0;
      });
  }, [groupedProducts, searchQuery, categoryFilter, stockFilter, sortOption]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
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
        <h3 className="font-bold text-lg text-foreground">Filters</h3>
        <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-accent rounded-full text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all text-foreground"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stock Level</label>
          <select 
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all text-foreground"
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
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all text-foreground"
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
        className="w-full py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto select-none">
      
      {/* Filters Sidebar - Desktop */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-24 space-y-6">
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
            <Search className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none h-11 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search product family or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl text-base sm:text-sm placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-foreground"
            />
          </div>
          <button 
            onClick={() => setShowFilters(true)}
            className="lg:hidden flex items-center justify-center px-6 py-3 bg-card border border-border rounded-2xl font-bold text-sm hover:bg-accent transition-colors w-full sm:w-auto shadow-sm text-foreground"
          >
            <Filter className="w-4 h-4 mr-2" /> Filters
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 text-sm text-muted-foreground">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p>
            This consolidated view groups Carton, Box, Packet, and Single packages together. Portions like halves and quarters are left out of this report for clear, concise monitoring of stock weight and pieces.
          </p>
        </div>

        {/* Table/List */}
        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-muted-foreground uppercase bg-muted/30 tracking-wider">
                <tr>
                  <th className="px-6 py-5 font-bold">Consolidated Product</th>
                  <th className="px-6 py-5 font-bold">Category</th>
                  <th className="px-6 py-5 font-bold">Packaging Details Breakdown</th>
                  <th className="px-6 py-5 font-bold text-right">Total Stock</th>
                  <th className="px-6 py-5 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSortedGroups.map((family) => {
                  const stock = family.totalStock;
                  const minStock = family.minStock;
                  
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
                    <tr key={family.id} className="transition-all hover:bg-muted/30 group">
                      <td className="px-6 py-5">
                        <div className="font-extrabold text-foreground group-hover:text-primary transition-colors text-base">{family.baseName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1 max-w-[200px] truncate" title={family.barcodes}>
                          {family.barcodes}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-muted-foreground font-medium">{family.category}</td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-foreground/80 leading-relaxed max-w-md">
                          {family.details}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-extrabold text-foreground text-base">
                        {stock.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-muted-foreground font-medium">{family.unit}s</span>
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

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-border">
            {filteredAndSortedGroups.map((family) => {
              const stock = family.totalStock;
              const minStock = family.minStock;
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
                <div key={family.id} className="p-5 space-y-4 hover:bg-muted/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <h4 className="font-extrabold text-lg text-foreground leading-tight">{family.baseName}</h4>
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-[180px]">{family.barcodes}</p>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1 bg-muted/50 rounded-lg shrink-0">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", statusDot)}></div>
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">{statusText}</span>
                    </div>
                  </div>

                  <div className="bg-muted/10 border border-border p-3.5 rounded-2xl space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Inventory Breakdown</span>
                    <p className="text-sm font-semibold text-foreground/80 leading-relaxed">{family.details}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Stock Weight</span>
                      <span className="text-lg font-black text-foreground">
                        {stock.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-muted-foreground">{family.unit}s</span>
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Category</span>
                      <span className="text-sm font-bold text-primary">{family.category}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAndSortedGroups.length === 0 && (
            <div className="p-20 text-center text-muted-foreground bg-muted/5">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-semibold text-foreground/75">No matching product families found</p>
              <p className="text-sm mt-1">Adjust filters or check your search term.</p>
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
