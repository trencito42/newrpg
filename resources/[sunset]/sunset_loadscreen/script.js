const loadscreen = document.getElementById('loadscreen');
const pctEl = document.getElementById('loading-pct');
const taskEl = document.getElementById('loading-task');
const filesEl = document.getElementById('loading-files');
const tipTextEl = document.getElementById('tip-text');
const rpmContainer = document.getElementById('rpm-bar');
const donutRingEl = document.getElementById('donut-ring');
const DONUT_CIRCUMFERENCE = 226.19; // 2 * π * 36

// The loadscreen runs before account authentication and before normal resources.
// Use the browser language here; the account locale takes over as soon as sunset_core starts.
const LOADSCREEN_LOCALES = {
    en: {
        title: 'Racket RPG — Loading', brand_subtitle: 'Est. 2026 · Los Santos', tips_header: 'Server Tips', // i18n-ignore: dictionary
        discord_header: 'Community', discord_desc: 'Connect with the community',
        initializing_session: 'Initializing session...', entering_session: 'Entering session...',
        loading_assets: 'Loading game assets...', downloading_files: 'Downloading {count} files...',
        initializing_resources: 'Initializing resources...', preparing_world: 'Preparing world...',
        connecting_server: 'Connecting to server...',
        tip_0: 'Stay in character at all times. Press [G] to open the quick interaction menu.',
        tip_1: 'Your voice range is shown on the HUD. Adjust voice settings in the pause menu.',
        tip_2: 'Vehicles left in traffic lanes may be impounded after server restarts.',
        tip_3: 'Press [G] near other players to open contextual interaction options.',
        tip_4: 'Need help? Use /report and describe the issue clearly.',
    },
    ro: {
        title: 'Racket RPG — Se încarcă', brand_subtitle: 'Din 2026 · Los Santos', tips_header: 'Sfaturi pentru server', // i18n-ignore: dictionary
        discord_header: 'Comunitate', discord_desc: 'Alătură-te comunității',
        initializing_session: 'Se inițializează sesiunea...', entering_session: 'Se intră în sesiune...',
        loading_assets: 'Se încarcă fișierele jocului...', downloading_files: 'Se descarcă {count} fișiere...',
        initializing_resources: 'Se inițializează resursele...', preparing_world: 'Se pregătește lumea...',
        connecting_server: 'Se conectează la server...',
        tip_0: 'Rămâi în caracter în permanență. Apasă [G] pentru meniul rapid de interacțiune.',
        tip_1: 'Raza vocii este afișată pe HUD. Poți ajusta vocea din meniul de pauză.',
        tip_2: 'Vehiculele lăsate pe carosabil pot fi ridicate după restartul serverului.',
        tip_3: 'Apasă [G] lângă alți jucători pentru opțiunile de interacțiune.',
        tip_4: 'Ai nevoie de ajutor? Folosește /report și descrie clar problema.',
    },
};
const loadscreenLocale = String(navigator.language || 'en').toLowerCase().startsWith('ro') ? 'ro' : 'en';
const lsT = (key, params = {}) => String(LOADSCREEN_LOCALES[loadscreenLocale][key] || LOADSCREEN_LOCALES.en[key] || '')
    .replace(/\{(\w+)\}/g, (all, name) => Object.prototype.hasOwnProperty.call(params, name) ? params[name] : all);
document.documentElement.lang = loadscreenLocale;
document.querySelectorAll('[data-ls-i18n]').forEach((el) => { el.textContent = lsT(el.dataset.lsI18n); });

// [BOOT TRACE v2] ABSOLUTE epoch-ms timestamps (Date.now())
const BOOT_T0 = Date.now();
let bootAttemptId = 'BOOT';

// [NUI PERF] Per-file / per-init trace lines fire thousands of times during load
// and each console.log is an IPC hop to the game. Keep all boot diagnostics off
// unless localStorage.sunset_boot_verbose === '1'.
const BTRACE_NOISY = new Set(['data_file', 'init_start', 'init_end', 'init_group_start', 'init_group_end',
    'init_order_start', 'map_load_step', 'load_progress', 'log_line', 'data_batch_start', 'data_batch_end']);
let BOOT_VERBOSE = false;
try { BOOT_VERBOSE = window.localStorage.getItem('sunset_boot_verbose') === '1'; } catch (_) { /* noop */ }
// One client-side switch for boot diagnostics. Keep expensive watchdogs and
// per-event console IPC completely out of the normal loading path.
const BOOT_DEBUG = BOOT_VERBOSE;
const LOADSCREEN_BUILD = document.querySelector('meta[name="loadscreen-build"]')?.content || 'unstamped';
const LOADSCREEN_COMMIT = document.querySelector('meta[name="loadscreen-commit"]')?.content || 'unknown';
const scriptUrl = document.currentScript?.src || 'unknown';
const paintTimeOrigin = performance.timeOrigin || (Date.now() - performance.now());
const paintStamp = () => Math.round(performance.now());
let firstPaintOccurred = false;
let firstPaintSource = 'none';
let firstRafSeen = false;
let receivedProgress = 0;
let displayedPct = 0;
let pendingTask = '';
let lifecyclePhase = 'connecting';
const firstEvents = BOOT_DEBUG ? new Set() : null;

function paintTrace(stage, extra = '') {
    if (BOOT_DEBUG) console.log(`[LS-PAINT] ${stage} t=${paintStamp()}ms visibility=${document.visibilityState} received=${Math.floor(receivedProgress)} displayed=${Math.floor(displayedPct)} source=${firstPaintSource}${extra ? ' ' + extra : ''}`);
}

function eventTrace(stage, extra = '') {
    if (!BOOT_DEBUG || firstEvents.has(stage)) return;
    firstEvents.add(stage);
    console.log(`[LS-EVENT] ${stage} t=${paintStamp()}ms received=${Math.floor(receivedProgress)} displayed=${Math.floor(displayedPct)}${extra ? ' ' + extra : ''}`);
}

if (BOOT_DEBUG) {
    console.log(`[LOADSCREEN BUILD] commit=${LOADSCREEN_COMMIT} asset=${LOADSCREEN_BUILD} script=${scriptUrl} css=${document.querySelector('link[href*="style.css"]')?.href || 'unknown'}`);
    paintTrace('script_start', `epoch=${Date.now()} timeOrigin=${Math.round(paintTimeOrigin)}`);
    document.addEventListener('DOMContentLoaded', () => paintTrace('dom_ready'));
    if (typeof PerformanceObserver === 'function') {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-paint') {
                        console.log(`[LS-PAINT] browser_first_paint t=${Math.round(entry.startTime)}ms displayedAtCallback=${Math.floor(displayedPct)} (PaintTiming may be delivered after paint)`);
                        markFirstPaint('PaintTiming');
                    }
                }
            });
            observer.observe({ type: 'paint', buffered: true });
        } catch (_) { paintTrace('paint_timing_unavailable'); }
    }
}

function btrace(stage, extra) {
    if (!BOOT_DEBUG) return;
    if (!BOOT_VERBOSE && BTRACE_NOISY.has(stage)) return;
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
if (BOOT_DEBUG) (function frameWatchdog() {
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

const TIPS = Array.from({ length: 5 }, (_, index) => lsT(`tip_${index}`));

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
            if (!seg.classList.contains('active')) seg.classList.add('active');
            if (seg.classList.contains('is-redline') && !seg.classList.contains('redline')) seg.classList.add('redline');
        } else {
            if (seg.classList.contains('active')) seg.classList.remove('active', 'redline');
        }
    });
}

// Monotonic: only move forward, never backwards.
function renderProgress(pct, task) {
    if (BOOT_DEBUG && pct >= 100 && lifecyclePhase !== 'terminal_shutdown') {
        console.error(`[LOADSCREEN INVARIANT] 100% displayed during phase=${lifecyclePhase}`);
    }
    const oldWholePct = Math.floor(displayedPct);
    displayedPct = pct;
    if (Math.floor(displayedPct) !== oldWholePct) {
        pctEl.innerHTML = `${Math.floor(displayedPct)}<span>%</span>`;
        updateRpmBar(displayedPct);
        if (donutRingEl) donutRingEl.style.strokeDashoffset = (DONUT_CIRCUMFERENCE * (1 - displayedPct / 100)).toFixed(2);
    }
    if (task && taskEl.textContent !== task) taskEl.textContent = task;
    if (filesEl.textContent) filesEl.textContent = '';
}

function markFirstPaint(source) {
    if (firstPaintOccurred || document.visibilityState === 'hidden') return;
    firstPaintOccurred = true;
    firstPaintSource = source;
    paintTrace('first_paint_opportunity', 'initialHtmlPct=0 (rAF is not compositor proof)');
    if (!handoffReceived) renderProgress(receivedProgress, pendingTask);
}

// The first rAF is before the first potential paint. Let the initial HTML 0%
// reach that paint; only flush real received progress on the next frame.
function queuePaintOpportunity() {
    requestAnimationFrame(() => {
        firstRafSeen = true;
        paintTrace('first_raf');
        requestAnimationFrame(() => {
            paintTrace('second_raf');
            markFirstPaint('second_rAF');
        });
    });
}
queuePaintOpportunity();
document.addEventListener('visibilitychange', () => {
    paintTrace('visibility_change');
    if (document.visibilityState === 'visible' && !firstPaintOccurred && !handoffReceived) queuePaintOpportunity();
});

function setProgress(pct, task) {
    const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
    if (clamped < receivedProgress) return;
    receivedProgress = clamped;
    if (BOOT_DEBUG) {
        if (clamped >= 70) eventTrace('timeTo70');
        if (clamped >= 85) eventTrace('timeTo85');
        if (clamped >= 95) eventTrace('timeTo95');
    }
    if (task) pendingTask = task;
    if (firstPaintOccurred && !handoffReceived) renderProgress(receivedProgress, pendingTask);
}

// ═══════════════════════════════════════════════════════════════
//  DIAGNOSTICS & STALL TRACKER FOR FIVEM LOAD LIFECYCLE
// ═══════════════════════════════════════════════════════════════

const loadMetrics = BOOT_DEBUG ? {
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
} : null;

const stallAlertThresholds = [1000, 3000, 5000];
let lastStallAlertLevel = 0;

function touchLoadEvent(eventName, phase) {
    if (!BOOT_DEBUG) return;
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
if (BOOT_DEBUG) setInterval(() => {
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
    if (!BOOT_DEBUG) return;
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
    if (handoffReceived) return;
    if (BOOT_DEBUG) eventTrace('handoff', `firstPaint=${firstPaintOccurred}`);
    btrace('handoff received -> animations off');
    handoffReceived = true;
    lifecyclePhase = 'terminal_shutdown';
    if (BOOT_DEBUG) loadMetrics.handoffTimestamp = Date.now() - BOOT_T0;
    touchLoadEvent('sunsetHandoff', 'handoff');

    loadscreen.classList.add('is-handoff');
    receivedProgress = 100;
    eventTrace('timeTo100');
    if (firstPaintOccurred) renderProgress(100, lsT('entering_session'));
    printLoadSummary();
    // Never expose 100 as the first frame. If CEF has not painted yet, the
    // core will shut this page down immediately instead of fabricating progress.
    loadscreen.classList.add('fade-out');
    if (BOOT_DEBUG) paintTrace('handoff_fade_started', `firstRaf=${firstRafSeen}`);
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
        lifecyclePhase = 'asset_load';
        if (BOOT_DEBUG) {
            if (!loadMetrics.tLoadProgressStart) loadMetrics.tLoadProgressStart = Date.now();
            loadMetrics.tLoadProgressEnd = Date.now();
        }

        const frac = Number(data.loadFraction) || 0;
        setProgress(frac * 70, lsT('loading_assets'));
        if (BOOT_DEBUG) {
            eventTrace('first_loadProgress', `fraction=${frac.toFixed(3)} target=${Math.floor(frac * 70)}`);
            if (frac >= 0.25) eventTrace('loadProgress_25');
            if (frac >= 0.5) eventTrace('loadProgress_50');
            btrace('load_progress', `fraction=${frac.toFixed(3)} pct=${Math.round(frac * 70)}%`);
        }
    },
    onLogLine(data) {
        if (!BOOT_DEBUG) return;
        touchLoadEvent('onLogLine');
        const msg = (data && data.message) ? String(data.message).trim() : '';
        if (msg) {
            loadMetrics.lastLogLine = msg;
            btrace('log_line', msg);
        }
    },
    startDataFileEntries(data) {
        touchLoadEvent('startDataFileEntries', 'data_files');
        lifecyclePhase = 'data_files';
        eventTrace('first_data_file_batch');
        if (BOOT_DEBUG) {
            loadMetrics.dataFileBatches += 1;
            loadMetrics.currentBatchCount = Number(data && data.count) || 0;
            loadMetrics.currentBatchStart = Date.now();
            btrace('data_batch_start', `count=${loadMetrics.currentBatchCount} batch=${loadMetrics.dataFileBatches}`);
        }
        if (data && data.count) {
            const task = lsT('downloading_files', { count: data.count });
            pendingTask = task;
            if (firstPaintOccurred && taskEl.textContent !== task) taskEl.textContent = task;
        }
    },
    onDataFileEntry(data) {
        if (!BOOT_DEBUG) return;
        touchLoadEvent('onDataFileEntry', 'data_files');
        eventTrace('first_data_file');
        loadMetrics.totalDataFiles += 1;
        const name = (data && data.name) || 'unknown';
        loadMetrics.lastDataFile = name;
        const type = (data && data.type) || '';
        const isNew = data && data.isNew !== undefined ? String(data.isNew) : '';
        const idx = data && data.idx !== undefined ? data.idx : '';
        const count = data && data.count !== undefined ? data.count : loadMetrics.currentBatchCount;

        btrace('data_file', `name=${name} type=${type} isNew=${isNew} idx=${idx}/${count}`);
        // Thousands of data-file events are diagnostic, not player-facing
        // progress steps. Repainting the name for every entry stalls CEF.
    },
    endDataFileEntries() {
        if (!BOOT_DEBUG) return;
        touchLoadEvent('endDataFileEntries', 'data_files');
        const elapsed = loadMetrics.currentBatchStart ? (Date.now() - loadMetrics.currentBatchStart) : 0;
        btrace('data_batch_end', `count=${loadMetrics.currentBatchCount} elapsed=${elapsed}ms`);
    },
    startInitFunction(data) {
        if (!BOOT_DEBUG) return;
        touchLoadEvent('startInitFunction', 'resource_init');
        eventTrace('first_init');
        btrace('init_group_start', `type=${(data && data.type) || 'all'}`);
    },
    startInitFunctionOrder(data) {
        touchLoadEvent('startInitFunctionOrder', 'resource_init');
        lifecyclePhase = 'resource_init';
        eventTrace('first_init');
        initTotal = Number(data && data.count) || 1;
        initDone = 0;
        setProgress(70, lsT('initializing_resources'));
        if (BOOT_DEBUG) btrace('init_order_start', `type=${(data && data.type) || 'all'} order=${(data && data.order) || 0} count=${initTotal}`);
    },
    initFunctionInvoking(data) {
        if (!BOOT_DEBUG) return;
        touchLoadEvent('initFunctionInvoking', 'resource_init');
        eventTrace('first_init');
        const name = (data && data.name) || 'anonymous';
        const type = (data && data.type) || '';
        const idx = (data && data.idx) !== undefined ? data.idx : '';
        loadMetrics.lastInitFunction = name;
        loadMetrics.activeInitFunctions[name] = Date.now();

        btrace('init_start', `name=${name} type=${type} idx=${idx}`);
        // Keep the stable phase label; per-init names remain in debug metrics.
    },
    initFunctionInvoked(data) {
        touchLoadEvent('initFunctionInvoked', 'resource_init');
        lifecyclePhase = 'resource_init';
        initDone += 1;
        if (BOOT_DEBUG) {
            const name = (data && data.name) || loadMetrics.lastInitFunction;
            const type = (data && data.type) || '';
            const tStart = loadMetrics.activeInitFunctions[name];
            const elapsed = tStart ? (Date.now() - tStart) : 0;
            delete loadMetrics.activeInitFunctions[name];
            loadMetrics.initFunctionCount += 1;
            loadMetrics.initTimings.push({ name, type, duration: elapsed, idx: initDone });
            let speedFlag = '';
            if (elapsed >= 1000) speedFlag = ' [STALL]';
            else if (elapsed >= 500) speedFlag = ' [VERY_SLOW]';
            else if (elapsed >= 100) speedFlag = ' [SLOW]';
            btrace('init_end', `name=${name} elapsed=${elapsed}ms${speedFlag}`);
        }

        if (initTotal > 0) {
            setProgress(70 + (initDone / initTotal) * 15);
        }
    },
    endInitFunction(data) {
        if (!BOOT_DEBUG) return;
        touchLoadEvent('endInitFunction', 'resource_init');
        btrace('init_group_end', `type=${(data && data.type) || 'all'}`);
    },
    performMapLoadFunction(data) {
        touchLoadEvent('performMapLoadFunction', 'map_load');
        lifecyclePhase = 'map_load';
        eventTrace('first_map');
        if (BOOT_DEBUG) {
            if (!loadMetrics.tMapLoadStart) loadMetrics.tMapLoadStart = Date.now();
            loadMetrics.tMapLoadEnd = Date.now();
        }

        const idx = data && data.idx !== undefined ? Number(data.idx) : 0;
        const count = data && data.count ? Number(data.count) : 1;
        const pct = 85 + (idx / count) * 10;
        setProgress(pct, lsT('preparing_world'));
        if (BOOT_DEBUG) btrace('map_load_step', `idx=${idx}/${count} pct=${Math.round(pct)}%`);
    },
};

window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (handoffReceived && data.eventName !== 'nofx' && data.eventName !== 'sunsetHandoff') {
        if (BOOT_DEBUG) console.error(`[LOADSCREEN INVARIANT] event=${data.eventName} after terminal handoff; phase=${lifecyclePhase}`);
        return;
    }
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
setProgress(0, lsT('connecting_server'));
btrace('loadscreen ready, waiting for FiveM events');
