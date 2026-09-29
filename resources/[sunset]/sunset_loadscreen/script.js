const loadscreen = document.getElementById('loadscreen');
const pctEl = document.getElementById('loading-pct');
const taskEl = document.getElementById('loading-task');
const filesEl = document.getElementById('loading-files');
const tipTextEl = document.getElementById('tip-text');
const rpmContainer = document.getElementById('rpm-bar');

// [BOOT TRACE v2] ABSOLUTE epoch-ms timestamps (Date.now())
const BOOT_T0 = Date.now();
let bootAttemptId = 'BOOT';

function btrace(stage, extra) {
    try {
        const now = Date.now();
        console.log(`[BOOTV boot=${bootAttemptId} ${now} +${now - BOOT_T0}ms] [loadscreen] ${stage}${extra ? ' ' + extra : ''}`);
    } catch (_) { /* console unavailable */ }
}
btrace('script:start');

window.addEventListener('error', (e) => {
    btrace('js:error', `${e.message} @ ${e.filename}:${e.lineno}`);
});

// [FREEZE WATCHDOG] rAF frame-gap detector for the loadscreen CEF.
(function frameWatchdog() {
    let last = performance.now();
    function frame() {
        const now = performance.now();
        const gap = now - last;
        last = now;
        if (gap > 200) {
            console.log(`[HITCH boot=${bootAttemptId}] LOADSCREEN CEF FRAME GAP ${Math.round(gap)}ms visibility=${document.visibilityState} displayedPct=${Math.round(displayedPct)}`);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// [A/B NOFX MODE]
function applyNofx() {
    btrace('nofx mode ON (animations/filters/big bg disabled)');
    document.body.classList.add('nofx');
}

const TOTAL_SEGMENTS = 25;

const TIPS = [
    'Stay in character at all times. Press G to open the quick interaction menu.',
    'Your voice range is shown on the HUD. Adjust voice settings in the pause menu.',
    'Vehicles left in traffic lanes may be impounded after server restarts.',
    'Press G near other players to open contextual interaction options.',
    'Need help? Use /report and describe the issue clearly.',
];

let displayedPct = 0;   // monotonic: never decreases
let initTotal = 0;
let initDone = 0;
let handoffReceived = false;

let segments = [];
for (let i = 0; i < TOTAL_SEGMENTS; i++) {
    const segment = document.createElement('div');
    segment.className = 'rpm-segment';
    if (i >= TOTAL_SEGMENTS - 3) segment.classList.add('is-redline');
    rpmContainer.appendChild(segment);
}
segments = [...document.querySelectorAll('.rpm-segment')];

function updateRpmBar(pct) {
    const segmentsToLight = Math.floor((pct / 100) * TOTAL_SEGMENTS);
    segments.forEach((seg, idx) => {
        if (idx < segmentsToLight) {
            seg.classList.add('active');
            if (seg.classList.contains('is-redline')) seg.classList.add('redline');
        } else {
            seg.classList.remove('active', 'redline');
        }
    });
}

// Monotonic: only move forward, never backwards.
function setProgress(pct, task) {
    const clamped = Math.min(100, Math.max(0, pct));
    if (clamped < displayedPct) return; // monotonic guard
    displayedPct = clamped;
    pctEl.innerHTML = `${Math.floor(displayedPct)}<span>%</span>`;
    if (task) taskEl.innerText = task;
    filesEl.innerText = '';
    updateRpmBar(displayedPct);
}

// ═══════════════════════════════════════════════════════════════
//  DIAGNOSTICS & STALL TRACKER FOR FIVEM LOAD LIFECYCLE
// ═══════════════════════════════════════════════════════════════

const loadMetrics = {
    currentPhase: 'connecting', // asset_load | data_files | resource_init | map_load | waiting_handoff | handoff
    lastEventName: 'script:start',
    lastEventTime: Date.now(),
    lastDataFile: 'none',
    lastInitFunction: 'none',
    lastLogLine: 'none',
    dataFileBatches: 0,
    totalDataFiles: 0,
    currentBatchCount: 0,
    currentBatchStart: 0,
    initFunctionCount: 0,
    initTimings: [],
    activeInitFunctions: {},
    stalls: [],
    largestEventGap: 0,
    lastFileBeforeLargestStall: 'none',
    tLoadProgressStart: 0,
    tLoadProgressEnd: 0,
    tMapLoadStart: 0,
    tMapLoadEnd: 0,
    handoffTimestamp: 0,
};

const stallAlertThresholds = [1000, 3000, 5000];
let lastStallAlertLevel = 0;

function touchLoadEvent(eventName, phase) {
    const now = Date.now();
    const gap = now - loadMetrics.lastEventTime;

    if (gap > 1000 && !handoffReceived) {
        loadMetrics.stalls.push({
            start: loadMetrics.lastEventTime - BOOT_T0,
            end: now - BOOT_T0,
            duration: gap,
            phase: loadMetrics.currentPhase,
            lastEvent: loadMetrics.lastEventName,
            lastDataFile: loadMetrics.lastDataFile,
            lastInitFunction: loadMetrics.lastInitFunction,
            lastLogLine: loadMetrics.lastLogLine,
        });
        if (gap > loadMetrics.largestEventGap) {
            loadMetrics.largestEventGap = gap;
            loadMetrics.lastFileBeforeLargestStall = loadMetrics.lastDataFile;
        }
    }

    if (phase) loadMetrics.currentPhase = phase;
    loadMetrics.lastEventName = eventName;
    loadMetrics.lastEventTime = now;
    lastStallAlertLevel = 0;
}

// Watchdog checking for stalls (>1s, >3s, >5s)
setInterval(() => {
    if (handoffReceived) return;
    const now = Date.now();
    const gap = now - loadMetrics.lastEventTime;

    for (let i = stallAlertThresholds.length - 1; i >= 0; i--) {
        const threshold = stallAlertThresholds[i];
        if (gap >= threshold && lastStallAlertLevel < threshold) {
            lastStallAlertLevel = threshold;
            console.log(`[LOAD STALL boot=${bootAttemptId} +${now - BOOT_T0}ms]`);
            console.log(`  elapsedSinceLastEvent: ${Math.round(gap)}ms`);
            console.log(`  currentProgress:       ${Math.round(displayedPct)}%`);
            console.log(`  currentPhase:          ${loadMetrics.currentPhase}`);
            console.log(`  lastEvent:             ${loadMetrics.lastEventName}`);
            console.log(`  lastDataFile:          ${loadMetrics.lastDataFile}`);
            console.log(`  lastInitFunction:      ${loadMetrics.lastInitFunction}`);
            console.log(`  lastLogLine:           ${loadMetrics.lastLogLine}`);
            break;
        }
    }
}, 250);

function printLoadSummary() {
    const now = Date.now();
    const loadProgressDuration = (loadMetrics.tLoadProgressEnd > loadMetrics.tLoadProgressStart)
        ? (loadMetrics.tLoadProgressEnd - loadMetrics.tLoadProgressStart) : 0;
    const mapLoadDuration = (loadMetrics.tMapLoadEnd > loadMetrics.tMapLoadStart)
        ? (loadMetrics.tMapLoadEnd - loadMetrics.tMapLoadStart) : 0;

    const sortedInit = [...loadMetrics.initTimings].sort((a, b) => b.duration - a.duration);
    const slowestInit = sortedInit[0] ? `${sortedInit[0].name} (${sortedInit[0].duration}ms)` : 'none';

    console.log('======== FIVE M LOAD SUMMARY ========');
    console.log(`loadProgress duration:          ${loadProgressDuration}ms`);
    console.log(`data file batches:              ${loadMetrics.dataFileBatches}`);
    console.log(`total data file entries:        ${loadMetrics.totalDataFiles}`);
    console.log(`init functions:                 ${loadMetrics.initFunctionCount}`);
    console.log(`slowest init function:          ${slowestInit}`);
    console.log(`last file before largest stall: ${loadMetrics.lastFileBeforeLargestStall}`);
    console.log(`largest event gap:              ${loadMetrics.largestEventGap}ms`);
    console.log(`map-load duration:              ${mapLoadDuration}ms`);
    console.log(`handoff timestamp:              +${loadMetrics.handoffTimestamp}ms`);
    console.log('');
    console.log('TOP SLOW INIT:');
    if (sortedInit.length === 0) {
        console.log('  none');
    } else {
        sortedInit.slice(0, 5).forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.name} (${item.type || 'init'}) - ${item.duration}ms`);
        });
    }
    console.log('');
    console.log('STALLS:');
    if (loadMetrics.stalls.length === 0) {
        console.log('  none detected (>1000ms)');
    } else {
        loadMetrics.stalls.forEach((s) => {
            console.log(`  +${s.start}ms -> +${s.end}ms = ${s.duration}ms | phase=${s.phase} | lastFile=${s.lastDataFile} | lastInit=${s.lastInitFunction}`);
        });
    }
    console.log('======================================');
}

function finishHandoff() {
    btrace('handoff received -> animations off');
    handoffReceived = true;
    loadMetrics.handoffTimestamp = Date.now() - BOOT_T0;
    touchLoadEvent('sunsetHandoff', 'handoff');

    loadscreen.classList.add('is-handoff');
    setProgress(100, 'Entering session...');
    segments.forEach((seg) => {
        seg.classList.add('active');
        if (seg.classList.contains('is-redline')) seg.classList.add('redline');
    });

    printLoadSummary();

    setTimeout(() => {
        btrace('fade-out started');
        loadscreen.classList.add('fade-out');
        setTimeout(() => btrace('fade-out complete (still alive)'), 600);
    }, 90);
}

// ═══════════════════════════════════════════════════════════════
//  FIVE M EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

const handlers = {
    sunsetHandoff() {
        finishHandoff();
    },
    nofx() {
        applyNofx();
    },
    loadProgress(data) {
        touchLoadEvent('loadProgress', 'asset_load');
        if (!loadMetrics.tLoadProgressStart) loadMetrics.tLoadProgressStart = Date.now();
        loadMetrics.tLoadProgressEnd = Date.now();

        const frac = Number(data.loadFraction) || 0;
        setProgress(frac * 70, 'Loading game assets...');
        btrace('load_progress', `fraction=${frac.toFixed(3)} pct=${Math.round(frac * 70)}%`);
    },
    onLogLine(data) {
        touchLoadEvent('onLogLine');
        const msg = (data && data.message) ? String(data.message).trim() : '';
        if (msg) {
            loadMetrics.lastLogLine = msg;
            btrace('log_line', msg);
        }
    },
    startDataFileEntries(data) {
        touchLoadEvent('startDataFileEntries', 'data_files');
        loadMetrics.dataFileBatches += 1;
        loadMetrics.currentBatchCount = Number(data && data.count) || 0;
        loadMetrics.currentBatchStart = Date.now();
        btrace('data_batch_start', `count=${loadMetrics.currentBatchCount} batch=${loadMetrics.dataFileBatches}`);
        if (data && data.count) {
            taskEl.innerText = `Downloading ${data.count} files...`;
        }
    },
    onDataFileEntry(data) {
        touchLoadEvent('onDataFileEntry', 'data_files');
        loadMetrics.totalDataFiles += 1;
        const name = (data && data.name) || 'unknown';
        loadMetrics.lastDataFile = name;
        const type = (data && data.type) || '';
        const isNew = data && data.isNew !== undefined ? String(data.isNew) : '';
        const idx = data && data.idx !== undefined ? data.idx : '';
        const count = data && data.count !== undefined ? data.count : loadMetrics.currentBatchCount;

        btrace('data_file', `name=${name} type=${type} isNew=${isNew} idx=${idx}/${count}`);
        if (name) taskEl.innerText = `${name}...`;
    },
    endDataFileEntries() {
        touchLoadEvent('endDataFileEntries', 'data_files');
        const elapsed = loadMetrics.currentBatchStart ? (Date.now() - loadMetrics.currentBatchStart) : 0;
        btrace('data_batch_end', `count=${loadMetrics.currentBatchCount} elapsed=${elapsed}ms`);
    },
    startInitFunction(data) {
        touchLoadEvent('startInitFunction', 'resource_init');
        btrace('init_group_start', `type=${(data && data.type) || 'all'}`);
    },
    startInitFunctionOrder(data) {
        touchLoadEvent('startInitFunctionOrder', 'resource_init');
        initTotal = Number(data && data.count) || 1;
        initDone = 0;
        setProgress(70, 'Initializing resources...');
        btrace('init_order_start', `type=${(data && data.type) || 'all'} order=${(data && data.order) || 0} count=${initTotal}`);
    },
    initFunctionInvoking(data) {
        touchLoadEvent('initFunctionInvoking', 'resource_init');
        const name = (data && data.name) || 'anonymous';
        const type = (data && data.type) || '';
        const idx = (data && data.idx) !== undefined ? data.idx : '';
        loadMetrics.lastInitFunction = name;
        loadMetrics.activeInitFunctions[name] = Date.now();

        btrace('init_start', `name=${name} type=${type} idx=${idx}`);
        if (name) taskEl.innerText = `${name}...`;
    },
    initFunctionInvoked(data) {
        touchLoadEvent('initFunctionInvoked', 'resource_init');
        initDone += 1;
        const name = (data && data.name) || loadMetrics.lastInitFunction;
        const type = (data && data.type) || '';
        const tStart = loadMetrics.activeInitFunctions[name];
        const elapsed = tStart ? (Date.now() - tStart) : 0;
        delete loadMetrics.activeInitFunctions[name];

        loadMetrics.initFunctionCount += 1;
        loadMetrics.initTimings.push({
            name: name,
            type: type,
            duration: elapsed,
            idx: initDone,
        });

        let speedFlag = '';
        if (elapsed >= 1000) speedFlag = ' [STALL]';
        else if (elapsed >= 500) speedFlag = ' [VERY_SLOW]';
        else if (elapsed >= 100) speedFlag = ' [SLOW]';

        btrace('init_end', `name=${name} elapsed=${elapsed}ms${speedFlag}`);

        if (initTotal > 0) {
            setProgress(70 + (initDone / initTotal) * 15);
        }
    },
    endInitFunction(data) {
        touchLoadEvent('endInitFunction', 'resource_init');
        btrace('init_group_end', `type=${(data && data.type) || 'all'}`);
    },
    performMapLoadFunction(data) {
        touchLoadEvent('performMapLoadFunction', 'map_load');
        if (!loadMetrics.tMapLoadStart) loadMetrics.tMapLoadStart = Date.now();
        loadMetrics.tMapLoadEnd = Date.now();

        const idx = data && data.idx !== undefined ? Number(data.idx) : 0;
        const count = data && data.count ? Number(data.count) : 1;
        const pct = 85 + (idx / count) * 10;
        setProgress(pct, 'Preparing world...');
        btrace('map_load_step', `idx=${idx}/${count} pct=${Math.round(pct)}%`);
    },
};

window.addEventListener('message', (event) => {
    const data = event.data || {};
    const handler = handlers[data.eventName];
    if (handler) handler(data);
});

// Tips rotation
let tipIdx = 0;
setInterval(() => {
    tipTextEl.style.opacity = 0;
    setTimeout(() => {
        tipIdx = (tipIdx + 1) % TIPS.length;
        tipTextEl.innerText = TIPS[tipIdx];
        tipTextEl.style.opacity = 1;
    }, 400);
}, 6000);

document.addEventListener('selectstart', (event) => event.preventDefault(), true);
document.addEventListener('dragstart', (event) => event.preventDefault(), true);
document.addEventListener('copy', (event) => event.preventDefault(), true);

// Start at 0% with a real status. No fake simulation.
setProgress(0, 'Connecting to server...');
btrace('loadscreen ready, waiting for FiveM events');
