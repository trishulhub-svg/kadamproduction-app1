// src/components/employees/EmployeesView.tsx
"use client";
import { useState } from "react";
import { Button, Input, Label, Modal, Card, EmptyState } from "@/components/ui";
import { Fab } from "@/components/Fab";
import { createEmployee, resetPassword, deleteEmployee } from "@/server/employee-actions";

type Emp = { id: number; name: string; email: string; phone: string | null };

export function EmployeesView({ employees }: { employees: Emp[] }) {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-gray-900">Employees</h1>
      <Card className="overflow-hidden">
        {employees.length === 0 ? (
          <EmptyState title="No employees" hint="Use the + button to add one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                    <td className="px-4 py-3 text-gray-600">{e.email}</td>
                    <td className="px-4 py-3 text-gray-600">{e.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ResetBtn id={e.id} name={e.name} />
                        <DeleteBtn id={e.id} name={e.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Fab onClick={() => setAddOpen(true)} label="Add employee" />
      {addOpen && <AddModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const f = new FormData(e.currentTarget);
    try {
      await createEmployee({
        name: String(f.get("name")),
        email: String(f.get("email")),
        phone: String(f.get("phone") || ""),
        password: String(f.get("password")),
      });
      onClose();
    } catch (err) { alert((err as Error).message); setPending(false); }
  }
  return (
    <Modal open onClose={onClose} title="Add Employee">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Name *</Label><Input name="name" required /></div>
        <div><Label>Email *</Label><Input name="email" type="email" required /></div>
        <div><Label>Phone</Label><Input name="phone" /></div>
        <div><Label>Password *</Label><Input name="password" type="password" required minLength={6} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add"}</Button></div>
      </form>
    </Modal>
  );
}

function ResetBtn({ id, name }: { id: number; name: string }) {
  const [pending, setPending] = useState(false);
  async function run() {
    const pw = prompt(`Enter new password for ${name}:`);
    if (!pw || pw.length < 6) return;
    setPending(true);
    try { await resetPassword(id, pw); alert("Password updated."); } catch (e) { alert((e as Error).message); }
    setPending(false);
  }
  return <Button size="sm" variant="warning" onClick={run} disabled={pending}>{pending ? "…" : "Reset Password"}</Button>;
}

function DeleteBtn({ id, name }: { id: number; name: string }) {
  const [pending, setPending] = useState(false);
  return <Button size="sm" variant="danger" disabled={pending} onClick={async () => { if (confirm(`Remove ${name}?`)) { setPending(true); await deleteEmployee(id); } }}>{pending ? "…" : "Delete"}</Button>;
}
