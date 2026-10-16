export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { configured, supabase } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";
import { resetPassword } from "@/app/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!configured())
    redirect(
      "/login?message=Open+a+valid+password+recovery+link+or+sign+in+first.",
    );
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    redirect(
      "/login?message=Open+a+valid+password+recovery+link+or+sign+in+first.",
    );
  const { message } = await searchParams;
  return (
    <AuthForm
      title="Set new password"
      description="Choose a new password for your account."
      action={resetPassword}
      mode="reset"
      message={message}
    />
  );
}
