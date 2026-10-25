"use client";

import { Icon } from "@/components/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AHEI_LABEL, HIGH_IN_LABEL, NUTRI_COLORS, type DishIndices, type NutriGrade } from "@/lib/indices";
import { cn } from "@/lib/utils";

const GRADES: NutriGrade[] = ["A", "B", "C", "D", "E"];

const HELP = {
  nutri: "Nutri-Score (France, 2023 algorithm): per 100 g, points off for energy, sugars, saturated fat and sodium; points back for fibre, protein, fruit, vegetables and legumes. A is best, E is worst.",
  ahei: "Harvard's Alternative Healthy Eating Index, adapted to one meal: ten of its eleven components (vegetables, fruit, whole grains, nuts and legumes, omega-3, polyunsaturated fat; sugary drinks, red meat, trans fat, sodium) with daily targets ÷ 3, scaled to the index's 0–110.",
  canada: "Health Canada front-of-package symbols: a dish is flagged when sodium, sugars or saturated fat reach 15 % of the daily value per serving, or 30 % for main dishes of 200 g and more.",
};

function summary(i: DishIndices): string {
  const parts = [i.nutriScore ? `Nutri-Score ${i.nutriScore.grade}` : null, `AHEI ${i.ahei.score}/110`, i.healthCanada.highIn.length ? i.healthCanada.highIn.map((h) => HIGH_IN_LABEL[h]).join(", ") : "No Health Canada warnings"];
  return parts.filter(Boolean).join(" · ");
}

/** One-letter Nutri-Score chip for list rows; the tooltip carries the other two systems. */
export function NutriChip({ indices }: { indices: DishIndices | null }) {
  if (!indices) return null;
  const grade = indices.nutriScore?.grade;
  const warn = indices.healthCanada.highIn.length > 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          {grade && (
            <span className="inline-flex size-4 items-center justify-center rounded-[4px] text-[10px] font-bold leading-none text-white" style={{ background: NUTRI_COLORS[grade] }}>
              {grade}
            </span>
          )}
          {warn && <Icon icon="lucide:octagon-alert" className="size-3.5 text-warning" />}
        </span>
      </TooltipTrigger>
      <TooltipContent>{summary(indices)} · estimated</TooltipContent>
    </Tooltip>
  );
}

function Row({ icon, label, help, children }: { icon: string; label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon icon={icon} className="size-4 text-muted-foreground" />
      <span className="shrink-0">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span><Icon icon="lucide:info" className="size-3.5 text-muted-foreground/70" /></span>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{help}</TooltipContent>
      </Tooltip>
      <span className="ml-auto flex items-center">{children}</span>
    </div>
  );
}

/** Full breakdown for the option sheet. */
export function IndicesPanel({ indices, basis }: { indices: DishIndices; basis: "estimate" | "catalogue" }) {
  const grade = indices.nutriScore?.grade;
  const { ahei, healthCanada } = indices;
  return (
    <div className="space-y-2.5">
      <Row icon="lucide:tag" label="Nutri-Score" help={HELP.nutri}>
        {grade ? (
          <span className="flex gap-0.5">
            {GRADES.map((g) => (
              <span
                key={g}
                className={cn("flex h-5 w-6 items-center justify-center rounded text-[11px] font-semibold text-white transition-transform", g === grade ? "scale-110 shadow-sm" : "opacity-25")}
                style={{ background: NUTRI_COLORS[g] }}
              >
                {g}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">needs portion size</span>
        )}
      </Row>
      <Row icon="lucide:graduation-cap" label="AHEI" help={HELP.ahei}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full", ahei.score >= 66 ? "bg-success" : ahei.score >= 40 ? "bg-warning" : "bg-destructive")} style={{ width: `${(ahei.score / 110) * 100}%` }} />
              </span>
              <span className="text-xs tabular-nums">
                {ahei.score}<span className="text-muted-foreground">/110</span>
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              {ahei.components.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>{AHEI_LABEL[c.id]}</span>
                  <span className="tabular-nums">{c.points}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </Row>
      <Row icon={healthCanada.highIn.length ? "lucide:shield-alert" : "lucide:shield-check"} label="Health Canada" help={HELP.canada}>
        {healthCanada.highIn.length ? (
          <span className="flex flex-wrap justify-end gap-1">
            {healthCanada.highIn.map((h) => (
              <span key={h} className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                {HIGH_IN_LABEL[h]}
              </span>
            ))}
          </span>
        ) : (
          <Icon icon="lucide:check" className="size-4 text-success" />
        )}
      </Row>
      <p className="text-[11px] text-muted-foreground">
        {basis === "estimate" ? "Estimated from the USDA components Decision-1 picked for this menu text." : "Nutrients as published; food groups read from the listed ingredients."}
      </p>
    </div>
  );
}
