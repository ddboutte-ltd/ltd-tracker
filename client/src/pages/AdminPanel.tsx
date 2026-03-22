import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users, DollarSign, RefreshCw } from "lucide-react";

interface Subscriber {
  id: number;
  name: string;
  email: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

function statusBadge(status: string | null) {
  const s = status || "inactive";
  const map: Record<string, string> = {
    active: "bg-green-500",
    trialing: "bg-blue-500",
    past_due: "bg-yellow-500",
    canceled: "bg-red-500",
    inactive: "bg-gray-400",
  };
  return <Badge className={`${map[s] || "bg-gray-400"} hover:${map[s]} text-white capitalize`}>{s.replace("_", " ")}</Badge>;
}

export default function AdminPanel() {
  const { toast } = useToast();

  const { data: subscribers = [], isLoading, refetch } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/subscribers/${id}`, { subscriptionStatus: "active" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
      toast({ title: "Subscriber activated" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/subscribers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
      toast({ title: "Subscription canceled" });
    },
  });

  const activeCount = subscribers.filter(s => ["active", "trialing"].includes(s.subscriptionStatus || "")).length;
  const mrr = subscribers.filter(s => s.subscriptionStatus === "active").length * 9.99;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Subscriber Admin</h1>
        <p className="text-sm text-muted-foreground">Manage all MindYourBiz subscribers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Total Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{subscribers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">${mrr.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriber Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Subscribers</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : subscribers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No subscribers yet. Share your signup link to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trial Ends</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((s) => (
                    <TableRow key={s.id} data-testid={`row-subscriber-${s.id}`}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.email}</TableCell>
                      <TableCell>{statusBadge(s.subscriptionStatus)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {s.subscriptionStatus !== "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={() => activateMutation.mutate(s.id)}
                              disabled={activateMutation.isPending}
                              data-testid={`button-activate-${s.id}`}
                            >
                              Activate
                            </Button>
                          )}
                          {s.subscriptionStatus !== "canceled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => cancelMutation.mutate(s.id)}
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-${s.id}`}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Signup link to share with clients:</strong>{" "}
            <a href="/#/register" className="text-primary underline" target="_blank">
              {window.location.origin}/#/register
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
