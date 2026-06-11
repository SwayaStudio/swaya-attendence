"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2 } from "lucide-react";

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    startTime: "09:30",
    endTime: "18:30",
    graceMinutes: 10,
    minimumWorkMinutes: 480,
    isNightShift: false,
  });

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
          <div className="grid grid-cols-6 gap-3 items-end">
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
          <table className="w-full text-sm">
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
                    <Button variant="ghost" size="icon" onClick={() => remove(s._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No shifts yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}