import { AuthForm } from "@/components/auth-form";
import { login } from "@/app/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <AuthForm
      title="Sign in"
      description="Welcome back. Continue to your company workspace."
      action={login}
      mode="login"
      message={message}
    />
  );
}
