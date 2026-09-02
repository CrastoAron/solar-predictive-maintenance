export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function isNgrokUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".ngrok-free.app") || hostname.endsWith(".ngrok-free.dev");
  } catch {
    return false;
  }
}

/**
 * Free ngrok tunnels return a browser-warning HTML page unless this header is
 * present. The header is intentionally limited to ngrok URLs so deployed APIs
 * receive only the headers they require.
 */
export function apiHeaders(token?: string | null, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  if (isNgrokUrl(API_BASE)) headers["ngrok-skip-browser-warning"] = "true";

  return headers;
}
