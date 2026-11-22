import { TINT_HEX } from './counselling-monthly-report';
import { tableBands, type SheetMeta, type ReportSection } from './report-sheet';
export async function exportSheetWorkbook(meta: SheetMeta, sections: ReportSection[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(); wb.creator = 'ACN — Assistance Case Note';
  const fill = (t: string) => ({type: 'pattern' as const, pattern: 'solid' as const, fgColor: {argb: `FF${t}`}});
  const thin = {style: 'thin' as const, color: {argb: 'FF9A9A9A'}};
  for (const section of sections) {
    const ws = wb.addWorksheet(section.title.slice(0,31), {views: [{showGridLines: false}]});
    const side = Math.max(5,...section.tables.filter(t=>!t.wide).map(t=>t.headers.length));
    const width = Math.max(side*2+1,...section.tables.map(t=>t.headers.length));
    for(let c=1;c<=width;c++) ws.getColumn(c).width = c===side+1 ? 4 : c===1 || c===side+2 ? 38 : 16;
    let r=1;
    for(const text of [meta.title, `${meta.orgName} · ${meta.department} · ${meta.from} to ${meta.to}`, ...(meta.details ?? []).map(([k,v])=>`${k}: ${v}`),section.title]) {
      ws.mergeCells(r,1,r,width); ws.getCell(r,1).value=text; ws.getCell(r,1).font={name:'Arial',size:r===1?14:10,bold:r===1||text===section.title}; ws.getCell(r,1).alignment={wrapText:true}; ws.getRow(r).height=24; r++;
    }
    r++;
    for(const band of tableBands(section.tables)) {
      let end=r;
      band.forEach((t,i)=>{
        const c0=i*(side+1)+1;
        ws.mergeCells(r,c0,r,c0+t.headers.length-1); const title=ws.getCell(r,c0); title.value=t.title; title.fill=fill(TINT_HEX[t.tint]); title.font={name:'Arial',size:11,bold:true};
        [t.headers,...t.rows].forEach((row,ri)=>{
          row.forEach((v,ci)=> {const c=ws.getCell(r+ri+1,c0+ci); c.value=v; c.border={top:thin,bottom:thin,left:thin,right:thin}; c.font={name:'Arial',size:10,bold:ri===0||ci===0}; c.alignment={wrapText:true,vertical:'middle',horizontal:ci?'center':'left'}; if(ri===0)c.fill=fill(TINT_HEX[t.tint]);});
          const height=ri===0?48:Math.max(22,...row.map((v,ci)=>Math.ceil(String(v).length/(ci?16:35))*14)); ws.getRow(r+ri+1).height=Math.max(ws.getRow(r+ri+1).height??0,height);
        }); end=Math.max(end,r+t.rows.length+2);
      }); r=end+2;
    }
    if(meta.note){ws.mergeCells(r,1,r,width);ws.getCell(r,1).value=meta.note;ws.getCell(r,1).alignment={wrapText:true};ws.getRow(r).height=40;}
    ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};ws.headerFooter.oddFooter='&LConfidential&RPage &P of &N';
  }
  const buf=await wb.xlsx.writeBuffer(); const url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`${meta.filename}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
