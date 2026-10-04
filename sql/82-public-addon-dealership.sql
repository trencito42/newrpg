-- Public civilian addon models that already have handling data in
-- scripts/discovered_addon_vehicles.json. Faction, emergency, job, utility,
-- and unverified hypercars are intentionally absent.
-- Prices sit on the existing catalog ladder: compact near the Issi/Prairie,
-- sports above the Buffalo/Comet, super below the Adder.

INSERT IGNORE INTO `dealership_vehicles`
    (`model`, `label`, `brand`, `category`, `price`, `stock`, `available`, `test_drive_enabled`, `display_order`)
VALUES
    ('briosoav', 'Brioso X', 'Grotti', 'compact', 28000, 14, 1, 1, 20),
    ('gaterback', 'Tailgater Sportback', 'Obey', 'sedan', 95000, 10, 1, 1, 21),
    ('abfbuff', 'Buffalo Wide', 'Bravado', 'sports', 110000, 10, 1, 1, 22),
    ('ballvenm', 'Baller Venuum', 'Gallivanter', 'suv', 140000, 8, 1, 1, 23),
    ('cometnor', 'Comet Noire', 'Pfister', 'sports', 185000, 8, 1, 1, 24),
    ('elegyxa19', 'Elegy X', 'Annis', 'sports', 220000, 6, 1, 1, 25),
    ('temphyc', 'Tempesta Hycade', 'Pegassi', 'super', 420000, 4, 1, 1, 26);
