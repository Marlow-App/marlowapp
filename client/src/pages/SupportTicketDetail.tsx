import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User as UserIcon, CheckCircle2, Loader2, ArrowLeft, Calendar, Tag } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  "Technical Issue": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "Bug Report": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  "Feature Request": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "Billing Question": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  "Other": "bg-muted text-muted-foreground border-border",
};

export default function SupportTicketDetail() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);

  const { data: tickets, isLoading } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"],
  });

  const ticket = tickets?.find((t: any) => t.id === ticketId);

  const resolveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/support/tickets/${ticketId}/resolve`, {}),
    onMutate: () => setResolving(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to resolve ticket", variant: "destructive" });
    },
    onSettled: () => setResolving(false),
  });

  const submitterName = ticket?.user?.firstName
    ? `${ticket.user.firstName}${ticket.user.lastName ? " " + ticket.user.lastName : ""}`
    : ticket?.user?.email?.split("@")[0] || "Unknown user";

  const resolverName = ticket?.resolvedBy?.firstName
    ? `${ticket.resolvedBy.firstName}${ticket.resolvedBy.lastName ? " " + ticket.resolvedBy.lastName : ""}`
    : ticket?.resolvedBy?.email?.split("@")[0] || "a reviewer";

  const isOpen = ticket?.status === "open";

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <h2 className="text-xl font-semibold mb-2">Ticket not found</h2>
          <p className="text-muted-foreground mb-6">This ticket may have been deleted or the ID is invalid.</p>
          <Button variant="outline" onClick={() => navigate("/reviewer-hub")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Portal
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 animate-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/reviewer-hub")} data-testid="button-back-to-portal">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Portal
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Support Ticket #{ticket.id}</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Submitted {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
            </p>
          </div>
          {isOpen ? (
            <Badge variant="outline" className="text-sm px-3 py-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 shrink-0">
              Open
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm px-3 py-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 shrink-0">
              Completed
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium text-sm" data-testid="ticket-submitter">{submitterName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Tag className="w-3.5 h-3.5" />
                <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[ticket.category] ?? CATEGORY_COLORS["Other"]}`} data-testid="ticket-category">
                  {ticket.category}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Message</CardTitle>
            <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground" data-testid="ticket-message">
              {ticket.message}
            </p>
          </CardContent>
        </Card>

        {!isOpen && ticket.resolvedAt && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">
                Marked complete by <span className="font-semibold">{resolverName}</span> on{" "}
                {format(new Date(ticket.resolvedAt), "MMMM d, yyyy")}
              </p>
            </CardContent>
          </Card>
        )}

        {isOpen && (
          <div className="flex justify-end">
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={resolving}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-mark-completed"
            >
              {resolving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Marking complete…</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Mark as Completed</>
              )}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
