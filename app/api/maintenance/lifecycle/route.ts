import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileLifecycle } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const configured = process.env.LIFECYCLE_CLEANUP_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;

  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await reconcileLifecycle();
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
