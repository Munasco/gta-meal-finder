"use client";

import { Icon as IconifyIcon, addCollection, type IconProps } from "@iconify/react";
import { ICON_SETS } from "@/components/generated-icons";
import { cn } from "@/lib/utils";

// Icons ship with the bundle (see scripts/bundle-icons.mjs), so they render on first paint and in SSR
// with no round trip to api.iconify.design. Anything not bundled still falls back to the API.
for (const set of ICON_SETS) addCollection(set);

/** Iconify icon with a sane default size. Pass `aria-label` when it is the only content of a control. */
export function Icon({ className, ...props }: IconProps) {
  return (
    <IconifyIcon
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("size-4 shrink-0", className)}
      {...props}
    />
  );
}
