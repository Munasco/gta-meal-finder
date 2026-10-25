"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface GeoLocation {
  address: string;
  lat: number;
  lng: number;
}

/** Roughly the Greater Toronto Area, used to bias address search. */
const GTA_VIEWBOX = "-79.85,43.45,-79.0,43.95";

interface NominatimHit {
  display_name: string;
  lat: string;
  lon: string;
}

function shortAddress(displayName: string): string {
  const parts = displayName.split(",").map((s) => s.trim());
  // "200, Bay Street, Toronto, …" → "200 Bay Street, Toronto"
  const first = /^\d+[a-z]?$/i.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
  const rest = parts.slice(/^\d+[a-z]?$/i.test(parts[0]) ? 2 : 1).filter((p) => !/^\d{5}|[A-Z]\d[A-Z]\s?\d[A-Z]\d|Canada|Golden Horseshoe|Ontario$/i.test(p));
  return [first, rest[0]].filter(Boolean).join(", ");
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`);
    const j = (await r.json()) as { display_name?: string };
    return j.display_name ? shortAddress(j.display_name) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export function LocationMap({
  value,
  rangeKm,
  onChange,
  className,
}: {
  value: GeoLocation;
  rangeKm: number;
  onChange: (v: GeoLocation) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: typeof Leaflet; map: Leaflet.Map; marker: Leaflet.Marker; circle: Leaflet.Circle } | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<NominatimHit[]>([]);
  const [busy, setBusy] = useState(false);

  const place = async (lat: number, lng: number, address?: string) => {
    onChangeRef.current({ address: address ?? (await reverseGeocode(lat, lng)), lat, lng });
  };

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod.default ?? mod) as typeof Leaflet;
      if (cancelled || !container.current || ref.current) return;
      const map = L.map(container.current, { zoomControl: false, attributionControl: false }).setView([value.lat, value.lng], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:9999px;background:#0a0a0a;border:3px solid #fff;box-shadow:0 0 0 2px #0a0a0a"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([value.lat, value.lng], { draggable: true, icon }).addTo(map);
      const circle = L.circle([value.lat, value.lng], { radius: rangeKm * 1000, color: "#0a0a0a", weight: 1, fillColor: "#0a0a0a", fillOpacity: 0.04 }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        void place(p.lat, p.lng);
      });
      map.on("click", (e: Leaflet.LeafletMouseEvent) => void place(e.latlng.lat, e.latlng.lng));
      ref.current = { L, map, marker, circle };
    });
    return () => {
      cancelled = true;
      ref.current?.map.remove();
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker, circle and viewport in sync with props.
  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    r.marker.setLatLng([value.lat, value.lng]);
    r.circle.setLatLng([value.lat, value.lng]);
    r.circle.setRadius(rangeKm * 1000);
    r.map.fitBounds(r.circle.getBounds(), { padding: [12, 12], animate: true });
  }, [value.lat, value.lng, rangeKm]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&viewbox=${GTA_VIEWBOX}&q=${encodeURIComponent(q)}`
      );
      setHits((await r.json()) as NominatimHit[]);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => void place(pos.coords.latitude, pos.coords.longitude),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="relative">
        <div ref={container} className="h-44 w-full bg-muted" aria-label="Map" />
        <div className="absolute inset-x-2 top-2 z-[400] flex gap-1">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="Search address"
              className="h-8 bg-background/95 pr-8 text-sm shadow-sm backdrop-blur"
            />
            <Icon icon={busy ? "lucide:loader-circle" : "lucide:search"} className={cn("absolute top-2 right-2.5 size-4 text-muted-foreground", busy && "animate-spin")} />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" className="bg-background/95 backdrop-blur" onClick={locate} aria-label="Use my location">
                <Icon icon="lucide:locate-fixed" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Use my location</TooltipContent>
          </Tooltip>
        </div>
        {hits.length > 0 && (
          <ul className="absolute inset-x-2 top-11 z-[400] overflow-hidden rounded-md border bg-popover text-sm shadow-md">
            {hits.map((h) => (
              <li key={`${h.lat},${h.lon}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    setHits([]);
                    setQuery("");
                    void place(Number(h.lat), Number(h.lon), shortAddress(h.display_name));
                  }}
                >
                  <Icon icon="lucide:map-pin" className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{shortAddress(h.display_name)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Icon icon="lucide:map-pin" className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{value.address}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{rangeKm} km</span>
      </div>
      <p className="px-3 pb-1.5 text-[10px] text-muted-foreground/70">© OpenStreetMap contributors</p>
    </div>
  );
}
