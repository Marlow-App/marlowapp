import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon, MessageSquare, CheckCircle2, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

const CATEGORY_COLORS: Record<string, string> = {
  "Technical Issue": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "Bug Report": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  "Feature Request": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "Billing Question": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  "Other": "bg-muted text-muted-foreground border-border",
};

function submitterName(ticket: any) {
  return ticket.user?.firstName
    ? `${ticket.user.firstName}${ticket.user.lastName ? " " + ticket.user.lastName : ""}`
    : ticket.user?.email?.split("@")[0] || "Unknown user";
}

function OpenTicketRow({ ticket }: { ticket: any }) {
  return (
    <Link href={`/support/tickets/${ticket.id}`}>
      <Card
        className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer group"
        data-testid={`ticket-row-${ticket.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded-md shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
              <span className="font-medium text-sm text-foreground/80">{submitterName(ticket)}</span>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${CATEGORY_COLORS[ticket.category] ?? CATEGORY_COLORS["Other"]}`}>
              {ticket.category}
            </Badge>
            <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
              {ticket.message}
            </p>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CompletedTicketRow({ ticket }: { ticket: any }) {
  const resolverName = ticket.resolvedBy?.firstName
    ? `${ticket.resolvedBy.firstName}${ticket.resolvedBy.lastName ? " " + ticket.resolvedBy.lastName : ""}`
    : ticket.resolvedBy?.email?.split("@")[0] || "a reviewer";

  return (
    <Link href={`/support/tickets/${ticket.id}`}>
      <Card
        className="opacity-75 hover:opacity-100 hover:shadow-sm transition-all duration-200 cursor-pointer group"
        data-testid={`ticket-row-${ticket.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded-md shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
              <span className="font-medium text-sm text-foreground/80">{submitterName(ticket)}</span>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${CATEGORY_COLORS[ticket.category] ?? CATEGORY_COLORS["Other"]}`}>
              {ticket.category}
            </Badge>
            <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
              {ticket.message}
            </p>
            {ticket.resolvedAt && (
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {format(new Date(ticket.resolvedAt), "MMM d")}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ReviewerPortal() {
  const { data: tickets, isLoading: loadingTickets } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"],
  });

  const openTickets = useMemo(() => (tickets || []).filter((t: any) => t.status === "open"), [tickets]);
  const completedTickets = useMemo(() => (tickets || []).filter((t: any) => t.status === "completed"), [tickets]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8 animate-in">
        <div>
          <h1 className="text-3xl font-bold font-display">Reviewer Portal</h1>
          <p className="text-muted-foreground mt-1">Manage support tickets from users</p>
        </div>

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1 rounded-xl">
            <TabsTrigger value="open" className="flex items-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg data-[state=active]:shadow-md" data-testid="tab-open">
              <AlertCircle className="w-4 h-4" />
              Open
              {openTickets.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid="open-tickets-count">
                  {openTickets.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg data-[state=active]:shadow-md" data-testid="tab-completed">
              <CheckCircle2 className="w-4 h-4" />
              Completed
              {completedTickets.length > 0 && (
                <Badge variant="outline" className="ml-auto text-xs" data-testid="completed-tickets-count">
                  {completedTickets.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-6">
            {loadingTickets ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : openTickets.length > 0 ? (
              <div className="grid gap-2">
                {openTickets.map((ticket: any) => (
                  <OpenTicketRow key={ticket.id} ticket={ticket} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed border-border">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-medium">All clear!</h3>
                <p className="text-muted-foreground mt-2">No open support tickets right now.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {loadingTickets ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : completedTickets.length > 0 ? (
              <div className="grid gap-2">
                {completedTickets.map((ticket: any) => (
                  <CompletedTicketRow key={ticket.id} ticket={ticket} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed border-border">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-medium">No resolved tickets yet</h3>
                <p className="text-muted-foreground mt-2">Completed tickets will appear here.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
