import { NextResponse } from "next/server";

/**
 * Cart-abandonment job — OUT OF SCOPE for now, so it's disabled and never sends.
 * The original logic is kept below (commented) to re-enable later.
 */
export async function GET() {
  return NextResponse.json({ ok: true, disabled: true });
}

export async function POST() {
  return NextResponse.json({ ok: true, disabled: true });
}

/* --- Original job (disabled until cart-abandonment is back in scope) ---
import { NextRequest, NextResponse } from "next/server";
import { sendCartAbandonmentReminders } from "@/lib/notifications";

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      new URL(req.url).searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await sendCartAbandonmentReminders();
    return NextResponse.json(result);
  } catch (e) {
    console.error("cart-abandonment cron failed", e);
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
*/
