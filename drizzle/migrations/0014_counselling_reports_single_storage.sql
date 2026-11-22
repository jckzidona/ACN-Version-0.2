ALTER TABLE public.counselling_reports ALTER COLUMN case_note_id DROP NOT NULL;
COMMENT ON COLUMN public.counselling_reports.case_note_id IS 'DEPRECATED: reports are standalone; case_note_id stays empty for new submissions';
COMMENT ON TABLE public.counselling_reports IS 'Counselling Monthly Report submissions (standalone, not tied to case notes)';
COMMENT ON TABLE public.counselling_monthly_reports IS 'DEPRECATED: consolidated into counselling_reports; no longer used by the app';