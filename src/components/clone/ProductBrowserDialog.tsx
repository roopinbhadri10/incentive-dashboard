import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockProducts } from "@/data/mockData";

const productCategories = ["All", "Carbonated", "Juice", "Tea", "Water", "Energy", "Dairy"] as const;

interface ProductBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSkus: Set<string>;
  onAddSku: (sku: string) => void;
  /** Optional KPI name — when set, dialog header shows it for context. */
  forKpiName?: string;
}

export function ProductBrowserDialog({ open, onOpenChange, existingSkus, onAddSku, forKpiName }: ProductBrowserDialogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "crossSell">("name");

  const brands = useMemo(() => {
    const b = new Set(mockProducts.map(p => p.brand));
    return ["All", ...Array.from(b).sort()];
  }, []);

  const filtered = useMemo(() => {
    let items = [...mockProducts];
    if (category !== "All") items = items.filter(p => p.category === category);
    if (brand !== "All") items = items.filter(p => p.brand === brand);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }
    if (sortBy === "crossSell") {
      items.sort((a, b) => (b.crossSellOpportunity || 0) - (a.crossSellOpportunity || 0));
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }
    return items;
  }, [search, category, brand, sortBy]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] w-[90vw] h-[80vh] max-h-[700px] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-base font-semibold">
            {forKpiName ? `Add SKUs to "${forKpiName}"` : "Product Master"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {forKpiName ? `Pick the SKUs that count toward ${forKpiName}.` : `${mockProducts.length} SKUs · Click to add`}
          </p>
        </DialogHeader>

        {/* Sticky filters */}
        <div className="px-6 pt-4 pb-3 space-y-2.5 shrink-0 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Category chips */}
          <div className="flex gap-1.5 flex-wrap">
            {productCategories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
                  category === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Brand chips */}
          <div className="flex gap-1.5 flex-wrap">
            {brands.map(b => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                  brand === b
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                )}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Sort + count */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{filtered.length} products</span>
            <button
              onClick={() => setSortBy(s => s === "name" ? "crossSell" : "name")}
              className="inline-flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
            >
              <ArrowUpDown size={10} />
              {sortBy === "name" ? "Sort by Cross-Sell" : "Sort by Name"}
            </button>
          </div>
        </div>

        {/* Dense table layout */}
        <ScrollArea className="flex-1">
          {/* Header row */}
          <div className="grid grid-cols-[32px_1fr_80px_72px_56px_80px_72px_28px] gap-2 px-6 py-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 sticky top-0 bg-background z-10">
            <span></span>
            <span>Product</span>
            <span>Pack</span>
            <span>SKU</span>
            <span>Price</span>
            <span>Brand</span>
            <span>X-Sell</span>
            <span></span>
          </div>

          <div className="divide-y divide-border/30">
            {filtered.map(prod => {
              const added = existingSkus.has(prod.sku);
              return (
                <button
                  key={prod.id}
                  disabled={added}
                  onClick={() => onAddSku(prod.sku)}
                  className={cn(
                    "w-full grid grid-cols-[32px_1fr_80px_72px_56px_80px_72px_28px] gap-2 px-6 py-2.5 items-center text-left transition-colors",
                    added
                      ? "bg-primary/5 opacity-50 cursor-default"
                      : "hover:bg-muted/40 cursor-pointer"
                  )}
                >
                  <span className="text-base">{prod.imageEmoji}</span>
                  <span className="text-xs font-medium text-foreground truncate">{prod.name}</span>
                  <span className="text-[11px] text-muted-foreground">{prod.packSize}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{prod.sku}</span>
                  <span className="text-[11px] text-foreground">₹{prod.price}</span>
                  <span className="text-[11px] text-muted-foreground">{prod.brand}</span>
                  <span>
                    {prod.crossSellOpportunity && prod.crossSellOpportunity > 120 ? (
                      <Badge variant="outline" className="text-[8px] bg-primary/10 text-primary px-1.5 py-0">
                        {prod.crossSellOpportunity}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{prod.crossSellOpportunity || "—"}</span>
                    )}
                  </span>
                  <span>{added && <Check size={14} className="text-primary" />}</span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No products match your search</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
