"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";

/**
 * Pending regularization + leave approvals. Used by both the admin and manager
 * dashboards. The API scopes the results by the caller's role (admins see the
 * whole company; managers see their team).
 */
export function ApprovalsPanel() {
  const [regs, setRegs] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  // Per-request reviewer notes, keyed by request id (a single shared field would
  // attach the same note to every row).
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const [r, l] = await Promise.all([
      fetch("/api/regularization?status=pending").then((r) => r.json()),
      fetch("/api/leave?status=pending").then((r) => r.json()),
    ]);
    if (r.ok) setRegs(r.data.requests || []);
    if (l.ok) setLeaves(l.data.leaves || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function review(id: string, status: "approved" | "rejected", kind: "reg" | "leave") {
    const url = kind === "reg" ? `/api/regularization/${id}` : `/api/leave/${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reviewerNote: notes[id] || undefined }),
    });
    const json = await res.json();
    if (json.ok) {
      toast({ title: `Marked ${status}` });
      setNotes((n) => {
        const copy = { ...n };
        delete copy[id];
        return copy;
      });
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Approvals</h1>

      <Tabs defaultValue="reg">
        <TabsList>
          <TabsTrigger value="reg">Regularization ({regs.length})</TabsTrigger>
          <TabsTrigger value="leave">Leave ({leaves.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reg">
          <Card>
            <CardHeader>
              <CardTitle>Pending regularization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {regs.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing pending.</p>
              ) : (
                regs.map((r) => (
                  <div key={r._id} className="border-b pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{r.requestType}</p>
                        <p className="text-sm text-muted-foreground">Reason: {r.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">Submitted: {formatDateTime(r.createdAt)}</p>
                      </div>
                      <Badge>{r.status}</Badge>
                    </div>
                    <div className="mt-2 space-y-2">
                      <Textarea
                        placeholder="Note (optional)"
                        value={notes[r._id] || ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [r._id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => review(r._id, "approved", "reg")}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => review(r._id, "rejected", "reg")}>Reject</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle>Pending leave</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaves.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing pending.</p>
              ) : (
                leaves.map((l) => (
                  <div key={l._id} className="border-b pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{l.leaveType} — {l.startDate} → {l.endDate}</p>
                        <p className="text-sm text-muted-foreground">{l.reason || "—"}</p>
                      </div>
                      <Badge>{l.status}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={() => review(l._id, "approved", "leave")}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => review(l._id, "rejected", "leave")}>Reject</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
