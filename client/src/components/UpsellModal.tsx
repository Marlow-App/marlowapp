import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SUBSCRIPTION_PLANS } from "@shared/credits";

const PRO_FEATURES = [
  "Unlimited recordings per day",
  "Unlimited error category insights",
  "Unlimited Practice List items",
  "Full pronunciation breakdown per character",
];

interface UpsellModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "recordings" | "popups" | "practice_list";
}

export function UpsellModal({ open, onClose, reason }: UpsellModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const reasonText = {
    recordings: "You've reached the daily recording limit for free accounts (5/day).",
    popups: "You've used your 3 free error insights for today.",
    practice_list: "Your Practice List is full (3 items on free accounts).",
  }[reason ?? "recordings"];

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await apiRequest("POST", "/api/stripe/subscribe", { plan: planId });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Checkout failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="upsell-modal">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold font-display">Upgrade to Pro</DialogTitle>
          </div>
          {reasonText && (
            <DialogDescription className="text-sm text-muted-foreground">
              {reasonText}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 my-2">
          <p className="text-sm font-semibold text-foreground">Everything in Pro:</p>
          <ul className="space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {SUBSCRIPTION_PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-4 text-center space-y-1 ${
                plan.highlight === "best_value"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60"
              }`}
            >
              {plan.highlight === "best_value" && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 bg-primary text-primary-foreground whitespace-nowrap">
                  Best Value
                </Badge>
              )}
              <p className="text-sm font-semibold mt-1">{plan.label}</p>
              <p className="text-2xl font-bold font-display">${plan.priceUsd}</p>
              <p className="text-xs text-muted-foreground">per {plan.interval}</p>
              {plan.highlight === "best_value" && (
                <p className="text-[10px] text-emerald-600 font-medium">Save ~17%</p>
              )}
              <Button
                size="sm"
                className="w-full mt-2 rounded-full"
                variant={plan.highlight === "best_value" ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.id)}
                disabled={!!loading}
                data-testid={`upsell-subscribe-${plan.id}`}
              >
                {loading === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Subscribe"
                )}
              </Button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} className="w-full text-muted-foreground mt-1">
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
