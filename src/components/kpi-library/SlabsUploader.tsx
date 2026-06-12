import { useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { NsvSlab } from "./nsvTypes";

interface Props {
  slabs: NsvSlab[];
  onReplace: (slabs: NsvSlab[]) => void;
  templateName?: string;
}

/**
 * Optional Excel uploader for slab configuration.
 * - Download a template (.xlsx) seeded with current slabs.
 * - Upload a filled file to replace slabs entirely (auto-grows / shrinks).
 *
 * Expected columns (case-insensitive headers):
 *   Achievement %  |  Rate (₹ per 1%)  |  Starting earning (entry slab only)
 */
export function SlabsUploader({ slabs, onReplace, templateName = "slabs" }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = slabs.length
      ? slabs.map((s, i) => ({
          "Achievement %": s.pct,
          "Rate (₹ per 1%)": i === 0 ? "" : s.ratePerPct,
          "Starting earning": i === 0 ? s.entryPayout ?? 0 : "",
        }))
      : [
          { "Achievement %": 95, "Rate (₹ per 1%)": "", "Starting earning": 2400 },
          { "Achievement %": 100, "Rate (₹ per 1%)": 320, "Starting earning": "" },
          { "Achievement %": 105, "Rate (₹ per 1%)": 200, "Starting earning": "" },
          { "Achievement %": 110, "Rate (₹ per 1%)": 200, "Starting earning": "" },
        ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 16 }, { wch: 20 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Slabs");
    XLSX.writeFile(wb, `${templateName}-template.xlsx`);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!rows.length) throw new Error("Empty sheet");

      const norm = (s: string) => s.toLowerCase().replace(/[^a-z%]/g, "");
      const keyMap: Record<string, "pct" | "rate" | "entry"> = {};
      Object.keys(rows[0]).forEach((k) => {
        const n = norm(k);
        if (n.includes("achievement") || n === "pct" || n.includes("%")) keyMap[k] = "pct";
        else if (n.includes("rate")) keyMap[k] = "rate";
        else if (n.includes("starting") || n.includes("entry")) keyMap[k] = "entry";
      });

      const parsed: NsvSlab[] = [];
      rows.forEach((r) => {
        let pct: number | undefined, rate: number | undefined, entry: number | undefined;
        Object.entries(r).forEach(([k, v]) => {
          const role = keyMap[k];
          const num = Number(v);
          if (v === "" || Number.isNaN(num)) return;
          if (role === "pct") pct = num;
          else if (role === "rate") rate = num;
          else if (role === "entry") entry = num;
        });
        if (pct == null) return;
        parsed.push({
          pct,
          ratePerPct: rate ?? 0,
          ...(entry != null ? { entryPayout: entry } : {}),
        });
      });
      if (parsed.length < 2) throw new Error("Need at least 2 slab rows");
      parsed.sort((a, b) => a.pct - b.pct);
      // ensure first slab has entryPayout
      if (parsed[0].entryPayout == null) parsed[0].entryPayout = 0;
      onReplace(parsed);
      toast({ title: "Slabs imported", description: `${parsed.length} slabs loaded from ${f.name}` });
    } catch (err) {
      toast({
        title: "Couldn't read file",
        description: err instanceof Error ? err.message : "Invalid format",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 rounded bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
          <FileSpreadsheet size={15} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground flex items-center gap-1">
            Bulk-upload slabs <span className="text-muted-foreground font-normal">(optional)</span>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 size={10} /> Replaces all slabs · auto-adjusts count · editable after upload
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1 h-8">
          <Download size={13} /> Template
        </Button>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1 h-8">
          <Upload size={13} /> Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  );
}
