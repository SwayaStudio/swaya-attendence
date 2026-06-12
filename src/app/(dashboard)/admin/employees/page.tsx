"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Plus, Pencil, Trash2 } from "lucide-react";

const emptyDraft = {
  fullName: "",
  email: "",
  password: "password123",
  phone: "",
  employeeCode: "",
  department: "",
  designation: "",
  role: "employee",
  siteIds: [] as string[],
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // null = creating; otherwise the id of the employee being edited.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(emptyDraft);

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

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  }

  async function openEdit(e: any) {
    setEditingId(e.id);
    setDraft({
      fullName: e.fullName || "",
      email: e.email || "",
      password: "",
      phone: e.phone || "",
      employeeCode: e.employeeCode || "",
      department: e.department || "",
      designation: e.designation || "",
      role: e.role || "employee",
      siteIds: [],
    });
    setOpen(true);
    // Pre-fill the site selector with the employee's current assignment so the
    // admin can see and change where they're posted.
    try {
      const r = await fetch(`/api/assignments?employeeId=${e.id}`);
      const j = await r.json();
      if (j.ok) {
        const siteIds = (j.data.assignments || []).map((a: any) => String(a.siteId));
        setDraft((d: any) => ({ ...d, siteIds }));
      }
    } catch {
      /* ignore — selector just starts empty */
    }
  }

  async function save() {
    setLoading(true);
    try {
      if (editingId) {
        // 1) Update the profile fields (PATCH doesn't touch email/password/sites).
        const res = await fetch(`/api/admin/employees/${editingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: draft.fullName,
            phone: draft.phone,
            employeeCode: draft.employeeCode,
            department: draft.department,
            designation: draft.designation,
            role: draft.role,
          }),
        });
        const json = await res.json();
        if (!json.ok) {
          toast({ title: "Failed", description: json.error, variant: "destructive" });
          return;
        }
        // 2) Reassign work site(s). This replaces the current assignment.
        const ares = await fetch("/api/assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ employeeId: editingId, siteIds: draft.siteIds }),
        });
        const ajson = await ares.json();
        if (!ajson.ok) {
          toast({
            title: "Profile saved, but site update failed",
            description: ajson.error,
            variant: "destructive",
          });
        } else {
          toast({ title: "Employee updated" });
        }
      } else {
        const res = await fetch("/api/admin/employees", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const json = await res.json();
        if (!json.ok) {
          toast({ title: "Failed", description: json.error, variant: "destructive" });
          return;
        }
        toast({ title: "Employee created" });
      }
      setOpen(false);
      setEditingId(null);
      setDraft(emptyDraft);
      load();
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(e: any) {
    const res = await fetch(`/api/admin/employees/${e.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !e.isActive }),
    });
    const json = await res.json();
    if (json.ok) {
      toast({ title: e.isActive ? "Marked inactive" : "Marked active" });
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  async function remove(e: any) {
    if (
      !confirm(
        `Permanently delete ${e.fullName}?\n\nThis erases the employee AND all of their attendance data (sessions, history, GPS pings, schedules, assignments) from the database. This cannot be undone.`
      )
    )
      return;
    const res = await fetch(`/api/admin/employees/${e.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      toast({ title: "Employee deleted" });
      load();
    } else {
      toast({ title: "Delete failed", description: json.error, variant: "destructive" });
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
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditingId(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> New employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit employee" : "New employee"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update this team member's profile and role."
                  : "Add a new team member and assign them to work sites."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Full name</Label>
                <Input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={draft.email}
                  disabled={!!editingId}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              {!editingId && (
                <div>
                  <Label>Password</Label>
                  <Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
                </div>
              )}
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
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>{editingId ? "Work site assignment" : "Assign to sites"}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
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
                  {sites.length === 0 && (
                    <p className="text-sm text-muted-foreground">No sites yet — create one first.</p>
                  )}
                </div>
                {editingId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Changing this reassigns the employee&apos;s work site. The first
                    selected site is their primary site.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={loading || !draft.fullName || (!editingId && !draft.email)}>
                {loading ? "Saving…" : editingId ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
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
                    <button
                      type="button"
                      onClick={() => toggleActive(e)}
                      title="Click to toggle active/inactive"
                    >
                      <Badge variant={e.isActive ? "success" : "secondary"} className="cursor-pointer">
                        {e.isActive ? "active" : "inactive"}
                      </Badge>
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)} aria-label="Edit employee">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(e)} aria-label="Delete employee">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {employees.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">No employees yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
