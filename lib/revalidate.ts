/**
 * Tell the storefront to refresh cached catalogue data immediately after a
 * change here, so new/edited products & categories show up near-instantly
 * (instead of waiting for the storefront's time-based cache window).
 *
 * Fire-and-forget: never throws, so a hiccup can't fail the admin action.
 * Needs STOREFRONT_URL + REVALIDATE_SECRET env (matching the storefront's
 * REVALIDATE_SECRET). If either is unset it silently no-ops.
 */
export async function revalidateStorefront(tags: string[]): Promise<void> {
  const url = process.env.STOREFRONT_URL?.replace(/\/+$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret || tags.length === 0) return;
  try {
    await fetch(`${url}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, tags }),
      // Don't hang the admin request on a slow storefront.
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn(`[revalidateStorefront] failed: ${String(e)}`);
  }
}
