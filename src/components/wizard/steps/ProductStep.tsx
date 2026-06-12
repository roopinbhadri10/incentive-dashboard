import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockProducts, brands } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Sparkles } from "lucide-react";

export function ProductStep() {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["p1", "p2", "p3"]);
  const [activeBrand, setActiveBrand] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const allBrands = ["All", ...brands];

  const highOpportunityProducts = mockProducts
    .filter((p) => (p.salesUplift ?? 0) > 20000)
    .slice(0, 5);

  const filteredProducts = mockProducts.filter(
    (p) =>
      (activeBrand === "All" || p.brand === activeBrand) &&
      (searchQuery === "" || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* AI High Opportunity SKUs */}
      <Card className="p-4 border-2 border-primary/20 bg-sidebar-accent">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold">{highOpportunityProducts.length} High Opportunity SKUs</span>
          <ChevronDown size={14} className="ml-auto text-muted-foreground" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {highOpportunityProducts.map((product) => (
            <Card
              key={product.id}
              className={cn(
                "min-w-[180px] p-3 cursor-pointer border-2 transition-all shrink-0",
                selectedProducts.includes(product.id) ? "border-primary" : "border-transparent"
              )}
              onClick={() => toggleProduct(product.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{product.imageEmoji}</span>
                  <div>
                    <p className="text-sm font-medium">{product.name} {product.packSize}</p>
                    <p className="text-[10px] text-muted-foreground">{product.sku}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Distribution opp.</p>
                  <p className="text-sm font-semibold highlight-green inline-block px-1.5 rounded text-xs">
                    {product.distributionOpportunity} <span className="font-normal">Outlets</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Sales uplift</p>
                  <p className="text-sm font-semibold highlight-yellow inline-block px-1.5 rounded text-xs">
                    ₹{((product.salesUplift ?? 0) / 1000).toFixed(1)}K
                  </p>
                </div>
              </div>
              <Button size="sm" variant="link" className="text-xs p-0 h-auto mt-2 text-primary">
                Create incentive →
              </Button>
            </Card>
          ))}
        </div>
        <button className="text-xs text-primary font-medium mt-2 hover:underline">
          See all recommendations →
        </button>
      </Card>

      {/* Info banner */}
      <div className="bg-sidebar-accent rounded-lg p-3 flex items-start gap-2">
        <span className="text-sm">🎯</span>
        <p className="text-xs text-primary">
          There are <strong>high distribution and sales uplift opportunity for 250 SKUs</strong> in the market!
          Select the ones you want to focus on.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {allBrands.slice(0, 6).map((brand) => (
          <Badge
            key={brand}
            variant={activeBrand === brand ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setActiveBrand(brand)}
          >
            {brand}
          </Badge>
        ))}
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-7 text-xs w-48" />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-3 gap-3">
        {filteredProducts.map((product) => (
          <Card
            key={product.id}
            className={cn(
              "p-3 cursor-pointer transition-all border-2",
              selectedProducts.includes(product.id) ? "border-primary bg-sidebar-accent" : "border-transparent hover:border-border"
            )}
            onClick={() => toggleProduct(product.id)}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{product.imageEmoji}</span>
              <div>
                <p className="text-sm font-medium">{product.name} {product.packSize}</p>
                <p className="text-[10px] text-muted-foreground">{product.sku}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Dist. opp.</p>
                <p className="text-xs font-semibold highlight-green inline-block px-1 rounded">
                  {product.distributionOpportunity} <span className="font-normal text-[10px]">Outlets</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Uplift</p>
                <p className="text-xs font-semibold highlight-yellow inline-block px-1 rounded">
                  ₹{((product.salesUplift ?? 0) / 1000).toFixed(1)}K
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Badge variant="secondary" className="text-xs">{selectedProducts.length} products selected</Badge>
    </div>
  );
}
