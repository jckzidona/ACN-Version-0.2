import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportSpreadsheet } from "@/components/ReportSpreadsheet";
import { clientServicesMeta, clientServicesSheets } from "@/lib/report-sheet";
import { getAcnClientServices } from "@/lib/funder-reports.functions";
import { useSession } from "@/hooks/useSession";
import { CounsellingMonthlyReportDialog } from "@/components/CounsellingMonthlyReportDialog";
import { SettlementMonthlyReportDialog } from "@/components/SettlementMonthlyReportDialog";

export function FunderReportsMenu({ from, to, departmentId, enabled }: { from: string; to: string; departmentId: string | null; enabled: boolean }) {
  const clientServices = useServerFn(getAcnClientServices);
  const { data: session } = useSession();
  const isAdmin = session?.roles.includes("org_admin") ?? false;
  const deptName = session?.department?.name ?? "";
  const showSettlement = isAdmin || /settlement/i.test(deptName);
  const showCounselling = isAdmin || /counsel/i.test(deptName);
  const [open, setOpen] = useState(false);
  const [csOpen, setCsOpen] = useState(false);
  const [crOpen, setCrOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: csData, isFetching: csLoading, error: csError } = useQuery({ queryKey: ["client-services-sheet", from, to, departmentId], queryFn: () => clientServices({data: {from,to,departmentId}}), enabled: csOpen });

  async function runClientServices(format: "excel" | "pdf") {
    setBusy(true);
    try {
      if (!csData || csLoading) return;
      const d = csData;
      if (format === "pdf") {
        const { exportAcnClientServicesPdf } = await import("@/lib/funder-reports-pdf");
        await exportAcnClientServicesPdf(d);
      } else {
        const { exportAcnClientServices } = await import("@/lib/funder-reports-export");
        await exportAcnClientServices(d);
      }
      toast.success(`Settlement — Client Services Summary (${format.toUpperCase()}) downloaded`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the report."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={!enabled || busy}><FileSpreadsheet className="mr-1.5 h-4 w-4" />Funder reports</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showSettlement && (<>
          <DropdownMenuItem onClick={() => setCsOpen(true)}>Settlement — Client Services Summary…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen(true)}>Settlement — Monthly Activity Report…</DropdownMenuItem>
          </>)}
          {showCounselling && <DropdownMenuItem onClick={() => setCrOpen(true)}>Counselling — Monthly Activity Report…</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <CounsellingMonthlyReportDialog
        from={from} to={to} departmentId={departmentId}
        canSubmit canExport
        open={crOpen} onOpenChange={setCrOpen}
      />

      <Dialog open={csOpen} onOpenChange={setCsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader><DialogTitle>Settlement — Client Services Summary</DialogTitle><DialogDescription>Period {from} to {to}.</DialogDescription></DialogHeader>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || csLoading || !csData} onClick={()=>runClientServices("excel")}><FileSpreadsheet />Export to Excel</Button><Button variant="outline" disabled={busy || csLoading || !csData} onClick={()=>runClientServices("pdf")}><FileDown />Export to PDF</Button></div>
          {csLoading && <p role="status">Loading report…</p>}
          {csError && <p role="alert" className="text-destructive">{csError instanceof Error ? csError.message : "Could not load report."}</p>}
          {csData && !csLoading && <ReportSpreadsheet meta={clientServicesMeta(csData)} sections={clientServicesSheets(csData.rows)} />}
        </DialogContent>
      </Dialog>
      <SettlementMonthlyReportDialog open={open} onOpenChange={setOpen} from={from} to={to} departmentId={departmentId} />
    </>
  );
}
