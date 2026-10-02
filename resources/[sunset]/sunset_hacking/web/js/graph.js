/**
 * Watch Dogs Network Graph Model & Directional Energy Propagation Engine
 * Supports port-based pure orthogonal routing, deterministic BFS propagation,
 * unified node geometry, and development invariant assertions.
 */

const DIR = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3
};

const DIR_VECTORS = {
    [DIR.TOP]:    { x: 0,  y: -1 },
    [DIR.RIGHT]:  { x: 1,  y: 0  },
    [DIR.BOTTOM]: { x: 0,  y: 1  },
    [DIR.LEFT]:   { x: -1, y: 0  },
};

// Single Source of Truth for all Node Geometry
const NODE_GEOMETRY = {
    radius: 24,         // Circle outer radius
    armLength: 24,      // Arm visual length from center (matches radius)
    portDistance: 24,   // Port coordinate distance from center
    hitRadius: 34,      // Click target radius
    targetSize: 26,     // Target diamond side length
    centerDotRadius: 3.5,
};

const NODE_TYPES = {
    STRAIGHT: { ports: [DIR.RIGHT, DIR.LEFT], rotatable: true },
    CORNER: { ports: [DIR.TOP, DIR.RIGHT], rotatable: true },
    T_JUNCTION: { ports: [DIR.LEFT, DIR.TOP, DIR.RIGHT], rotatable: true },
    CROSS: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT], rotatable: false },
    ENDPOINT: { ports: [DIR.TOP], rotatable: true },
    SOURCE: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT], rotatable: false },
    TARGET: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT], rotatable: false },
    LOCKED_JUNCTION: { ports: [DIR.TOP, DIR.RIGHT], rotatable: true },
};

class PuzzleGraph {
    constructor(puzzleData) {
        this.id = puzzleData.id;
        this.title = puzzleData.title || 'CTOS_NETWORK_GRID';
        this.difficulty = puzzleData.difficulty || 'easy';
        this.viewBox = puzzleData.viewBox || { width: 1000, height: 650 };
        this.sourceId = puzzleData.source;
        this.targetIds = new Set(puzzleData.targets || []);
        this.timeLimit = puzzleData.timeLimit || 35;

        this.nodes = new Map();
        this.links = [];
        this.adj = new Map();

        this.lastEnergizedNodes = new Set();
        this.lastEnergizedLinks = new Set();

        this.load(puzzleData);
    }

    load(data) {
        (data.nodes || []).forEach(n => {
            const baseType = NODE_TYPES[n.type] || NODE_TYPES.STRAIGHT;
            this.nodes.set(n.id, {
                id: n.id,
                x: n.x,
                y: n.y,
                type: n.type,
                rotation: n.rotation || 0,
                basePorts: [...(baseType.ports || [1, 3])],
                rotatable: baseType.rotatable !== false && !n.locked,
                locked: n.locked === true,
                unlockRequirement: n.unlockRequirement || (n.locked ? 'power' : null),
                isSource: n.id === this.sourceId || n.type === 'SOURCE',
                isTarget: this.targetIds.has(n.id) || n.type === 'TARGET',
                energized: false
            });
            this.adj.set(n.id, []);
        });

        (data.links || []).forEach((link, idx) => {
            const linkObj = {
                id: `link_${idx}_${link.from}_${link.to}`,
                from: link.from,
                to: link.to,
                dirFrom: link.dirFrom,
                dirTo: link.dirTo,
                pathD: '',
                length: 0,
                energized: false,
                flowForward: true,
                depth: 0,
            };

            const fromNode = this.nodes.get(link.from);
            const toNode = this.nodes.get(link.to);
            if (fromNode && toNode) {
                const p1 = this.getNodePort(fromNode, link.dirFrom);
                const p2 = this.getNodePort(toNode, link.dirTo);
                linkObj.pathD = this.buildOrthogonalPath(p1, p2, link.dirFrom, link.dirTo);
            }

            this.links.push(linkObj);

            if (this.adj.has(link.from)) {
                this.adj.get(link.from).push({ neighbor: link.to, link: linkObj, dirOut: link.dirFrom, dirIn: link.dirTo, isForward: true });
            }
            if (this.adj.has(link.to)) {
                this.adj.get(link.to).push({ neighbor: link.from, link: linkObj, dirOut: link.dirTo, dirIn: link.dirFrom, isForward: false });
            }
        });
    }

    /**
     * Calculates port coordinates at the exact node perimeter boundary
     */
    getNodePort(node, dir) {
        const d = NODE_GEOMETRY.portDistance;
        const v = DIR_VECTORS[dir] || { x: 0, y: 0 };
        return {
            x: Math.round(node.x + v.x * d),
            y: Math.round(node.y + v.y * d)
        };
    }

    /**
     * Builds a guaranteed 100% orthogonal SVG path (ZERO diagonal segments)
     * Every single segment satisfies (x1 === x2 || y1 === y2)
     */
    buildOrthogonalPath(p1, p2, dir1, dir2) {
        const stub = 16;
        const v1 = DIR_VECTORS[dir1];
        const v2 = DIR_VECTORS[dir2];

        // S1: Stub outward from port 1
        const s1 = {
            x: p1.x + v1.x * stub,
            y: p1.y + v1.y * stub
        };

        // S2: Stub outward from port 2
        const s2 = {
            x: p2.x + v2.x * stub,
            y: p2.y + v2.y * stub
        };

        const rawPoints = [p1, s1];

        const isH1 = (v1.x !== 0);
        const isH2 = (v2.x !== 0);

        if (isH1 && isH2) {
            // Both horizontal: transition at mid-X
            const midX = Math.round((s1.x + s2.x) / 2);
            rawPoints.push({ x: midX, y: s1.y });
            rawPoints.push({ x: midX, y: s2.y });
        } else if (!isH1 && !isH2) {
            // Both vertical: transition at mid-Y
            const midY = Math.round((s1.y + s2.y) / 2);
            rawPoints.push({ x: s1.x, y: midY });
            rawPoints.push({ x: s2.x, y: midY });
        } else if (isH1 && !isH2) {
            // Port 1 horizontal, Port 2 vertical: single corner at (s2.x, s1.y)
            rawPoints.push({ x: s2.x, y: s1.y });
        } else {
            // Port 1 vertical, Port 2 horizontal: single corner at (s1.x, s2.y)
            rawPoints.push({ x: s1.x, y: s2.y });
        }

        rawPoints.push(s2);
        rawPoints.push(p2);

        // Simplify collinear adjacent points and duplicate points
        const simplified = [];
        for (let i = 0; i < rawPoints.length; i++) {
            const pt = rawPoints[i];
            if (simplified.length >= 2) {
                const prev1 = simplified[simplified.length - 1];
                const prev2 = simplified[simplified.length - 2];

                // Check if prev2, prev1, pt are collinear on X or Y
                const sameX = (Math.abs(prev2.x - prev1.x) < 0.001 && Math.abs(prev1.x - pt.x) < 0.001);
                const sameY = (Math.abs(prev2.y - prev1.y) < 0.001 && Math.abs(prev1.y - pt.y) < 0.001);

                if (sameX || sameY) {
                    // Replace prev1 with pt
                    simplified[simplified.length - 1] = pt;
                    continue;
                }
            }

            // Avoid consecutive duplicates
            if (simplified.length > 0) {
                const prev = simplified[simplified.length - 1];
                if (Math.abs(prev.x - pt.x) < 0.001 && Math.abs(prev.y - pt.y) < 0.001) {
                    continue;
                }
            }

            simplified.push(pt);
        }

        // ── INVARIANT VALIDATION: Ensure 100% strictly orthogonal ────────
        for (let i = 0; i < simplified.length - 1; i++) {
            const a = simplified[i];
            const b = simplified[i + 1];
            const isOrthogonal = Math.abs(a.x - b.x) < 0.001 || Math.abs(a.y - b.y) < 0.001;
            if (!isOrthogonal) {
                console.error(`[sunset_hacking] INVARIANT VIOLATION: Diagonal segment generated from (${a.x},${a.y}) to (${b.x},${b.y})!`);
            }
        }

        // Build SVG path string
        const dParts = [`M ${simplified[0].x} ${simplified[0].y}`];
        for (let i = 1; i < simplified.length; i++) {
            dParts.push(`L ${simplified[i].x} ${simplified[i].y}`);
        }

        return dParts.join(' ');
    }

    getEffectivePorts(node) {
        const rotSteps = Math.floor((((node.rotation % 360) + 360) % 360 / 90) + 0.5) % 4;
        return new Set(node.basePorts.map(p => (p + rotSteps) % 4));
    }

    rotateNode(nodeId, direction = 1) {
        const node = this.nodes.get(nodeId);
        if (!node || node.locked || node.isSource || node.isTarget || node.type === 'CROSS') {
            return false;
        }

        const delta = direction * 90;
        node.rotation = (((node.rotation + delta) % 360) + 360) % 360;
        return true;
    }

    /**
     * Executes BFS deterministic power propagation from SOURCE
     */
    propagate() {
        const energizedNodes = new Set();
        const energizedLinks = new Set();
        const newlyUnlockedNodes = [];

        const sourceNode = this.nodes.get(this.sourceId);
        if (!sourceNode) {
            return {
                energizedNodes,
                energizedLinks,
                newlyEnergizedLinks: [],
                severedLinks: [],
                newlyUnlockedNodes,
                targetReached: false
            };
        }

        energizedNodes.add(sourceNode.id);
        const queue = [{ id: sourceNode.id, depth: 0 }];

        while (queue.length > 0) {
            const item = queue.shift();
            const currId = item.id;
            const currDepth = item.depth;
            const currNode = this.nodes.get(currId);
            const currPorts = this.getEffectivePorts(currNode);

            const connections = this.adj.get(currId) || [];
            for (const edge of connections) {
                const neighborNode = this.nodes.get(edge.neighbor);
                if (!neighborNode) continue;

                // Port alignment check
                if (!currPorts.has(edge.dirOut)) continue;

                const neighborPorts = this.getEffectivePorts(neighborNode);
                if (!neighborPorts.has(edge.dirIn)) continue;

                // Valid energized connection
                energizedLinks.add(edge.link.id);
                edge.link.flowForward = edge.isForward;
                edge.link.depth = currDepth;

                // Locked node unlock on energized route arrival
                if (neighborNode.locked && neighborNode.unlockRequirement === 'power') {
                    neighborNode.locked = false;
                    neighborNode.rotatable = true;
                    newlyUnlockedNodes.push(neighborNode.id);
                }

                if (!energizedNodes.has(neighborNode.id)) {
                    energizedNodes.add(neighborNode.id);
                    queue.push({ id: neighborNode.id, depth: currDepth + 1 });
                }
            }
        }

        const newlyEnergizedLinks = [];
        const severedLinks = [];

        energizedLinks.forEach(linkId => {
            if (!this.lastEnergizedLinks.has(linkId)) {
                newlyEnergizedLinks.push(linkId);
            }
        });

        this.lastEnergizedLinks.forEach(linkId => {
            if (!energizedLinks.has(linkId)) {
                severedLinks.push(linkId);
            }
        });

        this.nodes.forEach(n => { n.energized = energizedNodes.has(n.id); });
        this.links.forEach(l => { l.energized = energizedLinks.has(l.id); });

        this.lastEnergizedNodes = new Set(energizedNodes);
        this.lastEnergizedLinks = new Set(energizedLinks);

        // Check if all targets are reached
        let allTargetsReached = this.targetIds.size > 0;
        for (const tId of this.targetIds) {
            if (!energizedNodes.has(tId)) {
                allTargetsReached = false;
                break;
            }
        }

        return {
            energizedNodes,
            energizedLinks,
            newlyEnergizedLinks,
            severedLinks,
            newlyUnlockedNodes,
            targetReached: allTargetsReached
        };
    }
}

window.NODE_GEOMETRY = NODE_GEOMETRY;
window.PuzzleGraph = PuzzleGraph;
