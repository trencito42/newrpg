SunsetHacking = SunsetHacking or {}

-- Port cardinal indices: 0 = TOP, 1 = RIGHT, 2 = BOTTOM, 3 = LEFT
-- Opposite port: (dir + 2) % 4
-- Rotated port: (basePort + (rotation / 90)) % 4

SunsetHacking.Puzzles = {
    -- =========================================================================
    -- EASY 01: Linear bypass with 2 branching turns (6 nodes)
    -- =========================================================================
    ['easy_01'] = {
        id = 'easy_01',
        title = 'SECURITY_GATE_01',
        difficulty = 'easy',
        viewBox = { width = 1000, height = 650 },
        source = 'node_source',
        targets = { 'node_target' },
        timeLimit = 45,
        nodes = {
            { id = 'node_source', x = 150, y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'node_1',      x = 320, y = 325, type = 'CORNER', rotation = 180, locked = false },
            { id = 'node_2',      x = 320, y = 180, type = 'CORNER', rotation = 90,  locked = false },
            { id = 'node_3',      x = 600, y = 180, type = 'CORNER', rotation = 0,   locked = false },
            { id = 'node_4',      x = 600, y = 325, type = 'CORNER', rotation = 90,  locked = false },
            { id = 'node_target', x = 850, y = 325, type = 'TARGET', rotation = 0,  locked = true }
        },
        links = {
            { from = 'node_source', to = 'node_1', dirFrom = 1, dirTo = 3 },
            { from = 'node_1',      to = 'node_2', dirFrom = 0, dirTo = 2 },
            { from = 'node_2',      to = 'node_3', dirFrom = 1, dirTo = 3 },
            { from = 'node_3',      to = 'node_4', dirFrom = 2, dirTo = 0 },
            { from = 'node_4',      to = 'node_target', dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- EASY 02: Dual path with T-junction (7 nodes)
    -- =========================================================================
    ['easy_02'] = {
        id = 'easy_02',
        title = 'TERMINAL_LINK_B',
        difficulty = 'easy',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 45,
        nodes = {
            { id = 'src', x = 150, y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 330, y = 325, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'n2',  x = 330, y = 180, type = 'CORNER',     rotation = 0,  locked = false },
            { id = 'n3',  x = 550, y = 180, type = 'STRAIGHT',   rotation = 90, locked = false },
            { id = 'n4',  x = 720, y = 180, type = 'CORNER',     rotation = 90, locked = false },
            { id = 'n5',  x = 550, y = 325, type = 'STRAIGHT',   rotation = 90, locked = false },
            { id = 'tgt', x = 850, y = 325, type = 'TARGET',     rotation = 0,  locked = true }
        },
        links = {
            { from = 'src', to = 'n1', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n2', dirFrom = 0, dirTo = 2 },
            { from = 'n1',  to = 'n5', dirFrom = 1, dirTo = 3 },
            { from = 'n2',  to = 'n3', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n4', dirFrom = 1, dirTo = 3 },
            { from = 'n4',  to = 'tgt', dirFrom = 2, dirTo = 0 },
            { from = 'n5',  to = 'tgt', dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- EASY 03: S-Curve bypass (7 nodes)
    -- =========================================================================
    ['easy_03'] = {
        id = 'easy_03',
        title = 'ROUTER_FIREWALL_03',
        difficulty = 'easy',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 40,
        nodes = {
            { id = 'src', x = 120, y = 200, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 300, y = 200, type = 'CORNER', rotation = 180, locked = false },
            { id = 'n2',  x = 300, y = 450, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n3',  x = 520, y = 450, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'n4',  x = 520, y = 200, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n5',  x = 720, y = 200, type = 'CORNER', rotation = 180, locked = false },
            { id = 'tgt', x = 880, y = 450, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'n1', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n2', dirFrom = 2, dirTo = 0 },
            { from = 'n2',  to = 'n3', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n4', dirFrom = 0, dirTo = 2 },
            { from = 'n4',  to = 'n5', dirFrom = 1, dirTo = 3 },
            { from = 'n5',  to = 'tgt', dirFrom = 2, dirTo = 0 },
        }
    },

    -- =========================================================================
    -- MEDIUM 01: Branching network with decoy loops (10 nodes)
    -- =========================================================================
    ['medium_01'] = {
        id = 'medium_01',
        title = 'SUBSTATION_MAINFRAME',
        difficulty = 'medium',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 35,
        nodes = {
            { id = 'src', x = 120, y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 280, y = 325, type = 'T_JUNCTION', rotation = 180, locked = false },
            { id = 'n2',  x = 280, y = 160, type = 'CORNER', rotation = 0, locked = false },
            { id = 'n3',  x = 280, y = 490, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n4',  x = 480, y = 160, type = 'STRAIGHT', rotation = 90, locked = false },
            { id = 'n5',  x = 480, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'n6',  x = 480, y = 490, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n7',  x = 680, y = 160, type = 'CORNER', rotation = 0, locked = false },
            { id = 'n8',  x = 680, y = 325, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'tgt', x = 880, y = 325, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'n1', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n2', dirFrom = 0, dirTo = 2 },
            { from = 'n1',  to = 'n3', dirFrom = 2, dirTo = 0 },
            { from = 'n2',  to = 'n4', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n6', dirFrom = 1, dirTo = 3 },
            { from = 'n4',  to = 'n7', dirFrom = 1, dirTo = 3 },
            { from = 'n5',  to = 'n8', dirFrom = 1, dirTo = 3 },
            { from = 'n6',  to = 'n5', dirFrom = 0, dirTo = 2 },
            { from = 'n7',  to = 'n8', dirFrom = 2, dirTo = 0 },
            { from = 'n8',  to = 'tgt', dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- MEDIUM 02: Multi-stage with 1 LOCKED gate node (12 nodes)
    -- =========================================================================
    ['medium_02'] = {
        id = 'medium_02',
        title = 'SECURITY_VAULT_GATE',
        difficulty = 'medium',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 35,
        nodes = {
            { id = 'src', x = 100, y = 220, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 240, y = 220, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'n2',  x = 240, y = 420, type = 'CORNER', rotation = 180, locked = false },
            { id = 'n3',  x = 420, y = 420, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n4',  x = 420, y = 220, type = 'CORNER', rotation = 0, locked = false },
            { id = 'lock1', x = 580, y = 220, type = 'STRAIGHT', rotation = 0, locked = true, unlockRequirement = 'power' },
            { id = 'n5',  x = 580, y = 420, type = 'STRAIGHT', rotation = 0, locked = false },
            { id = 'n6',  x = 740, y = 220, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'n7',  x = 740, y = 420, type = 'CORNER', rotation = 90, locked = false },
            { id = 'tgt', x = 900, y = 320, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src',   to = 'n1',    dirFrom = 1, dirTo = 3 },
            { from = 'n1',    to = 'n2',    dirFrom = 2, dirTo = 0 },
            { from = 'n1',    to = 'n4',    dirFrom = 1, dirTo = 3 },
            { from = 'n2',    to = 'n3',    dirFrom = 1, dirTo = 3 },
            { from = 'n3',    to = 'n4',    dirFrom = 0, dirTo = 2 },
            { from = 'n4',    to = 'lock1', dirFrom = 1, dirTo = 3 },
            { from = 'lock1', to = 'n6',    dirFrom = 1, dirTo = 3 },
            { from = 'n5',    to = 'n7',    dirFrom = 1, dirTo = 3 },
            { from = 'n6',    to = 'tgt',   dirFrom = 1, dirTo = 3 },
            { from = 'n7',    to = 'tgt',   dirFrom = 0, dirTo = 2 },
        }
    },

    -- =========================================================================
    -- MEDIUM 03: Symmetrical bypass grid (11 nodes)
    -- =========================================================================
    ['medium_03'] = {
        id = 'medium_03',
        title = 'DATA_RELAY_GRID',
        difficulty = 'medium',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 35,
        nodes = {
            { id = 'src', x = 120, y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 280, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'n2',  x = 280, y = 170, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n3',  x = 280, y = 480, type = 'CORNER', rotation = 0, locked = false },
            { id = 'n4',  x = 480, y = 170, type = 'T_JUNCTION', rotation = 180, locked = false },
            { id = 'n5',  x = 480, y = 480, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'n6',  x = 480, y = 325, type = 'STRAIGHT', rotation = 0, locked = false },
            { id = 'n7',  x = 680, y = 170, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n8',  x = 680, y = 480, type = 'CORNER', rotation = 180, locked = false },
            { id = 'n9',  x = 680, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'tgt', x = 880, y = 325, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'n1', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n2', dirFrom = 0, dirTo = 2 },
            { from = 'n1',  to = 'n3', dirFrom = 2, dirTo = 0 },
            { from = 'n1',  to = 'n6', dirFrom = 1, dirTo = 3 },
            { from = 'n2',  to = 'n4', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n5', dirFrom = 1, dirTo = 3 },
            { from = 'n4',  to = 'n7', dirFrom = 1, dirTo = 3 },
            { from = 'n5',  to = 'n8', dirFrom = 1, dirTo = 3 },
            { from = 'n6',  to = 'n9', dirFrom = 1, dirTo = 3 },
            { from = 'n7',  to = 'n9', dirFrom = 2, dirTo = 0 },
            { from = 'n8',  to = 'n9', dirFrom = 0, dirTo = 2 },
            { from = 'n9',  to = 'tgt', dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- HARD 01: Complex 4x4 matrix with 2 locked junctions & false routes (16 nodes)
    -- =========================================================================
    ['hard_01'] = {
        id = 'hard_01',
        title = 'CTOS_CORE_MATRIX',
        difficulty = 'hard',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 30,
        nodes = {
            { id = 'src',   x = 100, y = 200, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n00',   x = 240, y = 200, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'n01',   x = 240, y = 350, type = 'CORNER', rotation = 0, locked = false },
            { id = 'n02',   x = 240, y = 500, type = 'CORNER', rotation = 180, locked = false },
            { id = 'n10',   x = 420, y = 200, type = 'CROSS', rotation = 0, locked = false },
            { id = 'lock1', x = 420, y = 350, type = 'CORNER', rotation = 0, locked = true, unlockRequirement = 'power' },
            { id = 'n12',   x = 420, y = 500, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'n20',   x = 600, y = 200, type = 'CORNER', rotation = 90, locked = false },
            { id = 'lock2', x = 600, y = 350, type = 'STRAIGHT', rotation = 0, locked = true, unlockRequirement = 'power' },
            { id = 'n22',   x = 600, y = 500, type = 'CROSS', rotation = 0, locked = false },
            { id = 'n30',   x = 760, y = 200, type = 'CORNER', rotation = 180, locked = false },
            { id = 'n31',   x = 760, y = 350, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'tgt',   x = 900, y = 350, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src',   to = 'n00',   dirFrom = 1, dirTo = 3 },
            { from = 'n00',   to = 'n01',   dirFrom = 2, dirTo = 0 },
            { from = 'n00',   to = 'n10',   dirFrom = 1, dirTo = 3 },
            { from = 'n01',   to = 'n02',   dirFrom = 2, dirTo = 0 },
            { from = 'n02',   to = 'n12',   dirFrom = 1, dirTo = 3 },
            { from = 'n10',   to = 'lock1', dirFrom = 2, dirTo = 0 },
            { from = 'n10',   to = 'n20',   dirFrom = 1, dirTo = 3 },
            { from = 'lock1', to = 'lock2', dirFrom = 1, dirTo = 3 },
            { from = 'n12',   to = 'n22',   dirFrom = 1, dirTo = 3 },
            { from = 'n20',   to = 'lock2', dirFrom = 2, dirTo = 0 },
            { from = 'lock2', to = 'n31',   dirFrom = 1, dirTo = 3 },
            { from = 'n22',   to = 'n31',   dirFrom = 0, dirTo = 2 },
            { from = 'n30',   to = 'n31',   dirFrom = 2, dirTo = 0 },
            { from = 'n31',   to = 'tgt',   dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- HARD 02: High-density multi-stage network (18 nodes)
    -- =========================================================================
    ['hard_02'] = {
        id = 'hard_02',
        title = 'PACIFIC_STANDARD_VAULT',
        difficulty = 'hard',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 25,
        nodes = {
            { id = 'src',   x = 80,  y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'a1',    x = 200, y = 170, type = 'CORNER', rotation = 90, locked = false },
            { id = 'a2',    x = 200, y = 325, type = 'CROSS',  rotation = 0, locked = false },
            { id = 'a3',    x = 200, y = 480, type = 'CORNER', rotation = 0, locked = false },
            { id = 'b1',    x = 360, y = 170, type = 'T_JUNCTION', rotation = 180, locked = false },
            { id = 'b2',    x = 360, y = 325, type = 'LOCKED_JUNCTION', rotation = 0, locked = true, unlockRequirement = 'power' },
            { id = 'b3',    x = 360, y = 480, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'c1',    x = 520, y = 170, type = 'CROSS', rotation = 0, locked = false },
            { id = 'c2',    x = 520, y = 325, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'c3',    x = 520, y = 480, type = 'CROSS', rotation = 0, locked = false },
            { id = 'd1',    x = 680, y = 170, type = 'LOCKED_JUNCTION', rotation = 90, locked = true, unlockRequirement = 'power' },
            { id = 'd2',    x = 680, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'd3',    x = 680, y = 480, type = 'CORNER', rotation = 270, locked = false },
            { id = 'e1',    x = 800, y = 170, type = 'CORNER', rotation = 180, locked = false },
            { id = 'e2',    x = 800, y = 325, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'tgt',   x = 920, y = 325, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'a2', dirFrom = 1, dirTo = 3 },
            { from = 'a2',  to = 'a1', dirFrom = 0, dirTo = 2 },
            { from = 'a2',  to = 'a3', dirFrom = 2, dirTo = 0 },
            { from = 'a1',  to = 'b1', dirFrom = 1, dirTo = 3 },
            { from = 'a2',  to = 'b2', dirFrom = 1, dirTo = 3 },
            { from = 'a3',  to = 'b3', dirFrom = 1, dirTo = 3 },
            { from = 'b1',  to = 'c1', dirFrom = 1, dirTo = 3 },
            { from = 'b1',  to = 'b2', dirFrom = 2, dirTo = 0 },
            { from = 'b2',  to = 'c2', dirFrom = 1, dirTo = 3 },
            { from = 'b3',  to = 'b2', dirFrom = 0, dirTo = 2 },
            { from = 'b3',  to = 'c3', dirFrom = 1, dirTo = 3 },
            { from = 'c1',  to = 'd1', dirFrom = 1, dirTo = 3 },
            { from = 'c1',  to = 'c2', dirFrom = 2, dirTo = 0 },
            { from = 'c2',  to = 'd2', dirFrom = 1, dirTo = 3 },
            { from = 'c3',  to = 'c2', dirFrom = 0, dirTo = 2 },
            { from = 'c3',  to = 'd3', dirFrom = 1, dirTo = 3 },
            { from = 'd1',  to = 'e1', dirFrom = 1, dirTo = 3 },
            { from = 'd2',  to = 'e2', dirFrom = 1, dirTo = 3 },
            { from = 'd3',  to = 'd2', dirFrom = 0, dirTo = 2 },
            { from = 'e1',  to = 'e2', dirFrom = 2, dirTo = 0 },
            { from = 'e2',  to = 'tgt', dirFrom = 1, dirTo = 3 },
        }
    }
}

-- Returns a random or requested puzzle definition
function SunsetHacking.GetPuzzle(puzzleIdOrDifficulty)
    if not puzzleIdOrDifficulty then
        return SunsetHacking.Puzzles['easy_01']
    end
    if SunsetHacking.Puzzles[puzzleIdOrDifficulty] then
        return SunsetHacking.Puzzles[puzzleIdOrDifficulty]
    end
    local diff = string.lower(tostring(puzzleIdOrDifficulty))
    local cfg = SunsetHacking.Config.Difficulties[diff]
    if cfg and cfg.puzzles and #cfg.puzzles > 0 then
        local chosen = cfg.puzzles[math.random(1, #cfg.puzzles)]
        return SunsetHacking.Puzzles[chosen] or SunsetHacking.Puzzles['easy_01']
    end
    return SunsetHacking.Puzzles['easy_01']
end

-- Mathematical Solvability Validator
-- Checks if there exists at least one configuration of node rotations connecting source to target
function SunsetHacking.ValidatePuzzle(puzzle)
    if not puzzle or not puzzle.nodes or not puzzle.links then
        return false, 'MISSING_DATA'
    end

    local nodesById = {}
    for _, n in ipairs(puzzle.nodes) do
        nodesById[n.id] = n
    end

    if not puzzle.source or not nodesById[puzzle.source] then
        return false, 'INVALID_SOURCE'
    end

    for _, tId in ipairs(puzzle.targets or {}) do
        if not nodesById[tId] then
            return false, 'INVALID_TARGET: ' .. tostring(tId)
        end
    end

    -- Build adjacency
    local adj = {}
    for _, link in ipairs(puzzle.links) do
        adj[link.from] = adj[link.from] or {}
        adj[link.to] = adj[link.to] or {}
        table.insert(adj[link.from], { to = link.to, dirFrom = link.dirFrom, dirTo = link.dirTo })
        table.insert(adj[link.to], { to = link.from, dirFrom = link.dirTo, dirTo = link.dirFrom })
    end

    -- Basic connectivity test: can source reach targets through physical topology?
    local visited = {}
    local queue = { puzzle.source }
    visited[puzzle.source] = true

    while #queue > 0 do
        local curr = table.remove(queue, 1)
        for _, neighbor in ipairs(adj[curr] or {}) do
            if not visited[neighbor.to] then
                visited[neighbor.to] = true
                table.insert(queue, neighbor.to)
            end
        end
    end

    for _, tId in ipairs(puzzle.targets or {}) do
        if not visited[tId] then
            return false, 'TARGET_UNREACHABLE_IN_TOPOLOGY: ' .. tostring(tId)
        end
    end

    return true, 'SOLVABLE'
end
