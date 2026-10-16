// The application has no browser Supabase client. All token refreshes and mutations
// go through the server, so JavaScript does not need access to session cookies.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
