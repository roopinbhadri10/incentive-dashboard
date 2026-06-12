import { useEffect, useMemo, useRef } from "react";
import { Upload, FileCheck2, CheckCircle2, Clock, RefreshCw, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { NsvBasis, SecondaryTargetSource, TargetStatus } from "./nsvTypes";
import { targetsPresentInSfa } from "@/lib/sfaTargets";

interface Props {
  basis: NsvBasis;
  secondarySource?: SecondaryTargetSource;
  targetFileName?: string;
  targetStatus?: TargetStatus;
  /** Stable key used to look the targets up in the SFA, e.g. "nsv-primary". */
  sfaKey: string;
  onChange: (next: {
    basis: NsvBasis;
    secondarySource?: SecondaryTargetSource;
    targetFileName?: string;
    targetStatus?: TargetStatus;
  }) => void;
  index?: string;
  title?: string;
}

export function TargetSourceSelector({
  basis,
  secondarySource = "aiml",
  targetFileName,
  targetStatus,
  sfaKey,
  onChange,
  index,
  title = "Target Basis",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const needsUpload =
    basis === "primary" || (basis === "secondary" && secondarySource === "upload");

  const effectiveKey = useMemo(
    () => `${sfaKey}-${basis}${basis === "secondary" ? `-${secondarySource}` : ""}`,
    [sfaKey, basis, secondarySource],
  );
  const sfaHasTargets = useMemo(
    () => needsUpload && targetsPresentInSfa(effectiveKey),
    [needsUpload, effectiveKey],
  );

  // Auto-set status to "sfa" when SFA targets are detected and no explicit choice has been made.
  useEffect(() => {
    if (!needsUpload) {
      if (targetStatus) onChange({ basis, secondarySource, targetFileName, targetStatus: undefined });
      return;
    }
    if (sfaHasTargets && !targetStatus) {
      onChange({ basis, secondarySource, targetFileName, targetStatus: "sfa" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsUpload, sfaHasTargets]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleDownloadTemplate = () => {
    const rows = [
      { "Employee ID": "E0001", "Employee Name": "Sample User", "Region": "North", "Target": 100000 },
      { "Employee ID": "E0002", "Employee Name": "Sample User", "Region": "South", "Target": 120000 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Targets");
    const fname = `${sfaKey}-targets-template.xlsx`;
    XLSX.writeFile(wb, fname);
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onChange({ basis, secondarySource, targetFileName: f.name, targetStatus: "uploaded" });
    e.target.value = "";
  };

  const setSecondary = (src: SecondaryTargetSource) =>
    onChange({
      basis,
      secondarySource: src,
      targetFileName: src === "aiml" ? undefined : targetFileName,
      targetStatus: undefined,
    });

  return (
    <section className="space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {index ? `${index} · ` : ""}
        {title}
      </Label>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={basis}
          onValueChange={(v) =>
            onChange({
              basis: v as NsvBasis,
              secondarySource: v === "secondary" ? secondarySource ?? "aiml" : undefined,
              targetFileName,
              targetStatus: undefined,
            })
          }
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary — client targets</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
          </SelectContent>
        </Select>

        {basis === "secondary" && (
          <div className="flex items-center gap-2">
            {/* Auto-generated card */}
            <button
              type="button"
              onClick={() => setSecondary("aiml")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                secondarySource === "aiml"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/30"
              )}
            >
              <RefreshCw size={14} className={secondarySource === "aiml" ? "text-primary" : "text-muted-foreground"} />
              Auto-generated
            </button>

            {/* Client upload card */}
            <button
              type="button"
              onClick={() => setSecondary("upload")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                secondarySource === "upload"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/30"
              )}
            >
              <Upload size={14} className={secondarySource === "upload" ? "text-primary" : "text-muted-foreground"} />
              Client upload
            </button>
          </div>
        )}
      </div>

      {basis === "secondary" && secondarySource === "aiml" && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw size={12} className="text-primary" /> Targets will be auto-generated by the system
        </div>
      )}

      {needsUpload && (
        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
          {sfaHasTargets && targetStatus === "sfa" ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-foreground">
                    Targets already available in SFA
                  </div>
                  <div className="text-muted-foreground">
                    These targets are already loaded for the sales reps — no upload needed.
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() =>
                  onChange({ basis, secondarySource, targetFileName, targetStatus: undefined })
                }
              >
                <RefreshCw size={12} /> Override
              </Button>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                {sfaHasTargets
                  ? "SFA targets detected, but you've chosen to override. Provide targets:"
                  : "Targets are not yet available in SFA. Choose how to provide them:"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="gap-1.5"
                >
                  <Download size={14} /> Download template
                </Button>
                <Button
                  variant={targetStatus === "uploaded" ? "default" : "outline"}
                  size="sm"
                  onClick={handleUploadClick}
                  className="gap-1.5"
                >
                  <Upload size={14} />
                  {targetStatus === "uploaded" ? "Replace target file" : "Upload now"}
                </Button>
                <Button
                  variant={targetStatus === "later" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    onChange({
                      basis,
                      secondarySource,
                      targetFileName: undefined,
                      targetStatus: "later",
                    })
                  }
                  className="gap-1.5"
                >
                  <Clock size={14} /> Upload later
                </Button>
                {sfaHasTargets && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-8 text-xs"
                    onClick={() =>
                      onChange({ basis, secondarySource, targetFileName, targetStatus: "sfa" })
                    }
                  >
                    <CheckCircle2 size={12} /> Use SFA targets
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>

              {targetStatus === "uploaded" && targetFileName && (
                <div className="text-xs text-foreground flex items-center gap-1.5">
                  <FileCheck2 size={14} className="text-primary" />
                  <span className="font-medium">{targetFileName}</span>
                  <span className="text-muted-foreground">uploaded</span>
                </div>
              )}
              {targetStatus === "later" && (
                <div className="text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <Clock size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Marked as <span className="font-medium">pending</span> — you'll need to upload
                    before the period starts. This will be flagged on the review screen.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
