const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const ALLOWED_HOURLY = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m";
const MIN_DATE = "1940-01-01";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...headers }
  });
}

function error(message, status = 400) {
  return json({ error: message, reason: message }, status, { "cache-control": "no-store" });
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "weather-archive-worker" }, 200, { "cache-control": "no-store" });
    }

    if (request.method !== "GET") {
      return error("Only GET requests are supported.", 405);
    }

    if (url.pathname === "/api/geocode") {
      const name = (url.searchParams.get("name") || "").trim();
      if (name.length < 2 || name.length > 100) return error("Enter a location between 2 and 100 characters.");
      const count = Math.max(1, Math.min(10, Number.parseInt(url.searchParams.get("count") || "6", 10) || 6));
      const upstream = new URL(GEO_URL);
      upstream.searchParams.set("name", name);
      upstream.searchParams.set("count", String(count));
      upstream.searchParams.set("language", "en");
      upstream.searchParams.set("format", "json");
      return proxyJson(upstream, ctx, 60 * 60);
    }

    if (url.pathname === "/api/archive") {
      const lat = Number(url.searchParams.get("latitude"));
      const lon = Number(url.searchParams.get("longitude"));
      const start = url.searchParams.get("start_date") || "";
      const end = url.searchParams.get("end_date") || "";
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return error("Latitude must be between -90 and 90.");
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) return error("Longitude must be between -180 and 180.");
      if (!validDate(start) || !validDate(end) || start < MIN_DATE || end < start) {
        return error("Invalid date range. Historical data starts on 1 January 1940.");
      }
      const startMs = Date.parse(`${start}T00:00:00Z`);
      const endMs = Date.parse(`${end}T00:00:00Z`);
      if ((endMs - startMs) / 86400000 > 60) return error("Requests may cover at most 61 calendar days.");
      const upstream = new URL(ARCHIVE_URL);
      upstream.searchParams.set("latitude", String(lat));
      upstream.searchParams.set("longitude", String(lon));
      upstream.searchParams.set("start_date", start);
      upstream.searchParams.set("end_date", end);
      upstream.searchParams.set("hourly", ALLOWED_HOURLY);
      upstream.searchParams.set("timezone", "auto");
      return proxyJson(upstream, ctx, 6 * 60 * 60);
    }

    return env.ASSETS.fetch(request);
  }
};

async function proxyJson(upstreamUrl, ctx, ttlSeconds) {
  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: { "accept": "application/json" },
      cf: { cacheTtl: ttlSeconds, cacheEverything: true }
    });
    const body = await response.text();
    const headers = new Headers({
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": response.ok ? `public, max-age=${Math.min(ttlSeconds, 3600)}` : "no-store",
      "x-content-type-options": "nosniff"
    });
    return new Response(body, { status: response.status, headers });
  } catch {
    return error("The upstream weather service could not be reached. Please try again.", 502);
  }
}
