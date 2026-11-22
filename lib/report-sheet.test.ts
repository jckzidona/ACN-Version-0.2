import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statisticsSheets, clientServicesSheets } from './report-sheet';
import type { ReportExportInput } from './excel-export';

const input: ReportExportInput = {
  orgName: 'ACN', from: '2026-10-01', to: '2026-10-26', department: 'Settlement',
  totals: { activeClients: 7, groupAttendances: 99, unmentionedMetric: 123 },
  staffCols: [['name','Staff member'],['caseNotes','Case notes']], staff: [{name:'Worker',caseNotes:5,hidden:12}],
  breakdowns: { Gender: [{label:'Female',value:2},{label:'Male',value:1}] }, needs: [{area:'Housing',High:3,Medium:2,Low:1,'No need':0}],
  counselling: {hasDepartment:false, totals:{sessions:999}, cols:[], counsellors:[], breakdowns:{}},
};
test('statistics exports contain only the reports existing measures, no added totals or hidden metrics',()=>{
  const sections=statisticsSheets(input);
  const rows=sections.flatMap(s=>s.tables.flatMap(t=>t.rows));
  assert.ok(rows.some(r=>r[0]==='Active clients'&&r[1]===7));
  assert.equal(rows.some(r=>r.includes(99)||r.includes(123)||r.includes(999)||r[0]==='Total'),false);
  assert.deepEqual(sections[1]?.tables[0]?.rows,[['Worker','5']]);
  assert.deepEqual(sections[3]?.tables[0]?.rows,[['Housing',3,2,1,0]]);
});
test('client services presentation preserves all four cohorts and their supplied values',()=>{
  const sections=clientServicesSheets([{attribute:'Gender',category:'Female',values:[1,2,3,4,5,6,7,8,9,10,11,12]}]);
  assert.deepEqual(sections[0]?.tables.map(t=>t.rows),[[['Female',1,2,3]],[['Female',4,5,6]],[['Female',7,8,9]],[['Female',10,11,12]]]);
});