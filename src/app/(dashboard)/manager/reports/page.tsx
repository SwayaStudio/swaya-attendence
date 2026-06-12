"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/utils";

export default function ManagerReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState<any[]>([]);

  async function load() {
    const r = await fetch(`/api/reports/attendance?from=${from}&to=${to}`);
    const j = await r.json();
    if (j.ok) setDays(j.data.rows || []);
  }
  useEffect(() => {
    load();
  }, []);

  function downloadCsv() {
    window.open(`/api/reports/attendance?from=${from}&to=${to}&format=csv`, "_blank");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team reports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={load}>Apply</Button>
              <Button variant="outline" onClick={downloadCsv}>Download CSV</Button>
            </div>
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
                <th className="p-3">Employee</th>
                <th className="p-3">Status</th>
                <th className="p-3">In</th>
                <th className="p-3">Out</th>
                <th className="p-3">Work</th>
                <th className="p-3">Outside</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d._id} className="border-b">
                  <td className="p-3">{d.workDate}</td>
                  <td className="p-3">{d.employeeName}</td>
                  <td className="p-3">{d.status}</td>
                  <td className="p-3">{d.firstCheckInAt ? formatDateTime(d.firstCheckInAt) : "—"}</td>
                  <td className="p-3">{d.lastCheckOutAt ? formatDateTime(d.lastCheckOutAt) : "—"}</td>
                  <td className="p-3">{formatDuration(d.totalWorkSeconds)}</td>
                  <td className="p-3">{formatDuration(d.totalOutsideSeconds)}</td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No records in range</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}