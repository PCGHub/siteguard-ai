/** Operator configuration only: never infer auth destinations from request headers. */
export function appOrigin(value = process.env.APP_ORIGIN): string {
  if (!value) throw new Error("APP_ORIGIN is required for authentication.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin, or an explicit local HTTP origin.",
    );
  }
  return url.origin;
}
export function confirmationRedirect() {
  return `${appOrigin()}/auth/confirm`;
}
