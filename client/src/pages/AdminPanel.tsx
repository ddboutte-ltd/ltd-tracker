import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users, DollarSign, RefreshCw, Search, Phone, Mail, Calendar, CreditCard } from "lucide-react";
import type { Client } from "@shared/schema";

interface Subscriber {
  id: number;
  name: string;
  email: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  clientId: number | null;
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
  return (
    <Badge className={`${map[s] || "bg-gray-400"} hover:${map[s]} text-white capitalize text-xs`}>
      {s.replace("_", " ")}
    </Badge>
  );
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: subscribers = [], isLoading: subLoading, refetch } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  const { data: allClients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
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
  const trialCount = subscribers.filter(s => s.subscriptionStatus === "trialing").length;
  const mrr = subscribers.filter(s => s.subscriptionStatus === "active").length * 9.99;

  const filteredSubs = subscribers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  // Build a map from clientId -> client record for quick lookup
  const clientMap = new Map<number, Client>(allClients.map(c => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">Manage subscribers and client records</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="w-4 h-4" /> Total
            </div>
            <p className="text-2xl font-bold">{subscribers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="w-4 h-4" /> Active
            </div>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Calendar className="w-4 h-4" /> On Trial
            </div>
            <p className="text-2xl font-bold text-blue-600">{trialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="w-4 h-4" /> MRR
            </div>
            <p className="text-2xl font-bold text-primary">${mrr.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Subscribers | Client Details */}
      <Tabs defaultValue="subscribers">
        <TabsList className="mb-4">
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="clients">Client Details</TabsTrigger>
        </TabsList>

        {/* ---- SUBSCRIBERS TAB ---- */}
        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base">All Subscribers</CardTitle>
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {subLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : filteredSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search ? "No results found." : "No subscribers yet. Share your signup link to get started."}
                </p>
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
                      {filteredSubs.map((s) => (
                        <TableRow key={s.id} data-testid={`row-subscriber-${s.id}`}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <a href={`mailto:${s.email}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                              <Mail className="w-3 h-3" />{s.email}
                            </a>
                          </TableCell>
                          <TableCell>{statusBadge(s.subscriptionStatus)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(s.trialEndsAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(s.currentPeriodEnd)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(s.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {s.subscriptionStatus !== "active" && (
                                <Button size="sm" variant="outline"
                                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950 text-xs h-7"
                                  onClick={() => activateMutation.mutate(s.id)}
                                  disabled={activateMutation.isPending}
                                  data-testid={`button-activate-${s.id}`}
                                >Activate</Button>
                              )}
                              {s.subscriptionStatus !== "canceled" && (
                                <Button size="sm" variant="outline"
                                  className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-xs h-7"
                                  onClick={() => cancelMutation.mutate(s.id)}
                                  disabled={cancelMutation.isPending}
                                  data-testid={`button-cancel-${s.id}`}
                                >Cancel</Button>
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

          <Card className="bg-muted/40 mt-4">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Signup link to share with clients:</strong>{" "}
                <a href="/#/register" className="text-primary underline" target="_blank">
                  {window.location.origin}/#/register
                </a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- CLIENT DETAILS TAB ---- */}
        <TabsContent value="clients">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Client Database</CardTitle>
              <p className="text-xs text-muted-foreground">All registered client profiles with contact info</p>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : allClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No client records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>EIN / SSN-4</TableHead>
                        <TableHead>Subscription</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allClients.map((c) => {
                        // Find the subscriber linked to this client
                        const sub = subscribers.find(s => s.clientId === c.id);
                        return (
                          <TableRow key={c.id} data-testid={`row-client-${c.id}`}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.businessName}</TableCell>
                            <TableCell>
                              <a href={`mailto:${c.email}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                                <Mail className="w-3 h-3" />{c.email}
                              </a>
                            </TableCell>
                            <TableCell>
                              {c.phone ? (
                                <a href={`tel:${c.phone}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                                  <Phone className="w-3 h-3" />{c.phone}
                                </a>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {c.ein || "—"}
                            </TableCell>
                            <TableCell>
                              {sub ? statusBadge(sub.subscriptionStatus) : (
                                <Badge className="bg-gray-400 hover:bg-gray-400 text-white text-xs">No Account</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
