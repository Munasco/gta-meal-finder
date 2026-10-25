"use client";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MenuOption, RestaurantGroup } from "@/lib/uber-eats";
import { cad, shortDriver } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <svg viewBox="0 0 20 20" className="size-4 -rotate-90">
            <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
            <circle
              cx="10"
              cy="10"
              r={r}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - value / 100)}
              className={cn(value >= 70 ? "stroke-success" : value >= 45 ? "stroke-warning" : "stroke-destructive")}
            />
          </svg>
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function OptionRow({ option, inCombo, onSelect, showRestaurant = false }: { option: MenuOption; inCombo: boolean; onSelect: () => void; showRestaurant?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          inCombo ? "border-brand bg-brand text-brand-foreground" : "border-border text-transparent"
        )}
      >
        <Icon icon="lucide:check" className="size-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{option.name}</span>
          {option.promo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Icon icon="lucide:badge-percent" className="size-3.5 text-success" /></span>
              </TooltipTrigger>
              <TooltipContent>{option.promo}</TooltipContent>
            </Tooltip>
          )}
          {option.kind !== "main" && (
            <Icon icon={option.kind === "side" ? "lucide:salad" : "lucide:cup-soda"} className="size-3.5 text-muted-foreground" />
          )}
        </span>
        {showRestaurant && <span className="text-xs text-muted-foreground">{option.restaurant}</span>}
        {option.description && <span className="line-clamp-1 text-xs text-muted-foreground">{option.description}</span>}
        {option.evaluated && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
            {[...option.evaluated.baselineComponents]
              .filter((c) => Math.abs(c.points) >= 2)
              .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
              .slice(0, 3)
              .map((c) => {
                const neg = c.direction === "negative";
                return (
                  <span key={c.id} className={cn("inline-flex items-center gap-0.5", neg ? "text-warning" : "text-brand")}>
                    <Icon icon={neg ? "lucide:arrow-down" : "lucide:arrow-up"} className="size-3" />
                    {shortDriver(c.label)} {c.metricDisplay.split(" · ")[0].replace(/ \(.*\)$/, "")}
                  </span>
                );
              })}
          </span>
        )}
        <span className="mt-1 flex items-center gap-2.5">
          <ScoreRing value={option.healthScore} label="Health score" />
          <ScoreRing value={option.fitScore} label="Fit to your request" />
          {!option.evaluated && option.calories !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  <Icon icon="lucide:flame" className="size-3.5" />{option.caloriesEstimated ? "~" : ""}{option.calories}
                </span>
              </TooltipTrigger>
              <TooltipContent>{option.caloriesEstimated ? `Estimated by Decision-1 from the menu text (${option.health?.caloriesBand.replace("_", "–")} kcal)` : "Calories as published on the Uber Eats menu"}</TooltipContent>
            </Tooltip>
          )}
          {option.evaluated && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                    <Icon icon="lucide:flame" className="size-3.5" />
                    {option.evaluated.dish.nutrients.calories}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Calories · {option.evaluated.dish.servingSize}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                    <Icon icon="lucide:dumbbell" className="size-3.5" />
                    {option.evaluated.dish.nutrients.proteinG}g
                  </span>
                </TooltipTrigger>
                <TooltipContent>Protein · {option.evaluated.dish.nutrients.fibreG}g fibre · {option.evaluated.dish.nutrients.sodiumMg}mg sodium</TooltipContent>
              </Tooltip>
            </>
          )}
          {option.cautions.map((c) => (
            <Tooltip key={c}>
              <TooltipTrigger asChild>
                <span>
                  <Icon icon="lucide:triangle-alert" className="size-3.5 text-warning" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{c}</TooltipContent>
            </Tooltip>
          ))}
        </span>
      </span>
      <span className="shrink-0 text-sm tabular-nums">{cad(option.priceCad)}</span>
    </button>
  );
}

export function RestaurantCard({ group, onSelect }: { group: RestaurantGroup; onSelect: (o: MenuOption) => void }) {
  const comboIds = new Set(group.combo.items.map((i) => i.id));
  const initial = group.restaurant.replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase() || "?";

  return (
    <article className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-start gap-3 px-4 pt-4 pb-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight">{group.restaurant}</h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {group.rating !== null && (
              <span className="inline-flex items-center gap-1"><Icon icon="lucide:star" className="size-3" />{group.rating.toFixed(1)}</span>
            )}
            {group.etaText && (
              <span className="inline-flex items-center gap-1"><Icon icon="lucide:clock" className="size-3" />{group.etaText}</span>
            )}
            {group.distanceKm !== null && (
              <span className="inline-flex items-center gap-1"><Icon icon="lucide:navigation" className="size-3" />{group.distanceKm} km</span>
            )}
            <span>{group.options.length} options</span>
            {group.otherLocations.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1"><Icon icon="lucide:map-pinned" className="size-3" />+{group.otherLocations.length}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  {group.otherLocations.slice(0, 6).map((l) => `${l.restaurant}${l.distanceKm !== null ? ` · ${l.distanceKm} km` : ""}`).join("\n")}
                </TooltipContent>
              </Tooltip>
            )}
            {group.promos.slice(0, 2).map((pr) => (
              <span key={pr} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                <Icon icon="lucide:badge-percent" className="size-3" />
                {pr}
              </span>
            ))}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-right">
              <div className={cn("text-lg font-semibold tabular-nums leading-tight", !group.combo.fitsBudget && "text-destructive")}>
                {group.combo.items.length ? cad(group.combo.netCad) : "—"}
              </div>
              <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <Icon icon={group.combo.fitsBudget ? "lucide:circle-check" : "lucide:circle-x"} className={cn("size-3.5", group.combo.fitsBudget ? "text-success" : "text-destructive")} />
                {cad(group.combo.estimatedTotalCad)}
              </div>
              {group.combo.discountCad > 0 && (
                <div className="flex items-center justify-end gap-1 text-xs text-success">
                  <Icon icon="lucide:badge-percent" className="size-3" />
                  −{cad(group.combo.discountCad)}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-right">
            {group.combo.items.length} items {cad(group.combo.subtotalCad)}
            {group.combo.discountCad > 0 && ` − ${group.combo.dealLabel} ${cad(group.combo.discountCad)}`}
            {" = "}
            {cad(group.combo.netCad)} before tax &amp; fees
            <br />
            + est. tax &amp; fees {cad(group.combo.estimatedFeesCad)} = {cad(group.combo.estimatedTotalCad)}
            {group.combo.budgetCad !== null && ` · budget ${cad(group.combo.budgetCad)}`}
          </TooltipContent>
        </Tooltip>
      </header>

      <div className="px-2 pb-2">
        {group.options.map((o) => (
          <OptionRow key={o.id} option={o} inCombo={comboIds.has(o.id)} onSelect={() => onSelect(o)} />
        ))}
      </div>

      <footer className="flex items-center gap-1 border-t px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a href={group.storeUrl ?? "#"} target="_blank" rel="noreferrer">
                <Icon icon="simple-icons:ubereats" className="size-4" />
                <Icon icon="lucide:arrow-up-right" className="size-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open on Uber Eats</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a href={group.doorDashUrl ?? "#"} target="_blank" rel="noreferrer">
                <Icon icon="simple-icons:doordash" className="size-4" />
                <Icon icon="lucide:arrow-up-right" className="size-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open on DoorDash</TooltipContent>
        </Tooltip>
      </footer>
    </article>
  );
}
