import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, LogOut, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DueBadge, Empty, Loading, PageHeader, Panel } from "@/components/dash/common";
import { TaskDialog, type TaskDraft } from "@/components/dash/TaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { qk, useGroupMembers, useGroups, useTaskMutations, useTasks, type StudyGroup } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/grupos")({
  head: () => ({ meta: [{ title: "Grupos · Brújula" }, { name: "description", content: "Grupos de trabajo con tareas compartidas." }] }),
  component: GroupsPage,
});

function useGroupActions() {
  const qc = useQueryClient();
  const refresh = () => [qk.groups, qk.members, qk.tasks].forEach((k) => qc.invalidateQueries({ queryKey: k }));
  const onError = (e: Error) => toast.error(e.message);
  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("study_groups").insert({ name });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError,
  });
  const join = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc("join_group", { code });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { refresh(); toast.success("Te has unido al grupo"); },
    onError,
  });
  const leave = useMutation({
    mutationFn: async ({ group, userId }: { group: StudyGroup; userId: string }) => {
      const { error } = group.owner_id === userId
        ? await supabase.from("study_groups").delete().eq("id", group.id)
        : await supabase.from("group_members").delete().eq("group_id", group.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError,
  });
  return { create, join, leave };
}

function GroupsPage() {
  const { user } = Route.useRouteContext();
  const { data: groups = [], isLoading } = useGroups();
  const { create, join } = useGroupActions();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="space-y-6">
      <PageHeader title="Grupos" description="Trabajos en grupo: comparte tareas y fechas con tus compañeros." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Crear grupo">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(name.trim(), { onSuccess: () => setName("") }); }}>
            <Input placeholder="p. ej. Proyecto de Redes" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" disabled={create.isPending}><Plus className="h-4 w-4" /> Crear</Button>
          </form>
        </Panel>
        <Panel title="Unirme con un código">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) join.mutate(code.trim(), { onSuccess: () => setCode("") }); }}>
            <Input placeholder="Código de invitación" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
            <Button type="submit" variant="outline" disabled={join.isPending}>Unirme</Button>
          </form>
        </Panel>
      </div>
      {isLoading ? <Loading /> : groups.length === 0 ? (
        <Panel><Empty icon={Users} title="Aún no estás en ningún grupo">Crea uno y comparte el código con tu equipo.</Empty></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{groups.map((g) => <GroupCard key={g.id} group={g} userId={user.id} />)}</div>
      )}
    </div>
  );
}

function GroupCard({ group, userId }: { group: StudyGroup; userId: string }) {
  const { data: members = [] } = useGroupMembers();
  const { data: tasks = [] } = useTasks();
  const { toggle } = useTaskMutations();
  const { leave } = useGroupActions();
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const mine = members.filter((m) => m.group_id === group.id);
  const shared = tasks.filter((t) => t.group_id === group.id && !t.parent_id);
  const owner = group.owner_id === userId;
  return (
    <Panel
      title={group.name}
      action={
        <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => confirm(owner ? "¿Eliminar el grupo para todos?" : "¿Salir del grupo?") && leave.mutate({ group, userId })}>
          {owner ? <Trash2 className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />} {owner ? "Eliminar" : "Salir"}
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Código:</span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{group.invite_code}</code>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Copiar código" onClick={() => navigator.clipboard.writeText(group.invite_code).then(() => toast.success("Código copiado"))}><Copy className="h-3 w-3" /></Button>
        <span className="ml-auto text-muted-foreground">{mine.map((m) => m.display_name || "Sin nombre").join(", ")}</span>
      </div>
      {shared.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Sin tareas compartidas todavía.</p> : (
        <ul className="divide-y">
          {shared.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 py-2">
              <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle.mutate(t)} aria-label="Completar" />
              <button className={cn("min-w-0 flex-1 truncate text-left text-sm", t.status === "done" && "text-muted-foreground line-through")} onClick={() => setDraft(t)}>{t.title}</button>
              {t.due_date && <DueBadge date={new Date(t.due_date + "T00:00")} done={t.status === "done"} />}
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setDraft({ group_id: group.id })}><Plus className="h-4 w-4" /> Tarea compartida</Button>
      <TaskDialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)} initial={draft} />
    </Panel>
  );
}
