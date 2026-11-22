// Styled Excel export for ACN reports (uses exceljs, loaded on demand in the browser).
type Cell = string | number | null | undefined;
type Row = { label: string; value: number };

export type ReportExportInput = {
  orgName: string;
  from: string;
  to: string;
  department: string;
  totals: Record<string, number>;
  staffCols: readonly (readonly [string, string])[];
  staff: Record<string, unknown>[];
  breakdowns: Record<string, Row[]>;
  needs: { area: string; High: number; Medium: number; Low: number; "No need": number }[];
  counselling: {
    hasDepartment: boolean;
    totals: Record<string, number>;
    cols: readonly (readonly [string, string])[];
    counsellors: Record<string, unknown>[];
    breakdowns: Record<string, Row[]>;
  };
};

export async function exportStyledReport(d: ReportExportInput) {
  const [{ statisticsSheets }, { exportSheetWorkbook }] = await Promise.all([import('./report-sheet'), import('./sheet-excel-export')]);
  await exportSheetWorkbook({title: 'ACN — Reports & statistics', orgName: d.orgName.replace(/\bECRC\b/gi, 'ACN') || 'ACN', department: d.department, from: d.from, to: d.to, filename: `ACN-report-${d.from}-to-${d.to}`}, statisticsSheets(d));
}
