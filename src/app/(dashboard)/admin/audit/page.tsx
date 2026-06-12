"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setLogs(j.data.logs || []);
      });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id} className="border-b">
                  <td className="p-3 text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                  <td className="p-3">{l.actorId ? String(l.actorId) : "—"}</td>
                  <td className="p-3 font-medium">{l.action}</td>
                  <td className="p-3 text-muted-foreground">{l.entityType} {l.entityId ? `· ${String(l.entityId)}` : ""}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No audit events yet</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}