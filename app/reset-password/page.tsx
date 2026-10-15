import { AuthForm } from "@/components/auth-form";
import { resetPassword } from "@/app/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
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
