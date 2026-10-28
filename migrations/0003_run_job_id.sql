-- Workbench chunks of one job share a job_id so Recent runs can show one line per job.
-- Old rows stay '' and read back as their own run id (see listRuns).
ALTER TABLE toolkit_runs ADD COLUMN job_id TEXT NOT NULL DEFAULT '';
