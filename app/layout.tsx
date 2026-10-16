import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SiteGuard AI | Workplace safety intelligence",
  description: "A private workspace for your company’s safety projects.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
