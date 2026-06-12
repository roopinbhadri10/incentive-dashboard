import { useState, useMemo } from "react";
import {
  Plus, Trash2, Info, Upload, FileText, Database, ListTree, ChevronRight,
  Search, Check, Package, X, SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PRODUCT_CATALOG,
  describeSelection,
  countSkusInSelection,
  previewImagesForSelection,
  getAllSkusInSelection,
  type ProductSelection,
  type ProductSelectionLevel,
  type CategoryNode,
  type BrandNode,
  type PackNode,
  type SkuNode,
} from "./productCatalog";
import { uid } from "./nsvTypes";

export type ProductSource = "mdm" | "upload" | "select";

export interface DbbProductConfig {
  source: ProductSource;
  uploadFileName?: string;
  selections: ProductSelection[];
}

export const DEFAULT_DBB_PRODUCTS: DbbProductConfig = {
  source: "mdm",
  selections: [],
};

interface Props {
  value: DbbProductConfig;
  onChange: (v: DbbProductConfig) => void;
}

const SOURCE_META: Record<ProductSource, { label: string; icon: typeof Database; blurb: string }> = {
  mdm: {
    label: "From Admin Portal (MDM)",
    icon: Database,
    blurb: "Use the master focus-SKU list maintained by your Admin team in MDM.",
  },
  upload: {
    label: "Upload list here",
    icon: Upload,
    blurb: "Override MDM for this programme with your own CSV / XLSX.",
  },
  select: {
    label: "Pick from catalog",
    icon: ListTree,
    blurb: "Cascade Category → Brand → Pack → SKU. Pick at any level.",
  },
};

export function DbbProductSelector({ value, onChange }: Props) {
  const update = (patch: Partial<DbbProductConfig>) => onChange({ ...value, ...patch });

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) update({ uploadFileName: f.name });
  };

  const totalSkus = value.selections.reduce((acc, s) => acc + countSkusInSelection(s), 0);

  return (
    <div className="space-y-3">
      {/* Source picker (3 tiles) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {(Object.keys(SOURCE_META) as ProductSource[]).map((src) => {
          const meta = SOURCE_META[src];
          const Icon = meta.icon;
          const active = value.source === src;
          return (
            <button
              key={src}
              type="button"
              onClick={() => update({ source: src })}
              className={`text-left rounded-lg border p-3 transition group ${
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                  : "border-border bg-card hover:bg-muted/30 hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-6 w-6 rounded-md grid place-items-center ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon size={13} />
                </div>
                <span className="text-sm font-medium">{meta.label}</span>
                {active && <Check size={13} className="ml-auto text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{meta.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Source-specific body */}
      {value.source === "mdm" && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>
            Focus SKUs will be auto-fetched from MDM at programme launch and refreshed on every sync.
          </span>
        </div>
      )}

      {value.source === "upload" && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-2">
          <label className="flex flex-col items-center justify-center gap-2 py-4 cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center">
              <Upload size={18} className="text-primary" />
            </div>
            <div className="text-sm font-medium">Drop CSV / XLSX or click to upload</div>
            <div className="text-[11px] text-muted-foreground">
              Expected columns: <code>sku_code</code>, <code>group_code</code> (optional), <code>description</code> (optional)
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onUpload} />
          </label>
          {value.uploadFileName && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-card border border-border">
              <FileText size={12} className="text-primary" />
              <span className="font-medium">{value.uploadFileName}</span>
              <button
                type="button"
                onClick={() => update({ uploadFileName: undefined })}
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label="Remove file"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {value.source === "select" && (
        <CatalogBrowser
          selections={value.selections}
          onChange={(selections) => update({ selections })}
          totalSkus={totalSkus}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Catalog browser (column-style, image-rich)                          */
/* ------------------------------------------------------------------ */

function CatalogBrowser({
  selections,
  onChange,
  totalSkus,
}: {
  selections: ProductSelection[];
  onChange: (s: ProductSelection[]) => void;
  totalSkus: number;
}) {
  const [catIdx, setCatIdx] = useState<number>(0);
  const [brandIdx, setBrandIdx] = useState<number | null>(null);
  const [packIdx, setPackIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const cat: CategoryNode = PRODUCT_CATALOG[catIdx];
  const brand: BrandNode | null = brandIdx !== null ? cat.brands[brandIdx] ?? null : null;
  const pack: PackNode | null = brand && packIdx !== null ? brand.packs[packIdx] ?? null : null;

  // Search across all SKUs when query present
  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const out: { cat: CategoryNode; brand: BrandNode; pack: PackNode; sku: SkuNode }[] = [];
    for (const c of PRODUCT_CATALOG)
      for (const b of c.brands)
        for (const p of b.packs)
          for (const s of p.skus)
            if (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.groupCode.toLowerCase().includes(q))
              out.push({ cat: c, brand: b, pack: p, sku: s });
    return out.slice(0, 50);
  }, [query]);

  const addSelection = (sel: Omit<ProductSelection, "id">) => {
    const sig = JSON.stringify({ ...sel, id: undefined });
    if (selections.some((x) => JSON.stringify({ ...x, id: undefined }) === sig)) return;
    onChange([...selections, { ...sel, id: uid("sel") }]);
  };
  const removeSelection = (id: string) => onChange(selections.filter((x) => x.id !== id));

  // Determine which list to show in the wide pane based on how deep the path goes
  type PaneMode = "brand" | "pack" | "sku";
  const paneMode: PaneMode = pack ? "sku" : brand ? "pack" : "brand";

  return (
    <div className="rounded-xl border border-border bg-gradient-to-b from-muted/20 to-card overflow-hidden">
      {/* Header: search + counter */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60">
        <Search size={14} className="text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products, SKU codes, group codes…"
          className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm"
        />
        <Badge variant="secondary" className="text-[11px] shrink-0">
          <Package size={11} className="mr-1" />
          {totalSkus} SKU{totalSkus === 1 ? "" : "s"} picked
        </Badge>
      </div>

      {/* Path bar — only when not searching */}
      {!searchHits && (
        <PathBar
          cat={cat}
          brand={brand}
          pack={pack}
          onPickCategory={(i) => { setCatIdx(i); setBrandIdx(null); setPackIdx(null); }}
          onPickBrand={(i) => { setBrandIdx(i); setPackIdx(null); }}
          onPickPack={(i) => setPackIdx(i)}
          onAddCategory={() => addSelection({ level: "category", category: cat.category })}
          onAddBrand={() => brand && addSelection({ level: "brand", category: cat.category, brand: brand.brand })}
          onAddPack={() => brand && pack && addSelection({
            level: "pack",
            category: cat.category,
            brand: brand.brand,
            packSize: pack.packSize,
          })}
          onReset={() => { setBrandIdx(null); setPackIdx(null); }}
        />
      )}

      {/* Content pane — fixed height */}
      <div className="h-[340px] overflow-y-auto">
        {searchHits ? (
          searchHits.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">No matches.</div>
          ) : (
            <div className="p-2 space-y-1">
              {searchHits.map((h) => {
                const picked = selections.some((s) => s.level === "sku" && s.skuCode === h.sku.code);
                return (
                  <WideRow
                    key={h.sku.code}
                    image={h.sku.image}
                    code={h.sku.code}
                    title={h.sku.name}
                    meta={`${h.cat.category} › ${h.brand.brand} · ${h.pack.packSize}`}
                    picked={picked}
                    onClick={() =>
                      picked
                        ? onChange(selections.filter((s) => !(s.level === "sku" && s.skuCode === h.sku.code)))
                        : addSelection({
                            level: "sku",
                            category: h.cat.category,
                            brand: h.brand.brand,
                            packSize: h.pack.packSize,
                            skuCode: h.sku.code,
                          })
                    }
                  />
                );
              })}
            </div>
          )
        ) : paneMode === "sku" && pack ? (
          <div className="p-2 space-y-1">
            {pack.skus.map((sk) => {
              const picked = selections.some((s) => s.level === "sku" && s.skuCode === sk.code);
              return (
                <WideRow
                  key={sk.code}
                  image={sk.image}
                  code={sk.code}
                  title={sk.name}
                  meta={sk.groupCode}
                  picked={picked}
                  onClick={() =>
                    picked
                      ? onChange(selections.filter((s) => !(s.level === "sku" && s.skuCode === sk.code)))
                      : addSelection({
                          level: "sku",
                          category: cat.category,
                          brand: brand!.brand,
                          packSize: pack.packSize,
                          skuCode: sk.code,
                        })
                  }
                />
              );
            })}
          </div>
        ) : paneMode === "pack" && brand ? (
          <div className="p-2 space-y-1">
            <PaneHint text={`Pick a pack size in ${brand.brand} — or add the entire brand from the path bar above.`} />
            {brand.packs.map((p, i) => (
              <WideRow
                key={p.packSize}
                colorTint={brand.color}
                title={p.packSize}
                code={`${p.skus.length} SKU${p.skus.length === 1 ? "" : "s"}`}
                meta={p.skus.map((s) => s.code).slice(0, 2).join(" · ")}
                chevron
                onClick={() => setPackIdx(i)}
              />
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <PaneHint text={`Pick a brand in ${cat.category} — or add the entire category from the path bar above.`} />
            {cat.brands.map((b, i) => (
              <WideRow
                key={b.brand}
                colorTint={b.color}
                title={b.brand}
                code={`${b.packs.length} pack size${b.packs.length === 1 ? "" : "s"}`}
                meta={b.packs.flatMap((p) => p.skus).length + " SKUs total"}
                chevron
                onClick={() => { setBrandIdx(i); setPackIdx(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add-all footer for SKU level */}
      {!searchHits && paneMode === "sku" && pack && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() =>
              addSelection({
                level: "pack",
                category: cat.category,
                brand: brand!.brand,
                packSize: pack.packSize,
              })
            }
            className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus size={11} /> Add all {pack.skus.length} SKUs in this pack
          </button>
        </div>
      )}

      {/* Selected chips tray */}
      <div className="border-t border-border bg-card/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Selected scopes
          </div>
          {selections.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          )}
        </div>
        {selections.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nothing picked yet. Use the path bar to drill in, then pick SKUs — or add a whole category, brand, or pack via the <span className="font-medium">＋</span> on each crumb.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selections.map((s) => (
              <SelectionChip
                key={s.id}
                selection={s}
                onRemove={() => removeSelection(s.id)}
                onUpdate={(next) =>
                  onChange(selections.map((x) => (x.id === s.id ? { ...x, ...next } : x)))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function PathBar({
  cat, brand, pack,
  onPickCategory, onPickBrand, onPickPack,
  onAddCategory, onAddBrand, onAddPack,
  onReset,
}: {
  cat: CategoryNode;
  brand: BrandNode | null;
  pack: PackNode | null;
  onPickCategory: (i: number) => void;
  onPickBrand: (i: number) => void;
  onPickPack: (i: number) => void;
  onAddCategory: () => void;
  onAddBrand: () => void;
  onAddPack: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card/40 overflow-x-auto">
      <Crumb
        label={cat.category}
        leading={<span className="text-sm">{cat.emoji ?? "📦"}</span>}
        onAdd={onAddCategory}
        addHint="Add whole category as a scope"
        active
        popover={
          <CrumbList>
            {PRODUCT_CATALOG.map((c, i) => (
              <CrumbOption
                key={c.category}
                selected={c.category === cat.category}
                onClick={() => onPickCategory(i)}
                leading={<span>{c.emoji ?? "📦"}</span>}
                title={c.category}
                subtitle={`${c.brands.length} brands`}
              />
            ))}
          </CrumbList>
        }
      />
      <ChevronRight size={12} className="text-muted-foreground/60 shrink-0" />
      <Crumb
        label={brand ? brand.brand : "Pick brand…"}
        leading={
          <span
            className="h-3.5 w-3.5 rounded-sm border border-border shrink-0"
            style={{ background: brand?.color ?? "hsl(var(--muted))" }}
          />
        }
        onAdd={brand ? onAddBrand : undefined}
        addHint="Add whole brand as a scope"
        active={!!brand}
        placeholder={!brand}
        popover={
          <CrumbList>
            {cat.brands.map((b, i) => (
              <CrumbOption
                key={b.brand}
                selected={b.brand === brand?.brand}
                onClick={() => onPickBrand(i)}
                leading={
                  <span
                    className="h-4 w-4 rounded-sm border border-border"
                    style={{ background: b.color ?? "hsl(var(--muted))" }}
                  />
                }
                title={b.brand}
                subtitle={`${b.packs.length} pack sizes`}
              />
            ))}
          </CrumbList>
        }
      />
      <ChevronRight size={12} className="text-muted-foreground/60 shrink-0" />
      <Crumb
        label={pack ? pack.packSize : "Pick pack…"}
        onAdd={pack ? onAddPack : undefined}
        addHint="Add whole pack as a scope"
        active={!!pack}
        placeholder={!pack}
        disabled={!brand}
        popover={
          brand ? (
            <CrumbList>
              {brand.packs.map((p, i) => (
                <CrumbOption
                  key={p.packSize}
                  selected={p.packSize === pack?.packSize}
                  onClick={() => onPickPack(i)}
                  title={p.packSize}
                  subtitle={`${p.skus.length} SKU${p.skus.length === 1 ? "" : "s"}`}
                />
              ))}
            </CrumbList>
          ) : null
        }
      />
      {(brand || pack) && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0"
          title="Reset path"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function Crumb({
  label, leading, onAdd, addHint, active, placeholder, disabled, popover,
}: {
  label: string;
  leading?: React.ReactNode;
  onAdd?: () => void;
  addHint?: string;
  active?: boolean;
  placeholder?: boolean;
  disabled?: boolean;
  popover: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-md border shrink-0 ${
        active
          ? "border-primary/40 bg-primary/5"
          : placeholder
            ? "border-dashed border-border bg-background"
            : "border-border bg-background"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 text-xs font-medium hover:bg-muted/40 rounded-l-md ${
              placeholder ? "text-muted-foreground italic" : "text-foreground"
            }`}
          >
            {leading}
            <span className="truncate max-w-[140px]">{label}</span>
            <ChevronRight size={11} className="rotate-90 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          {popover}
        </PopoverContent>
      </Popover>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          title={addHint}
          className="h-7 w-7 grid place-items-center border-l border-border/60 text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-r-md"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}

function CrumbList({ children }: { children: React.ReactNode }) {
  return <div className="max-h-72 overflow-y-auto p-1">{children}</div>;
}

function CrumbOption({
  selected, onClick, leading, title, subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs ${
        selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50"
      }`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
      {selected && <Check size={12} className="text-primary shrink-0" />}
    </button>
  );
}

function PaneHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 text-[11px] text-muted-foreground italic">
      <Info size={11} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="h-full grid place-items-center text-center px-4">
      <p className="text-xs text-muted-foreground italic">{text}</p>
    </div>
  );
}

function WideRow({
  image, colorTint, code, title, meta, picked, chevron, onClick,
}: {
  image?: string;
  colorTint?: string;
  code?: string;
  title: string;
  meta?: string;
  picked?: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition ${
        picked ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"
      }`}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="h-9 w-9 rounded-md object-cover border border-border shrink-0"
          loading="lazy"
        />
      ) : (
        <span
          className="h-9 w-9 rounded-md border border-border shrink-0"
          style={{ background: colorTint ?? "hsl(var(--muted))" }}
        />
      )}
      {code && (
        <span className="font-mono text-[11px] text-muted-foreground w-[132px] shrink-0 truncate">
          {code}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{title}</div>
        {meta && <div className="text-[10px] text-muted-foreground truncate">{meta}</div>}
      </div>
      {chevron ? (
        <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
      ) : (
        <div
          className={`h-5 w-5 rounded-md grid place-items-center border shrink-0 transition ${
            picked
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border text-transparent group-hover:border-primary/50"
          }`}
        >
          <Check size={12} />
        </div>
      )}
    </button>
  );
}

function SelectionChip({
  selection, onRemove, onUpdate,
}: {
  selection: ProductSelection;
  onRemove: () => void;
  onUpdate: (next: Partial<ProductSelection>) => void;
}) {
  const imgs = previewImagesForSelection(selection, 3);
  const count = countSkusInSelection(selection);
  const allSkus = getAllSkusInSelection(selection);
  const excluded = new Set(selection.excludedSkuCodes ?? []);
  const canExclude = selection.level !== "sku" && allSkus.length > 1;
  const levelLabel: Record<ProductSelectionLevel, string> = {
    category: "Category",
    brand: "Brand",
    pack: "Pack",
    sku: "SKU",
  };

  const toggleExclude = (code: string) => {
    const next = new Set(excluded);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onUpdate({ excludedSkuCodes: Array.from(next) });
  };

  return (
    <div className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full border border-border bg-card shadow-sm">
      <div className="flex -space-x-2">
        {imgs.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="h-6 w-6 rounded-full border border-card object-cover"
          />
        ))}
      </div>
      <div className="text-[11px]">
        <span className="font-medium">{describeSelection(selection)}</span>
        <span className="text-muted-foreground ml-1">
          · {levelLabel[selection.level]} · {count} SKU{count === 1 ? "" : "s"}
          {excluded.size > 0 && (
            <span className="text-amber-600 dark:text-amber-500 ml-1">
              ({excluded.size} excluded)
            </span>
          )}
        </span>
      </div>
      {canExclude && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-5 w-5 grid place-items-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
              aria-label="Edit exclusions"
              title="Exclude specific SKUs"
            >
              <SlidersHorizontal size={11} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="px-3 py-2 border-b border-border">
              <div className="text-xs font-semibold">Include / exclude SKUs</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {describeSelection(selection)}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
              {allSkus.map((sk) => {
                const isOut = excluded.has(sk.code);
                return (
                  <label
                    key={sk.code}
                    className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition ${
                      isOut ? "opacity-50 bg-muted/30" : "hover:bg-muted/50"
                    }`}
                  >
                    <img src={sk.image} alt="" className="h-8 w-8 rounded object-cover border border-border" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium truncate">{sk.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{sk.code}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!isOut}
                      onChange={() => toggleExclude(sk.code)}
                      className="h-4 w-4 accent-primary cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
            <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {count} of {allSkus.length} included
              </span>
              {excluded.size > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdate({ excludedSkuCodes: [] })}
                  className="text-primary font-medium hover:underline"
                >
                  Include all
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="h-5 w-5 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        aria-label="Remove"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
