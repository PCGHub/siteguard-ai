import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { configured, supabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash"),
    type = request.nextUrl.searchParams.get("type");
  if (
    configured() &&
    token_hash &&
    (type === "signup" || type === "recovery")
  ) {
    const db = await supabase();
    const { error } = await db.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error)
      return new NextResponse(null, {
        status: 303,
        headers: {
          Location:
            type === "recovery"
              ? "/reset-password"
              : "/login?message=Email+confirmed.+Sign+in+to+continue.",
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
  }
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location:
        "/login?message=Confirmation+link+is+invalid+or+expired.+Request+a+new+confirmation+email.",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
