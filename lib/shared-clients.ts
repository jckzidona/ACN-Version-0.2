import type { Db, WorkContext } from "./authz";
import type { Database } from "@/integrations/supabase/types";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export const SHARED_INTAKE_KEYS = ["uci", "gender", "marital_status", "country_of_birth", "citizenship", "city", "province", "postal_code", "alt_phone", "other_languages", "clb_level", "intended_destination", "education", "employment_status", "occupation", "enrollments"] as const;

export function sharedIntake(value: Record<string, unknown>) {
  return Object.fromEntries(SHARED_INTAKE_KEYS.filter((key) => key in value).map((key) => [key, value[key]]));
}

export function ownsClientDetails(ctx: Pick<WorkContext, "isAdmin" | "departmentId">, departmentId: string | null) {
  return ctx.isAdmin || Boolean(ctx.departmentId && ctx.departmentId === departmentId);
}

// Explicit result types for additive RPCs until generated database types refresh.
export async function clientRpc<T>(sb: Db, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const rpc = sb.rpc as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: T; error: { message: string } | null }>;
  const { data, error } = await rpc.call(sb, name, args);
  if (error) throw new Error(error.message);
  return data;
}

export function sharedClientRows(sb: Db) {
  return clientRpc<ClientRow[]>(sb, "shared_client_directory");
}