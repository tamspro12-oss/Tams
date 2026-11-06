-- Remove the restrictive travel_type constraint to allow Custom Service names
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_travel_type_check;