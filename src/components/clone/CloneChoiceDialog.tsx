import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CloneChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  programCount: number;
  onChoose: (mode: "direct" | "ai") => void;
}

export function CloneChoiceDialog({ open, onClose, programCount, onChoose }: CloneChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Clone {programCount} Program{programCount > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            How would you like to clone?
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {/* Quick Clone */}
          <button
            onClick={() => onChoose("direct")}
            className={cn(
              "w-full text-left rounded-xl border-2 border-border p-5 transition-all",
              "hover:border-primary/40 hover:bg-primary/5 group"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Zap size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">⚡ Quick Clone</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clone as-is with rolled-forward dates. Quick review, tweak if needed, then publish.
                </p>
              </div>
            </div>
          </button>

          {/* Clone with AI */}
          <button
            onClick={() => onChoose("ai")}
            className={cn(
              "w-full text-left rounded-xl border-2 border-primary/30 p-5 transition-all",
              "hover:border-primary hover:bg-primary/5 group bg-primary/[0.03]"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Sparkles size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">✨ Clone with AI</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI optimizes your programs with data-backed tweaks. Review & confirm.
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] text-primary font-medium">Recommended</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
