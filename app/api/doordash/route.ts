import { NextResponse } from "next/server";
import { GTA_DISH_CATALOGUE } from "../../../lib/gta-catalogue";

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createDoorDashJwt(
  developerId: string,
  keyId: string,
  signingSecret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
    "dd-ver": "DD-JWT-V1",
  };
  const payload = {
    aud: "doordash",
    iss: developerId,
    kid: keyId,
    iat: now,
    exp: now + 300,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const secretBytes = base64UrlDecode(signingSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secretBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;
}

export async function POST(request: Request) {
  let body: {
    dishId?: string;
    dropoffAddress?: string;
    neighborhood?: string;
    developerId?: string;
    keyId?: string;
    signingSecret?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dish =
    GTA_DISH_CATALOGUE.find((d) => d.id === body.dishId) ?? GTA_DISH_CATALOGUE[0];
  const matchedLoc =
    dish.locations.find((l) => l.neighborhood === body.neighborhood) ??
    dish.locations[0];

  const dropoff =
    body.dropoffAddress?.trim() || "200 Bay St, Toronto, ON M5J 2J2";

  const devId = body.developerId?.trim() || process.env.DOORDASH_DEVELOPER_ID;
  const keyId = body.keyId?.trim() || process.env.DOORDASH_KEY_ID;
  const secret = body.signingSecret?.trim() || process.env.DOORDASH_SIGNING_SECRET;

  const doorDashDishSearchUrl = `https://www.doordash.com/search/store/${encodeURIComponent(
    `${dish.restaurant} ${dish.name.split("+")[0]?.trim() ?? dish.name} ${matchedLoc.city}`
  )}/`;

  // If DoorDash Developer credentials are provided, sign DD-JWT-V1 and call DoorDash Drive v2 Quote API
  if (devId && keyId && secret) {
    try {
      const jwt = await createDoorDashJwt(devId, keyId, secret);
      const externalDeliveryId = `gta-health-${dish.id}-${Date.now()}`;
      const ddResp = await fetch("https://openapi.doordash.com/drive/v2/quotes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_delivery_id: externalDeliveryId,
          pickup_address: matchedLoc.address,
          pickup_business_name: dish.restaurant,
          dropoff_address: dropoff,
          order_value: Math.round(dish.priceCad * 100),
          currency: "CAD",
        }),
      });

      const ddJson = await ddResp.json();
      return NextResponse.json({
        mode: ddResp.ok ? "live_doordash_drive_v2" : "doordash_api_response",
        status: ddResp.status,
        jwtGenerated: true,
        dishId: dish.id,
        dishName: dish.name,
        restaurant: dish.restaurant,
        pickupAddress: matchedLoc.address,
        dropoffAddress: dropoff,
        storeCheckoutUrl: matchedLoc.doorDashUrl,
        dishSearchUrl: doorDashDishSearchUrl,
        directRestaurantUrl: matchedLoc.directOrderUrl,
        apiPayload: ddJson,
      });
    } catch (err) {
      return NextResponse.json(
        {
          mode: "doordash_jwt_error",
          error: err instanceof Error ? err.message : "Failed to sign DoorDash JWT.",
          storeCheckoutUrl: matchedLoc.doorDashUrl,
          dishSearchUrl: doorDashDishSearchUrl,
        },
        { status: 400 }
      );
    }
  }

  // Instant GTA Storefront & Delivery Estimator + Deep Link Generator (works with zero API keys!)
  const etaMinutes =
    matchedLoc.neighborhood === "Downtown & Financial District"
      ? "22–32 min"
      : matchedLoc.neighborhood === "King West & Liberty Village" ||
          matchedLoc.neighborhood === "Yorkville & Midtown"
        ? "25–35 min"
        : "28–40 min";

  return NextResponse.json({
    mode: "gta_storefront_bridge",
    jwtGenerated: false,
    dishId: dish.id,
    dishName: dish.name,
    restaurant: dish.restaurant,
    neighborhood: matchedLoc.neighborhood,
    pickupAddress: matchedLoc.address,
    dropoffAddress: dropoff,
    estimatedDeliveryWindow: etaMinutes,
    estimatedDeliveryFeeCad: 2.99,
    dishPriceCad: dish.priceCad,
    storeCheckoutUrl: matchedLoc.doorDashUrl,
    dishSearchUrl: doorDashDishSearchUrl,
    directRestaurantUrl: matchedLoc.directOrderUrl,
    googleMapsUrl: matchedLoc.googleMapsUrl,
    note: "Ready for 1-click DoorDash Toronto store checkout or dish search. Paste DoorDash Developer Portal credentials (developer_id, key_id, signing_secret) to enable live DD-JWT-V1 Drive v2 quotes.",
  });
}
