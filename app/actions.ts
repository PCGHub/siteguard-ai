"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { confirmationRedirect } from "@/lib/auth-origin";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { credentials, organizationInput, projectInput } from "@/lib/validation";
function fail(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}
export async function login(form: FormData) {
  const email = String(form.get("email") ?? ""),
    password = String(form.get("password") ?? "");
  if (!email || !password) fail("/login", "Enter your email and password.");
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error)
    fail(
      "/login",
      "Unable to sign in. Check your credentials and verify your email.",
    );
  redirect("/dashboard");
}
export async function signup(form: FormData) {
  const result = credentials.safeParse(Object.fromEntries(form));
  if (!result.success)
    fail("/signup", "Use a valid email and a password of 12–128 characters.");
  const db = await supabase();
  const { error } = await db.auth.signUp({
    ...result.data,
    options: { emailRedirectTo: confirmationRedirect() },
  });
  if (error) fail("/signup", "Unable to register. Try again later.");
  fail("/login", "Check your email to confirm your account before signing in.");
}
export async function logout() {
  const db = await supabase();
  const { error } = await db.auth.signOut();
  if (error) fail("/dashboard", "Sign-out failed. Please try again.");
  redirect("/login");
}
export async function requestReset(form: FormData) {
  const db = await supabase();
  const email = String(form.get("email") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email))
    fail("/forgot-password", "Enter a valid email.");
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: confirmationRedirect(),
  });
  if (error)
    fail(
      "/forgot-password",
      "Unable to request recovery right now. Please try again later.",
    );
  fail(
    "/forgot-password",
    "If this account exists, a recovery email has been sent.",
  );
}
export async function resetPassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 128)
    fail("/reset-password", "Use 12–128 characters.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db.auth.updateUser({ password });
  if (error)
    fail(
      "/reset-password",
      "Unable to update password. Request a new recovery email.",
    );
  await db.auth.signOut();
  fail("/login", "Password updated. Sign in again.");
}
export async function createOrganization(form: FormData) {
  const result = organizationInput.safeParse(Object.fromEntries(form));
  if (!result.success)
    fail("/onboarding", "Enter a company name of 2–100 characters.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db.rpc("create_organization", {
    organization_name: result.data.name,
  });
  if (error)
    fail("/onboarding", "Unable to create workspace. Please try again.");
  redirect("/dashboard");
}
export async function createProject(form: FormData) {
  const result = projectInput.safeParse(Object.fromEntries(form));
  if (!result.success) fail("/dashboard", "Check the project fields.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db
    .from("projects")
    .insert({ ...result.data, created_by: user.id });
  if (error)
    fail(
      "/dashboard",
      "Unable to create project. Check your role or choose a different name.",
    );
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function resendConfirmation(form: FormData) {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success)
    fail("/resend-confirmation", "Enter a valid email address.");
  const db = await supabase();
  const { error } = await db.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: confirmationRedirect() },
  });
  if (error)
    fail(
      "/resend-confirmation",
      "Unable to request confirmation right now. Please try again later.",
    );
  fail(
    "/resend-confirmation",
    "If this account is awaiting confirmation, a new email has been requested. Use the newest email.",
  );
}
