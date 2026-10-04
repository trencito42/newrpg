(function () {
    const PS = window.PhoneState;
    const $ = (id) => document.getElementById(id);
    const t = (key, params) => (window.I18n ? I18n.t(key, params) : key);
    const money = (n) => (window.formatMoney ? formatMoney(n) : ('$' + Math.floor(Number(n) || 0)));
    const SVG = {
        back: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>',
        phone: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
        messages: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
        bank: '<svg viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="8" rx="2"></rect><path d="M2 10L12 2l10 8"></path></svg>',
        garage: '<svg viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2m14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg>',
        market: '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
        jobs: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        map: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
        faction: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        apps: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
        taxi: '<svg viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path></svg>',
        properties: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>',
        clan: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg>',
        news: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"></path><path d="M8 8h8M8 12h8M8 16h5"></path></svg>',
        settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path></svg>',
        quests: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
    };

    function el(tag, className) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        return node;
    }
    function svg(name) {
        const wrap = el('span', 'svg-wrap');
        wrap.innerHTML = SVG[name] || '';
        return wrap;
    }
    function text(value) { return document.createTextNode(PS.safeText(value)); }
    function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
    function btn(className, label, onClick) {
        const b = el('button', className);
        b.type = 'button';
        b.append(text(label));
        b.addEventListener('click', onClick);
        return b;
    }
    function field(placeholder, value) {
        const wrap = el('label', 'field');
        const input = el('input');
        input.placeholder = placeholder;
        input.value = value || '';
        input.addEventListener('keydown', (e) => e.stopPropagation());
        wrap.append(input);
        return { wrap, input };
    }

    const Phone = {
        data: {},
        stack: ['home'],
        call: { state: 'IDLE' },
        layout: null,
        editing: false,
        isOpen: false,
        apps: {},
        taxi: null,
        taxiDest: null,
        taxiEstimate: null,
        token: 0,
        busy: {},
        garageFilter: 'all',
        marketFilter: 'all',
        factionTab: 'overview',
        phoneTab: 'keypad',
        dial: '',
        thread: null,
        suppressClick: false,

        init() {
            if (this._ready) return;
            this._ready = true;
            this.layout = PS.normalizeLayout(null);
            const views = $('phone-views');
            views.append(this.buildHome());
            ['phone', 'messages', 'conversation', 'contacts', 'bank', 'transfer', 'garage', 'market', 'detail', 'taxi', 'jobs', 'map', 'faction', 'apps', 'properties', 'clan', 'news', 'settings'].forEach((id) => {
                views.append(this.shell(id));
            });
            $('phone-home-bar').addEventListener('click', () => this.homeTap());
            $('phone-island').addEventListener('click', () => {
                if (this.call.state === 'ACTIVE' || this.call.state === 'OUTGOING_RINGING' || this.call.state === 'INCOMING_RINGING') this.renderCall(true);
            });
            views.addEventListener('wheel', (e) => e.stopPropagation());
        },

        shell(id) {
            const view = el('div', 'view-container');
            view.id = 'view-' + id;
            const header = el('div', 'app-header');
            const back = el('button', 'btn-icon');
            back.type = 'button';
            back.innerHTML = SVG.back;
            back.addEventListener('click', () => this.back());
            const title = el('div', 'app-title');
            title.id = 'phone-title-' + id;
            const slot = el('div');
            slot.id = 'phone-slot-' + id;
            header.append(back, title, slot);
            const content = el('div', 'app-content');
            content.id = 'phone-content-' + id;
            view.append(header, content);
            return view;
        },

        buildHome() {
            const view = el('div', 'view-container active');
            view.id = 'view-home';
            const content = el('div', 'home-content');
            content.id = 'phone-home';
            const top = el('div', 'home-top');
            const logo = el('div', 'home-logo');
            logo.append(text('RACKET'));
            const done = btn('edit-done', t('phone.ui.done'), () => this.exitEdit());
            done.id = 'phone-edit-done';
            top.append(logo, done);
            const grid = el('div', 'app-grid');
            grid.id = 'phone-grid';
            const dock = el('div', 'dock');
            dock.id = 'phone-dock';
            content.append(top, grid, dock);
            view.append(content);
            return view;
        },

        show(payload) {
            this.init();
            this.data = payload || {};
            this.layout = PS.normalizeLayout(payload && payload.layout);
            this.isOpen = true;
            this.renderHome();
            const device = $('phone-device');
            device.classList.remove('hidden');
            device.setAttribute('aria-hidden', 'false');
            requestAnimationFrame(() => device.classList.add('is-open'));
            this.updateClock();
            if (!this._clock) this._clock = setInterval(() => this.updateClock(), 15000);
            const st = this.call && this.call.state;
            if (st === 'INCOMING_RINGING' || st === 'OUTGOING_RINGING') this.renderCall(true);
            else this.showView(this.stack[this.stack.length - 1] || 'home', false);
        },

        hide() {
            this.isOpen = false;
            this.editing = false;
            const device = $('phone-device');
            device.classList.remove('is-open');
            device.setAttribute('aria-hidden', 'true');
            setTimeout(() => { if (!this.isOpen) device.classList.add('hidden'); }, 420);
            if (this._clock) { clearInterval(this._clock); this._clock = null; }
        },

        close() {
            if (!this.isOpen) return;
            if (this.editing) { this.exitEdit(); return; }
            post('phoneClose', {});
        },

        update(payload) {
            this.data = Object.assign({}, this.data || {}, payload || {});
            if (this.current() === 'messages' || this.current() === 'conversation') this.renderMessages();
            if (this.current() === 'contacts') this.renderContacts();
            if (this.current() === 'bank') this.renderBank();
            if (this.current() === 'phone') this.renderPhoneApp();
            this.renderHome();
        },

        addMessage(msg) {
            if (!msg) return;
            this.data.messages = this.data.messages || [];
            if (!this.data.messages.some((row) => row.id === msg.id)) this.data.messages.unshift(msg);
            this.renderHome();
            if (this.current() === 'messages' || this.current() === 'conversation') this.renderMessages();
        },

        updateTaxi(payload) {
            this.taxi = payload || {};
            if (this.current() === 'taxi') this.renderTaxi();
        },
        setTaxiEstimate(payload) {
            this.taxiEstimate = payload || null;
            if (this.current() === 'taxi') this.renderTaxi();
        },
        onTaxiPick(dest) {
            if (!dest) return;
            this.taxiDest = { id: dest.destinationId, label: dest.label, x: dest.x, y: dest.y };
            if (this.current() === 'taxi') this.renderTaxi();
        },

        onActionResult(payload) {
            payload = payload || {};
            if (payload.op === 'send') {
                this.busy.send = false;
                this.toast(payload.ok ? t('phone.ui.sent') : (payload.error || t('phone.ui.failed_send')), payload.ok ? 'good' : 'bad');
                if (!payload.ok && this._pendingBubble) this._pendingBubble.failed = true;
            }
            if (payload.op === 'transfer') {
                this.busy.transfer = false;
                this.toast(payload.ok ? t('phone.ui.transfer_ok') : (payload.error || t('phone.ui.action_failed')), payload.ok ? 'good' : 'bad');
                if (payload.ok) this.back();
                if (this.current() === 'transfer' || this.current() === 'bank') this.renderBank();
            }
        },

        applyAppData(payload) {
            if (!payload || payload.token !== this.token) return;
            this.apps[payload.app] = payload.data || {};
            const view = this.current();
            if (payload.app === 'garage' && view === 'garage') this.renderGarage();
            if (payload.app === 'market' && (view === 'market' || view === 'detail')) this.renderMarket();
            if (payload.app === 'news' && view === 'news') this.renderNews();
            if (payload.app === 'jobs' && view === 'jobs') this.renderJobs();
            if (payload.app === 'map' && view === 'map') this.renderMap();
            if (payload.app === 'faction' && view === 'faction') this.renderFaction();
            if (payload.app === 'properties' && payload.data && payload.data.more) {
                const prev = this.apps.properties || {};
                const filter = payload.data.filter === 'rented' ? 'rented' : 'owned';
                const bucket = prev[filter] || { rows: [] };
                const extra = (payload.data.more && payload.data.more.rows) || [];
                bucket.rows = (bucket.rows || []).concat(extra);
                bucket.page = payload.data.page;
                prev[filter] = bucket;
                this.apps.properties = prev;
            }
            if (payload.app === 'properties' && view === 'properties') this.renderProperties();
            if (payload.app === 'clan' && view === 'clan') this.renderClan();
            if (payload.app === 'taxi' && view === 'taxi') { this.taxi = payload.data || this.taxi; this.renderTaxi(); }
        },

        setCall(payload) {
            const next = PS.applyCall(this.call, payload || { state: 'IDLE' });
            this.call = next;
            if (next.runTimer) this.ensureCallTimer();
            else this.stopCallTimer();
            const island = $('phone-island');
            if (next.state === 'ACTIVE') {
                island.classList.add('call-active');
                $('phone-island-name').textContent = this.peerLabel();
                this.paintDuration();
            } else island.classList.remove('call-active');
            if (next.state === 'INCOMING_RINGING' || next.state === 'OUTGOING_RINGING' || next.state === 'ACTIVE' || PS.terminalState(next.state)) this.renderCall(true);
            else this.renderCall(false);
            if (PS.terminalState(next.state)) {
                const id = next.callId;
                setTimeout(() => {
                    if (this.call.callId === id && PS.terminalState(this.call.state)) {
                        this.call = { state: 'IDLE' };
                        this.renderCall(false);
                        $('phone-island').classList.remove('call-active');
                    }
                }, 1600);
            }
        },

        ensureCallTimer() {
            if (this._callTimer) return;
            this._callTimer = setInterval(() => this.paintDuration(), 1000);
        },
        stopCallTimer() {
            if (this._callTimer) clearInterval(this._callTimer);
            this._callTimer = null;
        },
        paintDuration() {
            if (this.call.state !== 'ACTIVE' || !this.call.localStart) return;
            const secs = Math.max(0, Math.floor((Date.now() - this.call.localStart) / 1000));
            const label = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
            const island = $('phone-island-time');
            if (island) island.textContent = label;
            const live = $('phone-call-duration');
            if (live) live.textContent = label;
        },

        toast(message, kind) {
            const node = $('phone-toast');
            if (!node) return;
            node.hidden = false;
            node.className = 'phone-toast ' + (kind || '');
            node.textContent = PS.safeText(message);
            clearTimeout(this._toast);
            this._toast = setTimeout(() => { node.hidden = true; }, 2600);
        },

        updateClock() {
            const now = new Date();
            const clock = $('phone-clock');
            if (clock) clock.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        },

        current() { return this.stack[this.stack.length - 1] || 'home'; },

        showView(id, push) {
            if (push !== false && this.current() !== id) this.stack.push(id);
            if (push === false) {
                const idx = this.stack.lastIndexOf(id);
                if (idx === -1) this.stack = ['home', id].filter((v, i, arr) => i === 0 || v !== 'home' || arr.length === 1);
            }
            document.querySelectorAll('#phone-views .view-container').forEach((view) => {
                view.classList.remove('active', 'bg-behind');
                if (view.id === 'view-home') {
                    if (id === 'home') view.classList.add('active');
                    else view.classList.add('bg-behind');
                } else if (view.id === 'view-' + id) view.classList.add('active');
            });
            this.renderCurrent();
        },

        openApp(id) {
            if (this.editing) return;
            if (!PS.KNOWN.has(id) && id !== 'contacts' && id !== 'conversation' && id !== 'transfer' && id !== 'detail') return;
            if (this.apps[id]) delete this.apps[id];
            this.showView(id, true);
        },

        back() {
            if (this.editing) { this.exitEdit(); return; }
            if (this._callOpen && (this.call.state === 'INCOMING_RINGING' || this.call.state === 'OUTGOING_RINGING')) return;
            if (this.stack.length > 1) {
                this.stack.pop();
                this.showView(this.current(), false);
            } else this.goHome();
        },

        goHome() {
            this.stack = ['home'];
            this.showView('home', false);
        },

        homeTap() {
            if (this.editing) { this.exitEdit(); return; }
            if (this.current() === 'home') this.close();
            else this.goHome();
        },

        load(app) {
            this.token += 1;
            const token = this.token;
            const content = $('phone-content-' + app);
            if (content) {
                clear(content);
                const note = el('div', 'empty');
                note.append(text(t('phone.ui.loading')));
                content.append(note);
            }
            post('phoneAction', { op: 'load', app: app, token: token });
        },

        renderCurrent() {
            const id = this.current();
            const map = {
                home: () => this.renderHome(),
                phone: () => this.renderPhoneApp(),
                messages: () => this.renderMessages(),
                conversation: () => this.renderConversation(),
                contacts: () => this.renderContacts(),
                bank: () => this.renderBank(),
                transfer: () => this.renderTransfer(),
                garage: () => this.renderGarage(),
                market: () => this.renderMarket(),
                detail: () => this.renderDetail(),
                taxi: () => this.renderTaxi(),
                jobs: () => this.renderJobs(),
                map: () => this.renderMap(),
                faction: () => this.renderFaction(),
                apps: () => this.renderApps(),
                properties: () => this.renderProperties(),
                clan: () => this.renderClan(),
                news: () => this.renderNews(),
                settings: () => this.renderSettings(),
            };
            if (map[id]) map[id]();
            const needs = { garage: 'garage', market: 'market', taxi: 'taxi', jobs: 'jobs', map: 'map', faction: 'faction', properties: 'properties', clan: 'clan', news: 'news' };
            if (needs[id] && !this.apps[needs[id]]) this.load(needs[id]);
        },

        title(id, key, icon) {
            const node = $('phone-title-' + id);
            if (!node) return;
            clear(node);
            if (icon) node.append(svg(icon));
            node.append(text(t(key)));
        },

        iconButton(appId, badge) {
            const wrap = el('button', 'app-icon-wrap');
            wrap.type = 'button';
            wrap.dataset.appid = appId;
            const icon = el('div', 'app-icon icon-' + appId);
            icon.append(svg(appId === 'messages' ? 'messages' : appId));
            if (badge) {
                const b = el('span', 'app-badge');
                b.append(text(badge > 9 ? '9+' : String(badge)));
                icon.append(b);
            }
            const label = el('span', 'app-label');
            label.append(text(t('phone.ui.' + appId)));
            wrap.append(icon, label);
            return wrap;
        },

        bindIcon(node, appId, editable) {
            let timer = null;
            let long = false;
            const cancel = () => { clearTimeout(timer); timer = null; };
            if (editable) {
                node.addEventListener('pointerdown', () => {
                    long = false;
                    timer = setTimeout(() => { long = true; this.suppressClick = true; this.enterEdit(); }, 560);
                });
                node.addEventListener('pointerup', cancel);
                node.addEventListener('pointerleave', cancel);
                node.addEventListener('pointermove', cancel);
                node.draggable = false;
                node.addEventListener('dragstart', (e) => {
                    if (!this.editing) { e.preventDefault(); return; }
                    e.dataTransfer.setData('text/plain', appId);
                    node.classList.add('dragging');
                });
                node.addEventListener('dragend', () => node.classList.remove('dragging'));
                node.addEventListener('dragover', (e) => { if (this.editing) e.preventDefault(); });
                node.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData('text/plain');
                    this.reorder(from, appId);
                });
            }
            node.addEventListener('click', (e) => {
                if (this.editing || long || this.suppressClick) {
                    e.preventDefault();
                    this.suppressClick = false;
                    long = false;
                    return;
                }
                if (appId === 'quests') {
                    post('phoneAction', { op: 'openQuests' });
                    return;
                }
                this.openApp(appId);
            });
        },

        unreadCount() {
            const me = Number(this.data.myCharacterId);
            return (this.data.messages || []).filter((m) => Number(m.receiver_character_id) === me && !m.read_at && Number(m.sender_character_id) !== me).length;
        },

        renderHome() {
            const grid = $('phone-grid');
            const dock = $('phone-dock');
            const home = $('phone-home');
            if (!grid || !dock) return;
            if (this.editing) home.classList.add('editing'); else home.classList.remove('editing');
            const done = $('phone-edit-done');
            if (done) done.textContent = t('phone.ui.done');
            clear(grid);
            clear(dock);
            const unread = this.unreadCount();
            const missed = Number(this.data.missedCalls) || 0;
            const badgeFor = (id) => id === 'messages' ? unread : (id === 'phone' ? missed : 0);
            (this.layout.grid || []).forEach((id) => {
                const node = this.iconButton(id, badgeFor(id));
                if (this.editing) node.draggable = true;
                this.bindIcon(node, id, true);
                grid.append(node);
            });
            ['phone', 'messages', 'bank', 'map'].forEach((id) => {
                const node = this.iconButton(id, badgeFor(id));
                this.bindIcon(node, id, false);
                dock.append(node);
            });
        },

        enterEdit() {
            this.editing = true;
            this.renderHome();
        },
        exitEdit() {
            this.editing = false;
            this.renderHome();
            post('phoneAction', { op: 'layout', grid: this.layout.grid });
        },
        reorder(from, to) {
            if (!from || !to || from === to) return;
            const grid = this.layout.grid.slice();
            const a = grid.indexOf(from);
            const b = grid.indexOf(to);
            if (a < 0 || b < 0) return;
            grid.splice(a, 1);
            grid.splice(b, 0, from);
            this.layout = PS.normalizeLayout({ grid: grid });
            this.renderHome();
            document.querySelectorAll('#phone-grid .app-icon-wrap').forEach((node) => { node.draggable = true; });
        },

        peerLabel() {
            const phone = this.call.peerPhone;
            const contact = (this.data.contacts || []).find((c) => c.phone === phone);
            return contact && contact.name ? contact.name : (this.call.peerName || t('phone.ui.unknown'));
        },

        renderCall(open) {
            this._callOpen = !!open && this.call.state && this.call.state !== 'IDLE';
            const layer = $('phone-call-layer');
            if (!layer) return;
            if (!this._callOpen) { layer.hidden = true; clear(layer); return; }
            layer.hidden = false;
            clear(layer);
            const initials = el('div', 'call-avatar');
            const label = this.peerLabel();
            initials.append(text(label.slice(0, 2).toUpperCase()));
            const name = el('div', 'call-name');
            name.append(text(label));
            const sub = el('div', 'call-sub');
            sub.append(text(this.call.peerPhone || ''));
            const state = el('div', 'call-sub');
            const stateKey = this.call.state === 'INCOMING_RINGING' ? 'phone.ui.incoming'
                : (this.call.state === 'ACTIVE' ? 'phone.ui.active_call'
                    : (PS.terminalState(this.call.state) ? ('phone.call.' + String(this.call.reason || this.call.state).toLowerCase()) : 'phone.ui.calling'));
            const stateLabel = t(stateKey);
            state.append(text(stateLabel === stateKey ? t('phone.ui.call') : stateLabel));
            if (this.call.state === 'ACTIVE') {
                const dur = el('div', 'call-name');
                dur.id = 'phone-call-duration';
                dur.append(text('00:00'));
                layer.append(initials, name, sub, state, dur);
                this.paintDuration();
            } else layer.append(initials, name, sub, state);
            const actions = el('div', 'call-actions');
            if (!PS.terminalState(this.call.state)) {
                if (this.call.state === 'INCOMING_RINGING') {
                    actions.append(btn('btn-red', t('phone.ui.decline'), () => post('phoneAction', { op: 'decline' })));
                    actions.append(btn('btn-green', t('phone.ui.accept'), () => post('phoneAction', { op: 'answer' })));
                } else {
                    actions.append(btn('btn-red', t('phone.ui.hangup'), () => post('phoneAction', { op: 'hangup' })));
                }
                layer.append(actions);
            }
        },

        myId() { return Number(this.data.myCharacterId); },

        threads() {
            const me = this.myId();
            const map = new Map();
            (this.data.messages || []).forEach((msg) => {
                const sender = Number(msg.sender_character_id);
                const receiver = Number(msg.receiver_character_id);
                const peer = sender === me ? receiver : sender;
                const key = String(peer);
                const row = map.get(key) || { peer: peer, messages: [], unread: 0 };
                row.messages.push(msg);
                if (receiver === me && !msg.read_at) row.unread += 1;
                map.set(key, row);
            });
            return Array.from(map.values()).map((row) => {
                row.messages.sort((a, b) => Number(a.id) - Number(b.id));
                const last = row.messages[row.messages.length - 1];
                row.last = last;
                row.name = this.nameForPeer(row.peer, last);
                row.phone = this.phoneForPeer(row.peer);
                return row;
            }).sort((a, b) => Number(b.last.id) - Number(a.last.id));
        },

        peerRecord(peer) {
            const id = Number(peer);
            const contact = (this.data.contacts || []).find((c) => Number(c.characterId) === id);
            let phone = contact && contact.phone ? String(contact.phone) : '';
            let name = contact && contact.name ? String(contact.name) : '';
            (this.data.messages || []).forEach((msg) => {
                if (Number(msg.sender_character_id) === id) {
                    if (!name && msg.sender_name) name = String(msg.sender_name);
                    if (!phone && msg.sender_phone) phone = String(msg.sender_phone);
                }
                if (Number(msg.receiver_character_id) === id) {
                    if (!name && msg.receiver_name) name = String(msg.receiver_name);
                    if (!phone && msg.receiver_phone) phone = String(msg.receiver_phone);
                }
            });
            return { name, phone };
        },
        nameForPeer(peer, msg) {
            if (Number(peer) === 0) return t('phone.ui.dispatch');
            const found = this.peerRecord(peer);
            if (found.name) return found.name;
            if (msg && Number(msg.sender_character_id) === Number(peer) && msg.sender_name) return msg.sender_name;
            if (found.phone) return found.phone;
            return t('phone.ui.unknown');
        },
        phoneForPeer(peer) {
            return this.peerRecord(peer).phone || '';
        },

        renderPhoneApp() {
            this.title('phone', 'phone.ui.phone', 'phone');
            const content = $('phone-content-phone');
            clear(content);
            const tabs = el('div', 'pill-tabs');
            ['keypad', 'recents', 'contacts'].forEach((tab) => {
                const b = btn('pill-tab' + (this.phoneTab === tab ? ' active' : ''), t('phone.ui.' + tab), () => { this.phoneTab = tab; this.renderPhoneApp(); });
                tabs.append(b);
            });
            content.append(tabs);
            if (this.phoneTab === 'contacts') { this.renderContactsInto(content); return; }
            if (this.phoneTab === 'recents') { this.renderRecents(content); return; }
            const number = el('div', 'dial-number');
            number.append(text(this.dial || t('phone.ui.number')));
            const pad = el('div', 'pad');
            ['1','2','3','4','5','6','7','8','9','*','0','#'].forEach((d) => {
                pad.append(btn('', d, () => { this.dial = (this.dial + d).slice(0, 16); this.renderPhoneApp(); }));
            });
            content.append(number, pad);
            content.append(btn('btn-green', t('phone.ui.call'), () => this.startCall(this.dial)));
            content.append(btn('btn-ghost', t('phone.ui.delete'), () => { this.dial = this.dial.slice(0, -1); this.renderPhoneApp(); }));
        },

        renderRecents(content) {
            const rows = this.data.calls || [];
            if (!rows.length) { content.append(this.empty(t('phone.ui.empty'))); return; }
            rows.forEach((call) => {
                const item = el('div', 'list-item');
                const title = el('div', 'grow');
                const name = el('div', 'item-title');
                const contact = (this.data.contacts || []).find((c) => c.phone === call.peer_phone);
                name.append(text(contact ? contact.name : (call.peer_name || t('phone.ui.unknown'))));
                const sub = el('div', 'item-subtitle');
                const dir = call.direction === 'out' ? t('phone.ui.calling') : (call.status === 'missed' ? t('phone.ui.missed') : t('phone.ui.incoming'));
                sub.append(text((call.peer_phone || '') + ' · ' + dir));
                title.append(name, sub);
                item.append(title, btn('mini', t('phone.ui.call'), () => this.startCall(call.peer_phone)));
                content.append(item);
            });
        },

        startCall(phone) {
            const number = PS.safeText(phone).trim();
            if (!number) { this.toast(t('phone.enter_number'), 'bad'); return; }
            if (number === '112') { post('phoneTrigger112', {}); return; }
            post('phoneAction', { op: 'call', phone: number });
        },

        renderMessages() {
            this.title('messages', 'phone.ui.messages', 'messages');
            const slot = $('phone-slot-messages');
            clear(slot);
            slot.append(btn('btn-icon', '', () => this.openApp('contacts')));
            slot.lastChild.innerHTML = SVG.messages;
            const content = $('phone-content-messages');
            clear(content);
            const search = field(t('phone.ui.search_messages'), this._msgQuery || '');
            search.input.addEventListener('input', () => { this._msgQuery = search.input.value; this.renderThreadList(content, search.wrap); });
            content.append(search.wrap);
            this.renderThreadList(content, search.wrap);
        },

        renderThreadList(content, keep) {
            Array.from(content.children).forEach((child) => { if (child !== keep) child.remove(); });
            const q = (this._msgQuery || '').toLowerCase();
            const rows = this.threads().filter((row) => !q || row.name.toLowerCase().indexOf(q) !== -1 || (row.last.message || '').toLowerCase().indexOf(q) !== -1);
            if (!rows.length) content.append(this.empty(t('phone.ui.empty_messages')));
            rows.forEach((row) => {
                const item = el('button', 'list-item');
                item.type = 'button';
                item.style.width = '100%';
                item.style.background = 'transparent';
                item.style.border = '0';
                item.style.color = 'inherit';
                item.style.textAlign = 'left';
                const av = el('div', 'avatar');
                av.append(text(row.name.slice(0, 2).toUpperCase()));
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(row.name + (row.unread ? ' (' + row.unread + ')' : '')));
                const sub = el('div', 'item-subtitle');
                sub.append(text(row.last.message || ''));
                body.append(title, sub);
                item.append(av, body);
                item.addEventListener('click', () => { this.thread = row; this.openApp('conversation'); });
                content.append(item);
            });
        },

        renderConversation() {
            const row = this.thread;
            this.title('conversation', 'phone.ui.messages', 'messages');
            const title = $('phone-title-conversation');
            clear(title);
            title.append(text(row ? row.name : t('phone.ui.messages')));
            const slot = $('phone-slot-conversation');
            clear(slot);
            if (row && Number(row.peer) > 0) slot.append(btn('btn-icon', '', () => this.startCall(row.phone)));
            if (slot.lastChild) slot.lastChild.innerHTML = SVG.phone;
            const content = $('phone-content-conversation');
            clear(content);
            if (!row) { content.append(this.empty(t('phone.ui.empty_messages'))); return; }
            post('phoneAction', { op: 'read', characterId: row.peer });
            (this.data.messages || []).forEach((msg) => {
                if (Number(msg.receiver_character_id) === this.myId() && Number(msg.sender_character_id) === Number(row.peer)) msg.read_at = msg.read_at || new Date().toISOString();
            });
            const log = el('div', 'chat-log');
            row.messages.forEach((msg) => {
                const mine = Number(msg.sender_character_id) === this.myId();
                const bubble = el('div', 'bubble ' + (mine ? 'out' : 'in'));
                bubble.append(text(msg.message || ''));
                const time = el('span', 'time');
                time.append(text(msg.created_at || ''));
                bubble.append(time);
                log.append(bubble);
            });
            const compose = el('div', 'chat-compose');
            const input = el('input');
            input.maxLength = 256;
            input.placeholder = t('phone.ui.type_message');
            input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); });
            const sendBtn = btn('mini', t('phone.ui.send'), () => send());
            const send = () => {
                const message = input.value.trim();
                if (!message || this.busy.send) return;
                this.busy.send = true;
                sendBtn.disabled = true;
                post('phoneSend', { targetCharacterId: row.peer, phone: row.phone, message: message });
                input.value = '';
            };
            compose.append(input, sendBtn);
            content.append(log, compose);
            content.scrollTop = content.scrollHeight;
        },

        renderContacts() {
            this.title('contacts', 'phone.ui.contacts', 'faction');
            const slot = $('phone-slot-contacts');
            clear(slot);
            slot.append(btn('mini', t('phone.ui.add_contact'), () => { this._adding = !this._adding; this.renderContacts(); }));
            const content = $('phone-content-contacts');
            clear(content);
            this.renderContactsInto(content);
        },

        renderContactsInto(content) {
            if (this._adding) {
                const name = field(t('phone.ui.name'));
                const phone = field(t('phone.ui.number'));
                content.append(name.wrap, phone.wrap, btn('btn-gold', t('phone.ui.save'), () => {
                    post('phoneAddContact', { name: name.input.value.trim(), phone: phone.input.value.trim() });
                    this._adding = false;
                }));
            }
            const q = (this._contactQuery || '').toLowerCase();
            const search = field(t('phone.ui.search'), this._contactQuery || '');
            search.input.dataset.focus = '1';
            search.input.addEventListener('input', () => {
                const caret = search.input.selectionStart;
                this._contactQuery = search.input.value;
                if (this.current() === 'contacts') this.renderContacts(); else this.renderPhoneApp();
                const next = document.querySelector('#phone-device input[data-focus="1"]');
                if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch (err) { /* ignore */ } }
            });
            content.append(search.wrap);
            const mine = el('div', 'panel');
            mine.append(text((this.data.myName || t('phone.ui.you')) + ' · ' + (this.data.myPhoneNumber || '')));
            content.append(mine);
            const rows = (this.data.contacts || []).filter((c) => !q || (c.name || '').toLowerCase().indexOf(q) !== -1 || (c.phone || '').indexOf(q) !== -1);
            if (!rows.length) content.append(this.empty(t('phone.ui.empty_contacts')));
            rows.forEach((c) => {
                const item = el('div', 'list-item');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(c.name || t('phone.ui.unknown')));
                const sub = el('div', 'item-subtitle');
                sub.append(text((c.phone || '') + ' · ' + (c.online ? t('phone.ui.online') : t('phone.ui.offline'))));
                body.append(title, sub);
                const actions = el('div', 'row-actions');
                actions.append(btn('mini', t('phone.ui.call'), () => this.startCall(c.phone)));
                actions.append(btn('mini', t('phone.ui.message'), () => {
                    this.thread = { peer: Number(c.characterId), name: c.name, phone: c.phone, messages: this.messagesWith(c.characterId) };
                    this.openApp('conversation');
                }));
                actions.append(btn('mini', t('phone.ui.edit'), () => {
                    const next = window.prompt(t('phone.ui.name'), c.name || '');
                    if (next && next.trim()) post('phoneEditContact', { contactId: c.id, name: next.trim().slice(0, 48) });
                }));
                actions.append(btn('mini danger', t('phone.ui.delete'), () => post('phoneDeleteContact', { contactId: c.id })));
                item.append(body, actions);
                content.append(item);
            });
        },

        messagesWith(characterId) {
            const me = this.myId();
            const peer = Number(characterId);
            return (this.data.messages || []).filter((m) => {
                const s = Number(m.sender_character_id);
                const r = Number(m.receiver_character_id);
                return (s === me && r === peer) || (r === me && s === peer);
            });
        },

        reasonLabel(reason) {
            const key = 'phone.ui.reason_' + String(reason || '');
            const label = t(key);
            return label === key ? PS.safeText(reason || '') : label;
        },

        renderBank() {
            this.title('bank', 'phone.ui.bank', 'bank');
            const content = $('phone-content-bank');
            clear(content);
            const cash = Number(this.data.cash) || 0;
            const bank = Number(this.data.bank) || 0;
            const total = el('div', 'panel bank-balance');
            total.append(el('div', 'bb-label'));
            total.lastChild.append(text(t('phone.ui.total')));
            const amount = el('div', 'bb-amount');
            amount.append(text(money(cash + bank)));
            total.append(amount);
            const subs = el('div', 'sub-balances');
            [['phone.ui.cash', cash], ['phone.ui.bank_balance', bank]].forEach(([key, value]) => {
                const card = el('div', 'sub-bal-card');
                const h = el('div', 'sbc-header');
                h.append(text(t(key)));
                const a = el('div', 'sbc-amount');
                a.append(text(money(value)));
                card.append(h, a);
                subs.append(card);
            });
            content.append(total, subs);
            const head = el('div', 'section-title');
            head.append(text(t('phone.ui.transactions')));
            content.append(head);
            const txs = this.data.transactions || [];
            if (!txs.length) content.append(this.empty(t('phone.ui.no_transactions')));
            txs.forEach((tx) => {
                const item = el('div', 'tx-item');
                const body = el('div', 'grow');
                const title = el('div', 'tx-title');
                title.append(text(this.reasonLabel(tx.reason)));
                const desc = el('div', 'tx-desc');
                desc.append(text(tx.created_at || ''));
                body.append(title, desc);
                const amt = el('div', 'tx-amt ' + (tx.direction === 'in' ? 'pos' : 'neg'));
                amt.append(text((tx.direction === 'in' ? '+' : '-') + money(tx.amount)));
                item.append(body, amt);
                content.append(item);
            });
            const footer = el('div', 'bank-footer');
            footer.append(btn('btn-bank', t('phone.ui.transfer'), () => this.openApp('transfer')));
            footer.append(btn('btn-gold', t('phone.ui.deposit'), () => {
                this.toast(t('phone.ui.deposit_hint'), 'good');
                post('phoneAction', { op: 'nearestAtm' });
            }));
            content.append(footer);
        },

        renderTransfer() {
            this.title('transfer', 'phone.ui.transfer', 'bank');
            const content = $('phone-content-transfer');
            clear(content);
            const id = field(t('phone.ui.player_id'));
            const amount = field(t('phone.ui.amount'));
            amount.input.inputMode = 'numeric';
            content.append(id.wrap, amount.wrap);
            (this.data.contacts || []).filter((c) => c.serverId).forEach((c) => {
                content.append(btn('mini', (c.name || '') + ' #' + c.serverId, () => { id.input.value = String(c.serverId); }));
            });
            const go = btn('btn-gold', t('phone.ui.confirm'), () => {
                const targetId = Number(id.input.value);
                const value = Math.floor(Number(amount.input.value));
                if (!targetId || !value || value < 1 || this.busy.transfer) return;
                this.busy.transfer = true;
                go.disabled = true;
                post('phoneBankTransfer', { targetId: targetId, amount: value });
            });
            content.append(go);
        },

        vehicleStatus(vehicle, impounded) {
            if (impounded) return 'impounded';
            if (Number(vehicle.destroyed) === 1) return 'destroyed';
            return Number(vehicle.stored) === 1 ? 'stored' : 'out';
        },

        renderGarage() {
            this.title('garage', 'phone.ui.garage', 'garage');
            const content = $('phone-content-garage');
            clear(content);
            const data = this.apps.garage;
            if (!data) return;
            const impoundIds = {};
            (data.impound || []).forEach((row) => { impoundIds[Number(row.vehicleId)] = row; });
            const vehicles = (data.vehicles || []).map((vehicle) => Object.assign({}, vehicle, { _status: this.vehicleStatus(vehicle, impoundIds[Number(vehicle.id)]) }));
            const counts = { all: vehicles.length, stored: 0, out: 0, impounded: 0 };
            vehicles.forEach((v) => { if (counts[v._status] !== undefined) counts[v._status] += 1; });
            const tabs = el('div', 'pill-tabs');
            ['all', 'stored', 'out', 'impounded'].forEach((key) => {
                tabs.append(btn('pill-tab' + (this.garageFilter === key ? ' active' : ''), t('phone.ui.' + key) + ' ' + (counts[key] || 0), () => { this.garageFilter = key; this.renderGarage(); }));
            });
            content.append(tabs);
            const list = vehicles.filter((v) => this.garageFilter === 'all' || v._status === this.garageFilter);
            if (!list.length) content.append(this.empty(t('phone.ui.no_vehicles')));
            list.forEach((vehicle) => {
                const card = el('div', 'veh-card' + (this._openVeh === vehicle.id ? ' open' : ''));
                const main = el('button', 'veh-main');
                main.type = 'button';
                main.style.cssText = 'width:100%;background:none;border:0;color:inherit;text-align:left;padding:0';
                const model = String(vehicle.model || '').toLowerCase();
                const img = el('img', 'veh-img');
                img.alt = '';
                img.src = 'assets/vehicles/' + encodeURIComponent(model) + '.webp';
                img.addEventListener('error', () => {
                    if (!img.dataset.png) {
                        img.dataset.png = '1';
                        img.src = 'assets/vehicles/' + encodeURIComponent(model) + '.png';
                        return;
                    }
                    if (!img.dataset.svg) {
                        img.dataset.svg = '1';
                        img.src = 'assets/vehicles/fallback.svg';
                        return;
                    }
                    const fallback = el('div', 'mc-fallback');
                    fallback.append(text((vehicle.displayName || model || '?').slice(0, 3).toUpperCase()));
                    img.replaceWith(fallback);
                });
                const info = el('div', 'grow');
                const name = el('div', 'veh-name');
                name.append(text(vehicle.displayName || vehicle.label || vehicle.model || ''));
                const status = el('div', 'item-subtitle');
                const dot = el('span', 'dot ' + (vehicle._status === 'stored' ? 'stored' : vehicle._status === 'out' ? 'out' : 'impounded'));
                status.append(dot, text(t('phone.ui.' + (vehicle._status === 'destroyed' ? 'destroyed' : vehicle._status)) + ' · ' + (vehicle.plate || '')));
                const km = el('div', 'item-subtitle');
                km.append(text(t('phone.ui.mileage') + ' ' + Math.floor(Number(vehicle.odometer) || 0) + ' km'));
                info.append(name, status, km);
                main.append(img, info);
                main.addEventListener('click', () => { this._openVeh = this._openVeh === vehicle.id ? null : vehicle.id; this.renderGarage(); });
                const actions = el('div', 'veh-actions');
                actions.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', {
                    op: 'garageGps',
                    status: vehicle._status === 'destroyed' ? 'stored' : vehicle._status,
                    garage: vehicle.garage,
                    plate: vehicle.plate,
                    vehicleId: vehicle.id,
                    parkedX: vehicle.parked_x,
                    parkedY: vehicle.parked_y,
                })));
                card.append(main, actions);
                content.append(card);
            });
        },

        marketItems() {
            const data = this.apps.market || {};
            const items = [];
            (data.listings || []).forEach((row) => items.push(row));
            (data.properties || []).forEach((row) => items.push(Object.assign({ category: 'properties', kind: 'server' }, row)));
            (data.businesses || []).forEach((row) => items.push(Object.assign({ category: 'businesses' }, row)));
            (data.ads || []).forEach((row) => items.push(Object.assign({ category: 'ads', price: null }, row)));
            return items;
        },

        renderMarket() {
            this.title('market', 'phone.ui.market_title', 'market');
            const content = $('phone-content-market');
            clear(content);
            const data = this.apps.market;
            if (!data) return;
            const tabs = el('div', 'pill-tabs');
            ['all', 'vehicles', 'items', 'properties', 'player_properties', 'businesses', 'ads'].forEach((key) => {
                tabs.append(btn('pill-tab' + (this.marketFilter === key ? ' active' : ''), t(key === 'all' ? 'phone.ui.all' : 'phone.ui.' + key), () => { this.marketFilter = key; this.renderMarket(); }));
            });
            const search = field(t('phone.ui.search'), this._marketQuery || '');
            search.input.dataset.focus = '1';
            search.input.addEventListener('input', () => {
                const caret = search.input.selectionStart;
                this._marketQuery = search.input.value;
                this.renderMarket();
                const next = document.querySelector('#view-market input[data-focus="1"]');
                if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch (err) { /* ignore */ } }
            });
            content.append(tabs, search.wrap);
            const listVeh = field(t('phone.ui.list_vehicle'));
            const listPrice = field(t('phone.ui.price'));
            content.append(listVeh.wrap, listPrice.wrap, btn('btn-ghost', t('phone.ui.list_vehicle'), () => {
                post('phoneAction', { op: 'marketListVehicle', vehicleId: listVeh.input.value, price: listPrice.input.value, token: this.token });
            }));
            const listItem = field(t('phone.ui.list_item'));
            const listQty = field(t('phone.ui.qty'));
            content.append(listItem.wrap, listQty.wrap, btn('btn-ghost', t('phone.ui.list_item'), () => {
                post('phoneAction', { op: 'marketListItem', item: listItem.input.value, quantity: listQty.input.value, price: listPrice.input.value, token: this.token });
            }));
            const hint = el('div', 'muted');
            hint.style.marginBottom = '8px';
            hint.append(text(t('phone.ui.ad_hint')));
            content.append(hint);
            const q = (this._marketQuery || '').toLowerCase();
            const rows = this.marketItems().filter((row) => (this.marketFilter === 'all' || row.category === this.marketFilter) && (!q || String(row.title || '').toLowerCase().indexOf(q) !== -1));
            if (!rows.length) content.append(this.empty(t('phone.ui.no_listings')));
            rows.forEach((row) => {
                const card = el('button', 'market-card');
                card.type = 'button';
                card.style.cssText = 'width:100%;color:inherit;text-align:left;border:0';
                const fallback = el('div', 'mc-fallback');
                fallback.append(text((row.category || '?').slice(0, 1).toUpperCase()));
                const info = el('div', 'grow');
                const title = el('div', 'mc-title');
                title.append(text(row.title || ''));
                const tag = el('div', 'muted');
                tag.append(text(t('phone.ui.' + row.category)));
                info.append(title, tag);
                if (row.price != null) {
                    const price = el('div', 'mc-price');
                    price.append(text(money(row.price)));
                    info.append(price);
                }
                card.append(fallback, info);
                card.addEventListener('click', () => { this.detail = row; this.openApp('detail'); });
                content.append(card);
            });
            if ((data.mine || []).length) {
                const head = el('div', 'section-title');
                head.append(text(t('phone.ui.my_ads')));
                content.append(head);
                data.mine.forEach((ad) => {
                    const line = el('div', 'list-item');
                    const body = el('div', 'grow');
                    const title = el('div', 'item-title');
                    title.append(text(ad.text || ''));
                    const sub = el('div', 'item-subtitle');
                    sub.append(text(t('phone.ui.' + (ad.status || 'pending'))));
                    body.append(title, sub);
                    line.append(body);
                    content.append(line);
                });
            }
            const cnn = (data.pins || []).find((pin) => String(pin.id).indexOf('cnn_') === 0);
            content.append(btn('btn-ghost', t('phone.ui.set_gps'), () => { if (cnn) post('phoneAction', { op: 'gps', x: cnn.x, y: cnn.y }); }));
        },

        renderDetail() {
            this.title('detail', 'phone.ui.market_title', 'market');
            const content = $('phone-content-detail');
            clear(content);
            const row = this.detail;
            if (!row) { content.append(this.empty(t('phone.ui.no_listings'))); return; }
            const title = el('div', 'item-title');
            title.append(text(row.title || ''));
            content.append(title);
            if (row.price != null) {
                const price = el('div', 'mc-price');
                price.append(text(money(row.price)));
                content.append(price);
            }
            if (row.seller) {
                const seller = el('div', 'muted');
                seller.append(text(row.seller + (row.phone ? ' · ' + row.phone : '')));
                content.append(seller);
            }
            if (row.x && row.y) content.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: row.x, y: row.y })));
            if (row.listingId && row.kind === 'player' && Number(row.characterId) === Number(this.data.myCharacterId)) {
                content.append(btn('btn-ghost', t('phone.ui.cancel_listing'), () => post('phoneAction', { op: 'marketCancel', listingId: row.listingId, token: this.token })));
            } else if (row.listingId && row.kind === 'player') {
                content.append(btn('btn-gold', t('phone.ui.buy'), () => post('phoneAction', { op: 'marketBuy', listingId: row.listingId, token: this.token })));
            }
            if (row.phone) content.append(btn('btn-ghost', t('phone.ui.message'), () => {
                this.thread = { peer: Number(row.characterId) || 0, name: row.seller || row.phone, phone: row.phone, messages: this.messagesWith(row.characterId) };
                this.openApp('conversation');
            }));
        },

        renderTaxi() {
            this.title('taxi', 'phone.ui.taxi', 'taxi');
            const content = $('phone-content-taxi');
            clear(content);
            const data = this.taxi || this.apps.taxi;
            if (!data) return;
            if (data.isDriver && data.onDuty) {
                content.append(btn('btn-ghost', t('phone.ui.available'), () => post('taxiSetAvailable', { available: data.driverAvailable === false })));
                const offers = data.pendingOffers || [];
                if (!offers.length) content.append(this.empty(t('phone.ui.no_offers')));
                offers.forEach((ride) => {
                    const card = el('div', 'panel');
                    card.append(text((ride.passengerName || t('phone.ui.passenger')) + ' · ' + money(ride.fare || 0)));
                    card.append(btn('btn-gold', t('phone.ui.accept_ride'), () => post('taxiAcceptRide', { rideId: ride.id })));
                    content.append(card);
                });
                const active = data.activeRide;
                if (active && active.isDriver) {
                    const card = el('div', 'panel');
                    card.append(text((active.status || '') + ' · ' + money(active.fare || active.meterFare || 0)));
                    if (active.status === 'accepted') card.append(btn('btn-gold', t('phone.ui.pickup'), () => post('taxiPickup', {})));
                    if (active.status === 'in_progress') card.append(btn('btn-gold', t('phone.ui.complete'), () => post('taxiComplete', {})));
                    card.append(btn('btn-ghost', t('phone.ui.cancel_ride'), () => post('taxiCancelRide', {})));
                    content.append(card);
                }
                return;
            }
            const from = el('div', 'field');
            const fromInput = el('input');
            fromInput.value = t('phone.ui.current_location');
            fromInput.readOnly = true;
            from.append(fromInput);
            const search = field(t('phone.ui.where_to'), this._taxiQuery || '');
            search.input.dataset.focus = '1';
            search.input.addEventListener('input', () => {
                const caret = search.input.selectionStart;
                this._taxiQuery = search.input.value;
                this.renderTaxi();
                const next = document.querySelector('#view-taxi input[data-focus="1"]');
                if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch (err) { /* ignore */ } }
            });
            content.append(from, search.wrap);
            const q = (this._taxiQuery || '').toLowerCase();
            (data.destinations || []).filter((d) => !q || String(d.label || '').toLowerCase().indexOf(q) !== -1 || (this.taxiDest && this.taxiDest.id === d.id)).slice(0, 12).forEach((dest) => {
                const selected = this.taxiDest && this.taxiDest.id === dest.id;
                content.append(btn('pill-tab' + (selected ? ' active' : ''), dest.label, () => {
                    this.taxiDest = dest;
                    post('taxiEstimate', { destinationId: dest.id });
                    this.renderTaxi();
                }));
            });
            const fare = el('div', 'panel');
            fare.append(text(t('phone.ui.standard')));
            const price = el('div', 'mc-price');
            price.append(text(this.taxiEstimate ? money(this.taxiEstimate.fare) : '—'));
            fare.append(price);
            if (this.taxiEstimate && this.taxiEstimate.distanceKm != null) {
                const dist = el('div', 'muted');
                dist.append(text(t('phone.ui.distance') + ' ' + Number(this.taxiEstimate.distanceKm).toFixed(1) + ' km'));
                fare.append(dist);
            }
            content.append(fare);
            const active = data.activeRide;
            if (active && active.isPassenger) {
                const card = el('div', 'panel');
                card.append(text((active.driverName || t('phone.ui.driver')) + ' · ' + (active.status || '')));
                card.append(btn('btn-ghost', t('phone.ui.cancel_ride'), () => post('taxiCancelRide', {})));
                if (active.status === 'completed') {
                    (data.tipOptions || []).forEach((amount) => card.append(btn('mini', t('phone.ui.tip') + ' ' + money(amount), () => post('taxiTip', { amount: amount }))));
                }
                content.append(card);
            } else {
                const request = btn('btn-taxi', t('phone.ui.request_ride'), () => {
                    if (!this.taxiDest) { this.toast(t('phone.ui.no_destination'), 'bad'); return; }
                    request.disabled = true;
                    post('taxiRequestRide', { destinationId: this.taxiDest.id });
                });
                content.append(request);
            }
        },

        renderJobs() {
            this.title('jobs', 'phone.ui.jobs', 'jobs');
            const content = $('phone-content-jobs');
            clear(content);
            const data = this.apps.jobs;
            if (!data) return;
            const job = data.currentJob;
            const card = el('div', 'panel');
            const title = el('div', 'item-title');
            title.append(text(job ? (job.label || job.id) : t('phone.ui.no_job')));
            card.append(title);
            if (job) {
                const prog = (data.jobs || []).find((row) => row.id === job.id) || {};
                const meta = el('div', 'muted');
                meta.append(text(t('phone.ui.level') + ' ' + (prog.level || 1) + ' · ' + t('phone.ui.xp') + ' ' + (prog.xp || 0) + '/' + (prog.xpNext || 0)));
                card.append(meta);
                if (prog.salary) {
                    const sal = el('div', 'muted');
                    sal.append(text(t('phone.ui.salary') + ' ' + money(prog.salary)));
                    card.append(sal);
                }
                const bar = el('div', 'progress');
                const span = el('span');
                const pct = prog.xpNext ? Math.max(0, Math.min(100, (Number(prog.xp) || 0) / Number(prog.xpNext) * 100)) : 0;
                span.style.width = pct + '%';
                bar.append(span);
                card.append(bar);
                const place = (data.workplaces || []).find((row) => row.id === job.id);
                if (place && place.x) card.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: place.x, y: place.y })));
            }
            if (data.session) {
                const shift = el('div', 'muted');
                shift.append(text(t('phone.ui.shift') + ' · ' + (data.session.state || data.session.jobId || '')));
                card.append(shift, btn('btn-ghost', t('phone.ui.end_shift'), () => post('phoneAction', { op: 'jobCancel', token: this.token })));
            } else {
                const hint = el('div', 'muted');
                hint.append(text(t('phone.ui.job_remote_hint')));
                card.append(hint);
            }
            content.append(card);
        },

        renderMap() {
            this.title('map', 'phone.ui.map', 'map');
            const content = $('phone-content-map');
            clear(content);
            const data = this.apps.map;
            if (!data) return;
            const search = field(t('phone.ui.search'), this._mapQuery || '');
            search.input.dataset.focus = '1';
            search.input.addEventListener('input', () => {
                const caret = search.input.selectionStart;
                this._mapQuery = search.input.value;
                this.renderMap();
                const next = document.querySelector('#view-map input[data-focus="1"]');
                if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch (err) { /* ignore */ } }
            });
            content.append(search.wrap);
            const cats = {};
            (data.pins || []).forEach((pin) => { cats[pin.category || 'Other'] = true; });
            const tabs = el('div', 'pill-tabs');
            ['all'].concat(Object.keys(cats)).forEach((cat) => {
                tabs.append(btn('pill-tab' + ((this._mapCat || 'all') === cat ? ' active' : ''), cat === 'all' ? t('phone.ui.all') : cat, () => { this._mapCat = cat; this.renderMap(); }));
            });
            content.append(tabs);
            const q = (this._mapQuery || '').toLowerCase();
            (data.pins || []).filter((pin) => (this._mapCat || 'all') === 'all' || pin.category === this._mapCat).filter((pin) => !q || String(pin.label).toLowerCase().indexOf(q) !== -1).slice(0, 40).forEach((pin) => {
                const item = el('div', 'list-item');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(pin.label || ''));
                const sub = el('div', 'item-subtitle');
                sub.append(text(pin.category || ''));
                body.append(title, sub);
                item.append(body, btn('mini', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: pin.x, y: pin.y })));
                content.append(item);
            });
        },

        renderFaction() {
            this.title('faction', 'phone.ui.faction', 'faction');
            const content = $('phone-content-faction');
            clear(content);
            const data = this.apps.faction;
            if (!data) return;
            const panel = data.panel;
            if (!panel || !panel.isFaction) { content.append(this.empty(t('phone.ui.no_faction'))); return; }
            const dash = data.dashboard || {};
            const tabs = el('div', 'pill-tabs');
            ['overview', 'members', 'announcements', 'vehicles'].forEach((tab) => {
                tabs.append(btn('pill-tab' + (this.factionTab === tab ? ' active' : ''), t('phone.ui.' + tab), () => { this.factionTab = tab; this.renderFaction(); }));
            });
            content.append(tabs);
            if (this.factionTab === 'members') return this.renderFactionMembers(content, dash);
            if (this.factionTab === 'announcements') return this.renderFactionNews(content, dash);
            if (this.factionTab === 'vehicles') return this.renderFactionVehicles(content, data.fleet);
            const card = el('div', 'panel');
            const name = el('div', 'item-title');
            name.append(text(panel.label || ''));
            const meta = el('div', 'muted');
            const members = dash.members || [];
            const online = members.filter((m) => m.online).length;
            meta.append(text((panel.gradeLabel || '') + ' · ' + (panel.onDuty ? t('phone.ui.on_duty_short') : t('phone.ui.off_duty_short')) + ' · ' + online + '/' + members.length));
            card.append(name, meta);
            const fleet = data.fleet;
            card.append(btn('btn-ghost', t('phone.ui.duty'), () => post('phoneAction', { op: 'duty', token: this.token })));
            if (fleet && fleet.x) card.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: fleet.x, y: fleet.y })));
            if (panel.job === 'taxi') card.append(btn('btn-ghost', t('phone.ui.taxi'), () => this.openApp('taxi')));
            content.append(card);
        },

        renderFactionMembers(content, dash) {
            const perms = dash.permissions || {};
            if (perms.invite) {
                const input = field(t('phone.ui.invite_placeholder'));
                content.append(input.wrap, btn('btn-gold', t('phone.ui.invite'), () => post('phoneAction', { op: 'factionInvite', serverId: Number(input.input.value), token: this.token })));
            }
            (dash.members || []).forEach((member) => {
                const item = el('div', 'member-row');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(member.name || ''));
                const sub = el('div', 'item-subtitle');
                sub.append(text((member.gradeLabel || '') + ' · ' + (member.online ? t('phone.ui.online') : t('phone.ui.offline')) + (member.onDuty ? ' · ' + t('phone.ui.on_duty_short') : '')));
                body.append(title, sub);
                item.append(body);
                if (perms.promote || perms.rankMembers) item.append(btn('mini', '+', () => post('phoneAction', { op: 'factionRank', characterId: member.characterId, delta: 1, token: this.token })));
                if (perms.promote || perms.rankMembers) item.append(btn('mini', '-', () => post('phoneAction', { op: 'factionRank', characterId: member.characterId, delta: -1, token: this.token })));
                if (perms.kickMembers || perms.uninvite) item.append(btn('mini danger', t('phone.ui.remove'), () => post('phoneAction', { op: 'factionKick', characterId: member.characterId, token: this.token })));
                content.append(item);
            });
        },

        renderFactionNews(content, dash) {
            const card = el('div', 'panel');
            card.append(text(dash.motd || t('phone.ui.empty')));
            content.append(card);
            const perms = dash.permissions || {};
            if (perms.motd) {
                const input = field(t('phone.ui.announce_placeholder'));
                content.append(input.wrap, btn('btn-gold', t('phone.ui.post'), () => post('phoneAction', { op: 'factionMotd', message: input.input.value, token: this.token })));
            }
        },

        renderFactionVehicles(content, fleet) {
            const hint = el('div', 'muted');
            hint.append(text(t('phone.ui.fleet_hint')));
            content.append(hint);
            if (fleet && fleet.x) content.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: fleet.x, y: fleet.y })));
            (fleet && fleet.vehicles || []).forEach((vehicle) => {
                const item = el('div', 'list-item');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(vehicle.label || vehicle.model || ''));
                const sub = el('div', 'item-subtitle');
                sub.append(text(vehicle.available ? t('phone.ui.unlocked') : t('phone.ui.rank_locked')));
                body.append(title, sub);
                item.append(body);
                content.append(item);
            });
        },

        renderApps() {
            this.title('apps', 'phone.ui.apps_title', 'apps');
            const content = $('phone-content-apps');
            clear(content);
            const grid = el('div', 'app-grid');
            PS.MORE.forEach((id) => {
                const node = this.iconButton(id, 0);
                this.bindIcon(node, id, false);
                grid.append(node);
            });
            content.append(grid);
        },

        renderProperties() {
            this.title('properties', 'phone.ui.properties', 'properties');
            const content = $('phone-content-properties');
            clear(content);
            const data = this.apps.properties;
            if (!data) return;
            const rows = [].concat((data.owned && data.owned.rows) || [], (data.rented && data.rented.rows) || []);
            if (!rows.length) content.append(this.empty(t('phone.ui.no_properties')));
            rows.forEach((row) => {
                const card = el('div', 'panel');
                const title = el('div', 'item-title');
                title.append(text(row.label || ''));
                const sub = el('div', 'muted');
                const entry = row.entry || {};
                sub.append(text((row.owned ? t('phone.ui.owned') : t('phone.ui.rented')) + ' · ' + (row.locked ? t('phone.ui.locked') : t('phone.ui.unlocked'))));
                card.append(title, sub);
                if (row.rentPrice) {
                    const rent = el('div', 'muted');
                    rent.append(text(t('phone.ui.rent') + ' ' + money(row.rentPrice)));
                    card.append(rent);
                }
                if (entry.x) card.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: entry.x, y: entry.y })));
                content.append(card);
            });
            const owned = data.owned || {};
            const rented = data.rented || {};
            if ((owned.rows || []).length >= 30) {
                content.append(btn('btn-ghost', t('phone.ui.load_more'), () => post('phoneAction', { op: 'propertiesMore', filter: 'owned', page: (owned.page || 1) + 1, token: this.token })));
            }
            if ((rented.rows || []).length >= 20) {
                content.append(btn('btn-ghost', t('phone.ui.load_more'), () => post('phoneAction', { op: 'propertiesMore', filter: 'rented', page: (rented.page || 1) + 1, token: this.token })));
            }
        },

        renderClan() {
            this.title('clan', 'phone.ui.clan', 'clan');
            const content = $('phone-content-clan');
            clear(content);
            const data = this.apps.clan;
            if (!data) return;
            const dash = data.dashboard;
            if (!dash || dash.inClan === false || !dash.name) { content.append(this.empty(t('phone.ui.no_clan'))); return; }
            const card = el('div', 'panel');
            const title = el('div', 'item-title');
            title.append(text((dash.tag ? '[' + dash.tag + '] ' : '') + (dash.name || '')));
            const meta = el('div', 'muted');
            meta.append(text((dash.rankLabel || '') + ' · ' + t('phone.ui.members') + ' ' + (dash.memberCount || (dash.members || []).length) + ' · ' + t('phone.ui.turfs') + ' ' + (dash.turfs || 0)));
            card.append(title, meta);
            if (dash.motd) {
                const motd = el('div', 'muted');
                motd.append(text(dash.motd));
                card.append(motd);
            }
            const life = window.ClanLifetime?.view?.(dash, I18n.getLocale(), (key, params) => I18n.t(key, params));
            if (life && life.primary && life.primary !== '—') {
                const lifeLine = el('div', 'muted' + (life.state === 'warning' ? ' is-warn' : '') + (life.state === 'expired' ? ' is-expired' : ''));
                lifeLine.append(text(t('ui.clans.lifetime') + ' · ' + life.primary + (life.expires ? ' · ' + life.expires : '')));
                card.append(lifeLine);
            }
            const statusKey = dash.status === 'expired' ? 'ui.clans.expired'
                : dash.status === 'grace' ? 'ui.clans.grace'
                : 'phone.ui.status_active';
            const st = el('div', 'muted');
            st.append(text(t('phone.ui.status') + ' · ' + t(statusKey)));
            card.append(st);
            content.append(card);
            const perms = dash.permissions || {};
            if (perms.store) {
                content.append(btn('btn-gold', t('phone.ui.clan_store'), () => post('phoneAction', { op: 'openClanShop' })));
            }
            if (perms.invite) {
                const input = field(t('phone.ui.invite_placeholder'));
                content.append(input.wrap, btn('btn-gold', t('phone.ui.invite'), () => post('phoneAction', { op: 'clanInvite', serverId: Number(input.input.value), token: this.token })));
            }
            (dash.members || []).forEach((member) => {
                const item = el('div', 'member-row');
                const body = el('div', 'grow');
                const name = el('div', 'item-title');
                name.append(text(member.name || member.characterName || ''));
                const sub = el('div', 'item-subtitle');
                const presence = member.online ? t('phone.ui.online') : t('phone.ui.offline');
                const warns = Number(member.warns) > 0 ? (' · ' + t('phone.ui.warnings') + ' ' + member.warns) : '';
                sub.append(text((member.rankLabel || member.rank || '') + ' · ' + presence + warns));
                body.append(name, sub);
                item.append(body);
                const self = Number(member.characterId) === Number(dash.viewerCharacterId);
                if (!self && member.characterId) {
                    if (perms.promote) {
                        item.append(btn('mini', '+', () => post('phoneAction', { op: 'clanRank', characterId: member.characterId, delta: 1, token: this.token })));
                        item.append(btn('mini', '-', () => post('phoneAction', { op: 'clanRank', characterId: member.characterId, delta: -1, token: this.token })));
                    }
                    if (perms.kick) {
                        item.append(btn('mini danger', t('phone.ui.remove'), () => post('phoneAction', { op: 'clanKick', characterId: member.characterId, token: this.token })));
                    }
                }
                content.append(item);
            });
        },

        renderNews() {
            this.title('news', 'phone.ui.news', 'news');
            const content = $('phone-content-news');
            clear(content);
            const data = this.apps.news;
            if (!data) return;
            const ads = data.ads || [];
            if (!ads.length) content.append(this.empty(t('phone.ui.news_empty')));
            ads.forEach((ad) => {
                const card = el('div', 'panel');
                card.append(text(ad.title || ''));
                const meta = el('div', 'muted');
                meta.append(text((ad.seller || '') + (ad.phone ? ' · ' + ad.phone : '') + (ad.publishedAt ? ' · ' + ad.publishedAt : '')));
                card.append(meta);
                if (ad.phone) card.append(btn('btn-ghost', t('phone.ui.message'), () => {
                    this.thread = { peer: Number(ad.characterId) || 0, name: ad.seller || ad.phone, phone: ad.phone, messages: this.messagesWith(ad.characterId) };
                    this.openApp('conversation');
                }));
                content.append(card);
            });
        },

        renderSettings() {
            this.title('settings', 'phone.ui.settings', 'settings');
            const content = $('phone-content-settings');
            clear(content);
            const card = el('div', 'panel');
            [['phone.ui.name', this.data.myName], ['phone.ui.my_number', this.data.myPhoneNumber], ['phone.ui.server_id', this.data.myId]].forEach(([key, value]) => {
                const line = el('div', 'list-item');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(t(key)));
                const sub = el('div', 'item-subtitle');
                sub.append(text(value || ''));
                body.append(title, sub);
                line.append(body);
                card.append(line);
            });
            content.append(card);
            const prefs = this.data.prefs || { ringtone: true, notifySound: true, compactNotes: false };
            const toggles = el('div', 'panel');
            [['ringtone', 'phone.ui.ringtone', true], ['notifySound', 'phone.ui.notify_sound', true], ['compactNotes', 'phone.ui.compact_notes', false]].forEach(([key, label, defaultOn]) => {
                const current = prefs[key] == null ? defaultOn : !!prefs[key];
                toggles.append(btn('mini', t(label) + ': ' + (current ? 'on' : 'off'), () => {
                    prefs[key] = !current;
                    this.data.prefs = prefs;
                    post('phoneAction', { op: 'settings', ringtone: prefs.ringtone !== false, notifySound: prefs.notifySound !== false, compactNotes: !!prefs.compactNotes });
                    this.renderSettings();
                }));
            });
            content.append(toggles);
        },

        empty(message) {
            const node = el('div', 'empty');
            node.append(text(message));
            return node;
        },
    };

    window.Phone = Phone;
}());
