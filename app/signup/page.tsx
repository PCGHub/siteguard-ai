import { AuthForm } from "@/components/auth-form";
import { signup } from "@/app/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <AuthForm
      title="Create account"
      description="Start with your work email. Use at least 12 characters for your password."
      action={signup}
      mode="signup"
      message={message}
    />
  );
}
