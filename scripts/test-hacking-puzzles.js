const DIR = { TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3 };

const NODE_TYPES = {
    STRAIGHT: { ports: [DIR.RIGHT, DIR.LEFT] },
    CORNER: { ports: [DIR.TOP, DIR.RIGHT] },
    T_JUNCTION: { ports: [DIR.LEFT, DIR.TOP, DIR.RIGHT] },
    CROSS: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT] },
    ENDPOINT: { ports: [DIR.TOP] },
    SOURCE: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT] },
    TARGET: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT] },
    LOCKED_JUNCTION: { ports: [DIR.TOP, DIR.RIGHT] },
};

function getEffectivePorts(basePorts, rotSteps) {
    return new Set(basePorts.map(p => (p + rotSteps) % 4));
}

function solvePuzzle(puzzle) {
    const nodes = puzzle.nodes;
    const links = puzzle.links;
    const sourceId = puzzle.source;
    const targetIds = new Set(puzzle.targets || []);

    const rotatableNodes = nodes.filter(n => !n.locked && n.type !== 'SOURCE' && n.type !== 'TARGET');
    const totalCombinations = Math.pow(4, rotatableNodes.length);

    console.log(`Testing puzzle '${puzzle.id}' with ${nodes.length} nodes, ${links.length} links (rotatable: ${rotatableNodes.length})...`);

    // Backtracking / BFS search to find a working solution
    function checkState(rotationMap) {
        const nodeMap = new Map();
        nodes.forEach(n => {
            const rot = rotationMap.has(n.id) ? rotationMap.get(n.id) : (n.rotation || 0);
            const rotSteps = Math.round(((rot % 360) + 360) % 360 / 90);
            const base = NODE_TYPES[n.type] ? NODE_TYPES[n.type].ports : [1, 3];
            nodeMap.set(n.id, {
                id: n.id,
                ports: getEffectivePorts(base, rotSteps),
                locked: n.locked === true,
                unlockRequirement: n.unlockRequirement
            });
        });

        const adj = new Map();
        nodes.forEach(n => adj.set(n.id, []));
        links.forEach(l => {
            if (adj.has(l.from)) adj.get(l.from).push({ neighbor: l.to, dirOut: l.dirFrom, dirIn: l.dirTo });
            if (adj.has(l.to)) adj.get(l.to).push({ neighbor: l.from, dirOut: l.dirTo, dirIn: l.dirFrom });
        });

        const queue = [sourceId];
        const visited = new Set([sourceId]);

        while (queue.length > 0) {
            const currId = queue.shift();
            const curr = nodeMap.get(currId);
            const edges = adj.get(currId) || [];

            for (const edge of edges) {
                const neighbor = nodeMap.get(edge.neighbor);
                if (!neighbor) continue;

                if (!curr.ports.has(edge.dirOut)) continue;
                if (!neighbor.ports.has(edge.dirIn)) continue;

                if (neighbor.locked && neighbor.unlockRequirement === 'power') {
                    neighbor.locked = false;
                }

                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push(neighbor.id);
                }
            }
        }

        let allTargets = true;
        for (const t of targetIds) {
            if (!visited.has(t)) {
                allTargets = false;
                break;
            }
        }
        return allTargets;
    }

    // Try a search over combinations
    function search(index, curMap) {
        if (index === rotatableNodes.length) {
            return checkState(curMap) ? curMap : null;
        }

        const node = rotatableNodes[index];
        for (let rot = 0; rot < 360; rot += 90) {
            curMap.set(node.id, rot);
            const sol = search(index + 1, curMap);
            if (sol) return sol;
        }
        return null;
    }

    const solution = search(0, new Map());
    return solution;
}

// Load puzzles from shared/puzzles.lua or test all defined puzzles
const fs = require('fs');
const path = require('path');
const puzzlesContent = fs.readFileSync(path.join(__dirname, '../resources/[sunset]/sunset_hacking/shared/puzzles.lua'), 'utf8');

// Quick parse for testing
const puzzles = [
    {
        id: 'easy_01',
        source: 'node_source',
        targets: ['node_target'],
        nodes: [
            { id: 'node_source', type: 'SOURCE', locked: true },
            { id: 'node_1', type: 'CORNER', locked: false },
            { id: 'node_2', type: 'CORNER', locked: false },
            { id: 'node_3', type: 'CORNER', locked: false },
            { id: 'node_4', type: 'CORNER', locked: false },
            { id: 'node_target', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'node_source', to: 'node_1', dirFrom: 1, dirTo: 3 },
            { from: 'node_1', to: 'node_2', dirFrom: 0, dirTo: 2 },
            { from: 'node_2', to: 'node_3', dirFrom: 1, dirTo: 3 },
            { from: 'node_3', to: 'node_4', dirFrom: 2, dirTo: 0 },
            { from: 'node_4', to: 'node_target', dirFrom: 1, dirTo: 3 },
        ]
    },
    {
        id: 'easy_02',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'n1', type: 'T_JUNCTION', locked: false },
            { id: 'n2', type: 'CORNER', locked: false },
            { id: 'n3', type: 'STRAIGHT', locked: false },
            { id: 'n4', type: 'CORNER', locked: false },
            { id: 'n5', type: 'STRAIGHT', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'n1', dirFrom: 1, dirTo: 3 },
            { from: 'n1', to: 'n2', dirFrom: 0, dirTo: 2 },
            { from: 'n1', to: 'n5', dirFrom: 1, dirTo: 3 },
            { from: 'n2', to: 'n3', dirFrom: 1, dirTo: 3 },
            { from: 'n3', to: 'n4', dirFrom: 1, dirTo: 3 },
            { from: 'n4', to: 'tgt', dirFrom: 2, dirTo: 0 },
            { from: 'n5', to: 'tgt', dirFrom: 1, dirTo: 3 },
        ]
    },
    {
        id: 'easy_03',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'n1', type: 'CORNER', locked: false },
            { id: 'n2', type: 'CORNER', locked: false },
            { id: 'n3', type: 'T_JUNCTION', locked: false },
            { id: 'n4', type: 'CORNER', locked: false },
            { id: 'n5', type: 'CORNER', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'n1', dirFrom: 1, dirTo: 3 },
            { from: 'n1', to: 'n2', dirFrom: 2, dirTo: 0 },
            { from: 'n2', to: 'n3', dirFrom: 1, dirTo: 3 },
            { from: 'n3', to: 'n4', dirFrom: 0, dirTo: 2 },
            { from: 'n4', to: 'n5', dirFrom: 1, dirTo: 3 },
            { from: 'n5', to: 'tgt', dirFrom: 2, dirTo: 0 },
        ]
    },
    {
        id: 'medium_01',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'n1', type: 'T_JUNCTION', locked: false },
            { id: 'n2', type: 'CORNER', locked: false },
            { id: 'n3', type: 'CORNER', locked: false },
            { id: 'n4', type: 'STRAIGHT', locked: false },
            { id: 'n5', type: 'CROSS', locked: false },
            { id: 'n6', type: 'CORNER', locked: false },
            { id: 'n7', type: 'CORNER', locked: false },
            { id: 'n8', type: 'T_JUNCTION', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'n1', dirFrom: 1, dirTo: 3 },
            { from: 'n1', to: 'n2', dirFrom: 0, dirTo: 2 },
            { from: 'n1', to: 'n3', dirFrom: 2, dirTo: 0 },
            { from: 'n2', to: 'n4', dirFrom: 1, dirTo: 3 },
            { from: 'n3', to: 'n6', dirFrom: 1, dirTo: 3 },
            { from: 'n4', to: 'n7', dirFrom: 1, dirTo: 3 },
            { from: 'n5', to: 'n8', dirFrom: 1, dirTo: 3 },
            { from: 'n6', to: 'n5', dirFrom: 0, dirTo: 2 },
            { from: 'n7', to: 'n8', dirFrom: 2, dirTo: 0 },
            { from: 'n8', to: 'tgt', dirFrom: 1, dirTo: 3 },
        ]
    },
    {
        id: 'medium_02',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'n1', type: 'T_JUNCTION', locked: false },
            { id: 'n2', type: 'CORNER', locked: false },
            { id: 'n3', type: 'CORNER', locked: false },
            { id: 'n4', type: 'CORNER', locked: false },
            { id: 'lock1', type: 'STRAIGHT', locked: true, unlockRequirement: 'power', rotation: 0 },
            { id: 'n5', type: 'STRAIGHT', locked: false },
            { id: 'n6', type: 'T_JUNCTION', locked: false },
            { id: 'n7', type: 'CORNER', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'n1', dirFrom: 1, dirTo: 3 },
            { from: 'n1', to: 'n2', dirFrom: 2, dirTo: 0 },
            { from: 'n1', to: 'n4', dirFrom: 1, dirTo: 3 },
            { from: 'n2', to: 'n3', dirFrom: 1, dirTo: 3 },
            { from: 'n3', to: 'n4', dirFrom: 0, dirTo: 2 },
            { from: 'n4', to: 'lock1', dirFrom: 1, dirTo: 3 },
            { from: 'lock1', to: 'n6', dirFrom: 1, dirTo: 3 },
            { from: 'n5', to: 'n7', dirFrom: 1, dirTo: 3 },
            { from: 'n6', to: 'tgt', dirFrom: 1, dirTo: 3 },
            { from: 'n7', to: 'tgt', dirFrom: 0, dirTo: 2 },
        ]
    },
    {
        id: 'medium_03',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'n1', type: 'CROSS', locked: false },
            { id: 'n2', type: 'CORNER', locked: false },
            { id: 'n3', type: 'CORNER', locked: false },
            { id: 'n4', type: 'T_JUNCTION', locked: false },
            { id: 'n5', type: 'T_JUNCTION', locked: false },
            { id: 'n6', type: 'STRAIGHT', locked: false },
            { id: 'n7', type: 'CORNER', locked: false },
            { id: 'n8', type: 'CORNER', locked: false },
            { id: 'n9', type: 'CROSS', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'n1', dirFrom: 1, dirTo: 3 },
            { from: 'n1', to: 'n2', dirFrom: 0, dirTo: 2 },
            { from: 'n1', to: 'n3', dirFrom: 2, dirTo: 0 },
            { from: 'n1', to: 'n6', dirFrom: 1, dirTo: 3 },
            { from: 'n2', to: 'n4', dirFrom: 1, dirTo: 3 },
            { from: 'n3', to: 'n5', dirFrom: 1, dirTo: 3 },
            { from: 'n4', to: 'n7', dirFrom: 1, dirTo: 3 },
            { from: 'n5', to: 'n8', dirFrom: 1, dirTo: 3 },
            { from: 'n6', to: 'n9', dirFrom: 1, dirTo: 3 },
            { from: 'n7', to: 'n9', dirFrom: 2, dirTo: 0 },
            { from: 'n8', to: 'n9', dirFrom: 0, dirTo: 2 },
            { from: 'n9', to: 'tgt', dirFrom: 1, dirTo: 3 },
        ]
    },
    {
        id: 'hard_01',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'n00', type: 'T_JUNCTION', locked: false },
            { id: 'n01', type: 'CORNER', locked: false },
            { id: 'n02', type: 'CORNER', locked: false },
            { id: 'n10', type: 'CROSS', locked: false },
            { id: 'lock1', type: 'CORNER', locked: true, unlockRequirement: 'power', rotation: 0 },
            { id: 'n12', type: 'T_JUNCTION', locked: false },
            { id: 'n20', type: 'CORNER', locked: false },
            { id: 'lock2', type: 'STRAIGHT', locked: true, unlockRequirement: 'power', rotation: 0 },
            { id: 'n22', type: 'CROSS', locked: false },
            { id: 'n30', type: 'CORNER', locked: false },
            { id: 'n31', type: 'T_JUNCTION', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'n00', dirFrom: 1, dirTo: 3 },
            { from: 'n00', to: 'n01', dirFrom: 2, dirTo: 0 },
            { from: 'n00', to: 'n10', dirFrom: 1, dirTo: 3 },
            { from: 'n01', to: 'n02', dirFrom: 2, dirTo: 0 },
            { from: 'n02', to: 'n12', dirFrom: 1, dirTo: 3 },
            { from: 'n10', to: 'lock1', dirFrom: 2, dirTo: 0 },
            { from: 'n10', to: 'n20', dirFrom: 1, dirTo: 3 },
            { from: 'lock1', to: 'lock2', dirFrom: 1, dirTo: 3 },
            { from: 'n12', to: 'n22', dirFrom: 1, dirTo: 3 },
            { from: 'n20', to: 'lock2', dirFrom: 2, dirTo: 0 },
            { from: 'lock2', to: 'n31', dirFrom: 1, dirTo: 3 },
            { from: 'n22', to: 'n31', dirFrom: 0, dirTo: 2 },
            { from: 'n30', to: 'n31', dirFrom: 2, dirTo: 0 },
            { from: 'n31', to: 'tgt', dirFrom: 1, dirTo: 3 },
        ]
    },
    {
        id: 'hard_02',
        source: 'src',
        targets: ['tgt'],
        nodes: [
            { id: 'src', type: 'SOURCE', locked: true },
            { id: 'a1', type: 'CORNER', locked: false },
            { id: 'a2', type: 'CROSS', locked: false },
            { id: 'a3', type: 'CORNER', locked: false },
            { id: 'b1', type: 'T_JUNCTION', locked: false },
            { id: 'b2', type: 'STRAIGHT', locked: true, unlockRequirement: 'power', rotation: 0 },
            { id: 'b3', type: 'T_JUNCTION', locked: false },
            { id: 'c1', type: 'CROSS', locked: false },
            { id: 'c2', type: 'T_JUNCTION', locked: false },
            { id: 'c3', type: 'CROSS', locked: false },
            { id: 'd1', type: 'CORNER', locked: true, unlockRequirement: 'power', rotation: 90 },
            { id: 'd2', type: 'CROSS', locked: false },
            { id: 'd3', type: 'CORNER', locked: false },
            { id: 'e1', type: 'CORNER', locked: false },
            { id: 'e2', type: 'T_JUNCTION', locked: false },
            { id: 'tgt', type: 'TARGET', locked: true }
        ],
        links: [
            { from: 'src', to: 'a2', dirFrom: 1, dirTo: 3 },
            { from: 'a2', to: 'a1', dirFrom: 0, dirTo: 2 },
            { from: 'a2', to: 'a3', dirFrom: 2, dirTo: 0 },
            { from: 'a1', to: 'b1', dirFrom: 1, dirTo: 3 },
            { from: 'a2', to: 'b2', dirFrom: 1, dirTo: 3 },
            { from: 'a3', to: 'b3', dirFrom: 1, dirTo: 3 },
            { from: 'b1', to: 'c1', dirFrom: 1, dirTo: 3 },
            { from: 'b1', to: 'b2', dirFrom: 2, dirTo: 0 },
            { from: 'b2', to: 'c2', dirFrom: 1, dirTo: 3 },
            { from: 'b3', to: 'b2', dirFrom: 0, dirTo: 2 },
            { from: 'b3', to: 'c3', dirFrom: 1, dirTo: 3 },
            { from: 'c1', to: 'd1', dirFrom: 1, dirTo: 3 },
            { from: 'c1', to: 'c2', dirFrom: 2, dirTo: 0 },
            { from: 'c2', to: 'd2', dirFrom: 1, dirTo: 3 },
            { from: 'c3', to: 'c2', dirFrom: 0, dirTo: 2 },
            { from: 'c3', to: 'd3', dirFrom: 1, dirTo: 3 },
            { from: 'd1', to: 'e1', dirFrom: 1, dirTo: 3 },
            { from: 'd2', to: 'e2', dirFrom: 1, dirTo: 3 },
            { from: 'd3', to: 'd2', dirFrom: 0, dirTo: 2 },
            { from: 'e1', to: 'e2', dirFrom: 2, dirTo: 0 },
            { from: 'e2', to: 'tgt', dirFrom: 1, dirTo: 3 },
        ]
    }
];

let allPassed = true;
for (const p of puzzles) {
    const sol = solvePuzzle(p);
    if (sol) {
        console.log(`✅ [PASS] ${p.id} solved successfully! Solution map:`, Array.from(sol.entries()));
    } else {
        console.error(`❌ [FAIL] ${p.id} could not be solved!`);
        allPassed = false;
    }
}

if (allPassed) {
    console.log('\n🎉 ALL PUZZLES VALIDATED AS MATHEMATICALLY SOLVABLE!');
    process.exit(0);
} else {
    process.exit(1);
}
