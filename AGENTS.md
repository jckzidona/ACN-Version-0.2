<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Managers and organization admins land on `/reports`; workers land on `/dashboard`, keeping role-specific starting views clear.
- Staff management (add/edit/deactivate/role changes) is org_admin-only, CARMiS-style: `admin.functions.ts` uses `requireAdmin`, and the manager console hides the Staff and roles section for non-admins.
- Group-session child links must reference children already stored under the attendee's Client file → Family; server-side validation enforces the parent relationship.
- Client directory sharing uses authenticated, organization-scoped RPC projections and allowlisted updates; original client RLS still protects intake narratives. Why: sharing identity must not expose sensitive client columns through direct queries.
- Private service records retain their own department scope independently of client-directory sharing; reports force scopedDepartment(). Why: Settlement and Counselling must never see each other's case notes, assessments or service narratives.
- Funder reports (ACN Client Services Summary, Monthly Activity) are computed in funder-reports.functions.ts with scopedDepartment(); interactions = case notes + attended group-session attendances. Why: same department isolation and one source of truth as other reports.
- Report PDFs are built only in `src/lib/pdf-export.ts` and `src/lib/funder-reports-pdf.ts`, which load jsPDF on demand and reuse the data returned by the report server functions. Why: keeps PDF code out of the initial bundle and stops exports from drifting apart from the on-screen numbers; Excel builders stay separate.
- Counselling Monthly Report questions live only in src/lib/counselling-report-schema.ts; the case-note form, server validation, Excel and PDF all read it. Why: one list keeps form and exports in step.
- Counselling Monthly Report is a standalone form (CounsellingMonthlyReportDialog) saved to counselling_reports (case_note_id stays empty); counselling_monthly_reports is DEPRECATED and unused. Why: workers submit it separately, like the old Microsoft Form; one table keeps listings and exports simple.
- The Counselling Monthly Activity Report layout and per-cell tint roles (headings, metric headers, labels and values) live only in src/lib/counselling-monthly-report.ts; screen, Excel and PDF all render them, with screen colours expressed through global sheet tokens. Why: keeps all three aligned with the manager's Excel template without changing aggregation.
- Settlement Monthly Activity Report pairings, tints and narrative labels live in src/lib/settlement-monthly-report.ts and are shared by screen, Excel and PDF; preserve server-provided sections and figures. Why: presentation stays aligned without changing Settlement reporting rules.
- Settlement monthly submissions store server-recomputed report snapshots and report-level narratives in settlement_monthly_reports; workers are forced to their own figures and managers read submissions only within their department. Why: month-end exports preserve submitted figures without exposing another department's records.
- Settlement report preview and submission call the same createServerOnlyFn calculation with the authenticated context; never call a server-function RPC from another handler. Why: nested RPC stubs can be missing from the published manifest and lose authentication context.
- General statistics retain the original dashboard in reports.tsx; report-sheet.ts models the existing displayed measures for paired Excel/PDF tables and the Client Services Summary preview/exports, without adding totals or questionnaire fields. Why: exports stay consistent while preserving on-screen statistics and department boundaries.
- Counselling Excel Responses sheet colours resolve through questionTint() from the Monthly Activity layout definitions; Responses retains individual answers in paired question/answer tables. The fill-in questionnaire uses standard app section and control tokens independently. Why: exports stay aligned while the form retains its restrained original appearance.
- Counselling report queries fetch the union of the selected period and the end date's fiscal year, then partition period and YTD rows separately. Why: custom ranges must not lose pre-April submissions or inflate fiscal-year totals.
- Client registration RPC and insert guard share the database identity predicate, requiring matching normalized names and two matching known birth dates within the organization. Why: missing birth dates are not proof of identity and must not block distinct same-name people.
- Public marketing copy describes implemented controls and AI review requirements without promising accuracy, regulatory compliance or unverified data residency. Why: product behavior is not evidence of certification or hosting location.
- The public welcome page keeps its overview compact and opens demonstration requests and detailed privacy information in accessible dialogs; reuse DemoRequestForm unchanged. Why: visitors can reach the primary actions without scrolling through the full form.
- The auth form mode is driven by validated optional URL search state, defaulting to sign-in. Why: account-creation links, reloads and history consistently show the requested form without changing authentication behavior.
- Voice transcription uses an authenticated multipart/SSE server route with bounded status-aware retries, a durable server-only provider-denial circuit breaker, and in-memory resumable recording parts. Why: complete audio and completed transcripts survive transient failures without exposing recordings or silently replaying terminal errors.
- CSV downloads serialize every cell through csvDocument/csvCell, quoting delimiters and neutralizing formula/control prefixes. Why: user-entered values must not execute as spreadsheet formulas, including in existing saved records.
