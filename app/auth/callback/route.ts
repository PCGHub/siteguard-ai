import { NextResponse } from "next/server";
// This application deliberately uses token-hash verification, not PKCE code exchange.
export function GET() {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location:
        "/login?message=This+link+uses+an+unsupported+format.+Request+a+new+confirmation+email,+or+sign+in+if+already+verified.",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
