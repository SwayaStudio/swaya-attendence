"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { Save, Trash2 } from "lucide-react";

type Row = { employeeId: string; siteId: string; shiftTemplateId: string; isWorkingDay: boolean };

export default function SchedulesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, Row>>({});
  // Existing saved schedules for the chosen date, keyed by employeeId.
  const [existing, setExisting] = useState<Record<string, any>>({});
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

  // Load existing schedules for the selected date and prefill the rows so the
  // admin can review, edit, or delete them.
  const loadSchedules = useCallback(async (date: string) => {
    const r = await fetch(`/api/schedules?from=${date}&to=${date}`);
    const j = await r.json();
    if (!j.ok) return;
    const byEmp: Record<string, any> = {};
    const prefilled: Record<string, Row> = {};
    for (const sc of j.data.schedules || []) {
      const empId = String(sc.employeeId);
      byEmp[empId] = sc;
      prefilled[empId] = {
        employeeId: empId,
        siteId: String(sc.siteId),
        shiftTemplateId: String(sc.shiftTemplateId),
        isWorkingDay: sc.isWorkingDay ?? true,
      };
    }
    setExisting(byEmp);
    setRows(prefilled);
  }, []);

  useEffect(() => {
    loadSchedules(workDate);
  }, [workDate, loadSchedules]);

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
      loadSchedules(workDate);
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  async function removeSchedule(employeeId: string) {
    const sc = existing[employeeId];
    if (!sc) return;
    if (!confirm("Delete this schedule entry?")) return;
    const r = await fetch(`/api/schedules/${sc._id}`, { method: "DELETE" });
    if (r.ok) {
      toast({ title: "Schedule deleted" });
      loadSchedules(workDate);
    } else {
      toast({ title: "Delete failed", variant: "destructive" });
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
              const isSaved = !!existing[e.id];
              return (
                <div key={e.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:items-center border-b pb-2">
                  <div className="font-medium lg:col-span-2 flex items-center gap-2">
                    {e.fullName}
                    {isSaved && <Badge variant="success">saved</Badge>}
                  </div>
                  <select
                    className="w-full border rounded-md px-2 py-1 text-sm"
                    value={r.siteId}
                    onChange={(ev) => setRow(e.id, { siteId: ev.target.value })}
                  >
                    <option value="">Select site</option>
                    {sites.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <select
                    className="w-full border rounded-md px-2 py-1 text-sm"
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
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isSaved}
                    onClick={() => removeSchedule(e.id)}
                    aria-label="Delete schedule"
                    className="justify-self-start"
                  >
                    <Trash2 className="h-4 w-4" />
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
