"use client";

import { Icon } from "@/components/icon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ProviderStatus {
  microsoftDecision1: boolean;
  snapshot?: { restaurants: number; items: number; withHealth: number } | null;
  googleMapsKey?: string | null;
}

function Dot({ on, tip }: { on: boolean; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-block size-2 rounded-full", on ? "bg-success" : "bg-muted-foreground/40")} />
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

export function SettingsDialog({ open, onOpenChange, status }: { open: boolean; onOpenChange: (o: boolean) => void; status: ProviderStatus | null }) {
  const ds = status?.snapshot ?? null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:plug" /> Connections
          </DialogTitle>
          <DialogDescription>Keys live on the server, never in the browser.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon icon="lucide:database" className="size-3.5" />
            Dataset
            <Dot on={Boolean(ds && ds.restaurants > 0)} tip={ds ? `${ds.restaurants} restaurants · ${ds.items} items · ${ds.withHealth} with nutrition estimates` : "No dataset loaded"} />
            {ds && <span className="ml-auto tabular-nums">{ds.restaurants} · {ds.items}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon icon="lucide:cpu" className="size-3.5" />
            Intent model
            <Dot on={Boolean(status?.microsoftDecision1)} tip={status?.microsoftDecision1 ? "Configured on the server" : "Not configured; keyword parsing in use"} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
