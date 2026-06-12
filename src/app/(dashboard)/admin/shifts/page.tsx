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

type ShiftDraft = {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  minimumWorkMinutes: number;
  isNightShift: boolean;
};

const emptyDraft: ShiftDraft = {
  name: "",
  startTime: "09:30",
  endTime: "18:30",
  graceMinutes: 10,
  minimumWorkMinutes: 480,
  isNightShift: false,
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [draft, setDraft] = useState<ShiftDraft>(emptyDraft);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ShiftDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch("/api/shifts");
    const j = await r.json();
    if (j.ok) setShifts(j.data.shifts || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json();
    if (json.ok) {
      toast({ title: "Shift created" });
      setDraft({ ...draft, name: "" });
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  function openEdit(s: any) {
    setEditingId(s._id);
    setEditDraft({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      graceMinutes: s.graceMinutes,
      minimumWorkMinutes: s.minimumWorkMinutes,
      isNightShift: !!s.isNightShift,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/shifts/${editingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editDraft),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      toast({ title: "Shift updated" });
      setEditOpen(false);
      setEditingId(null);
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Deactivate?")) return;
    const r = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shifts</h1>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Day shift" />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
            </div>
            <div>
              <Label>Grace (min)</Label>
              <Input type="number" value={draft.graceMinutes} onChange={(e) => setDraft({ ...draft, graceMinutes: parseInt(e.target.value) })} />
            </div>
            <Button onClick={add} disabled={!draft.name}><Plus className="h-4 w-4 mr-2" />Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Start</th>
                <th className="p-3">End</th>
                <th className="p-3">Grace</th>
                <th className="p-3">Night</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s._id} className="border-b">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.startTime}</td>
                  <td className="p-3">{s.endTime}</td>
                  <td className="p-3">{s.graceMinutes}m</td>
                  <td className="p-3">{s.isNightShift ? "Yes" : "No"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit shift">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(s._id)} aria-label="Delete shift">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No shifts yet</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit shift</DialogTitle>
            <DialogDescription>Update the shift timing and rules.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Name</Label>
              <Input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={editDraft.startTime} onChange={(e) => setEditDraft({ ...editDraft, startTime: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={editDraft.endTime} onChange={(e) => setEditDraft({ ...editDraft, endTime: e.target.value })} />
            </div>
            <div>
              <Label>Grace (min)</Label>
              <Input type="number" value={editDraft.graceMinutes} onChange={(e) => setEditDraft({ ...editDraft, graceMinutes: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>Min work (min)</Label>
              <Input type="number" value={editDraft.minimumWorkMinutes} onChange={(e) => setEditDraft({ ...editDraft, minimumWorkMinutes: parseInt(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={editDraft.isNightShift}
                onChange={(e) => setEditDraft({ ...editDraft, isNightShift: e.target.checked })}
              />
              Night shift
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editDraft.name}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
