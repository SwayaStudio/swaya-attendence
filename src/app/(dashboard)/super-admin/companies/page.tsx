"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { Plus } from "lucide-react";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", timezone: "Asia/Kolkata" });

  const load = async () => {
    const r = await fetch("/api/admin/companies");
    const j = await r.json();
    if (j.ok) setCompanies(j.data.companies || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function create() {
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const j = await res.json();
    if (j.ok) {
      toast({ title: "Company created" });
      setOpen(false);
      setDraft({ name: "", timezone: "Asia/Kolkata" });
      load();
    } else {
      toast({ title: "Failed", description: j.error, variant: "destructive" });
    }
  }

  async function toggleActive(c: any) {
    const r = await fetch(`/api/admin/companies?id=${c._id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (r.ok) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New company</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New company</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Timezone</Label>
                <Input value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={!draft.name}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Users</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c._id} className="border-b">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-muted-foreground">{c.timezone}</td>
                  <td className="p-3">{c.userCount}</td>
                  <td className="p-3">
                    <Badge variant={c.isActive ? "success" : "secondary"}>
                      {c.isActive ? "active" : "inactive"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Suspend" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No companies</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}