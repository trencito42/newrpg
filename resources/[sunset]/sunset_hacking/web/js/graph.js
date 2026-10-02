/**
 * Deterministic Graph & Power Propagation Model for Watch Dogs Hacking Puzzle
 */

const DIR = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3
};

const NODE_TYPES = {
    STRAIGHT: { ports: [DIR.RIGHT, DIR.LEFT] },                  // 1, 3
    CORNER: { ports: [DIR.TOP, DIR.RIGHT] },                     // 0, 1
    T_JUNCTION: { ports: [DIR.LEFT, DIR.TOP, DIR.RIGHT] },       // 3, 0, 1
    CROSS: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT] },// 0, 1, 2, 3
    ENDPOINT: { ports: [DIR.TOP] },                              // 0
    SOURCE: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT] },
    TARGET: { ports: [DIR.TOP, DIR.RIGHT, DIR.BOTTOM, DIR.LEFT] },
    LOCKED_JUNCTION: { ports: [DIR.TOP, DIR.RIGHT] },            // Default corner ports
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

        // Previously energized sets to track diffs for propagation / retraction animations
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
                locked: n.locked === true,
                unlockRequirement: n.unlockRequirement || null,
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
                energized: false
            };
            this.links.push(linkObj);

            if (this.adj.has(link.from)) {
                this.adj.get(link.from).push({ neighbor: link.to, link: linkObj, dirOut: link.dirFrom, dirIn: link.dirTo, isForward: true });
            }
            if (this.adj.has(link.to)) {
                this.adj.get(link.to).push({ neighbor: link.from, link: linkObj, dirOut: link.dirTo, dirIn: link.dirFrom, isForward: false });
            }
        });
    }

    getEffectivePorts(node) {
        // Effective ports = (basePort + rotSteps) % 4
        const rotSteps = Math.round(((node.rotation % 360) + 360) % 360 / 90);
        return new Set(node.basePorts.map(p => (p + rotSteps) % 4));
    }

    rotateNode(nodeId, direction = 1) {
        const node = this.nodes.get(nodeId);
        if (!node || node.locked || node.isSource || node.isTarget) {
            return false;
        }

        const delta = direction * 90;
        node.rotation = (node.rotation + delta) % 360;
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
        const queue = [sourceNode.id];

        while (queue.length > 0) {
            const currId = queue.shift();
            const currNode = this.nodes.get(currId);
            const currPorts = this.getEffectivePorts(currNode);

            const connections = this.adj.get(currId) || [];
            for (const edge of connections) {
                const neighborNode = this.nodes.get(edge.neighbor);
                if (!neighborNode) continue;

                // Port alignment check
                // 1. Current node must have an open port facing edge.dirOut
                if (!currPorts.has(edge.dirOut)) continue;

                // 2. Neighbor node must have an open port facing edge.dirIn
                const neighborPorts = this.getEffectivePorts(neighborNode);
                if (!neighborPorts.has(edge.dirIn)) continue;

                // Connection is valid and energized!
                energizedLinks.add(edge.link.id);

                // Handle locked nodes: if locked junction receives power, unlock it!
                if (neighborNode.locked && neighborNode.unlockRequirement === 'power') {
                    neighborNode.locked = false;
                    newlyUnlockedNodes.push(neighborNode.id);
                }

                if (!energizedNodes.has(neighborNode.id)) {
                    energizedNodes.add(neighborNode.id);
                    queue.push(neighborNode.id);
                }
            }
        }

        // Calculate diffs for animations
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

        // Update internal states
        this.nodes.forEach(n => { n.energized = energizedNodes.has(n.id); });
        this.links.forEach(l => { l.energized = energizedLinks.has(l.id); });

        this.lastEnergizedNodes = new Set(energizedNodes);
        this.lastEnergizedLinks = new Set(energizedLinks);

        // Check if all targets are energized
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
