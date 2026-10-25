"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GeoLocation } from "@/components/meal/location-map";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    __gmapsLoading?: Promise<void>;
  }
}

function loadGoogleMaps(key: string): Promise<void> {
  if (typeof google !== "undefined" && typeof google.maps?.importLibrary === "function") return Promise.resolve();
  if (!window.__gmapsLoading) {
    window.__gmapsLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places,geocoding`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(s);
    });
  }
  return window.__gmapsLoading;
}

const GTA_BOUNDS = { north: 43.95, south: 43.45, east: -79.0, west: -79.85 };

function shortAddress(formatted: string): string {
  return formatted
    .replace(/,\s*Canada$/, "")
    .replace(/\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d/g, "")
    .replace(/,\s*ON\b/, "")
    .trim();
}

export function GoogleLocationMap({
  apiKey,
  value,
  rangeKm,
  onChange,
  className,
}: {
  apiKey: string;
  value: GeoLocation;
  rangeKm: number;
  onChange: (v: GeoLocation) => void;
  className?: string;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLDivElement>(null);
  const ref = useRef<{ map: google.maps.Map; marker: google.maps.Marker; circle: google.maps.Circle; geocoder: google.maps.Geocoder } | null>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapEl.current || ref.current) return;
        const { Map, Circle } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        const { Marker } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;
        const { Geocoder } = (await google.maps.importLibrary("geocoding")) as google.maps.GeocodingLibrary;
        const { PlaceAutocompleteElement } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        if (cancelled || !mapEl.current) return;

        const center = { lat: value.lat, lng: value.lng };
        const map = new Map(mapEl.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        const marker = new Marker({
          map,
          position: center,
          draggable: true,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#0a0a0a", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 },
        });
        const circle = new Circle({ map, center, radius: rangeKm * 1000, strokeColor: "#059669", strokeWeight: 1, fillColor: "#059669", fillOpacity: 0.06, clickable: false });
        const geocoder = new Geocoder();
        ref.current = { map, marker, circle, geocoder };

        const place = async (lat: number, lng: number, address?: string) => {
          let label = address;
          if (!label) {
            try {
              const { results } = await geocoder.geocode({ location: { lat, lng } });
              label = results[0] ? shortAddress(results[0].formatted_address) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            } catch {
              label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
          }
          onChangeRef.current({ address: label, lat, lng });
        };

        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) void place(p.lat(), p.lng());
        });
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) void place(e.latLng.lat(), e.latLng.lng());
        });

        // Address search (new Places autocomplete element)
        if (searchEl.current && searchEl.current.childElementCount === 0) {
          const ac = new PlaceAutocompleteElement({ includedRegionCodes: ["ca"], locationBias: GTA_BOUNDS });
          ac.id = "meal-finder-place";
          searchEl.current.appendChild(ac);
          ac.addEventListener("gmp-select", async (ev: Event) => {
            const prediction = (ev as Event & { placePrediction?: { toPlace(): google.maps.places.Place } }).placePrediction;
            if (!prediction) return;
            const p = prediction.toPlace();
            await p.fetchFields({ fields: ["location", "formattedAddress"] });
            if (p.location) void place(p.location.lat(), p.location.lng(), p.formattedAddress ? shortAddress(p.formattedAddress) : undefined);
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Map unavailable");
      }
    })();
    return () => {
      cancelled = true;
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    const pos = { lat: value.lat, lng: value.lng };
    r.marker.setPosition(pos);
    r.circle.setCenter(pos);
    r.circle.setRadius(rangeKm * 1000);
    const b = r.circle.getBounds();
    if (b) r.map.fitBounds(b, 12);
  }, [value.lat, value.lng, rangeKm]);

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const r = ref.current;
        if (!r) return;
        void r.geocoder.geocode({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).then(({ results }) => {
          onChangeRef.current({ address: results[0] ? shortAddress(results[0].formatted_address) : "My location", lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className={cn("overflow-hidden rounded-xl bg-muted/40", className)}>
      <div className="relative">
        <div ref={mapEl} className="h-44 w-full bg-muted" aria-label="Map" />
        <div className="absolute inset-x-2 top-2 z-10 flex gap-1">
          <div ref={searchEl} className="min-w-0 flex-1 overflow-hidden rounded-md bg-background/95 shadow-sm backdrop-blur [&_gmp-place-autocomplete]:block [&_gmp-place-autocomplete]:w-full" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" className="shrink-0 bg-background/95 backdrop-blur" onClick={locate} aria-label="Use my location">
                <Icon icon="lucide:locate-fixed" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Use my location</TooltipContent>
          </Tooltip>
        </div>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 px-3 text-center text-xs text-muted-foreground">
            <Icon icon="lucide:map-off" className="mr-1.5 size-3.5" />
            {error}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Icon icon="lucide:map-pin" className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{value.address}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{rangeKm} km</span>
      </div>
    </div>
  );
}
