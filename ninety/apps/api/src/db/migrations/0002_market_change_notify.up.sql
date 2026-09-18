-- Market configuration changes must reach a running API without a redeploy.
--
-- The admin market editor invalidates the cache itself, but an operator editing
-- the table directly — during an incident, or a migration — would otherwise wait
-- out the cache TTL and reasonably conclude the editor does not work. A NOTIFY
-- on write closes that gap: any change to a market row, from any source, wakes
-- every API process and invalidates the entry.

CREATE OR REPLACE FUNCTION notify_market_changed() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ninety_market_changed', json_build_object(
    'id',   COALESCE(NEW.id, OLD.id),
    'code', COALESCE(NEW.code, OLD.code)
  )::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER markets_changed
  AFTER INSERT OR UPDATE OR DELETE ON markets
  FOR EACH ROW EXECUTE FUNCTION notify_market_changed();
