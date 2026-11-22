type Row = { label: string; value: number };

export type PdfReportInput = {
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

export async function exportReportPdf(d: PdfReportInput) {
  const { statisticsSheets } = await import('./report-sheet');
  await exportSheetPdf({title: 'ACN — Reports & statistics', orgName: d.orgName.replace(/\bECRC\b/gi,'ACN') || 'ACN', department: d.department, from: d.from, to: d.to, filename: `ACN-report-${d.from}-to-${d.to}`}, statisticsSheets(d));
}

export async function exportSheetPdf(meta: import('./report-sheet').SheetMeta, sections: import('./report-sheet').ReportSection[]) {
  const [{ jsPDF }, { default: autoTable }, { TINT_HEX }, { tableBands }] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./counselling-monthly-report'), import('./report-sheet')]);
  const doc = new jsPDF({orientation:'landscape',unit:'pt',format:'letter'});
  const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=30, GAP=14, HALF=(W-2*M-GAP)/2, TOP=82;
  const rgb=(hex:string):[number,number,number]=>[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
  const heading=()=>{doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(meta.title,M,25);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`${meta.orgName} · ${meta.department} · ${meta.from} to ${meta.to}`,M,42);doc.text(`Confidential · Page ${doc.getCurrentPageInfo().pageNumber}`,M,H-15);};
  const finalY=()=> (doc as unknown as {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY ?? TOP;
  sections.forEach((section,si)=>{
    if(si)doc.addPage();let y=TOP;
    if(meta.details?.length){autoTable(doc,{startY:60,body:meta.details,theme:'plain',margin:{left:M,right:M,top:TOP,bottom:36},styles:{fontSize:8},didDrawPage:heading});y=finalY()+16;}
    for(const band of tableBands(section.tables)){
      const needed = Math.max(...band.map(t => 52 + t.rows.reduce((sum, row) => sum + 18 + Math.max(0, Math.ceil(String(row[0] ?? '').length / 30) - 1) * 9, 0)));
      if(y + needed > H - 36 && y > TOP){doc.addPage();y=TOP;}
      const startPage=doc.getCurrentPageInfo().pageNumber;let endPage=startPage,endY=y;
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(section.title,M,y-10);
      band.forEach((t,i)=>{
        doc.setPage(startPage);const width=t.wide?W-2*M:HALF,x=M+i*(HALF+GAP);
        autoTable(doc,{startY:y,margin:{left:x,right:W-x-width,top:TOP,bottom:36},tableWidth:width,theme:'grid',head:[[{content:t.title,colSpan:t.headers.length}],t.headers],body:t.rows,styles:{fontSize:t.wide?6:8,cellPadding:3,textColor:[0,0,0],lineColor:[154,154,154],lineWidth:0.5},headStyles:{fillColor:rgb(TINT_HEX[t.tint]),textColor:[0,0,0],fontStyle:'bold',valign:'middle'},columnStyles:{0:{fontStyle:'bold',...(t.wide?{}:{cellWidth:width*0.38})}},didDrawPage:heading});
        const p=doc.getCurrentPageInfo().pageNumber;if(p>endPage){endPage=p;endY=finalY();}else if(p===endPage)endY=Math.max(endY,finalY());
      });doc.setPage(endPage);y=endY+20;
    }
  });
  if(meta.note){doc.addPage();heading();doc.setFontSize(9);doc.text(doc.splitTextToSize(meta.note,W-2*M),M,TOP);}
  doc.save(`${meta.filename}.pdf`);
}
