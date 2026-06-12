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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch("/api/holidays");
    const j = await r.json();
    if (j.ok) setHolidays(j.data.holidays || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, holidayDate: date }),
    });
    const j = await res.json();
    if (j.ok) {
      toast({ title: "Holiday added" });
      setName("");
      setDate("");
      load();
    } else {
      toast({ title: "Failed", description: j.error, variant: "destructive" });
    }
  }

  function openEdit(h: any) {
    setEditingId(h._id);
    setEditName(h.name);
    setEditDate(h.holidayDate);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/holidays/${editingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: editName, holidayDate: editDate }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.ok) {
      toast({ title: "Holiday updated" });
      setEditOpen(false);
      setEditingId(null);
      load();
    } else {
      toast({ title: "Failed", description: j.error, variant: "destructive" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    const r = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Holidays</h1>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Independence Day" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button onClick={add} disabled={!name || !date}><Plus className="h-4 w-4 mr-2" />Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Date</th>
                <th className="p-3">Name</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h._id} className="border-b">
                  <td className="p-3">{h.holidayDate}</td>
                  <td className="p-3 font-medium">{h.name}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(h)} aria-label="Edit holiday">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(h._id)} aria-label="Delete holiday">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No holidays yet</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit holiday</DialogTitle>
            <DialogDescription>Update the holiday name or date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editName || !editDate}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
