"use client";

import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MealIntent } from "@/lib/intent";
import type { MenuSearchResult } from "@/lib/uber-eats";
import { LENS_META, PROTEIN_ICON, cad } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

function Pill({ icon, children, tip, className }: { icon: string; children: React.ReactNode; tip: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("h-7 gap-1.5 px-2.5 font-normal", className)}>
          <Icon icon={icon} className="size-3.5" />
          {children}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

export function IntentStrip({ intent, dealsOnly = false, targetScore = null }: { intent: MealIntent; search?: MenuSearchResult; dealsOnly?: boolean; targetScore?: number | null }) {
  const lens = LENS_META[intent.primaryLens];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill
        icon={intent.engine === "microsoft-decision-1" ? "lucide:cpu" : "lucide:regex"}
        tip={intent.engine === "microsoft-decision-1" ? `Microsoft Decision-1 · ${intent.latencyMs} ms` : "Heuristic parse (Decision-1 key not set)"}
      >
        {intent.engine === "microsoft-decision-1" ? "Decision-1" : "Heuristic"}
      </Pill>
      <Pill icon={lens.icon} tip={`Lens · ${pct(intent.primaryConfidence)} confidence`}>
        {lens.label}
      </Pill>
      {intent.protein !== "any" && (
        <Pill icon={PROTEIN_ICON[intent.protein]} tip={`Protein · ${pct(intent.proteinConfidence)}`}>
          {intent.protein}
        </Pill>
      )}
      {intent.diet !== "none" && (
        <Pill icon="lucide:shield-check" tip="Hard dietary rule applied to every result">
          {intent.diet.replace(/_/g, " ")}
        </Pill>
      )}
      {intent.wantsSpicy >= 0.6 && (
        <Pill icon="lucide:flame" tip="Spicy preferred">
          spicy
        </Pill>
      )}
      {intent.budgetCad !== null && (
        <Pill icon="lucide:wallet" tip="Budget incl. tax and fees">
          {cad(intent.budgetCad)}
        </Pill>
      )}
      <Pill icon="lucide:users" tip={`Portions · ${pct(intent.wantsLargePortions)} wants a big plate`}>
        {intent.servings}
        {intent.wantsLargePortions > 0.6 && <Icon icon="lucide:plus" className="size-3" />}
      </Pill>
      {intent.maxCalories !== null && (
        <Pill icon="lucide:flame" tip="Calorie cap per item">
          ≤ {intent.maxCalories}
        </Pill>
      )}
      {targetScore !== null && (
        <Pill icon="lucide:crosshair" tip="Ranked by closeness to this health score">
          ≈ {targetScore}
        </Pill>
      )}
      {dealsOnly && (
        <Pill icon="lucide:badge-percent" tip="Only deals" className="text-success">
          BOGO
        </Pill>
      )}
      {intent.detectedAllergens.map((a) => (
        <Pill key={a} icon="lucide:ban" tip="Excluded" className="text-destructive">
          {a.replace("_", " ")}
        </Pill>
      ))}
    </div>
  );
}
