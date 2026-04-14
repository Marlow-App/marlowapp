import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mic, ArrowRight, Zap } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";

export default function CheckoutSuccess() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const plan = params.get("plan");

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);

  const planLabel = plan === "yearly" ? "Yearly" : "Monthly";

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center gap-8" data-testid="checkout-success-page">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-display" data-testid="checkout-success-title">
            Welcome to Pro!
          </h1>
          <p className="text-muted-foreground text-lg">
            Your {planLabel} subscription is now active.
          </p>
        </div>

        <Card className="w-full border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold font-display">Marlow Pro</span>
            </div>
            <div className="space-y-2 text-left">
              {[
                "Unlimited recordings per day",
                "Unlimited error category insights",
                "Unlimited Practice List items",
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-sm">{f}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={() => navigate("/record")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
            data-testid="checkout-success-record-btn"
          >
            Start Recording
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/profile?tab=subscription")}
            data-testid="checkout-success-profile-btn"
          >
            View Subscription
          </Button>
        </div>
      </div>
    </Layout>
  );
}
