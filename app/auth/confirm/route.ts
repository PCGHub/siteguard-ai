import { NextRequest, NextResponse } from "next/server";
import { configured, supabase } from "@/lib/supabase/server";

const invalid =
  "/login?message=Confirmation+link+is+invalid+or+expired.+Open+the+latest+email+in+the+same+browser+that+requested+it,+or+request+a+new+confirmation+or+recovery+email.";
function destination(recovery: boolean) {
  return recovery
    ? "/reset-password"
    : "/login?message=Email+confirmed.+Sign+in+to+continue.";
}
function finish(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  // Reject ambiguous credentials and provider errors; never echo their contents.
  if (
    !configured() ||
    params.has("error") ||
    params.has("error_code") ||
    ["code", "token_hash", "type", "sb_flow_id"].some(
      (key) => params.getAll(key).length > 1,
    ) ||
    (params.has("code") && params.has("token_hash"))
  )
    return finish(invalid);

  if (code && /^[A-Za-z0-9_-]{1,2048}$/.test(code)) {
    const flowId = params.get("sb_flow_id");
    if (flowId !== null && !/^[a-f0-9]{32}$/.test(flowId))
      return finish(invalid);
    const db = await supabase();
    // The SDK requires the HttpOnly PKCE verifier set by signup/resend/recovery.
    // Recovery intent comes from that verifier, never a caller-supplied next/type.
    const { data, error } = await db.auth.exchangeCodeForSession(
      code,
      flowId === null ? undefined : { flowId },
    );
    if (!error && data.session)
      return finish(
        destination("redirectType" in data && data.redirectType === "recovery"),
      );
  } else if (
    !params.has("code") &&
    token_hash &&
    token_hash.length <= 2048 &&
    (type === "signup" || type === "recovery")
  ) {
    const db = await supabase();
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error) return finish(destination(type === "recovery"));
  }
  return finish(invalid);
}
