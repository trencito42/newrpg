(function (root) {
    const HOME = ['phone', 'messages', 'bank', 'garage', 'market', 'jobs', 'map', 'faction', 'apps', 'camera'];
    const MORE = ['gallery', 'taxi', 'properties', 'clan', 'news', 'feed', 'quests', 'settings'];
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

    // LOCAL text during an ACTIVE call becomes phone speech. A phone-context
    // send after the call has ended fails closed and never falls back to nearby chat.
    function routeLocalCallText(channel, context, active) {
        const name = String(channel || 'all').toLowerCase();
        const local = name === 'all' || name === 'local' || name === 'say' || name === '';
        if (!local) return 'explicit';
        if (context === 'phone' && !active) return 'reject';
        if (active) return 'phone_call';
        return 'nearby';
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
        if (intent === 'toggle') return current === 'full' ? 'peek' : 'full';
        if (intent === 'open') return 'full';
        return current;
    }

    function terminalState(state) {
        return state === 'ENDED' || state === 'FAILED' || state === 'BUSY' || state === 'DECLINED' || state === 'UNAVAILABLE';
    }

    const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MONTHS_RO = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.'];

    function messageInstant(row) {
        if (row == null) return null;
        if (typeof row === 'number' || typeof row === 'string') return parseMessageTime(row);
        const unix = Number(row.created_at_unix != null ? row.created_at_unix : row.createdAtUnix);
        if (Number.isFinite(unix) && unix > 0) return unix < 1e12 ? unix * 1000 : unix;
        return parseMessageTime(row.created_at != null ? row.created_at : row.createdAt);
    }

    function parseMessageTime(value) {
        if (value == null || value === '') return null;
        if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(String(value).trim()))) {
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0) return null;
            const ms = n < 1e12 ? n * 1000 : n;
            const date = new Date(ms);
            return Number.isNaN(date.getTime()) ? null : date.getTime();
        }
        if (typeof value !== 'string') return null;
        const sql = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (sql) {
            const date = new Date(Number(sql[1]), Number(sql[2]) - 1, Number(sql[3]), Number(sql[4]), Number(sql[5]), Number(sql[6] || 0));
            return Number.isNaN(date.getTime()) ? null : date.getTime();
        }
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }

    function formatBubbleTime(value) {
        const ms = messageInstant(value);
        if (!Number.isFinite(ms)) return '--';
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return '--';
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    function dayKey(ms) {
        const date = new Date(ms);
        return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    }

    function formatDayLabel(ms, locale) {
        const date = new Date(ms);
        const day = String(date.getDate()).padStart(2, '0');
        const months = String(locale || 'en').toLowerCase().indexOf('ro') === 0 ? MONTHS_RO : MONTHS_EN;
        const month = months[date.getMonth()];
        if (String(locale || 'en').toLowerCase().indexOf('ro') === 0) return day + ' ' + month + ' ' + date.getFullYear();
        return day + ' ' + month + ' ' + date.getFullYear();
    }

    function dateSeparator(ms, now, labels) {
        const current = new Date(now || Date.now());
        const date = new Date(ms);
        const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
        const diff = Math.round((start(current) - start(date)) / 86400000);
        if (diff === 0) return labels.today;
        if (diff === 1) return labels.yesterday;
        return formatDayLabel(ms, labels.locale);
    }

    function conversationMessages(rows, me, peer) {
        const mine = Number(me);
        const other = Number(peer);
        const list = (rows || []).filter((row) => {
            const sender = Number(row.sender_character_id);
            const receiver = Number(row.receiver_character_id);
            return (sender === mine && receiver === other) || (receiver === mine && sender === other);
        });
        list.sort((a, b) => {
            const left = messageInstant(a) || 0;
            const right = messageInstant(b) || 0;
            if (left !== right) return left - right;
            return (Number(a.id) || 0) - (Number(b.id) || 0);
        });
        return list;
    }

    function resolveVoice(state, voiceAvailable, myVoiceEnabled, peerVoiceEnabled) {
        const active = state === 'ACTIVE';
        const available = active && voiceAvailable !== false;
        return {
            voiceAvailable: available,
            myVoiceEnabled: available && myVoiceEnabled !== false,
            peerVoiceEnabled: available && peerVoiceEnabled !== false,
        };
    }

    function phoneDraftOnEnd(text, hasAttachment) {
        const draft = String(text || '').trim();
        if (draft.length > 0 || hasAttachment) return 'hold';
        return 'clear';
    }

    function applyCall(current, next) {
        const prev = current || { state: 'IDLE' };
        const incoming = next || { state: 'IDLE' };
        const sameActive = prev.state === 'ACTIVE' && incoming.state === 'ACTIVE' && prev.callId === incoming.callId;
        const voice = resolveVoice(incoming.state, incoming.voiceAvailable, incoming.myVoiceEnabled, incoming.peerVoiceEnabled);
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
            voiceAvailable: voice.voiceAvailable,
            myVoiceEnabled: voice.myVoiceEnabled,
            peerVoiceEnabled: voice.peerVoiceEnabled,
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
        routeLocalCallText: routeLocalCallText,
        resolveVoice: resolveVoice,
        phoneDraftOnEnd: phoneDraftOnEnd,
        messageInstant: messageInstant,
        formatBubbleTime: formatBubbleTime,
        dateSeparator: dateSeparator,
        formatDayLabel: formatDayLabel,
        dayKey: dayKey,
        conversationMessages: conversationMessages,
        nextPresentation: nextPresentation,
        terminalState: terminalState,
        applyCall: applyCall,
        safeText: safeText,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.PhoneState;
}(typeof window !== 'undefined' ? window : globalThis));
