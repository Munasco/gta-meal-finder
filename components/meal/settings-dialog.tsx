"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Credentials {
  apifyToken: string;
  apifyActor: string;
  uberEatsMcpToken: string;
  azureDecisionKey: string;
}

export interface ProviderStatus {
  microsoftDecision1: boolean;
  browserBridge?: { running: boolean; browser?: boolean; busy?: boolean; lastError?: string | null };
  uberEatsOfficialMcp: boolean;
  apifyUberEats: boolean;
  apifyActor: string;
  googleMapsKey?: string | null;
}

export interface CapturedSummary {
  restaurants: { restaurant: string; items: number; capturedAt: string; storeUrl: string | null }[];
  items: number;
  pl: string | null;
}

export const EMPTY_CREDENTIALS: Credentials = { apifyToken: "", apifyActor: "", uberEatsMcpToken: "", azureDecisionKey: "" };

export async function fetchCaptured(): Promise<CapturedSummary | null> {
  try {
    const r = await fetch("/api/ingest");
    return r.ok ? ((await r.json()) as CapturedSummary) : null;
  } catch {
    return null;
  }
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

function Help({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-auto"><Icon icon="lucide:circle-help" className="size-3.5" /></span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

function Field({
  id, icon, label, value, onChange, placeholder, on, help, secret = true,
}: {
  id: string; icon: string; label: string; value: string; onChange: (v: string) => void;
  placeholder: string; on: boolean; help: string; secret?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon={icon} className="size-3.5" />
        {label}
        <Dot on={on} tip={on ? "Configured" : "Not configured"} />
        <Help text={help} />
      </Label>
      <Input id={id} type={secret ? "password" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
    </div>
  );
}

/** Bookmarklet + console snippet + paste import for menus captured on ubereats.com. */
function BrowserBridge({ captured, onChange, status }: { captured: CapturedSummary | null; onChange: (c: CapturedSummary | null) => void; status: ProviderStatus | null }) {
  const [code, setCode] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    fetch("/bridge.js").then((r) => r.text()).then(setCode).catch(() => setCode(""));
  }, []);

  const snippet = code ? `window.__MEAL_FINDER_APP__=${JSON.stringify(window.location.origin)};${code}` : "";

  useEffect(() => {
    // Set via DOM so React does not warn about javascript: URLs; this is a user-dragged bookmarklet.
    if (linkRef.current && snippet) linkRef.current.setAttribute("href", `javascript:${encodeURIComponent(snippet)}`);
  }, [snippet]);

  const refresh = async () => onChange(await fetchCaptured());

  const importPaste = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const payload = JSON.parse(paste);
      const r = await fetch("/api/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = (await r.json()) as { added?: number; items?: number; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setPaste("");
      setMsg(`${j.added} restaurant(s), ${j.items} items`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Invalid JSON");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    await fetch("/api/ingest", { method: "DELETE" });
    await refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon="simple-icons:ubereats" className="size-3.5" />
        Live helper
        <Dot on={Boolean(status?.browserBridge?.running)} tip={status?.browserBridge?.running ? (status.browserBridge.lastError ? `Running · last error: ${status.browserBridge.lastError}` : "Running") : "Not running · run `bun run bridge` in the project"} />
        <Help text="Uber Eats blocks plain servers, so `bun run bridge` drives a real Chrome window at your location and reads each store's menu automatically. Without it, capture menus by hand: open a restaurant on ubereats.com and click the bookmarklet (drag it to your bookmarks bar first), or paste the snippet in DevTools console." />
        <span className="mx-1 h-3 w-px bg-border" />
        <Icon icon="lucide:bookmark" className="size-3.5" />
        <Dot on={(captured?.items ?? 0) > 0} tip={captured?.items ? `${captured.items} items captured` : "Nothing captured yet"} />
        {(captured?.restaurants.length ?? 0) > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={clear} aria-label="Clear captured menus">
                <Icon icon="lucide:trash-2" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear captured menus</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              ref={linkRef}
              href="#capture"
              onClick={(e) => e.preventDefault()}
              draggable
              className="inline-flex h-8 cursor-grab items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent active:cursor-grabbing"
            >
              <Icon icon="lucide:bookmark-plus" />
              Capture menu
            </a>
          </TooltipTrigger>
          <TooltipContent>Drag to your bookmarks bar, then click it on an Uber Eats restaurant page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!snippet}
              aria-label="Copy console snippet"
              onClick={() => navigator.clipboard?.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}
            >
              <Icon icon={copied ? "lucide:check" : "lucide:terminal"} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy console snippet</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" asChild aria-label="Open Uber Eats">
              <a href={captured?.pl ? `https://www.ubereats.com/ca/search?q=&pl=${captured.pl}` : "https://www.ubereats.com/ca"} target="_blank" rel="noreferrer">
                <Icon icon="lucide:arrow-up-right" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Uber Eats</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex gap-2">
        <Textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Or paste captured JSON"
          rows={2}
          className="min-h-9 resize-none text-xs"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" disabled={!paste.trim() || busy} onClick={importPaste} aria-label="Import">
              <Icon icon={busy ? "lucide:loader-circle" : "lucide:download"} className={cn(busy && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import</TooltipContent>
        </Tooltip>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      {captured && captured.restaurants.length > 0 && (
        <ul className="space-y-1">
          {captured.restaurants.slice(0, 6).map((r) => (
            <li key={r.restaurant} className="flex items-center gap-2 text-xs">
              <Icon icon="lucide:store" className="size-3.5 text-muted-foreground" />
              <span className="truncate">{r.restaurant}</span>
              <Badge variant="secondary" className="ml-auto h-5 px-1.5 tabular-nums">{r.items}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettingsDialog({
  open, onOpenChange, creds, onChange, status, captured, onCapturedChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  creds: Credentials;
  onChange: (c: Credentials) => void;
  status: ProviderStatus | null;
  captured: CapturedSummary | null;
  onCapturedChange: (c: CapturedSummary | null) => void;
}) {
  const set = (k: keyof Credentials) => (v: string) => onChange({ ...creds, [k]: v });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:plug" /> Connections
          </DialogTitle>
          <DialogDescription>Keys stay in this browser. Server env vars apply when a field is empty.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <BrowserBridge captured={captured} onChange={onCapturedChange} status={status} />
          <Separator />
          <Field
            id="apify" icon="lucide:radio" label="Apify token" value={creds.apifyToken} onChange={set("apifyToken")} placeholder="apify_api_…"
            on={Boolean(creds.apifyToken) || Boolean(status?.apifyUberEats)}
            help="Automated live Uber Eats menus near the address. Free Apify account works; actor james.logantech/uber-eats-scraper."
          />
          <Field
            id="actor" icon="lucide:box" label="Apify actor" value={creds.apifyActor} onChange={set("apifyActor")}
            placeholder={status?.apifyActor ?? "james.logantech~uber-eats-scraper"} on={true}
            help="Alternative: khadinakbar~uber-eats-scraper (search + menus, CA proxy)." secret={false}
          />
          <Field
            id="uber" icon="simple-icons:ubereats" label="Uber Eats MCP token" value={creds.uberEatsMcpToken} onChange={set("uberEatsMcpToken")}
            placeholder="OAuth access token" on={Boolean(creds.uberEatsMcpToken) || Boolean(status?.uberEatsOfficialMcp)}
            help="Official mcp.ubereats.com server. Needs an Uber OAuth access token with scope eats.3p.mcp."
          />
          <Field
            id="azure" icon="lucide:cpu" label="Decision-1 key" value={creds.azureDecisionKey} onChange={set("azureDecisionKey")}
            placeholder="Azure AI Foundry key" on={Boolean(creds.azureDecisionKey) || Boolean(status?.microsoftDecision1)}
            help="Microsoft Decision-1 classifies the request (lens, protein, portions). Heuristics are used without it."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
