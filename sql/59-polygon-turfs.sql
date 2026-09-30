-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — 59-polygon-turfs.sql
--  Realistic Hand-Crafted Polygon Turf Grid & Adjacency Graph
-- ═══════════════════════════════════════════════════════════════

-- Ensure columns exist in turfs
ALTER TABLE `turfs`
    ADD COLUMN IF NOT EXISTS `polygon` JSON DEFAULT NULL AFTER `radius`,
    ADD COLUMN IF NOT EXISTS `min_z` FLOAT NOT NULL DEFAULT -50.0 AFTER `polygon`,
    ADD COLUMN IF NOT EXISTS `max_z` FLOAT NOT NULL DEFAULT 500.0 AFTER `min_z`,
    ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Normalized polygon points table
CREATE TABLE IF NOT EXISTS `turf_points` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `turf_id` INT NOT NULL,
    `point_order` INT NOT NULL DEFAULT 0,
    `x` FLOAT NOT NULL,
    `y` FLOAT NOT NULL,
    `z` FLOAT NOT NULL DEFAULT 0.0,
    INDEX `idx_turf_order` (`turf_id`, `point_order`),
    CONSTRAINT `fk_turf_points_turf` FOREIGN KEY (`turf_id`) REFERENCES `turfs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Explicit territory adjacency connections (A <-> B)
CREATE TABLE IF NOT EXISTS `turf_connections` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `turf_a` INT NOT NULL,
    `turf_b` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_connection` (`turf_a`, `turf_b`),
    INDEX `idx_turf_a` (`turf_a`),
    INDEX `idx_turf_b` (`turf_b`),
    CONSTRAINT `fk_conn_turf_a` FOREIGN KEY (`turf_a`) REFERENCES `turfs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_conn_turf_b` FOREIGN KEY (`turf_b`) REFERENCES `turfs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clear previous test/placeholder entries and rebuild the official 18 hand-crafted polygon territories
DELETE FROM `turf_connections`;
DELETE FROM `turf_points`;
DELETE FROM `turfs`;

INSERT INTO `turfs` (`id`, `name`, `x`, `y`, `z`, `radius`, `min_z`, `max_z`, `payout`, `respect_payout`, `polygon`) VALUES
(1, 'Grove Street & South Davis', 105.2, -1941.4, 20.8, 120.0, -10.0, 100.0, 2000, 3,
 '[{"x":48.2,"y":-1845.6},{"x":112.5,"y":-1828.2},{"x":178.4,"y":-1852.1},{"x":238.9,"y":-1896.3},{"x":205.1,"y":-2012.4},{"x":142.3,"y":-2055.7},{"x":65.8,"y":-2024.1},{"x":28.4,"y":-1938.6}]'),

(2, 'Davis Central & Mega Mall', 124.5, -1550.4, 29.2, 115.0, -10.0, 120.0, 1900, 3,
 '[{"x":28.5,"y":-1482.1},{"x":125.4,"y":-1456.8},{"x":215.6,"y":-1495.2},{"x":248.3,"y":-1588.4},{"x":198.7,"y":-1668.5},{"x":98.2,"y":-1682.3},{"x":15.6,"y":-1615.4}]'),

(3, 'Chamberlain Hills', -178.4, -1612.3, 33.6, 110.0, -10.0, 120.0, 1750, 2,
 '[{"x":-268.4,"y":-1520.5},{"x":-158.2,"y":-1485.4},{"x":-92.6,"y":-1542.1},{"x":-85.3,"y":-1678.5},{"x":-162.8,"y":-1748.2},{"x":-255.1,"y":-1695.6}]'),

(4, 'Strawberry Projects', 290.1, -1350.2, 31.8, 110.0, -10.0, 120.0, 1850, 2,
 '[{"x":215.4,"y":-1285.6},{"x":345.8,"y":-1262.4},{"x":412.3,"y":-1345.8},{"x":385.6,"y":-1452.1},{"x":268.2,"y":-1465.3},{"x":208.5,"y":-1378.4}]'),

(5, 'Rancho & Jamestown St', 382.6, -1897.2, 25.5, 115.0, -10.0, 100.0, 1800, 2,
 '[{"x":285.4,"y":-1825.6},{"x":425.8,"y":-1812.3},{"x":495.2,"y":-1915.6},{"x":462.8,"y":-2045.2},{"x":358.4,"y":-2088.5},{"x":278.2,"y":-1985.4}]'),

(6, 'Ballas Glen Park & South LS', 382.6, -1597.2, 29.2, 110.0, -10.0, 120.0, 1800, 2,
 '[{"x":312.5,"y":-1512.4},{"x":452.8,"y":-1498.6},{"x":498.3,"y":-1595.2},{"x":458.6,"y":-1715.4},{"x":335.2,"y":-1725.8},{"x":288.4,"y":-1628.1}]'),

(7, 'La Mesa Industrial Canal', 755.2, -1450.4, 28.5, 120.0, -10.0, 120.0, 1750, 2,
 '[{"x":658.4,"y":-1358.2},{"x":812.5,"y":-1342.6},{"x":895.4,"y":-1458.2},{"x":862.1,"y":-1588.4},{"x":725.8,"y":-1612.3},{"x":642.5,"y":-1495.6}]'),

(8, 'Cypress Flats Rail Yard', 835.4, -2105.3, 29.8, 130.0, -10.0, 120.0, 1700, 2,
 '[{"x":712.5,"y":-1985.4},{"x":925.8,"y":-1968.2},{"x":995.4,"y":-2145.6},{"x":928.6,"y":-2285.2},{"x":765.2,"y":-2295.4},{"x":685.4,"y":-2142.1}]'),

(9, 'El Burro Heights Oilfields', 1335.2, -1580.4, 54.2, 125.0, 10.0, 200.0, 1650, 2,
 '[{"x":1198.5,"y":-1465.2},{"x":1425.6,"y":-1442.8},{"x":1512.4,"y":-1598.5},{"x":1465.2,"y":-1745.2},{"x":1285.4,"y":-1758.6},{"x":1182.3,"y":-1612.4}]'),

(10, 'Murrieta Heights & East LS', 1045.2, -1150.4, 38.5, 115.0, 10.0, 150.0, 1700, 2,
 '[{"x":945.8,"y":-1045.2},{"x":1158.4,"y":-1028.6},{"x":1225.6,"y":-1165.4},{"x":1185.2,"y":-1295.8},{"x":1012.5,"y":-1312.4},{"x":928.4,"y":-1185.6}]'),

(11, 'Mirror Park Lakes', 1045.3, -680.2, 56.8, 125.0, 20.0, 180.0, 1850, 3,
 '[{"x":915.4,"y":-558.2},{"x":1158.6,"y":-542.5},{"x":1245.2,"y":-695.4},{"x":1188.5,"y":-845.2},{"x":985.4,"y":-858.6},{"x":895.2,"y":-712.4}]'),

(12, 'East Vinewood & Parkway', 585.2, -450.4, 42.5, 120.0, 10.0, 180.0, 1950, 3,
 '[{"x":465.8,"y":-345.2},{"x":698.5,"y":-328.6},{"x":765.2,"y":-485.4},{"x":712.4,"y":-615.2},{"x":525.6,"y":-628.5},{"x":442.1,"y":-495.8}]'),

(13, 'Downtown Vinewood Commercial', 320.4, -220.5, 54.0, 120.0, 20.0, 200.0, 2200, 4,
 '[{"x":195.4,"y":-115.2},{"x":425.8,"y":-98.6},{"x":498.5,"y":-245.2},{"x":445.2,"y":-385.6},{"x":265.4,"y":-398.2},{"x":178.5,"y":-265.4}]'),

(14, 'Hawick & Alta Commercial', 185.2, -650.4, 42.5, 115.0, 10.0, 160.0, 2000, 3,
 '[{"x":78.5,"y":-545.2},{"x":295.4,"y":-528.6},{"x":365.2,"y":-675.4},{"x":312.5,"y":-815.2},{"x":125.8,"y":-828.6},{"x":55.2,"y":-695.4}]'),

(15, 'Little Seoul Commercial District', -685.2, -820.4, 24.8, 115.0, -10.0, 120.0, 1900, 3,
 '[{"x":-812.5,"y":-715.4},{"x":-595.4,"y":-698.2},{"x":-528.6,"y":-845.6},{"x":-575.2,"y":-985.4},{"x":-765.4,"y":-998.2},{"x":-835.6,"y":-865.2}]'),

(16, 'Vespucci Canals & Boardwalk', -1220.5, -1450.2, 4.3, 115.0, -10.0, 80.0, 1800, 2,
 '[{"x":-1345.8,"y":-1345.2},{"x":-1125.4,"y":-1328.6},{"x":-1058.2,"y":-1485.4},{"x":-1105.6,"y":-1625.8},{"x":-1298.5,"y":-1638.2},{"x":-1375.2,"y":-1495.6}]'),

(17, 'Del Perro Pier & Plaza', -1540.2, -1080.4, 13.0, 115.0, -10.0, 100.0, 1950, 3,
 '[{"x":-1665.4,"y":-975.2},{"x":-1445.2,"y":-958.6},{"x":-1378.5,"y":-1115.4},{"x":-1425.8,"y":-1255.2},{"x":-1618.4,"y":-1268.5},{"x":-1695.2,"y":-1125.6}]'),

(18, 'La Puerta Scrapyard & Industrial', -480.2, -1720.5, 18.5, 115.0, -10.0, 100.0, 1700, 2,
 '[{"x":-595.4,"y":-1615.2},{"x":-385.2,"y":-1598.6},{"x":-318.5,"y":-1755.4},{"x":-365.8,"y":-1895.2},{"x":-558.4,"y":-1908.6},{"x":-635.2,"y":-1775.4}]');

-- Seed normalized polygon vertices into turf_points
INSERT INTO `turf_points` (`turf_id`, `point_order`, `x`, `y`, `z`)
SELECT t.id, 0, 48.2, -1845.6, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 1, 112.5, -1828.2, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 2, 178.4, -1852.1, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 3, 238.9, -1896.3, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 4, 205.1, -2012.4, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 5, 142.3, -2055.7, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 6, 65.8, -2024.1, 20.8 FROM turfs t WHERE t.id = 1 UNION ALL
SELECT t.id, 7, 28.4, -1938.6, 20.8 FROM turfs t WHERE t.id = 1;

-- Seed Adjacency Graph (turf_connections)
-- 1 (Grove St) <-> 2 (Davis Mall), 5 (Rancho), 3 (Chamberlain)
INSERT IGNORE INTO `turf_connections` (`turf_a`, `turf_b`) VALUES
(1, 2), (2, 1),
(1, 3), (3, 1),
(1, 5), (5, 1),
(2, 4), (4, 2),
(2, 6), (6, 2),
(3, 18), (18, 3),
(3, 15), (15, 3),
(4, 6), (6, 4),
(4, 14), (14, 4),
(5, 6), (6, 5),
(5, 8), (8, 5),
(6, 7), (7, 6),
(7, 8), (8, 7),
(7, 10), (10, 7),
(8, 9), (9, 8),
(9, 10), (10, 9),
(10, 11), (11, 10),
(11, 12), (12, 11),
(12, 13), (13, 12),
(13, 14), (14, 13),
(14, 15), (15, 14),
(15, 16), (16, 15),
(16, 17), (17, 16),
(16, 18), (18, 16);
