-- The peak-traffic delivery figure.
--
-- The public promise is "delivered in 90 minutes, typically — up to N hours in
-- peak traffic", and N is a market value: Dubai at 18:00 is not Johannesburg at
-- 18:00. It was a literal inside a translated sentence, which is the same
-- hardcoded market value the guard forbids in code, hidden in a place the guard
-- does not scan.

ALTER TABLE markets ADD COLUMN sla_delivery_peak_min integer;

UPDATE markets SET sla_delivery_peak_min = 180 WHERE code = 'AE';
UPDATE markets SET sla_delivery_peak_min = 180 WHERE code = 'ZA';
UPDATE markets SET sla_delivery_peak_min = sla_delivery_min * 2 WHERE sla_delivery_peak_min IS NULL;

ALTER TABLE markets ALTER COLUMN sla_delivery_peak_min SET NOT NULL;
ALTER TABLE markets
  ADD CONSTRAINT markets_peak_not_faster_than_normal CHECK (sla_delivery_peak_min >= sla_delivery_min);
