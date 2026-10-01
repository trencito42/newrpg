-- 63-performance-indexes.sql
-- High-concurrency performance indexes for 100-200 concurrent players.

-- Phone messages: optimize sender/receiver recent message lookups (getPhoneData LIMIT 60)
CREATE INDEX IF NOT EXISTS idx_phone_messages_sender ON phone_messages (sender_character_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_phone_messages_receiver ON phone_messages (receiver_character_id, id DESC);

-- Phone contacts: optimize contact list queries per character
CREATE INDEX IF NOT EXISTS idx_phone_contacts_char ON phone_contacts (character_id, contact_name);

-- Characters: phone number lookup index
CREATE INDEX IF NOT EXISTS idx_characters_phone ON characters (phone_number);

-- Property rentals: optimize active rentals check
CREATE INDEX IF NOT EXISTS idx_prop_rentals_active_char ON property_rentals (character_id, active, property_id);
CREATE INDEX IF NOT EXISTS idx_prop_rentals_active_prop ON property_rentals (property_id, active);

-- Vehicles: character and plate lookup
CREATE INDEX IF NOT EXISTS idx_vehicles_char_plate ON vehicles (character_id, plate);
