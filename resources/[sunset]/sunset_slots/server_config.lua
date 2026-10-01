-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Slots SERVER-ONLY configuration (single source of truth)
--  Paytable / weights / limits live here and are never read from the client.
--  scripts/test-casino-authority.js parses this file to compute the RTP.
-- ═══════════════════════════════════════════════════════════════
SlotsServer = {}

-- Allowed stake denominations (chips). The client may only pick one of these.
SlotsServer.Bets = { 50, 100, 150, 200, 250, 300 }

-- Max chips moved from inventory into one machine session.
SlotsServer.SessionMax = 25000

-- Min milliseconds between two accepted spins (client animation is ~4.5s).
SlotsServer.MinSpinIntervalMs = 2000

-- Max distance (m) from the machine to open a session / keep spinning.
SlotsServer.MaxDistance = 6.0

-- Symbol weights for symbols 1..7 per visible cell (sum is arbitrary).
-- Derived from the marginal distribution of the original client reel generator.
SlotsServer.SymbolWeights = { 159, 157, 157, 166, 174, 167, 20 }

-- Multipliers (x stake) by symbol 1..7 for a run of 3 / 4 / 5 on a payline.
SlotsServer.TripleMult   = { 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 }
SlotsServer.QuadrupleMult = { 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4 }
SlotsServer.QuintupleMult = { 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 4.0 }

-- Bonus on the total when several lines hit at once.
SlotsServer.MultiLineBonus2 = 0.1  -- exactly 2 lines
SlotsServer.MultiLineBonus3 = 0.2  -- 3+ lines

-- Red/black gamble ("double or nothing"), fair 50/50.
SlotsServer.MaxDoubles = 4          -- auto-collect after this many doubles
SlotsServer.MaxDoublePending = 700  -- cannot gamble a win larger than this

-- Hard cap on any single pending win (defence in depth; paytable max is ~ 4x*lines).
SlotsServer.MaxWin = 200000
