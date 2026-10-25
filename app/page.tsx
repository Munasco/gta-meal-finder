"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { Composer } from "@/components/meal/composer";
import type { GeoLocation } from "@/components/meal/location-map";
import { IntentStrip } from "@/components/meal/intent-strip";
import { OptionSheet } from "@/components/meal/option-sheet";
import { RestaurantCard } from "@/components/meal/restaurant-card";
import { DishList } from "@/components/meal/dish-list";
import { SettingsDialog, fetchCaptured, type CapturedSummary, type ProviderStatus } from "@/components/meal/settings-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FindResponse } from "@/app/api/find/route";
import type { BiomarkerLensId } from "@/lib/models";
import { BIOMARKER_LENS_LIST } from "@/lib/studies-and-lenses";
import type { MenuOption, RestaurantGroup } from "@/lib/uber-eats";
import { LENS_META } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

type View = "find" | "lenses" | "developer";

/** Developer tools (API page, Connections dialog) are hidden for now; flip to true to bring them back. */
const SHOW_DEVELOPER = false;

const NAV: { id: View; icon: string; label: string }[] = [
  { id: "find", icon: "lucide:search", label: "Find" },
  { id: "lenses", icon: "lucide:heart-pulse", label: "Lenses" },
  ...(SHOW_DEVELOPER ? [{ id: "developer" as View, icon: "lucide:code", label: "API" }] : []),
];

const STORAGE_KEY = "gta-meal-finder:v4";

type SortKey = "match" | "health" | "price" | "distance" | "calories";
const SORTS: { id: SortKey; icon: string; label: string }[] = [
  { id: "match", icon: "lucide:sparkles", label: "Best match" },
  { id: "health", icon: "lucide:leaf", label: "Healthiest" },
  { id: "price", icon: "lucide:wallet", label: "Cheapest" },
  { id: "distance", icon: "lucide:navigation", label: "Nearest" },
  { id: "calories", icon: "lucide:flame", label: "Fewest calories" },
];

function sortGroups(groups: RestaurantGroup[], key: SortKey): RestaurantGroup[] {
  const best = (g: RestaurantGroup) => g.options[0];
  const num = (v: number | null | undefined, fallback: number) => (v === null || v === undefined ? fallback : v);
  const byKey: Record<SortKey, (a: RestaurantGroup, b: RestaurantGroup) => number> = {
    match: (a, b) => b.rankScore - a.rankScore,
    health: (a, b) => num(best(b)?.healthScore, 0) - num(best(a)?.healthScore, 0),
    price: (a, b) => num(a.combo.items.length ? a.combo.netCad : null, 1e9) - num(b.combo.items.length ? b.combo.netCad : null, 1e9),
    distance: (a, b) => num(a.distanceKm, 1e9) - num(b.distanceKm, 1e9),
    calories: (a, b) => num(best(a)?.calories, 1e9) - num(best(b)?.calories, 1e9),
  };
  const sorted = [...groups].sort(byKey[key]);
  if (key === "health" || key === "calories") {
    const optionSort = key === "health" ? (a: MenuOption, b: MenuOption) => b.healthScore - a.healthScore : (a: MenuOption, b: MenuOption) => num(a.calories, 1e9) - num(b.calories, 1e9);
    return sorted.map((g) => ({ ...g, options: [...g.options].sort(optionSort) }));
  }
  return sorted;
}

interface Persisted {
  query: string;
  location: GeoLocation;
  rangeKm: number;
  budget: string;
  bogo: boolean;
  maxCalories: string;
  targetScore: string;
  lens: BiomarkerLensId | "auto";
}

const DEFAULTS: Persisted = {
  query: "",
  location: { address: "200 Bay St, Toronto", lat: 43.6477, lng: -79.3797 },
  rangeKm: 5,
  budget: "40",
  bogo: false,
  maxCalories: "",
  targetScore: "",
  lens: "auto",
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default function MealFinderPage() {
  const [view, setView] = useState<View>("find");
  const [state, setState] = useState<Persisted>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FindResponse | null>(null);
  const [selected, setSelected] = useState<MenuOption | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resultsView, setResultsView] = useState<"restaurants" | "dishes">("restaurants");
  const [sortBy, setSortBy] = useState<SortKey>("match");
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [captured, setCaptured] = useState<CapturedSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCaptured().then((c) => { if (!cancelled) setCaptured(c); });
    return () => { cancelled = true; };
  }, []);

  // Menus captured from the user's own browser only change while the local helper is in play, never in snapshot mode.
  const snapshotMode = Boolean(status?.snapshot);
  useEffect(() => {
    if (snapshotMode) return;
    let cancelled = false;
    const refresh = () => fetchCaptured().then((c) => { if (!cancelled) setCaptured(c); });
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, [snapshotMode]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setState(load());
      setHydrated(true);
    });
    fetch("/api/find")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setStatus((j as { providers: ProviderStatus }).providers);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state, hydrated]);

  const patch = (p: Partial<Persisted>) => setState((s) => ({ ...s, ...p }));

  const submit = useCallback(async () => {
    const query = state.query.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          location: state.location,
          rangeKm: state.rangeKm,
          lens: state.lens === "auto" ? undefined : state.lens,
          budgetCad: state.budget ? Number(state.budget) : undefined,
          dealsOnly: state.bogo,
          maxCalories: state.maxCalories ? Number(state.maxCalories) : undefined,
          targetScore: state.targetScore ? Number(state.targetScore) : undefined,
        }),
      });
      const json = (await res.json()) as FindResponse & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [state]);

  const sortedGroups = useMemo(() => (result ? sortGroups(result.search.groups, sortBy) : []), [result, sortBy]);

  const liveConfigured = Boolean(status?.browserBridge?.running || (status?.snapshot?.restaurants ?? 0) > 0 || (captured?.items ?? 0) > 0);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
          <span className="flex size-7 items-center justify-center rounded-lg border bg-white shadow-xs">
            <Icon icon="lucide:utensils" className="size-4 text-brand" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Eat Healthier</span>
        </div>
        <nav className="space-y-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                view === n.id ? "bg-brand/10 font-medium text-brand" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon icon={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        {SHOW_DEVELOPER && (
        <div className="mt-auto">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <Icon icon="lucide:plug" />
            Connections
            <span className={cn("ml-auto size-2 rounded-full", liveConfigured ? "bg-brand" : "bg-muted-foreground/40")} />
          </button>
        </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-20 flex h-12 items-center gap-1 border-b bg-background/90 px-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Button key={n.id} variant="ghost" size="icon-sm" className={cn(view === n.id && "bg-brand/10 text-brand")} onClick={() => setView(n.id)} aria-label={n.label}>
            <Icon icon={n.icon} />
          </Button>
        ))}
        {SHOW_DEVELOPER && (
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setSettingsOpen(true)} aria-label="Connections">
            <Icon icon="lucide:plug" />
          </Button>
        )}
      </div>

      <main className="min-w-0 flex-1 px-4 pt-16 pb-24 md:px-8 md:pt-14">
        <div className="mx-auto w-full max-w-2xl">
          {view === "find" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">What do you feel like eating?</h1>
              <Composer
                value={state.query}
                onChange={(query) => patch({ query })}
                onSubmit={submit}
                loading={loading}
                lens={state.lens}
                onLensChange={(lens) => patch({ lens })}
                location={state.location}
                onLocationChange={(location) => patch({ location })}
                rangeKm={state.rangeKm}
                onRangeChange={(rangeKm) => patch({ rangeKm })}
                budget={state.budget}
                onBudgetChange={(budget) => patch({ budget })}
                bogo={state.bogo}
                onBogoChange={(bogo) => patch({ bogo })}
                maxCalories={state.maxCalories}
                onMaxCaloriesChange={(maxCalories) => patch({ maxCalories })}
                targetScore={state.targetScore}
                onTargetScoreChange={(targetScore) => patch({ targetScore })}
                googleMapsKey={status?.googleMapsKey ?? null}
              />

              {SHOW_DEVELOPER && !liveConfigured && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
                >
                  <Icon icon="lucide:radio" className="size-3.5" />
                  Capture restaurants near you from Uber Eats
                  <Icon icon="lucide:chevron-right" className="ml-auto size-3.5" />
                </button>
              )}

              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <Icon icon="lucide:circle-alert" />
                  {error}
                </div>
              )}

              {loading && (
                <div className="space-y-3">
                  <Skeleton className="h-7 w-2/3" />
                  <Skeleton className="h-44 w-full rounded-2xl" />
                  <Skeleton className="h-44 w-full rounded-2xl" />
                </div>
              )}

              {result && !loading && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <IntentStrip intent={result.intent} search={result.search} dealsOnly={state.bogo} targetScore={state.targetScore ? Number(state.targetScore) : null} />
                    </div>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SelectTrigger size="sm" className="h-8 w-9 shrink-0 justify-center rounded-full px-0 [&>svg:last-child]:hidden" aria-label="Sort results">
                            <Icon icon={SORTS.find((x) => x.id === sortBy)?.icon ?? "lucide:arrow-up-down"} />
                          </SelectTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Sort · {SORTS.find((x) => x.id === sortBy)?.label}</TooltipContent>
                      </Tooltip>
                      <SelectContent align="end">
                        {SORTS.map((o) => (
                          <SelectItem key={o.id} value={o.id}><Icon icon={o.icon} /> {o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex shrink-0 rounded-full border p-0.5">
                      {(["restaurants", "dishes"] as const).map((v) => (
                        <Tooltip key={v}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-pressed={resultsView === v}
                              className={cn("size-7 rounded-full", resultsView === v && "bg-brand/10 text-brand")}
                              onClick={() => setResultsView(v)}
                              aria-label={v === "restaurants" ? "By restaurant" : "Top dishes"}
                            >
                              <Icon icon={v === "restaurants" ? "lucide:store" : "lucide:list-ordered"} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{v === "restaurants" ? "By restaurant" : "Top dishes across all restaurants"}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  {result.search.groups.length === 0 ? (
                    <div className="rounded-2xl border px-4 py-8 text-center text-sm text-muted-foreground">
                      <Icon icon="lucide:search-x" className="mx-auto mb-2 size-5" />
                      {state.bogo ? "No deals nearby for this. Turn off BOGO to see everything." : "Nothing matched."}
                    </div>
                  ) : resultsView === "dishes" ? (
                    <DishList groups={sortedGroups} sortBy={sortBy} targetScore={state.targetScore ? Number(state.targetScore) : null} onSelect={setSelected} />
                  ) : (
                    sortedGroups.slice(0, 8).map((g) => (
                      <RestaurantCard key={g.restaurant} group={g} onSelect={setSelected} />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {view === "lenses" && <LensesView />}
          {view === "developer" && <DeveloperView />}
        </div>
      </main>

      <OptionSheet option={selected} onClose={() => setSelected(null)} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        status={status}
        captured={captured}
        onCapturedChange={setCaptured}
      />
    </div>
    </TooltipProvider>
  );
}

function LensesView() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Biomarker lenses</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {BIOMARKER_LENS_LIST.map((lens) => (
          <div key={lens.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon icon={LENS_META[lens.id].icon} />
              <h2 className="font-semibold">{LENS_META[lens.id].label}</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{lens.subtitle}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <ul className="space-y-1">
                {lens.takeMoreOf.slice(0, 4).map((m) => (
                  <li key={m.label} className="flex items-start gap-1.5">
                    <Icon icon="lucide:arrow-up" className="mt-0.5 size-3 text-success" />
                    <Tooltip>
                      <TooltipTrigger asChild><span>{m.label}</span></TooltipTrigger>
                      <TooltipContent className="max-w-64">{m.why}</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
              <ul className="space-y-1">
                {lens.takeLessOf.slice(0, 4).map((m) => (
                  <li key={m.label} className="flex items-start gap-1.5">
                    <Icon icon="lucide:arrow-down" className="mt-0.5 size-3 text-warning" />
                    <Tooltip>
                      <TooltipTrigger asChild><span>{m.label}</span></TooltipTrigger>
                      <TooltipContent className="max-w-64">{m.why}</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl border bg-secondary">
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute top-2 right-2"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        <Icon icon={copied ? "lucide:check" : "lucide:copy"} />
      </Button>
      <pre className="overflow-x-auto p-3 pr-10 text-xs leading-relaxed">{code}</pre>
    </div>
  );
}

function DeveloperView() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">API</h1>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon="lucide:search" />POST /api/find</h2>
        <CodeBlock
          code={`curl -X POST ${origin}/api/find \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"healthy chicken, enough portions, like Nando\\u2019s","address":"200 Bay St, Toronto","budgetCad":40}'`}
        />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon="lucide:cpu" />POST /api/decision</h2>
        <CodeBlock code={`curl -X POST ${origin}/api/decision -H 'Content-Type: application/json' -d '{"text":"low sodium salmon for 2"}'`} />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon="lucide:plug" />MCP server</h2>
        <CodeBlock code={`claude mcp add gta-meals --transport http ${origin}/api/mcp`} />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon="simple-icons:ubereats" />Live Uber Eats helper</h2>
        <CodeBlock code={`bun run bridge   # opens Chrome, searches Uber Eats at your location, reads each store's menu`} />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon="lucide:key-round" />Server env</h2>
        <CodeBlock
          code={`AZURE_DECISION_KEY=…        # request understanding + nutrition estimates
DATASET_LOCAL=1             # snapshot mode: search the crawl dataset (npm run data:pull)
GOOGLE_MAPS_API_KEY=…       # optional map picker; OpenStreetMap otherwise`}
        />
      </section>
    </div>
  );
}
