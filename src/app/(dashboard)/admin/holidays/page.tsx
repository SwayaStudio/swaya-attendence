"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2 } from "lucide-react";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

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
          <div className="grid grid-cols-3 gap-3 items-end">
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
          <table className="w-full text-sm">
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
                    <Button variant="ghost" size="icon" onClick={() => remove(h._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No holidays yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}