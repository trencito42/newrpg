(function (root) {
    const HOME = ['phone', 'messages', 'bank', 'garage', 'market', 'jobs', 'map', 'faction', 'apps', 'camera'];
    const MORE = ['gallery', 'taxi', 'properties', 'clan', 'news', 'quests', 'settings'];
    const KNOWN = new Set(HOME.concat(MORE));

    function normalizeLayout(saved) {
        const seen = Object.create(null);
        const grid = [];
        const incoming = saved && Array.isArray(saved.grid) ? saved.grid : HOME;
        incoming.forEach((id) => {
            if (typeof id === 'string' && KNOWN.has(id) && HOME.indexOf(id) !== -1 && !seen[id]) {
                seen[id] = true;
                grid.push(id);
            }
        });
        HOME.forEach((id) => {
            if (!seen[id]) grid.push(id);
        });
        return { grid: grid };
    }

    function shouldRunTimer(state) {
        return state === 'ACTIVE';
    }

    function shouldConnectVoice(state) {
        return state === 'ACTIVE';
    }

    function shouldAutoLower(state) {
        return false;
    }

    function callIsLive(state) {
        return state === 'INCOMING_RINGING' || state === 'OUTGOING_RINGING' || state === 'ACTIVE';
    }

    // Presentation is closed, full, or peek. It never changes the call.
    function nextPresentation(presentation, callState, intent) {
        const current = presentation === 'full' || presentation === 'peek' ? presentation : 'closed';
        if (intent === 'forceClose') return 'closed';
        if (intent === 'terminal') return current === 'peek' ? 'closed' : current;
        if (!callIsLive(callState)) {
            if (intent === 'toggle') return current === 'closed' ? 'full' : 'closed';
            if (intent === 'open') return 'full';
            return current;
        }
        if (intent === 'toggle' || intent === 'open') {
            return current === 'full' ? 'peek' : 'full';
        }
        return current;
    }

    function terminalState(state) {
        return state === 'ENDED' || state === 'FAILED' || state === 'BUSY' || state === 'DECLINED' || state === 'UNAVAILABLE';
    }

    function applyCall(current, next) {
        const prev = current || { state: 'IDLE' };
        const incoming = next || { state: 'IDLE' };
        const sameActive = prev.state === 'ACTIVE' && incoming.state === 'ACTIVE' && prev.callId === incoming.callId;
        return {
            callId: incoming.callId || null,
            state: incoming.state || 'IDLE',
            reason: incoming.reason || null,
            role: incoming.role || null,
            peerName: incoming.peerName || '',
            peerPhone: incoming.peerPhone || '',
            peerCharacterId: incoming.peerCharacterId || null,
            localStart: sameActive ? prev.localStart : (incoming.state === 'ACTIVE' ? Date.now() : null),
            runTimer: shouldRunTimer(incoming.state),
            connectVoice: shouldConnectVoice(incoming.state),
        };
    }

    function safeText(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    }

    root.PhoneState = {
        HOME: HOME,
        MORE: MORE,
        KNOWN: KNOWN,
        normalizeLayout: normalizeLayout,
        shouldRunTimer: shouldRunTimer,
        shouldConnectVoice: shouldConnectVoice,
        shouldAutoLower: shouldAutoLower,
        callIsLive: callIsLive,
        nextPresentation: nextPresentation,
        terminalState: terminalState,
        applyCall: applyCall,
        safeText: safeText,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.PhoneState;
}(typeof window !== 'undefined' ? window : globalThis));
