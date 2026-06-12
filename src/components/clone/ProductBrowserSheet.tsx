import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockProducts } from "@/data/mockData";

const productCategories = ["All", "Carbonated", "Juice", "Tea", "Water", "Energy", "Dairy"] as const;

interface ProductBrowserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSkus: Set<string>;
  onAddSku: (sku: string) => void;
}

export function ProductBrowserSheet({ open, onOpenChange, existingSkus, onAddSku }: ProductBrowserSheetProps) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-base font-semibold">Product Master</SheetTitle>
          <p className="text-xs text-muted-foreground">{mockProducts.length} SKUs · Search, filter, and add products</p>
        </SheetHeader>

        <div className="px-5 pt-4 pb-2 space-y-3">
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

        <ScrollArea className="flex-1 px-5 pb-5">
          <div className="space-y-1.5 pr-2">
            {filtered.map(prod => {
              const added = existingSkus.has(prod.sku);
              return (
                <button
                  key={prod.id}
                  disabled={added}
                  onClick={() => onAddSku(prod.sku)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3.5 py-2.5 transition-all flex items-center gap-3",
                    added
                      ? "border-primary/20 bg-primary/5 opacity-60 cursor-default"
                      : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                  )}
                >
                  <span className="text-lg">{prod.imageEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{prod.name}</span>
                      <span className="text-[10px] text-muted-foreground">— {prod.packSize}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{prod.sku}</span>
                      <span className="text-[10px] text-muted-foreground">₹{prod.price}</span>
                      <span className="text-[10px] text-muted-foreground">{prod.brand}</span>
                    </div>
                  </div>
                  {prod.crossSellOpportunity && prod.crossSellOpportunity > 130 && (
                    <Badge variant="outline" className="text-[8px] bg-primary/10 text-primary px-1.5 py-0 shrink-0">
                      Cross-sell {prod.crossSellOpportunity}
                    </Badge>
                  )}
                  {added && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No products match your search</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
