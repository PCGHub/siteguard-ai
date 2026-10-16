import { AuthForm } from "@/components/auth-form";
import { resendConfirmation } from "@/app/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <AuthForm
      title="Resend confirmation email"
      description="Expired link? Request a fresh email, then use the newest confirmation link. If already verified, sign in instead."
      action={resendConfirmation}
      mode="resend"
      message={message}
    />
  );
}
