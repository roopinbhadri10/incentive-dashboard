import { Upload, FileText, Database, Info, Check, X } from "lucide-react";

export type ProductSource = "mdm" | "upload";

export interface DbbProductConfig {
  source: ProductSource;
  uploadFileName?: string;
}

export const DEFAULT_DBB_PRODUCTS: DbbProductConfig = {
  source: "mdm",
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
};

export function DbbProductSelector({ value, onChange }: Props) {
  const update = (patch: Partial<DbbProductConfig>) => onChange({ ...value, ...patch });

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) update({ uploadFileName: f.name });
  };

  return (
    <div className="space-y-3">
      {/* Source picker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
    </div>
  );
}
