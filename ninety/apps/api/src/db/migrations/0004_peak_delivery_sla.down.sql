ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_peak_not_faster_than_normal;
ALTER TABLE markets DROP COLUMN IF EXISTS sla_delivery_peak_min;
