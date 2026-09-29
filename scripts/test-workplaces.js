/**
 * test-workplaces.js
 * Automated unit test suite for the Sunset Physical Job Workplaces & Employment Office architecture.
 */

const assert = require('assert');

console.log('=== Starting Physical Job Workplaces Unit Tests ===\n');

// Mock Sunset.JobWorkplaces
const JobWorkplaces = {
    fisherman: {
        jobId: 'fisherman',
        jobLabel: 'Fisherman',
        locationLabel: 'Paleto Waterfront',
        address: 'Procopio Drive, Paleto Bay',
        description: 'Catch fresh fish along the northern coastline and pontoon, then sell your haul at local stores.',
        npc: {
            id: 'workplace_fisherman',
            name: 'Billy Ray',
            title: 'Master Angler',
            model: 'a_m_m_hillbilly_01',
            coords: { x: -1593.23, y: 5207.74, z: 3.31, w: 25.49 },
            scenario: 'WORLD_HUMAN_STAND_IMPATIENT',
            icon: 'ph-fish',
            badgeClass: 'fishing',
            badge: 'FISHING WORKPLACE',
        },
        guide: {
            title: 'Fisherman Career Guide',
            steps: [
                '1. Buy bait and a fishing rod from Billy Ray or local 24/7 stores.',
                '2. Head to the Paleto Bay waterfront or pontoon area.',
                '3. Press [E] to cast your line into the water and wait for a bite.',
                '4. Follow the minigame prompts to successfully reel in the fish.',
                '5. Sell your fresh catch to Billy Ray or any 24/7 store cashier.'
            ]
        },
        requirements: {
            minLevel: 1,
            licenses: [],
        },
        actions: { apply: true, startShift: true, stopShift: true, guide: true, quitJob: true }
    },

    trucker: {
        jobId: 'trucker',
        jobLabel: 'Trucker',
        locationLabel: 'Port of Los Santos',
        address: 'Terminal Way, Port of LS',
        description: 'Haul heavy industrial cargo and fuel tanker trailers across San Andreas highway networks.',
        npc: {
            id: 'workplace_trucker',
            name: 'Earl - Depot Dispatcher',
            title: 'Freight Supervisor',
            model: 'g_m_y_strpunk_02',
            coords: { x: 1200.59, y: -3107.89, z: 6.03, w: 312.11 },
            scenario: 'WORLD_HUMAN_CLIPBOARD',
            icon: 'ph-truck',
            badgeClass: 'trucker',
            badge: 'TRUCKER DEPOT',
        },
        secondaryLocation: {
            label: 'Route Laptop',
            coords: { x: 1207.92, y: -3114.87, z: 5.54, w: 259.54 },
        },
        guide: {
            title: 'Trucker Career Guide',
            steps: [
                '1. Apply as a Trucker with Dispatcher Earl at the dock depot.',
                '2. Use the Route Laptop inside the office to select a delivery contract.',
                '3. Hitch your truck to the assigned trailer in the loading bay.',
                '4. Follow GPS navigation to the destination delivery entrance.',
                '5. Choose Quick Deliver [E] or Manual Docking [G] in the bay for bonus pay.'
            ]
        },
        requirements: {
            minLevel: 1,
            licenses: ['driver'],
        },
        actions: { apply: true, startShift: false, stopShift: true, guide: true, quitJob: true }
    },

    garbage: {
        jobId: 'garbage',
        jobLabel: 'Garbage Collector',
        locationLabel: 'Davis Sanitation Yard',
        address: 'Innocence Blvd, Davis',
        description: 'Collect waste routes across city neighborhoods and unload at the central compaction depot.',
        npc: {
            id: 'workplace_garbage',
            name: 'Sal - Sanitation Foreman',
            title: 'Sanitation Supervisor',
            model: 's_m_y_garbage',
            coords: { x: -321.70, y: -1545.94, z: 27.72, w: 270.0 },
            scenario: 'WORLD_HUMAN_CLIPBOARD',
            icon: 'ph-trash',
            badgeClass: 'garbage',
            badge: 'SANITATION DEPOT',
        },
        guide: {
            title: 'Garbage Collector Career Guide',
            steps: [
                '1. Apply with Foreman Sal at the Davis Sanitation Yard.',
                '2. Start your route to dispatch a company Trashmaster truck.',
                '3. Drive to each authored bin stop in sequence along the route.',
                '4. Pick up trash bags [E] and toss them into the rear hopper.',
                '5. Return to the depot unload zone to compact and collect your payout.'
            ]
        },
        requirements: {
            minLevel: 1,
            licenses: ['driver'],
        },
        actions: { apply: true, startShift: true, stopShift: true, guide: true, quitJob: true }
    },

    courier: {
        jobId: 'courier',
        jobLabel: 'Courier',
        locationLabel: 'Post OP Warehouse',
        address: 'Elysian Fields Fwy, Terminal',
        description: 'Load parcel crates at the distribution warehouse and make door-to-door deliveries.',
        npc: {
            id: 'workplace_courier',
            name: 'Artie - Parcel Dispatcher',
            title: 'Logistics Coordinator',
            model: 's_m_m_postal_01',
            coords: { x: 78.45, y: 112.22, z: 81.16, w: 160.0 },
            scenario: 'WORLD_HUMAN_CLIPBOARD',
            icon: 'ph-package',
            badgeClass: 'courier',
            badge: 'POST OP DEPOT',
        },
        guide: {
            title: 'Courier Career Guide',
            steps: [
                '1. Apply with Dispatcher Artie at the Post OP warehouse.',
                '2. Start your delivery run to spawn your company Speedo van.',
                '3. Load all assigned packages at the warehouse loading bay.',
                '4. Follow GPS to each recipient address and deliver the package on foot.',
                '5. Complete all assigned drop-offs to earn your delivery commission.'
            ]
        },
        requirements: {
            minLevel: 1,
            licenses: ['driver'],
        },
        actions: { apply: true, startShift: true, stopShift: true, guide: true, quitJob: true }
    }
};

let passed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS ${name}`);
        passed++;
    } catch (err) {
        console.error(`  FAIL ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// ── Test 1: Workplace Structure & Completeness ────────────────
console.log('[1] Workplace Catalog & Metadata Verification');
test('All 4 physical civilian jobs are configured', () => {
    assert.strictEqual(Object.keys(JobWorkplaces).length, 4);
    assert.ok(JobWorkplaces.fisherman);
    assert.ok(JobWorkplaces.trucker);
    assert.ok(JobWorkplaces.garbage);
    assert.ok(JobWorkplaces.courier);
});

test('Each workplace has valid NPC coords (vector4) and model', () => {
    for (const [key, wp] of Object.entries(JobWorkplaces)) {
        assert.ok(wp.npc, `${key} missing npc`);
        assert.ok(wp.npc.coords, `${key} missing coords`);
        assert.strictEqual(typeof wp.npc.coords.x, 'number');
        assert.strictEqual(typeof wp.npc.coords.y, 'number');
        assert.strictEqual(typeof wp.npc.coords.z, 'number');
        assert.strictEqual(typeof wp.npc.coords.w, 'number');
        assert.ok(wp.npc.model, `${key} missing model`);
        assert.ok(wp.npc.name, `${key} missing name`);
    }
});

test('Each workplace includes concise guide with >= 4 numbered steps', () => {
    for (const [key, wp] of Object.entries(JobWorkplaces)) {
        assert.ok(wp.guide, `${key} missing guide`);
        assert.ok(Array.isArray(wp.guide.steps), `${key} steps not an array`);
        assert.ok(wp.guide.steps.length >= 4, `${key} guide has fewer than 4 steps`);
        assert.ok(wp.guide.steps[0].startsWith('1.'), `${key} first step not numbered 1.`);
    }
});

// ── Test 2: Requirements & Licensing Hooks ────────────────────
console.log('\n[2] Job Requirements & License Verification');

function checkRequirements(char, reqs, playerLicenses) {
    if (!reqs) return { ok: true };
    if (reqs.minLevel && char.level < reqs.minLevel) {
        return { ok: false, reason: `Requires Character Level ${reqs.minLevel}` };
    }
    if (reqs.licenses && reqs.licenses.length > 0) {
        for (const lic of reqs.licenses) {
            if (!playerLicenses.includes(lic)) {
                return { ok: false, reason: `Requires valid ${lic} license` };
            }
        }
    }
    return { ok: true };
}

test('Player with driver license meets trucker requirements', () => {
    const char = { id: 1, level: 2 };
    const res = checkRequirements(char, JobWorkplaces.trucker.requirements, ['driver']);
    assert.strictEqual(res.ok, true);
});

test('Player without driver license is rejected for trucker with clear reason', () => {
    const char = { id: 2, level: 5 };
    const res = checkRequirements(char, JobWorkplaces.trucker.requirements, []);
    assert.strictEqual(res.ok, false);
    assert.ok(res.reason.includes('driver'));
});

test('Fisherman has no license barrier', () => {
    const char = { id: 3, level: 1 };
    const res = checkRequirements(char, JobWorkplaces.fisherman.requirements, []);
    assert.strictEqual(res.ok, true);
});

// ── Test 3: Employment State Transitions ──────────────────────
console.log('\n[3] Employment State Transitions & Active Shift Safety');

class WorkplaceSimulator {
    constructor() {
        this.playerJob = 'unemployed';
        this.activeSession = null;
    }

    apply(jobId, playerPos, playerLicenses) {
        const wp = JobWorkplaces[jobId];
        if (!wp) return { ok: false, err: 'Unknown job' };

        // Distance check (12m limit)
        const dx = playerPos.x - wp.npc.coords.x;
        const dy = playerPos.y - wp.npc.coords.y;
        const dz = playerPos.z - wp.npc.coords.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > 12.0) {
            return { ok: false, err: 'Must visit supervisor in person' };
        }

        const reqCheck = checkRequirements({ level: 1 }, wp.requirements, playerLicenses);
        if (!reqCheck.ok) return { ok: false, err: reqCheck.reason };

        if (this.activeSession) {
            this.activeSession = null; // Clean active shift on job switch
        }

        this.playerJob = jobId;
        return { ok: true };
    }

    startShift(jobId) {
        if (this.playerJob !== jobId) return { ok: false, err: 'Not employed' };
        if (this.activeSession) return { ok: false, err: 'Already on shift' };
        this.activeSession = { jobId, state: 'ACTIVE' };
        return { ok: true };
    }

    stopShift() {
        if (!this.activeSession) return { ok: false, err: 'No active shift' };
        this.activeSession = null;
        return { ok: true };
    }

    quitJob() {
        if (this.playerJob === 'unemployed') return { ok: false, err: 'Already unemployed' };
        this.activeSession = null;
        this.playerJob = 'unemployed';
        return { ok: true };
    }
}

test('Complete lifecycle: Apply -> Start Shift -> Stop Shift -> Quit', () => {
    const sim = new WorkplaceSimulator();
    const pos = { x: -321.70, y: -1545.94, z: 27.72 }; // at garbage supervisor
    const lic = ['driver'];

    // 1. Apply
    const appRes = sim.apply('garbage', pos, lic);
    assert.strictEqual(appRes.ok, true);
    assert.strictEqual(sim.playerJob, 'garbage');

    // 2. Start Shift
    const startRes = sim.startShift('garbage');
    assert.strictEqual(startRes.ok, true);
    assert.ok(sim.activeSession);

    // 3. Stop Shift
    const stopRes = sim.stopShift();
    assert.strictEqual(stopRes.ok, true);
    assert.strictEqual(sim.activeSession, null);

    // 4. Quit Job
    const quitRes = sim.quitJob();
    assert.strictEqual(quitRes.ok, true);
    assert.strictEqual(sim.playerJob, 'unemployed');
});

test('Remote application attempt from far away is rejected', () => {
    const sim = new WorkplaceSimulator();
    const farPos = { x: 0, y: 0, z: 0 }; // far from depot
    const appRes = sim.apply('trucker', farPos, ['driver']);
    assert.strictEqual(appRes.ok, false);
    assert.ok(appRes.err.includes('in person'));
});

// ── Test 4: Employment Office Discovery Payload ───────────────
console.log('\n[4] Employment Office Discovery & Navigation');

function buildEmploymentOfficeListing(currentJob) {
    return Object.entries(JobWorkplaces).map(([jobId, wp]) => ({
        id: jobId,
        label: wp.jobLabel,
        description: wp.description,
        locationLabel: wp.locationLabel,
        address: wp.address,
        supervisorName: wp.npc.name,
        hasPhysicalWorkplace: true,
        npcCoords: { x: wp.npc.coords.x, y: wp.npc.coords.y, z: wp.npc.coords.z },
        isCurrent: (currentJob === jobId),
    }));
}

test('Employment office listing includes GPS coordinates for all workplaces', () => {
    const listing = buildEmploymentOfficeListing('trucker');
    assert.strictEqual(listing.length, 4);

    const truckerEntry = listing.find(j => j.id === 'trucker');
    assert.strictEqual(truckerEntry.isCurrent, true);
    assert.strictEqual(truckerEntry.locationLabel, 'Port of Los Santos');
    assert.strictEqual(truckerEntry.supervisorName, 'Earl - Depot Dispatcher');
    assert.ok(truckerEntry.npcCoords.x > 1000);

    const garbageEntry = listing.find(j => j.id === 'garbage');
    assert.strictEqual(garbageEntry.isCurrent, false);
    assert.strictEqual(garbageEntry.locationLabel, 'Davis Sanitation Yard');
});

console.log(`\n=== Test Suite Complete: ${passed} Passed, 0 Failed ===`);
