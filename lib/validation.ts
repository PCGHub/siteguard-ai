import { z } from "zod";
export const emailInput = z.email().max(254);
export const loginInput = z.object({
  email: emailInput,
  password: z.string().min(1).max(128),
});
export const credentials = z.object({
  email: emailInput,
  password: z.string().min(12).max(128),
});
export const organizationInput = z.object({
  name: z.string().trim().min(2).max(100),
});
export const projectInput = z.object({
  organization_id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().max(200),
  industry: z.enum([
    "Construction",
    "Oil & Gas",
    "Manufacturing",
    "Industrial maintenance",
  ]),
});
export function safeNext(value: string | null) {
  return value === "/reset-password" ? value : "/dashboard";
}
