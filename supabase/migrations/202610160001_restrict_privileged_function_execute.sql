-- Harden privileges on privileged functions created by foundation migration.
-- Revoke inherited PUBLIC access and explicit anon access; retain only required
-- authenticated RPC/policy helper access. Trigger helper is not callable directly.
revoke execute on function public.audit_project_creation() from public, anon, authenticated;
revoke execute on function public.create_organization(text) from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_company_admin(uuid) from public, anon, authenticated;
revoke execute on function public.storage_org_member(text) from public, anon, authenticated;
grant execute on function public.create_organization(text),
  public.is_member(uuid), public.is_company_admin(uuid),
  public.storage_org_member(text) to authenticated;
-- Remaining signed-in SECURITY DEFINER advisor notices require architectural
-- review. Never remove needed grants merely to silence the linter.
