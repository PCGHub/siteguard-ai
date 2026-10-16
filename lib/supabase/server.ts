import "server-only";
import { appOrigin } from "@/lib/auth-origin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "./cookies";
export function configured() {
  try {
    appOrigin();
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  } catch {
    return false;
  }
}
export async function supabase() {
  if (!configured())
    throw new Error("Supabase is not configured. Follow README.md.");
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server components cannot persist refresh cookies; proxy handles refresh. */
          }
        },
      },
    },
  );
}
