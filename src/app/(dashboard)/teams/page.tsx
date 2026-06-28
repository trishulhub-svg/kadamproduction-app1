// src/app/(dashboard)/teams/page.tsx
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { TeamsView } from "@/components/teams/TeamsView";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  let data: (typeof schema.teams.$inferSelect & { members: { userId: number; name: string }[] })[] = [];
  let employees: { id: number; name: string }[] = [];
  try {
    const [teams, allMembers, emps] = await Promise.all([
      db.select().from(schema.teams).where(isNull(schema.teams.deletedAt)),
      db.select().from(schema.teamMembers),
      db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(and(eq(schema.users.role, "employee"), isNull(schema.users.deletedAt))),
    ]);
    employees = emps;
    data = teams.map((t) => ({
      ...t,
      members: allMembers.filter((m) => m.teamId === t.id).map((m) => ({ userId: m.userId, name: employees.find((e) => e.id === m.userId)?.name ?? "Unknown" })),
    }));
  } catch {
    // use empty defaults
  }

  return <TeamsView teams={data} employees={employees} />;
}
