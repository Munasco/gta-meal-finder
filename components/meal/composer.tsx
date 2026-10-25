"use client";

import { Icon } from "@/components/icon";
import { GoogleLocationMap } from "@/components/meal/google-map";
import { LocationMap, type GeoLocation } from "@/components/meal/location-map";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BiomarkerLensId } from "@/lib/models";
import { LENS_META } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

export const EXAMPLES = [
  "Healthy chicken with enough portions, something like Nando's",
  "Grilled salmon, low sodium, high blood pressure",
  "Veggie bowl, gluten free, watching my iron",
  "Mediterranean, big portions for 2, Gilbert's syndrome",
];

export const BUDGETS = Array.from({ length: 15 }, (_, i) => (i + 1) * 10); // 10 … 150

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  lens: BiomarkerLensId | "auto";
  onLensChange: (l: BiomarkerLensId | "auto") => void;
  location: GeoLocation;
  onLocationChange: (l: GeoLocation) => void;
  rangeKm: number;
  onRangeChange: (km: number) => void;
  budget: string;
  onBudgetChange: (b: string) => void;
  bogo: boolean;
  onBogoChange: (b: boolean) => void;
  maxCalories: string;
  onMaxCaloriesChange: (v: string) => void;
  /** "" = highest score first; otherwise rank by closeness to this score. */
  targetScore: string;
  onTargetScoreChange: (v: string) => void;
  googleMapsKey?: string | null;
}

export const CALORIE_CAPS = ["400", "500", "600", "700", "800", "1000", "1200"];

function Field({ icon, label, children, trailing }: { icon: string; label: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon icon={icon} className="size-3.5" />
        {label}
        {trailing && <span className="ml-auto tabular-nums text-foreground">{trailing}</span>}
      </div>
      {children}
    </div>
  );
}

export function Composer(p: ComposerProps) {
  const canSubmit = p.value.trim().length > 2 && !p.loading;

  return (
    <div className="space-y-4">
      {/* One panel: preferences on top, the prompt underneath. No inner borders. */}
      <div className="rounded-2xl border bg-card shadow-sm transition-shadow focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20">
      {/* Preferences: location on the left, labelled fields on the right */}
      <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr]" onKeyDown={(e) => e.stopPropagation()}>
        {p.googleMapsKey ? (
          <GoogleLocationMap apiKey={p.googleMapsKey} value={p.location} rangeKm={p.rangeKm} onChange={p.onLocationChange} />
        ) : (
          <LocationMap value={p.location} rangeKm={p.rangeKm} onChange={p.onLocationChange} />
        )}

        <div className="flex flex-col justify-between gap-4">
          <Field icon="lucide:navigation" label="Range" trailing={`${p.rangeKm} km`}>
            <Slider
              value={[p.rangeKm]}
              min={1}
              max={30}
              step={1}
              onValueChange={([v]) => p.onRangeChange(v)}
              aria-label="Range in kilometres"
              className="py-1 [&_[data-slot=slider-range]]:bg-brand [&_[data-slot=slider-thumb]]:border-brand"
            />
          </Field>

          <Field icon="lucide:wallet" label="Budget" trailing="incl. fees">
            <Select value={p.budget || "40"} onValueChange={p.onBudgetChange}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUDGETS.map((b) => (
                  <SelectItem key={b} value={String(b)}>${b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field icon="lucide:flame" label="Calories" trailing="per item">
            <Select value={p.maxCalories || "any"} onValueChange={(v) => p.onMaxCaloriesChange(v === "any" ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">No limit</SelectItem>
                {CALORIE_CAPS.map((c) => (
                  <SelectItem key={c} value={c}>≤ {c} kcal</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field icon="lucide:heart-pulse" label="Lens" trailing={p.targetScore ? `target ${p.targetScore}` : "highest first"}>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select value={p.lens} onValueChange={(v) => p.onLensChange(v as BiomarkerLensId | "auto")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto"><Icon icon="lucide:sparkles" /> Auto</SelectItem>
                  {(Object.keys(LENS_META) as BiomarkerLensId[]).map((id) => (
                    <SelectItem key={id} value={id}><Icon icon={LENS_META[id].icon} /> {LENS_META[id].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={p.targetScore || "max"} onValueChange={(v) => p.onTargetScoreChange(v === "max" ? "" : v)}>
                <SelectTrigger className="w-28" aria-label="Target score"><Icon icon="lucide:crosshair" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="max">Max</SelectItem>
                  {["95", "90", "85", "80", "75", "70", "65", "60"].map((t) => (
                    <SelectItem key={t} value={t}>≈ {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

          <label className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors", p.bogo ? "border-brand bg-brand/5" : "")}>
            <Icon icon="lucide:badge-percent" className={cn("size-4", p.bogo ? "text-brand" : "text-muted-foreground")} />
            <span className={cn(p.bogo ? "text-foreground" : "text-muted-foreground")}>BOGO only</span>
            <Switch checked={p.bogo} onCheckedChange={p.onBogoChange} aria-label="Only BOGO and other deals" className="ml-auto data-[state=checked]:bg-brand" />
          </label>
        </div>
      </div>

      <div className="mx-4 my-1 h-px bg-border" />

      {/* Prompt */}
      <div className="relative">
        <Textarea
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSubmit) {
              e.preventDefault();
              p.onSubmit();
            }
          }}
          placeholder="What do you feel like eating?"
          rows={3}
          className="min-h-24 resize-none border-0 bg-transparent px-4 pt-4 pr-14 pb-4 text-base shadow-none focus-visible:ring-0 md:text-base"
        />
        <Button size="icon" className="absolute right-3 bottom-3 size-9 rounded-full" disabled={!canSubmit} onClick={p.onSubmit} aria-label="Find meals">
          <Icon icon={p.loading ? "lucide:loader-circle" : "lucide:arrow-up"} className={cn("size-4", p.loading && "animate-spin")} />
        </Button>
      </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => p.onChange(ex)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              p.value === ex ? "border-brand bg-brand/10 text-brand" : "bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
