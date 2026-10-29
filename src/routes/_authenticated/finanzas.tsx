import { createFileRoute } from "@tanstack/react-router";
import { addMonths, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Repeat, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, Loading, PageHeader, Panel } from "@/components/dash/common";
import { qk, useCrud, useTransactions, type Transaction } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({ meta: [{ title: "Finanzas · Brújula" }, { name: "description", content: "Ingresos, gastos, becas y suscripciones." }] }),
  component: FinancePage,
});

const EXPENSE_CATS = ["comida", "transporte", "alquiler", "material", "matrícula", "ocio", "suscripciones", "salud", "otros"];
const INCOME_CATS = ["beca", "trabajo", "familia", "otros"];
const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Monthly view: recurring items count in every month from their start date. */
function monthItems(list: Transaction[], month: string) {
  return list.filter((t) => t.date.slice(0, 7) === month || (t.recurring && t.date.slice(0, 7) <= month));
}

function FinancePage() {
  const { data: list = [], isLoading } = useTransactions();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const items = monthItems(list, month);
  const income = items.filter((t) => Number(t.amount) > 0).reduce((n, t) => n + Number(t.amount), 0);
  const expenses = items.filter((t) => Number(t.amount) < 0).reduce((n, t) => n - Number(t.amount), 0);
  const recurring = list.filter((t) => t.recurring && Number(t.amount) < 0);
  const byCat = new Map<string, number>();
  for (const t of items) if (Number(t.amount) < 0) byCat.set(t.category, (byCat.get(t.category) ?? 0) - Number(t.amount));
  const cats = [...byCat].sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 1;
  const shift = (n: number) => setMonth(format(addMonths(parseISO(month + "-01"), n), "yyyy-MM"));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Controla becas, gastos y suscripciones del curso."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="w-32 text-center text-sm font-medium capitalize">{format(parseISO(month + "-01"), "MMMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Ingresos</p><p className="mt-1 text-2xl font-semibold tabular-nums text-success">{eur(income)}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Gastos</p><p className="mt-1 text-2xl font-semibold tabular-nums">{eur(expenses)}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Balance</p><p className={cn("mt-1 text-2xl font-semibold tabular-nums", income - expenses < 0 ? "text-destructive" : "")}>{eur(income - expenses)}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AddTransaction />
          <Panel title="Movimientos del mes" className="[&>div]:p-0">
            {isLoading ? <Loading /> : items.length === 0 ? <Empty icon={Wallet} title="Sin movimientos este mes" /> : (
              <ul className="divide-y">
                {items.map((t) => <Row key={t.id} t={t} month={month} />)}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Gasto por categoría">
            {cats.length === 0 ? <p className="text-sm text-muted-foreground">Sin gastos este mes.</p> : (
              <div className="space-y-2">
                {cats.map(([c, v]) => (
                  <div key={c} className="text-xs">
                    <div className="mb-0.5 flex justify-between"><span className="capitalize">{c}</span><span className="tabular-nums text-muted-foreground">{eur(v)}</span></div>
                    <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v / maxCat) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Gastos fijos y suscripciones">
            {recurring.length === 0 ? <p className="text-sm text-muted-foreground">Marca un gasto como mensual para verlo aquí.</p> : (
              <>
                <ul className="space-y-1 text-sm">
                  {recurring.map((t) => <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.description || t.category}</span><span className="tabular-nums">{eur(-Number(t.amount))}</span></li>)}
                </ul>
                <p className="mt-2 flex justify-between border-t pt-2 text-sm font-medium"><span>Al mes</span><span className="tabular-nums">{eur(recurring.reduce((n, t) => n - Number(t.amount), 0))}</span></p>
                <p className="text-xs text-muted-foreground">Al año: {eur(recurring.reduce((n, t) => n - Number(t.amount), 0) * 12)}</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ t, month }: { t: Transaction; month: string }) {
  const { remove } = useCrud("transactions", qk.transactions);
  const amount = Number(t.amount);
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm">{t.description || <span className="capitalize">{t.category}</span>}{t.recurring && <Repeat className="h-3 w-3 text-muted-foreground" aria-label="Mensual" />}</p>
        <p className="text-xs capitalize text-muted-foreground">{t.category} · {t.recurring && t.date.slice(0, 7) !== month ? "mensual" : format(parseISO(t.date), "d MMM", { locale: es })}</p>
      </div>
      <span className={cn("tabular-nums text-sm font-medium", amount > 0 && "text-success")}>{amount > 0 ? "+" : ""}{eur(amount)}</span>
      <button onClick={() => confirm("¿Eliminar movimiento?") && remove.mutate(t.id)} className="text-muted-foreground opacity-0 group-hover:opacity-100" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
    </li>
  );
}

function AddTransaction() {
  const { save } = useCrud("transactions", qk.transactions);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("comida");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [recurring, setRecurring] = useState(false);
  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;
  return (
    <Panel title="Nuevo movimiento">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Math.abs(Number(amount.replace(",", ".")));
          if (!v) return;
          save.mutate(
            { amount: type === "expense" ? -v : v, category, description: description.trim() || null, date, recurring },
            { onSuccess: () => { setAmount(""); setDescription(""); setRecurring(false); } },
          );
        }}
      >
        <ToggleGroup type="single" size="sm" value={type} onValueChange={(v) => { if (v) { setType(v as "expense" | "income"); setCategory(v === "expense" ? "comida" : "beca"); } }} className="justify-start">
          <ToggleGroupItem value="expense">Gasto</ToggleGroupItem>
          <ToggleGroupItem value="income">Ingreso</ToggleGroupItem>
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input placeholder="Importe €" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>{cats.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Descripción" maxLength={120} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Switch id="rec" checked={recurring} onCheckedChange={setRecurring} /><Label htmlFor="rec" className="text-sm">Se repite cada mes</Label></div>
          <Button size="sm" type="submit" disabled={save.isPending}><Plus className="h-4 w-4" /> Añadir</Button>
        </div>
      </form>
    </Panel>
  );
}
