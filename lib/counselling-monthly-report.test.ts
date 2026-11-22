import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyActivityReport, fiscalYearStart, counsellingReportWindow, counsellingReportPeriods, type ReportSubmission } from "./counselling-monthly-report";

const sub = (date: string, clientId: string | null, answers: ReportSubmission["answers"]): ReportSubmission => ({ date, clientId, answers });
type Sheet = ReturnType<typeof buildMonthlyActivityReport>;

const rowOf = (sheet: Sheet, heading: string, label: string) => {
  const blocks = sheet.flatMap((b) => [...b.left, ...b.right]).filter((b) => b.heading === heading);
  const r = blocks.flatMap((b) => b.rows).find((x) => x.label === label);
  assert.ok(r, `missing row ${label} under ${heading}`);
  return r;
};

test("fiscal year starts April 1", () => {
  assert.equal(fiscalYearStart("2026-10-31"), "2026-04-01");
  assert.equal(fiscalYearStart("2027-02-15"), "2026-04-01");
  assert.equal(fiscalYearStart("2026-04-01"), "2026-04-01");
});

test("January to June custom period includes pre-April submissions without adding them to fiscal YTD", () => {
  assert.deepEqual(counsellingReportWindow("2026-01-01", "2026-06-30"), { queryFrom: "2026-01-01", ytdFrom: "2026-04-01" });
  const dates = ["2025-12-31", "2026-01-01", "2026-03-31", "2026-04-01", "2026-06-30", "2026-07-01"];
  const periods = counsellingReportPeriods(dates.map((date) => sub(date, "c1", { interaction_type: ["Phone"] })), "2026-01-01", "2026-06-30");
  assert.deepEqual(periods.submissions.map((s) => s.date), dates.slice(1, 5));
  assert.deepEqual(periods.ytdSubmissions.map((s) => s.date), dates.slice(3, 5));
  const phone = rowOf(buildMonthlyActivityReport(periods.submissions, periods.ytdSubmissions), "Type of Interaction", "Phone");
  assert.equal(phone.month, 4);
  assert.equal(phone.ytd, 2);
});

test("periods after April still fetch earlier fiscal-year submissions for YTD", () => {
  assert.deepEqual(counsellingReportWindow("2026-10-01", "2026-10-31"), { queryFrom: "2026-04-01", ytdFrom: "2026-04-01" });
});

test("multi-year custom period retains older submissions and uses only the end date's fiscal year for YTD", () => {
  const periods = counsellingReportPeriods([{ date: "2025-01-01" }, { date: "2025-04-01" }, { date: "2026-04-01" }], "2025-01-01", "2026-06-30");
  assert.equal(counsellingReportWindow("2025-01-01", "2026-06-30").queryFrom, "2025-01-01");
  assert.equal(periods.submissions.length, 3);
  assert.deepEqual(periods.ytdSubmissions, [{ date: "2026-04-01" }]);
});

test("sheet follows the template: Type of Interaction beside Access Supports, Gender beside Age Range", () => {
  const sheet = buildMonthlyActivityReport([], []);
  assert.equal(sheet[0]!.left[0]!.heading, "Type of Interaction");
  assert.deepEqual(sheet[0]!.left[0]!.cols.map((c) => c[1]), ["Month", "YTD"]);
  assert.equal(sheet[0]!.right[0]!.heading, "Access Supports");
  assert.equal(sheet[1]!.left[0]!.heading, "Gender Identity");
  assert.equal(sheet[1]!.right[0]!.heading, "Age Range");
  assert.deepEqual(sheet[3]!.left[0]!.cols.map((c) => c[1]), ["#Sessions Completed", "YTD # of Sessions", "#Visits", "YTD Visits"]);
});

test("month counts only the period; YTD counts everything since April 1", () => {
  const ytd = [
    sub("2026-05-10", "c1", { interaction_type: ["Phone"], gender: "Female", first_visit_year: "Yes" }),
    sub("2026-10-03", "c1", { interaction_type: ["Phone"], gender: "Female", first_visit_year: "No" }),
    sub("2026-10-20", "c2", { interaction_type: ["Zoom"], gender: "Female", first_visit_year: "Yes" }),
  ];
  const month = ytd.filter((s) => s.date >= "2026-10-01");
  const sheet = buildMonthlyActivityReport(month, ytd);
  const phone = rowOf(sheet, "Type of Interaction", "Phone");
  assert.equal(phone.month, 1);
  assert.equal(phone.ytd, 2);
  const female = rowOf(sheet, "Gender Identity", "Female");
  assert.equal(female.month, 2);
  assert.equal(female.newMonth, 1);
  assert.equal(female.ytd, 3);
  assert.equal(female.ytdUnique, 2);
});

test("session recap: sessions vs unique visits, and merged I&R options", () => {
  const ytd = [
    sub("2026-10-01", "c1", { activities: ["Counselling", "Information & Referral - Housing"] }),
    sub("2026-10-05", "c1", { activities: ["Counselling", "Information & Referral - Other"] }),
  ];
  const sheet = buildMonthlyActivityReport(ytd, ytd);
  const c = rowOf(sheet, "Session Type", "Counselling");
  assert.equal(c.month, 2);
  assert.equal(c.monthUnique, 1);
  assert.equal(rowOf(sheet, "Session Type", "Information and Referrals").month, 2);
});

test("access supports total numbers and counted resources", () => {
  const ytd = [
    sub("2026-10-01", "c1", { tokens: 2, childminding: 1, resources: ["Meal", "Clothing"] }),
    sub("2026-10-05", "c2", { tokens: 3, childminding: 2, resources: ["Meal"] }),
  ];
  const sheet = buildMonthlyActivityReport(ytd, ytd);
  assert.equal(rowOf(sheet, "Access Supports", "# Bus Tokens").month, 5);
  assert.equal(rowOf(sheet, "Access Supports", "# of children in childminding").month, 3);
  assert.equal(rowOf(sheet, "Access Supports", "# Meals").month, 2);
  assert.equal(rowOf(sheet, "Access Supports", "# Times Clothing was provided").month, 1);
  assert.equal(rowOf(sheet, "Access Supports", "# Emergency Hampers").month, 0);
});

test("referral types are counted per type", () => {
  const ytd = [
    sub("2026-10-01", "c1", { referral_types: ["Housing", "Food Hamper"] }),
    sub("2026-10-02", "c2", { referral_types: ["Housing"] }),
  ];
  const sheet = buildMonthlyActivityReport(ytd, ytd);
  assert.equal(rowOf(sheet, "Referral Type", "Housing").month, 2);
  assert.equal(rowOf(sheet, "Referral Type", "Food Hamper").ytdUnique, 1);
  assert.equal(rowOf(sheet, "Referral Type", "Shelter: GBV").month, 0);
});
