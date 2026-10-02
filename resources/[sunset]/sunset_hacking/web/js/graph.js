/**
 * Watch Dogs Network Graph Model & Directional Energy Propagation Engine
 * Supports port-based orthogonal routing, deterministic BFS propagation,
 * and lock state persistence.
 */

const DIR = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3
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

const NODE_RADIUS = 28;

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
                flowForward: true, // true: from -> to, false: to -> from
                depth: 0,
            };

            // Compute orthogonal SVG path
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
     * Calculates the exact cardinal port coordinates at node boundary
     * 0 = TOP, 1 = RIGHT, 2 = BOTTOM, 3 = LEFT
     */
    getNodePort(node, dir) {
        const r = NODE_RADIUS;
        switch (dir) {
            case DIR.TOP:    return { x: node.x, y: node.y - r };
            case DIR.RIGHT:  return { x: node.x + r, y: node.y };
            case DIR.BOTTOM: return { x: node.x, y: node.y + r };
            case DIR.LEFT:   return { x: node.x - r, y: node.y };
            default:         return { x: node.x, y: node.y };
        }
    }

    /**
     * Builds a clean Watch Dogs-inspired orthogonal SVG path with 90-degree turns
     */
    buildOrthogonalPath(p1, p2, dir1, dir2) {
        const stub = 16;
        let s1 = { x: p1.x, y: p1.y };
        let s2 = { x: p2.x, y: p2.y };

        // Step 1: outward stub from port 1
        if (dir1 === DIR.TOP) s1.y -= stub;
        else if (dir1 === DIR.RIGHT) s1.x += stub;
        else if (dir1 === DIR.BOTTOM) s1.y += stub;
        else if (dir1 === DIR.LEFT) s1.x -= stub;

        // Step 2: outward stub from port 2
        if (dir2 === DIR.TOP) s2.y -= stub;
        else if (dir2 === DIR.RIGHT) s2.x += stub;
        else if (dir2 === DIR.BOTTOM) s2.y += stub;
        else if (dir2 === DIR.LEFT) s2.x -= stub;

        // Step 3: Orthogonal waypoint routing
        const points = [`M ${p1.x} ${p1.y}`, `L ${s1.x} ${s1.y}`];

        const isHorizontal1 = (dir1 === DIR.LEFT || dir1 === DIR.RIGHT);
        const isHorizontal2 = (dir2 === DIR.LEFT || dir2 === DIR.RIGHT);

        if (isHorizontal1 && isHorizontal2) {
            // Both horizontal: use mid-X
            const midX = (s1.x + s2.x) / 2;
            points.push(`L ${midX} ${s1.y}`);
            points.push(`L ${midX} ${s2.y}`);
        } else if (!isHorizontal1 && !isHorizontal2) {
            // Both vertical: use mid-Y
            const midY = (s1.y + s2.y) / 2;
            points.push(`L ${s1.x} ${midY}`);
            points.push(`L ${s2.x} ${midY}`);
        } else if (isHorizontal1 && !isHorizontal2) {
            // P1 horizontal, P2 vertical: single corner at (s2.x, s1.y)
            points.push(`L ${s2.x} ${s1.y}`);
        } else {
            // P1 vertical, P2 horizontal: single corner at (s1.x, s2.y)
            points.push(`L ${s1.x} ${s2.y}`);
        }

        points.push(`L ${s2.x} ${s2.y}`);
        points.push(`L ${p2.x} ${p2.y}`);

        return points.join(' ');
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
     * Records traversal direction, depth, and unlocking conditions
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

                // Connection is valid and energized
                energizedLinks.add(edge.link.id);
                edge.link.flowForward = edge.isForward;
                edge.link.depth = currDepth;

                // Handle locked nodes: if locked junction receives power, unlock it
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

        // Check victory (all targets reached)
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

window.PuzzleGraph = PuzzleGraph;
