import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Image, MessageSquare, Smartphone, Sparkles } from "lucide-react";

interface BannerConfig {
  headline: string;
  subtext: string;
  ctaText: string;
  style: "gradient" | "minimal" | "bold";
}

export function CommunicationStep() {
  const [banner, setBanner] = useState<BannerConfig>({
    headline: "🎯 New Incentive Plan is Live!",
    subtext: "Earn up to ₹12,000 by achieving your targets this month. Focus on distribution of Fanta & Sprite in your territory.",
    ctaText: "View Plan Details",
    style: "gradient",
  });
  const [notificationMessage, setNotificationMessage] = useState(
    "Hi {name}, a new incentive plan is now active! Earn rewards by hitting your targets. Tap to see details."
  );
  const [launchDate, setLaunchDate] = useState("2025-05-01");
  const [prelaunchDays, setPrelaunchDays] = useState("3");

  return (
    <div className="animate-fade-in space-y-4">
      {/* AI Suggestion */}
      <div className="gradient-banner rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-foreground">AI Message Generator</p>
            <p className="text-xs text-primary-foreground/80">
              AI has generated optimized banner copy based on your plan. Messages with <strong>specific earning amounts</strong> have 40% higher engagement.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="text-xs shrink-0">Regenerate</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Banner Config */}
        <div className="space-y-3">
          <label className="text-sm font-medium">In-App Banner</label>
          <Card className="p-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Headline</label>
              <Input value={banner.headline} onChange={(e) => setBanner({ ...banner, headline: e.target.value })} className="text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Textarea value={banner.subtext} onChange={(e) => setBanner({ ...banner, subtext: e.target.value })} className="text-xs" rows={3} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CTA Button Text</label>
              <Input value={banner.ctaText} onChange={(e) => setBanner({ ...banner, ctaText: e.target.value })} className="text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Style</label>
              <div className="flex gap-2">
                {(["gradient", "minimal", "bold"] as const).map((style) => (
                  <Badge
                    key={style}
                    variant={banner.style === style ? "default" : "outline"}
                    className="cursor-pointer text-xs capitalize"
                    onClick={() => setBanner({ ...banner, style })}
                  >
                    {style}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Preview</label>

          {/* Banner Preview */}
          <Card className="overflow-hidden">
            <div className={cn(
              "p-4",
              banner.style === "gradient" && "gradient-banner",
              banner.style === "minimal" && "bg-card border-b-2 border-primary",
              banner.style === "bold" && "bg-foreground"
            )}>
              <p className={cn(
                "text-sm font-bold mb-1",
                banner.style === "minimal" ? "text-foreground" : "text-primary-foreground"
              )}>
                {banner.headline}
              </p>
              <p className={cn(
                "text-xs mb-3",
                banner.style === "minimal" ? "text-muted-foreground" : "text-primary-foreground/80"
              )}>
                {banner.subtext}
              </p>
              <Button size="sm" variant={banner.style === "minimal" ? "default" : "secondary"} className="text-xs">
                {banner.ctaText}
              </Button>
            </div>
          </Card>

          {/* Phone notification preview */}
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium">Push Notification Preview</span>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                  <span className="text-[8px] text-primary-foreground font-bold">IC</span>
                </div>
                <span className="text-[10px] font-medium">Salescode.ai</span>
                <span className="text-[10px] text-muted-foreground ml-auto">now</span>
              </div>
              <p className="text-xs">{notificationMessage.replace("{name}", "Rahul")}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Notification message */}
      <Card className="p-3">
        <label className="text-xs font-medium mb-1 block">Push Notification Message</label>
        <Textarea
          value={notificationMessage}
          onChange={(e) => setNotificationMessage(e.target.value)}
          className="text-xs"
          rows={2}
        />
        <p className="text-[10px] text-muted-foreground mt-1">Use {"{name}"} for personalization</p>
      </Card>

      {/* Launch Timing */}
      <Card className="p-3">
        <label className="text-sm font-medium mb-2 block">Launch Timing</label>
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Launch Date</label>
            <Input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} className="text-xs w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pre-launch notice (days)</label>
            <Input type="number" value={prelaunchDays} onChange={(e) => setPrelaunchDays(e.target.value)} className="text-xs w-20" />
          </div>
        </div>
      </Card>
    </div>
  );
}
