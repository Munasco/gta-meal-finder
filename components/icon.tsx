"use client";

import { Icon as IconifyIcon, type IconProps } from "@iconify/react";
import { cn } from "@/lib/utils";

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
