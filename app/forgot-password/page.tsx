import { AuthForm } from "@/components/auth-form";
import { requestReset } from "@/app/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <AuthForm
      title="Send recovery email"
      description="We will send a secure password recovery link."
      action={requestReset}
      mode="forgot"
      message={message}
    />
  );
}
