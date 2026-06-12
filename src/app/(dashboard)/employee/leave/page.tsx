"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

const LEAVE_TYPES = ["casual", "sick", "paid", "unpaid", "other"];

export default function LeavePage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r = await fetch("/api/leave");
    const j = await r.json();
    if (j.ok) setLeaves(j.data.leaves || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function submit() {
    if (!startDate || !endDate) {
      toast({ title: "Pick a start and end date", variant: "destructive" });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leaveType, startDate, endDate, reason: reason || undefined }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      toast({ title: "Leave request submitted" });
      setReason("");
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const json = await res.json();
    if (json.ok) {
      toast({ title: "Leave cancelled" });
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leave</h1>

      <Card>
        <CardHeader>
          <CardTitle>Apply for leave</CardTitle>
          <CardDescription>
            Once approved, you won&apos;t need to check in on the leave dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave…" />
          </div>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Submitting…" : "Submit request"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My leave requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="text-muted-foreground text-sm">No leave requests yet.</p>
          ) : (
            <div className="space-y-3">
              {leaves.map((l) => (
                <div key={l._id} className="flex items-center justify-between gap-2 border-b pb-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.leaveType} — {l.startDate} → {l.endDate}
                    </p>
                    {l.reason && <p className="text-sm text-muted-foreground truncate">{l.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        l.status === "approved"
                          ? "success"
                          : l.status === "rejected"
                          ? "destructive"
                          : l.status === "cancelled"
                          ? "secondary"
                          : "warning"
                      }
                    >
                      {l.status}
                    </Badge>
                    {l.status === "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => cancel(l._id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
