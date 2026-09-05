-- Yansha-wg5: prayer data is never shared (CONSTITUTION.md §12).
-- Strips the retired "salah" sharing scope from every existing circle member.
-- Idempotent: array_remove is a no-op once the value is gone.
UPDATE circle_members
SET "sharedTelemetry" = array_remove("sharedTelemetry", 'salah')
WHERE 'salah' = ANY("sharedTelemetry");
