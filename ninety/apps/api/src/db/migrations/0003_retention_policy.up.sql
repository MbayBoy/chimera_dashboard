-- Data retention, per market.
--
-- An erasure request cannot simply delete everything: tax law in both launch
-- markets requires the financial record of a completed sale to be kept for a
-- fixed number of years, and a platform that deletes an invoice on request is
-- not compliant, it is unauditable.
--
-- The number of years is a market value, so it lives in market configuration
-- rather than in application code — the UAE Federal Tax Procedures Law and the
-- South African Tax Administration Act both set it today, and either can change
-- without a deploy.

ALTER TABLE markets ADD COLUMN financial_retention_years integer;

UPDATE markets SET financial_retention_years = 5 WHERE code = 'AE';
UPDATE markets SET financial_retention_years = 5 WHERE code = 'ZA';
UPDATE markets SET financial_retention_years = 5 WHERE financial_retention_years IS NULL;

ALTER TABLE markets ALTER COLUMN financial_retention_years SET NOT NULL;
ALTER TABLE markets ADD CONSTRAINT markets_retention_positive CHECK (financial_retention_years > 0);

-- The erasure report is the evidence that a request was honoured. It is written
-- once, by the executor, and never updated.
ALTER TABLE data_deletion_requests ADD COLUMN executed_by uuid REFERENCES users(id);
