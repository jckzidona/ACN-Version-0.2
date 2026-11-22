import { z } from "zod";
import type { WorkContext } from "./authz";

export function settlementWorkerScope(ctx: WorkContext, requested: string | null) {
  return ctx.isManager ? requested : ctx.userId;
}

export function settlementMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Select a valid report month.");
  const year = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
  const to = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to };
}

export const settlementNarrativeSchema = z.object({
  program: z.string().trim().min(1, "Enter the program.").max(200),
  submitted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cultural: z.string().max(5000), successes: z.string().max(5000), challenges: z.string().max(5000),
  plans: z.string().max(5000), incidents: z.string().max(5000), meetings: z.string().max(5000),
  referrals: z.string().max(5000), events: z.string().max(5000), organized: z.string().max(5000),
  comments: z.string().max(5000).default(""),
});

export const blankSettlementNarrative = () => ({
  program: "", submitted: new Date().toISOString().slice(0, 10), cultural: "", successes: "", challenges: "",
  plans: "", incidents: "", meetings: "", referrals: "", events: "", organized: "", comments: "",
});