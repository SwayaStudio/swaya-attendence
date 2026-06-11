"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2 } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<any>({
    fullName: "",
    email: "",
    password: "password123",
    phone: "",
    employeeCode: "",
    department: "",
    designation: "",
    role: "employee",
    siteIds: [] as string[],
  });

  const load = async () => {
    const [a, b] = await Promise.all([
      fetch("/api/admin/employees").then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
    ]);
    if (a.ok) setEmployees(a.data.employees || []);
    if (b.ok) setSites(b.data.sites || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      toast({ title: "Employee created" });
      setOpen(false);
      setDraft({
        fullName: "",
        email: "",
        password: "password123",
        phone: "",
        employeeCode: "",
        department: "",
        designation: "",
        role: "employee",
        siteIds: [],
      });
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this employee?")) return;
    const res = await fetch(`/api/admin/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deactivated" });
      load();
    }
  }

  function toggleSite(siteId: string) {
    setDraft((d: any) => ({
      ...d,
      siteIds: d.siteIds.includes(siteId)
        ? d.siteIds.filter((s: string) => s !== siteId)
        : [...d.siteIds, siteId],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New employee</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full name</Label>
                <Input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div>
                <Label>Password</Label>
                <Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div>
                <Label>Employee code</Label>
                <Input value={draft.employeeCode} onChange={(e) => setDraft({ ...draft, employeeCode: e.target.value })} />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Assign to sites</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {sites.map((s) => (
                    <label key={s._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.siteIds.includes(s._id)}
                        onChange={() => toggleSite(s._id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={loading || !draft.fullName || !draft.email}>
                {loading ? "Saving…" : "Create"}
              </Button>
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
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Code</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3 font-medium">{e.fullName}</td>
                  <td className="p-3 text-muted-foreground">{e.email}</td>
                  <td className="p-3">{e.role}</td>
                  <td className="p-3 text-muted-foreground">{e.employeeCode || "—"}</td>
                  <td className="p-3">
                    <Badge variant={e.isActive ? "success" : "secondary"}>
                      {e.isActive ? "active" : "inactive"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => deactivate(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">No employees yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}