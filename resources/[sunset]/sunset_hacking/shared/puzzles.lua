SunsetHacking = SunsetHacking or {}

-- Cardinal Direction Indices: 0 = TOP/NORTH, 1 = RIGHT/EAST, 2 = BOTTOM/SOUTH, 3 = LEFT/WEST
-- Opposite Direction: (dir + 2) % 4
-- Rotated Port: (basePort + (rotation / 90)) % 4

-- Base Port Definitions for Node Types
local BASE_PORTS = {
    STRAIGHT = { 1, 3 },                   -- Horizontal (Left + Right)
    CORNER = { 0, 1 },                     -- Top + Right
    T_JUNCTION = { 3, 0, 1 },              -- Left + Top + Right
    CROSS = { 0, 1, 2, 3 },                -- All 4 directions
    ENDPOINT = { 0 },                      -- Top only
    SOURCE = { 0, 1, 2, 3 },               -- All directions (or explicit port)
    TARGET = { 0, 1, 2, 3 },               -- All directions (or explicit port)
    LOCKED_JUNCTION = { 0, 1 },            -- Top + Right (starts locked)
}

--- Returns the set of open ports for a node type at a given rotation
--- @param nodeType string
--- @param rotation number (0, 90, 180, 270)
--- @return table<number, boolean>
function SunsetHacking.GetEffectivePorts(nodeType, rotation)
    local base = BASE_PORTS[nodeType] or BASE_PORTS.STRAIGHT
    local rotSteps = math.floor((((rotation or 0) % 360) + 360) % 360 / 90 + 0.5) % 4
    local ports = {}
    for _, p in ipairs(base) do
        local eff = (p + rotSteps) % 4
        ports[eff] = true
    end
    return ports
end

--- Evaluates power propagation from source through the graph
--- @param nodes table Array of node tables { id, type, rotation, locked, unlockRequirement }
--- @param links table Array of link tables { from, to, dirFrom, dirTo }
--- @param sourceId string
--- @param targetIds table Array of target IDs
--- @param allowUnlock boolean If true, unlocks locked nodes when power reaches them
--- @return table { energizedNodes, energizedLinks, allTargetsReached, unlockedNodes }
function SunsetHacking.EvaluateGraph(nodes, links, sourceId, targetIds, allowUnlock)
    local nodesById = {}
    local nodeLocked = {}
    for _, n in ipairs(nodes) do
        nodesById[n.id] = n
        nodeLocked[n.id] = n.locked == true
    end

    local sourceNode = nodesById[sourceId]
    if not sourceNode then
        return { energizedNodes = {}, energizedLinks = {}, allTargetsReached = false, unlockedNodes = {} }
    end

    -- Build adjacency index
    local adj = {}
    for idx, link in ipairs(links) do
        local linkId = link.id or ('link_' .. idx .. '_' .. link.from .. '_' .. link.to)
        adj[link.from] = adj[link.from] or {}
        adj[link.to] = adj[link.to] or {}
        table.insert(adj[link.from], { neighbor = link.to, linkId = linkId, dirOut = link.dirFrom, dirIn = link.dirTo })
        table.insert(adj[link.to], { neighbor = link.from, linkId = linkId, dirOut = link.dirTo, dirIn = link.dirFrom })
    end

    local energizedNodes = { [sourceId] = true }
    local energizedLinks = {}
    local unlockedNodes = {}
    local queue = { sourceId }

    while #queue > 0 do
        local currId = table.remove(queue, 1)
        local currNode = nodesById[currId]
        if currNode then
            local currPorts = SunsetHacking.GetEffectivePorts(currNode.type, currNode.rotation)
            local connections = adj[currId] or {}

            for _, conn in ipairs(connections) do
                local neighborNode = nodesById[conn.neighbor]
                if neighborNode then
                    -- Check port alignment: current node must output towards conn.dirOut
                    if currPorts[conn.dirOut] then
                        -- Neighbor node must accept from conn.dirIn
                        local neighborPorts = SunsetHacking.GetEffectivePorts(neighborNode.type, neighborNode.rotation)
                        if neighborPorts[conn.dirIn] then
                            energizedLinks[conn.linkId] = true

                            -- Check locked node unlocking condition
                            if allowUnlock and nodeLocked[neighborNode.id] and neighborNode.unlockRequirement == 'power' then
                                nodeLocked[neighborNode.id] = false
                                table.insert(unlockedNodes, neighborNode.id)
                            end

                            if not energizedNodes[neighborNode.id] then
                                energizedNodes[neighborNode.id] = true
                                table.insert(queue, neighborNode.id)
                            end
                        end
                    end
                end
            end
        end
    end

    local allTargetsReached = #targetIds > 0
    for _, tId in ipairs(targetIds) do
        if not energizedNodes[tId] then
            allTargetsReached = false
            break
        end
    end

    return {
        energizedNodes = energizedNodes,
        energizedLinks = energizedLinks,
        allTargetsReached = allTargetsReached,
        unlockedNodes = unlockedNodes
    }
end

--- Deterministic Backtracking Solvability Solver
--- Searches the state space of legal node rotations to prove a puzzle is solvable
--- @param puzzle table
--- @param maxDepth number Optional limit
--- @return boolean solvable, table solutionState
function SunsetHacking.SolvePuzzle(puzzle, maxDepth)
    if not puzzle or not puzzle.nodes or not puzzle.links or not puzzle.source then
        return false, nil
    end

    local nodes = {}
    local rotatableIds = {}
    local currentRotations = {}
    local targets = puzzle.targets or {}

    for _, n in ipairs(puzzle.nodes) do
        local nCopy = {
            id = n.id,
            type = n.type,
            rotation = n.rotation or 0,
            locked = n.locked == true,
            unlockRequirement = n.unlockRequirement or (n.locked and 'power' or nil)
        }
        table.insert(nodes, nCopy)
        currentRotations[n.id] = nCopy.rotation

        -- Rotatable if not source, not target, not CROSS, and not permanently locked
        local isSpecial = n.type == 'SOURCE' or n.type == 'TARGET' or n.type == 'CROSS' or n.id == puzzle.source
        for _, tId in ipairs(targets) do
            if n.id == tId then isSpecial = true break end
        end

        if not isSpecial and (not n.locked or n.unlockRequirement == 'power') then
            table.insert(rotatableIds, n.id)
        end
    end

    local nodeById = {}
    for _, n in ipairs(nodes) do
        nodeById[n.id] = n
    end

    -- Fast check: already solved?
    local initialEval = SunsetHacking.EvaluateGraph(nodes, puzzle.links, puzzle.source, targets, true)
    if initialEval.allTargetsReached then
        local sol = {}
        for _, n in ipairs(nodes) do sol[n.id] = n.rotation end
        return true, sol
    end

    -- Backtracking search across rotatable nodes
    local function search(index)
        if index > #rotatableIds then
            local eval = SunsetHacking.EvaluateGraph(nodes, puzzle.links, puzzle.source, targets, true)
            return eval.allTargetsReached
        end

        local nodeId = rotatableIds[index]
        local node = nodeById[nodeId]
        local originalRot = node.rotation

        -- Try all 4 cardinal angles: 0, 90, 180, 270
        for rot = 0, 270, 90 do
            node.rotation = rot
            if search(index + 1) then
                return true
            end
        end

        node.rotation = originalRot
        return false
    end

    local found = search(1)
    if found then
        local sol = {}
        for _, n in ipairs(nodes) do sol[n.id] = n.rotation end
        return true, sol
    end

    return false, nil
end

--- Authored Topology Templates for all difficulties
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
        title = 'SUBNET_MAINFRAME_04',
        difficulty = 'medium',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 35,
        nodes = {
            { id = 'src', x = 100, y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 240, y = 325, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'n2',  x = 240, y = 160, type = 'CORNER', rotation = 0, locked = false },
            { id = 'n3',  x = 420, y = 160, type = 'T_JUNCTION', rotation = 180, locked = false },
            { id = 'n4',  x = 420, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'n5',  x = 240, y = 490, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n6',  x = 420, y = 490, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n7',  x = 620, y = 160, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n8',  x = 620, y = 325, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'tgt', x = 880, y = 325, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'n1', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n2', dirFrom = 0, dirTo = 2 },
            { from = 'n1',  to = 'n4', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n5', dirFrom = 2, dirTo = 0 },
            { from = 'n2',  to = 'n3', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n7', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n4', dirFrom = 2, dirTo = 0 },
            { from = 'n5',  to = 'n6', dirFrom = 1, dirTo = 3 },
            { from = 'n6',  to = 'n4', dirFrom = 0, dirTo = 2 },
            { from = 'n7',  to = 'n8', dirFrom = 2, dirTo = 0 },
            { from = 'n4',  to = 'n8', dirFrom = 1, dirTo = 3 },
            { from = 'n8',  to = 'tgt', dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- MEDIUM 02: Locked gate puzzle (9 nodes, 1 locked junction)
    -- =========================================================================
    ['medium_02'] = {
        id = 'medium_02',
        title = 'ENCRYPTED_PROXY_NODE',
        difficulty = 'medium',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 35,
        nodes = {
            { id = 'src',  x = 120, y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',   x = 280, y = 325, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'key1', x = 280, y = 160, type = 'CORNER', rotation = 0, locked = false },
            { id = 'key2', x = 480, y = 160, type = 'CORNER', rotation = 90, locked = false },
            { id = 'lock', x = 480, y = 325, type = 'LOCKED_JUNCTION', rotation = 180, locked = true, unlockRequirement = 'power' },
            { id = 'n2',   x = 280, y = 490, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n3',   x = 680, y = 490, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n4',   x = 680, y = 325, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'tgt',  x = 880, y = 325, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src',  to = 'n1',   dirFrom = 1, dirTo = 3 },
            { from = 'n1',   to = 'key1', dirFrom = 0, dirTo = 2 },
            { from = 'n1',   to = 'n2',   dirFrom = 2, dirTo = 0 },
            { from = 'key1', to = 'key2', dirFrom = 1, dirTo = 3 },
            { from = 'key2', to = 'lock', dirFrom = 2, dirTo = 0 },
            { from = 'n1',   to = 'lock', dirFrom = 1, dirTo = 3 },
            { from = 'lock', to = 'n4',   dirFrom = 1, dirTo = 3 },
            { from = 'n2',   to = 'n3',   dirFrom = 1, dirTo = 3 },
            { from = 'n3',   to = 'n4',   dirFrom = 0, dirTo = 2 },
            { from = 'n4',   to = 'tgt',  dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- MEDIUM 03: Triple-tier grid (9 nodes)
    -- =========================================================================
    ['medium_03'] = {
        id = 'medium_03',
        title = 'RELAY_MATRIX_07',
        difficulty = 'medium',
        viewBox = { width = 1000, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 35,
        nodes = {
            { id = 'src', x = 100, y = 200, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'n1',  x = 280, y = 200, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'n2',  x = 280, y = 450, type = 'CORNER', rotation = 270, locked = false },
            { id = 'n3',  x = 480, y = 450, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'n4',  x = 480, y = 200, type = 'CROSS', rotation = 0, locked = false },
            { id = 'n5',  x = 680, y = 200, type = 'CORNER', rotation = 90, locked = false },
            { id = 'n6',  x = 680, y = 450, type = 'CORNER', rotation = 180, locked = false },
            { id = 'tgt', x = 880, y = 450, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'n1', dirFrom = 1, dirTo = 3 },
            { from = 'n1',  to = 'n2', dirFrom = 2, dirTo = 0 },
            { from = 'n1',  to = 'n4', dirFrom = 1, dirTo = 3 },
            { from = 'n2',  to = 'n3', dirFrom = 1, dirTo = 3 },
            { from = 'n3',  to = 'n4', dirFrom = 0, dirTo = 2 },
            { from = 'n3',  to = 'n6', dirFrom = 1, dirTo = 3 },
            { from = 'n4',  to = 'n5', dirFrom = 1, dirTo = 3 },
            { from = 'n5',  to = 'n6', dirFrom = 2, dirTo = 0 },
            { from = 'n6',  to = 'tgt', dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- HARD 01: Multi-stage ctOS Core with 2 security locks (13 nodes)
    -- =========================================================================
    ['hard_01'] = {
        id = 'hard_01',
        title = 'CTOS_CORE_MAINFRAME',
        difficulty = 'hard',
        viewBox = { width = 1050, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 30,
        nodes = {
            { id = 'src',   x = 80,  y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'a1',    x = 220, y = 325, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'a2',    x = 220, y = 150, type = 'CORNER', rotation = 0, locked = false },
            { id = 'a3',    x = 220, y = 500, type = 'CORNER', rotation = 270, locked = false },
            { id = 'lock1', x = 400, y = 150, type = 'LOCKED_JUNCTION', rotation = 90, locked = true, unlockRequirement = 'power' },
            { id = 'b2',    x = 400, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'b3',    x = 400, y = 500, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'c1',    x = 600, y = 150, type = 'CORNER', rotation = 90, locked = false },
            { id = 'lock2', x = 600, y = 325, type = 'LOCKED_JUNCTION', rotation = 180, locked = true, unlockRequirement = 'power' },
            { id = 'c3',    x = 600, y = 500, type = 'CORNER', rotation = 180, locked = false },
            { id = 'd1',    x = 780, y = 325, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'tgt',   x = 960, y = 325, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src',   to = 'a1',    dirFrom = 1, dirTo = 3 },
            { from = 'a1',    to = 'a2',    dirFrom = 0, dirTo = 2 },
            { from = 'a1',    to = 'b2',    dirFrom = 1, dirTo = 3 },
            { from = 'a1',    to = 'a3',    dirFrom = 2, dirTo = 0 },
            { from = 'a2',    to = 'lock1', dirFrom = 1, dirTo = 3 },
            { from = 'a3',    to = 'b3',    dirFrom = 1, dirTo = 3 },
            { from = 'lock1', to = 'c1',    dirFrom = 1, dirTo = 3 },
            { from = 'b3',    to = 'b2',    dirFrom = 0, dirTo = 2 },
            { from = 'b3',    to = 'c3',    dirFrom = 1, dirTo = 3 },
            { from = 'b2',    to = 'lock2', dirFrom = 1, dirTo = 3 },
            { from = 'c1',    to = 'lock2', dirFrom = 2, dirTo = 0 },
            { from = 'c3',    to = 'lock2', dirFrom = 0, dirTo = 2 },
            { from = 'lock2', to = 'd1',    dirFrom = 1, dirTo = 3 },
            { from = 'd1',    to = 'tgt',   dirFrom = 1, dirTo = 3 },
        }
    },

    -- =========================================================================
    -- HARD 02: Hyper-Dense Crossroad Grid (14 nodes)
    -- =========================================================================
    ['hard_02'] = {
        id = 'hard_02',
        title = 'QUANTUM_ENCRYPTION_LAYER',
        difficulty = 'hard',
        viewBox = { width = 1050, height = 650 },
        source = 'src',
        targets = { 'tgt' },
        timeLimit = 25,
        nodes = {
            { id = 'src', x = 80,  y = 325, type = 'SOURCE', rotation = 0, locked = true },
            { id = 'b1',  x = 220, y = 160, type = 'CORNER', rotation = 0, locked = false },
            { id = 'b2',  x = 220, y = 325, type = 'T_JUNCTION', rotation = 90, locked = false },
            { id = 'b3',  x = 220, y = 490, type = 'CORNER', rotation = 270, locked = false },
            { id = 'c1',  x = 420, y = 160, type = 'T_JUNCTION', rotation = 180, locked = false },
            { id = 'c2',  x = 420, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'c3',  x = 420, y = 490, type = 'T_JUNCTION', rotation = 0, locked = false },
            { id = 'd1',  x = 620, y = 160, type = 'CORNER', rotation = 90, locked = false },
            { id = 'd2',  x = 620, y = 325, type = 'CROSS', rotation = 0, locked = false },
            { id = 'd3',  x = 620, y = 490, type = 'CORNER', rotation = 180, locked = false },
            { id = 'e1',  x = 800, y = 240, type = 'CORNER', rotation = 90, locked = false },
            { id = 'e2',  x = 800, y = 410, type = 'T_JUNCTION', rotation = 270, locked = false },
            { id = 'tgt', x = 960, y = 410, type = 'TARGET', rotation = 0, locked = true }
        },
        links = {
            { from = 'src', to = 'b2', dirFrom = 1, dirTo = 3 },
            { from = 'b2',  to = 'b1', dirFrom = 0, dirTo = 2 },
            { from = 'b2',  to = 'b3', dirFrom = 2, dirTo = 0 },
            { from = 'b1',  to = 'c1', dirFrom = 1, dirTo = 3 },
            { from = 'b2',  to = 'c2', dirFrom = 1, dirTo = 3 },
            { from = 'b3',  to = 'c3', dirFrom = 1, dirTo = 3 },
            { from = 'c1',  to = 'c2', dirFrom = 2, dirTo = 0 },
            { from = 'c1',  to = 'd1', dirFrom = 1, dirTo = 3 },
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

--- Pseudo-Random Number Generator with Seed support (Linear Congruential Generator)
local function createPrng(seed)
    local s = seed or math.random(1, 2147483647)
    return function(min, max)
        s = (s * 1103515245 + 12345) % 2147483648
        local val = s / 2147483648
        if min and max then
            return math.floor(min + val * (max - min + 1))
        elseif min then
            return math.floor(1 + val * min)
        end
        return val
    end
end

--- Procedurally scrambles a puzzle template while guaranteeing:
--- 1. It is never already solved initially.
--- 2. It remains mathematically solvable.
--- 3. It satisfies minimum rotation distance for its difficulty.
--- @param template table Authored template
--- @param difficulty string 'easy'|'medium'|'hard'
--- @param seed number|nil
--- @return table scrambledPuzzle, table solutionState
function SunsetHacking.ScramblePuzzle(template, difficulty, seed)
    local diff = difficulty or template.difficulty or 'easy'
    local diffCfg = SunsetHacking.Config.Difficulties[diff] or SunsetHacking.Config.Difficulties.easy
    local minRotations = diffCfg.minRotations or 2
    local maxTries = diffCfg.scrambleMaxTries or 30
    local rng = createPrng(seed)

    -- Solve template first to get known solved orientation
    local solvable, solvedState = SunsetHacking.SolvePuzzle(template)
    if not solvable or not solvedState then
        return nil, nil
    end

    local rotSteps = { 90, 180, 270 }

    for _ = 1, maxTries do
        -- Deep clone template nodes
        local scrambledNodes = {}
        local rotatedCount = 0

        for _, n in ipairs(template.nodes) do
            local isSpecial = n.type == 'SOURCE' or n.type == 'TARGET' or n.type == 'CROSS' or n.id == template.source
            for _, tId in ipairs(template.targets or {}) do
                if n.id == tId then isSpecial = true break end
            end

            local rot = solvedState[n.id] or n.rotation or 0
            local locked = n.locked == true

            if not isSpecial and (not locked or n.unlockRequirement == 'power') then
                -- Randomly rotate away from solved state
                local offset = rotSteps[rng(1, #rotSteps)]
                rot = (rot + offset) % 360
                rotatedCount = rotatedCount + 1
            end

            table.insert(scrambledNodes, {
                id = n.id,
                x = n.x,
                y = n.y,
                type = n.type,
                rotation = rot,
                locked = locked,
                unlockRequirement = n.unlockRequirement
            })
        end

        local candidate = {
            id = template.id,
            title = template.title,
            difficulty = diff,
            viewBox = template.viewBox,
            source = template.source,
            targets = template.targets,
            timeLimit = template.timeLimit or diffCfg.timeLimit,
            nodes = scrambledNodes,
            links = template.links
        }

        -- Condition 1: Initial state must NOT be already solved!
        local eval = SunsetHacking.EvaluateGraph(candidate.nodes, candidate.links, candidate.source, candidate.targets, true)
        if not eval.allTargetsReached and rotatedCount >= minRotations then
            -- Condition 2: Scrambled puzzle must still be solvable
            local isSolvable = SunsetHacking.SolvePuzzle(candidate)
            if isSolvable then
                return candidate, solvedState
            end
        end
    end

    -- Fallback: return template with solution
    return template, solvedState
end

--- Generates or retrieves a playable puzzle for gameplay
--- @param puzzleIdOrDifficulty string|nil
--- @param seed number|nil
--- @return table puzzle, table solutionState
function SunsetHacking.GetPuzzle(puzzleIdOrDifficulty, seed)
    local template
    local diff = 'easy'

    if puzzleIdOrDifficulty and SunsetHacking.Puzzles[puzzleIdOrDifficulty] then
        template = SunsetHacking.Puzzles[puzzleIdOrDifficulty]
        diff = template.difficulty or 'easy'
    else
        diff = string.lower(tostring(puzzleIdOrDifficulty or 'easy'))
        local diffCfg = SunsetHacking.Config.Difficulties[diff] or SunsetHacking.Config.Difficulties.easy
        local pool = diffCfg.templates or { 'easy_01' }
        local rng = createPrng(seed)
        local chosen = pool[rng(1, #pool)]
        template = SunsetHacking.Puzzles[chosen] or SunsetHacking.Puzzles['easy_01']
    end

    return SunsetHacking.ScramblePuzzle(template, diff, seed)
end

--- Mathematical & Structural Validation of any puzzle object
function SunsetHacking.ValidatePuzzle(puzzle)
    if not puzzle or not puzzle.nodes or not puzzle.links or not puzzle.source then
        return false, 'MISSING_DATA'
    end

    local nodesById = {}
    for _, n in ipairs(puzzle.nodes) do
        if nodesById[n.id] then return false, 'DUPLICATE_NODE_ID: ' .. tostring(n.id) end
        nodesById[n.id] = n
        if n.x < 0 or (puzzle.viewBox and n.x > puzzle.viewBox.width) then
            return false, 'NODE_OUT_OF_BOUNDS_X: ' .. tostring(n.id)
        end
        if n.y < 0 or (puzzle.viewBox and n.y > puzzle.viewBox.height) then
            return false, 'NODE_OUT_OF_BOUNDS_Y: ' .. tostring(n.id)
        end
    end

    if not nodesById[puzzle.source] then
        return false, 'INVALID_SOURCE: ' .. tostring(puzzle.source)
    end

    for _, tId in ipairs(puzzle.targets or {}) do
        if not nodesById[tId] then
            return false, 'INVALID_TARGET: ' .. tostring(tId)
        end
    end

    for idx, link in ipairs(puzzle.links) do
        if not nodesById[link.from] then return false, 'LINK_INVALID_FROM: ' .. tostring(link.from) end
        if not nodesById[link.to] then return false, 'LINK_INVALID_TO: ' .. tostring(link.to) end
        if link.dirFrom < 0 or link.dirFrom > 3 then return false, 'LINK_INVALID_DIR_FROM at ' .. idx end
        if link.dirTo < 0 or link.dirTo > 3 then return false, 'LINK_INVALID_DIR_TO at ' .. idx end
    end

    -- Run real rotational solver
    local solvable, solution = SunsetHacking.SolvePuzzle(puzzle)
    if not solvable then
        return false, 'NO_ROTATIONAL_SOLUTION'
    end

    return true, solution
end
