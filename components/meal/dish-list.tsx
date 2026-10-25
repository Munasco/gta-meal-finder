"use client";

import { OptionRow } from "@/components/meal/restaurant-card";
import type { MenuOption, RestaurantGroup } from "@/lib/uber-eats";

/** Every dish across all restaurants, ranked by health first, then fit (or closeness to a target score). */
export function DishList({
  groups,
  targetScore,
  sortBy = "match",
  onSelect,
}: {
  groups: RestaurantGroup[];
  targetScore: number | null;
  sortBy?: "match" | "health" | "price" | "distance" | "calories";
  onSelect: (o: MenuOption) => void;
}) {
  const closeness = (s: number) => (targetScore === null ? 0 : Math.exp(-((s - targetScore) ** 2) / (2 * 12 * 12)));
  const big = 1e9;
  const value = (o: MenuOption) => {
    if (sortBy === "health") return o.healthScore;
    if (sortBy === "price") return -(o.priceCad ?? big);
    if (sortBy === "calories") return -(o.calories ?? big);
    if (sortBy === "distance") return -(groups.find((g) => g.restaurant === o.restaurant)?.distanceKm ?? big);
    return targetScore === null ? o.healthScore * 0.6 + o.fitScore * 0.4 : closeness(o.healthScore) * 100 + o.fitScore * 0.3;
  };
  const dishes = groups
    .flatMap((g) => g.options.filter((o) => o.kind === "main" && !o.cautions.some((c) => c.startsWith("No "))))
    .sort((a, b) => value(b) - value(a))
    .slice(0, 40);
  return (
    <div className="rounded-2xl border bg-card px-2 py-2 shadow-sm">
      {dishes.map((o) => (
        <OptionRow key={o.id} option={o} inCombo={false} showRestaurant onSelect={() => onSelect(o)} />
      ))}
    </div>
  );
}
