"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { Save } from "lucide-react";

type Row = { employeeId: string; siteId: string; shiftTemplateId: string; isWorkingDay: boolean };

export default function SchedulesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/employees").then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
      fetch("/api/shifts").then((r) => r.json()),
    ]).then(([e, s, sh]: any[]) => {
      if (e.ok) setEmployees(e.data.employees || []);
      if (s.ok) setSites(s.data.sites || []);
      if (sh.ok) setShifts(sh.data.shifts || []);
    });
  }, []);

  function setRow(employeeId: string, partial: Partial<Row>) {
    setRows((r) => ({
      ...r,
      [employeeId]: {
        employeeId,
        siteId: r[employeeId]?.siteId || sites[0]?._id || "",
        shiftTemplateId: r[employeeId]?.shiftTemplateId || shifts[0]?._id || "",
        isWorkingDay: r[employeeId]?.isWorkingDay ?? true,
        ...partial,
      },
    }));
  }

  async function saveAll() {
    setLoading(true);
    const entries = Object.values(rows).filter((r) => r.siteId && r.shiftTemplateId);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workDate, entries }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      toast({ title: `Saved ${entries.length} schedule entries` });
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schedules</h1>
      <Card>
        <CardHeader>
          <CardTitle>Build schedule for a date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Work date</Label>
            <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            {employees.map((e) => {
              const r = rows[e.id] || {
                siteId: sites[0]?._id || "",
                shiftTemplateId: shifts[0]?._id || "",
                isWorkingDay: true,
              };
              return (
                <div key={e.id} className="grid grid-cols-5 gap-2 items-center border-b pb-2">
                  <div className="font-medium">{e.fullName}</div>
                  <select
                    className="border rounded-md px-2 py-1 text-sm"
                    value={r.siteId}
                    onChange={(ev) => setRow(e.id, { siteId: ev.target.value })}
                  >
                    <option value="">Select site</option>
                    {sites.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <select
                    className="border rounded-md px-2 py-1 text-sm"
                    value={r.shiftTemplateId}
                    onChange={(ev) => setRow(e.id, { shiftTemplateId: ev.target.value })}
                  >
                    <option value="">Select shift</option>
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.startTime}-{s.endTime})</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={r.isWorkingDay}
                      onChange={(ev) => setRow(e.id, { isWorkingDay: ev.target.checked })}
                    />
                    Working day
                  </label>
                  <Button size="sm" onClick={() => setRow(e.id, {})}>
                    Add
                  </Button>
                </div>
              );
            })}
            {employees.length === 0 && <p className="text-muted-foreground text-sm">No employees yet.</p>}
          </div>

          <Button onClick={saveAll} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Saving…" : "Save schedule"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}