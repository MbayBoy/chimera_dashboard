ALTER TABLE data_deletion_requests DROP COLUMN IF EXISTS executed_by;
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_retention_positive;
ALTER TABLE markets DROP COLUMN IF EXISTS financial_retention_years;
