import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { PlusCircle, Pencil, Trash2, ArrowRight, Users } from "lucide-react";
import type { Client } from "@shared/schema";

const defaultForm = {
  name: "", businessName: "", email: "", phone: "", ein: "",
  bookkeeperEmail: "d.d.boutte@theltdgroupllc.com"
};

export default function ClientSetup() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const createMutation = useMutation({
    mutationFn: (data: typeof defaultForm) => apiRequest("POST", "/api/clients", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client added" });
      setOpen(false);
      setForm(defaultForm);
    },
    onError: () => toast({ title: "Error", description: "Failed to add client", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof defaultForm }) =>
      apiRequest("PATCH", `/api/clients/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
      setEditClient(null);
      setOpen(false);
      setForm(defaultForm);
    },
    onError: () => toast({ title: "Error", description: "Failed to update client", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client removed" });
    },
  });

  function openEdit(client: Client) {
    setEditClient(client);
    setForm({
      name: client.name,
      businessName: client.businessName,
      email: client.email,
      phone: client.phone ?? "",
      ein: client.ein ?? "",
      bookkeeperEmail: client.bookkeeperEmail,
    });
    setOpen(true);
  }

  function openNew() {
    setEditClient(null);
    setForm(defaultForm);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editClient) {
      updateMutation.mutate({ id: editClient.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{fontFamily:"'DM Serif Display',serif"}}>Clients</h1>
          <p className="text-sm text-muted-foreground">Manage your sole proprietor &amp; self-employed clients.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={openNew} data-testid="button-add-client">
              <PlusCircle size={14}/>Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editClient ? "Edit Client" : "New Client"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Owner Name *</Label>
                  <Input id="name" data-testid="input-name" required value={form.name}
                    onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder="Jane Smith"/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input id="businessName" data-testid="input-businessName" required value={form.businessName}
                    onChange={e => setForm(f => ({...f, businessName: e.target.value}))}
                    placeholder="Jane's Consulting LLC"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Client Email *</Label>
                <Input id="email" data-testid="input-email" type="email" required value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  placeholder="jane@example.com"/>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" data-testid="input-phone" value={form.phone}
                    onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    placeholder="(555) 000-0000"/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ein">EIN / SSN last 4</Label>
                  <Input id="ein" data-testid="input-ein" value={form.ein}
                    onChange={e => setForm(f => ({...f, ein: e.target.value}))}
                    placeholder="XX-XXXXXXX"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookkeeperEmail">Bookkeeper Email</Label>
                <Input id="bookkeeperEmail" data-testid="input-bookkeeperEmail" type="email" value={form.bookkeeperEmail}
                  onChange={e => setForm(f => ({...f, bookkeeperEmail: e.target.value}))}/>
                <p className="text-xs text-muted-foreground">Monthly summaries will be sent here.</p>
              </div>
              <Button type="submit" className="w-full" data-testid="button-submit-client"
                disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (editClient ? "Save Changes" : "Add Client")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse"/>)}</div>}

      {!isLoading && (!clients || clients.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Users size={36} className="text-muted-foreground opacity-40"/>
            <p className="text-muted-foreground text-sm">No clients yet. Add your first client to get started.</p>
          </CardContent>
        </Card>
      )}

      {clients && clients.length > 0 && (
        <div className="space-y-3">
          {clients.map(client => (
            <Card key={client.id} data-testid={`card-client-${client.id}`}>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-sm">{client.businessName}</p>
                  <p className="text-xs text-muted-foreground">{client.name} · {client.email}</p>
                  {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                  {client.ein && <p className="text-xs text-muted-foreground">EIN: {client.ein}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/clients/${client.id}/entries`}>
                    <Button variant="default" size="sm" className="gap-1.5 text-xs" data-testid={`button-open-${client.id}`}>
                      Open Tracker <ArrowRight size={12}/>
                    </Button>
                  </Link>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}
                    data-testid={`button-edit-${client.id}`}>
                    <Pencil size={13}/>
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => { if(confirm("Delete this client?")) deleteMutation.mutate(client.id); }}
                    data-testid={`button-delete-${client.id}`}>
                    <Trash2 size={13}/>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
