"use client";

import { Icon } from "@/components/icon";
import { IndicesPanel } from "@/components/meal/indices";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MenuOption } from "@/lib/uber-eats";
import { SOURCE_META, cad, driverLabel } from "@/lib/ui-meta";
import { officialNutritionLink } from "@/lib/nutrition-links";

function Driver({ label, metric, points }: { label: string; metric: string; points: number }) {
  const up = points >= 0;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon icon={up ? "lucide:arrow-up" : "lucide:arrow-down"} className={cn("size-4 shrink-0", up ? "text-brand" : "text-warning")} />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{metric}</span>
      <span className={cn("w-9 shrink-0 text-right text-xs font-medium tabular-nums", up ? "text-brand" : "text-warning")}>
        {up ? "+" : "−"}{Math.abs(points).toFixed(0)}
      </span>
    </li>
  );
}
import { cn } from "@/lib/utils";

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">
        {value === null ? "—" : value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Line({ icon, text, tone }: { icon: string; text: string; tone: "good" | "warn" }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon icon={icon} className={cn("mt-0.5 size-4", tone === "good" ? "text-success" : "text-warning")} />
      <span>{text}</span>
    </li>
  );
}

export function OptionSheet({ option, onClose }: { option: MenuOption | null; onClose: () => void }) {
  const ev = option?.evaluated;
  const n = ev?.dish.nutrients;
  const official = option ? officialNutritionLink(option.restaurant) : null;
  return (
    <Sheet open={Boolean(option)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {option && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 leading-snug">{option.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <span>{option.restaurant}</span>
                <span>·</span>
                <span className="tabular-nums">{cad(option.priceCad)}</span>
                <Icon icon={SOURCE_META[option.source].icon} className="size-3.5" />
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {option.description && <p className="text-sm text-muted-foreground">{option.description}</p>}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Health</div>
                  <div className="text-xl font-semibold tabular-nums">{option.healthScore}</div>
                </div>
                <div className="rounded-lg border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Fit</div>
                  <div className="text-xl font-semibold tabular-nums">{option.fitScore}</div>
                </div>
              </div>

              {ev ? (
                <ul className="space-y-1.5">
                  {[...ev.baselineComponents]
                    .filter((c) => Math.abs(c.points) >= 1)
                    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
                    .slice(0, 6)
                    .map((c) => (
                      <Driver key={c.id} label={driverLabel(c.id)} metric={c.metricDisplay} points={c.direction === "negative" ? -Math.abs(c.points) : c.points} />
                    ))}
                  {option.cautions.filter((c) => /No |over your limit|Fried/.test(c)).map((c) => <Line key={c} icon="lucide:triangle-alert" text={c} tone="warn" />)}
                </ul>
              ) : (
                (option.reasons.length > 0 || option.cautions.length > 0) && (
                  <ul className="space-y-1.5">
                    {option.reasons.map((r) => <Line key={r} icon="lucide:circle-check" text={r} tone="good" />)}
                    {option.cautions.map((c) => <Line key={c} icon="lucide:triangle-alert" text={c} tone="warn" />)}
                  </ul>
                )
              )}

              {option.indices && (
                <>
                  <Separator />
                  <IndicesPanel indices={option.indices} basis={option.health ? "estimate" : "catalogue"} />
                </>
              )}

              {option.health && option.health.components.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {option.health.components.map((c) => (
                    <span key={c.slot} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      <Icon icon={c.slot === "protein" ? "lucide:drumstick" : c.slot === "base" ? "lucide:wheat" : "lucide:leaf"} className="size-3 text-muted-foreground" />
                      {c.label ?? c.id} · {c.grams} g
                    </span>
                  ))}
                </div>
              )}

              {n && ev && (
                <>
                  <Separator />
                  {option.health && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon icon="lucide:flask-conical" className="size-3.5" />
                      Estimated nutrition {option.calories && !option.caloriesEstimated ? "anchored to Uber's published calories" : ""}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Calories" value={n.calories} unit="kcal" />
                    <Stat label="Protein" value={n.proteinG} unit="g" />
                    <Stat label="Fibre" value={n.fibreG} unit="g" />
                    <Stat label="Sodium" value={n.sodiumMg} unit="mg" />
                    <Stat label="Sat. fat" value={n.saturatedFatG} unit="g" />
                    <Stat label="Sugars" value={n.sugarsG} unit="g" />
                  </div>
                  {(ev.takeMoreOfHits.length > 0 || ev.takeLessOfChecks.some((c) => c.status === "caution")) && (
                    <ul className="space-y-1.5">
                      {ev.takeMoreOfHits.slice(0, 3).map((h) => (
                        <Line key={h.nutrientOrFood} icon="lucide:heart-pulse" text={`${h.nutrientOrFood} · ${h.dishValueDisplay}`} tone="good" />
                      ))}
                      {ev.takeLessOfChecks.filter((c) => c.status === "caution").slice(0, 3).map((h) => (
                        <Line key={h.nutrientOrFood} icon="lucide:heart-pulse" text={`${h.nutrientOrFood} · ${h.dishValueDisplay}`} tone="warn" />
                      ))}
                    </ul>
                  )}
                  <a
                    href={ev.dish.nutritionSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    <Icon icon="lucide:file-check" className="size-3.5" />
                    {ev.dish.nutritionSourceTitle}
                  </a>
                </>
              )}

              {official && (
                <a href={official.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline">
                  <Icon icon="lucide:external-link" className="size-3.5" />
                  {official.label}
                </a>
              )}

              <Button asChild className="w-full gap-2">
                <a href={option.url ?? "#"} target="_blank" rel="noreferrer">
                  <Icon icon="simple-icons:ubereats" />
                  Order
                  <Icon icon="lucide:arrow-up-right" className="size-3.5" />
                </a>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
