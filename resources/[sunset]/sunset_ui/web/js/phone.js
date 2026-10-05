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
        camera: '<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>',
        gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>',
        feed: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M20 21a8 8 0 1 0-16 0"></path><path d="M12 17v4M9 19h6"></path></svg>',
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
            ['phone', 'messages', 'conversation', 'contacts', 'bank', 'transfer', 'garage', 'market', 'detail', 'taxi', 'jobs', 'map', 'faction', 'apps', 'properties', 'clan', 'news', 'feed', 'feed-post', 'feed-profile', 'settings', 'camera', 'gallery'].forEach((id) => {
                views.append(this.shell(id));
            });
            $('phone-home-bar').addEventListener('click', () => this.homeTap());
            $('phone-island').addEventListener('click', () => {
                if (this.call.state === 'ACTIVE' || this.call.state === 'OUTGOING_RINGING' || this.call.state === 'INCOMING_RINGING') this.renderCall(true);
            });
            views.addEventListener('wheel', (e) => e.stopPropagation());
            this.bindCameraHud();
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
            this.presentation = 'full';
            device.classList.remove('is-peek');
            const st = this.call && this.call.state;
            if (PS.callIsLive(st)) this.renderCall(true);
            else this.showView(this.stack[this.stack.length - 1] || 'home', false);
            if (payload && payload.openListingId) this.focusListing({ listingId: payload.openListingId });
        },

        focusListing(payload) {
            const listingId = Number(payload && payload.listingId);
            if (!listingId) return;
            this._focusListing = listingId;
            this.openApp('market');
        },

        showPromote(payload) {
            const listingId = Number(payload && payload.listingId);
            const price = Number(payload && payload.price);
            if (!listingId || !price) return;
            document.getElementById('market-promote')?.remove();
            const dialog = el('div', 'asset-preview');
            dialog.id = 'market-promote';
            const title = el('div', 'asset-preview__title');
            title.append(text(t('asset.promote')));
            const body = el('p', 'asset-preview__desc');
            body.append(text(t('asset.promote_prompt', { price: window.I18n?.number?.(price) || String(price) })));
            const actions = el('div', 'asset-preview__actions');
            actions.append(btn('btn-ghost', t('asset.no_thanks'), () => dialog.remove()));
            actions.append(btn('btn-gold', t('asset.promote'), () => {
                dialog.remove();
                post('marketPromote', { listingId });
            }));
            dialog.append(title, body, actions);
            document.body.appendChild(dialog);
        },

        hide() {
            this.isOpen = false;
            this.editing = false;
            if (this._feedPollTimer) { clearTimeout(this._feedPollTimer); this._feedPollTimer = null; }
            const device = $('phone-device');
            device.classList.remove('is-open', 'is-peek');
            this.presentation = 'closed';
            device.setAttribute('aria-hidden', 'true');
            setTimeout(() => { if (!this.isOpen) device.classList.add('hidden'); }, 420);
            this._compose = '';
        },

        close() {
            if (!this.isOpen) return;
            if (document.getElementById('phone-photo-viewer')) { document.getElementById('phone-photo-viewer').remove(); return; }
            if (document.getElementById('phone-share-sheet')) { document.getElementById('phone-share-sheet').remove(); return; }
            if ($('phone-device')?.classList.contains('is-camera')) {
                post('phoneAction', { op: 'cameraClose' });
                return;
            }
            if (this.editing) { this.exitEdit(); return; }
            if (PS.callIsLive(this.call && this.call.state) && this.presentation !== 'peek') {
                post('phoneAction', { op: 'peek' });
                return;
            }
            post('phoneClose', {});
        },

        setPresentation(payload) {
            const mode = payload && payload.mode;
            const device = $('phone-device');
            if (!device) return;
            if (mode === 'closed') {
                this.hide();
                return;
            }
            this.presentation = mode === 'peek' ? 'peek' : 'full';
            this.isOpen = true;
            device.classList.remove('hidden');
            device.classList.add('is-open');
            device.classList.toggle('is-peek', this.presentation === 'peek');
            device.setAttribute('aria-hidden', 'false');
            if (this.presentation === 'full' && PS.callIsLive(this.call && this.call.state)) this.renderCall(true);
        },

        update(payload) {
            this.data = Object.assign({}, this.data || {}, payload || {});
            if (this.current() === 'messages') this.renderMessages();
            if (this.current() === 'conversation') this.renderConversation();
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
            if (this.current() === 'messages') this.renderMessages();
            if (this.current() === 'conversation') this.renderConversation();
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
            this.taxiDest = {
                id: dest.destinationId || (dest.waypoint ? 'waypoint' : undefined),
                label: dest.label,
                x: dest.x,
                y: dest.y,
                z: dest.z,
                waypoint: !!dest.waypoint,
            };
            if (dest.waypoint) post('taxiEstimate', { destination: { x: dest.x, y: dest.y, z: dest.z, label: dest.label } });
            if (this.current() === 'taxi') this.renderTaxi();
        },

        onActionResult(payload) {
            payload = payload || {};
            if (payload.op === 'camera' && !payload.ok) this.toast(payload.error || t('phone.ui.photo_upload_failed'), 'bad');
            if (payload.op === 'send') {
                this.busy.send = false;
                const pending = this._pendingBubble;
                if (payload.ok) {
                    this._pendingBubble = null;
                    if (payload.message) this.addMessage(payload.message);
                    this._compose = '';
                } else if (pending && (!payload.localId || pending.localId === payload.localId)) {
                    pending.failed = true;
                    this._compose = pending.message || this._compose;
                }
                this.toast(payload.ok ? t('phone.ui.sent') : (payload.error || t('phone.ui.failed_send')), payload.ok ? 'good' : 'bad');
                if (this.current() === 'conversation') this.renderConversation();
            }
            if (payload.op === 'settings') {
                this.busy.settings = false;
                if (payload.ok && payload.prefs) this.data.prefs = Object.assign({}, this.data.prefs || {}, payload.prefs);
                else if (this._settingsSnapshot) this.data.prefs = this._settingsSnapshot;
                this._settingsSnapshot = null;
                if (!payload.ok) this.toast(payload.error || t('phone.ui.action_failed'), 'bad');
                if (this.current() === 'settings') this.renderSettings();
            }
            if (payload.op === 'level') {
                this.busy.level = false;
                this.toast(payload.ok ? (payload.message || t('phone.ui.sent')) : (payload.error || t('phone.ui.action_failed')), payload.ok ? 'good' : 'bad');
                if (this.current() === 'settings') this.renderSettings();
            }
            if (payload.op === 'taxi' || payload.op === 'app' || payload.op === 'contact') {
                this.busy.taxi = false;
                if (payload.message || payload.error) this.toast(payload.ok ? payload.message : payload.error, payload.ok ? 'good' : 'bad');
                if (payload.op === 'taxi' && this.current() === 'taxi') this.renderTaxi();
            }
            if (payload.op === 'transfer') {
                this.busy.transfer = false;
                this.toast(payload.ok ? t('phone.ui.transfer_ok') : (payload.error || t('phone.ui.action_failed')), payload.ok ? 'good' : 'bad');
                if (payload.ok) {
                    this._transferDraft = null;
                    this.back();
                    if (this.current() === 'bank') this.renderBank();
                } else if (this.current() === 'transfer') this.renderTransfer();
            }
            if (payload.op === 'reactUpdate') {
                if (!this._newsReactions) this._newsReactions = {};
                const id = payload.updateId;
                if (id) {
                    this._newsReactions[id] = {
                        likesCount:    payload.ok ? payload.likesCount    : (this._newsReactions[id]?.likesCount    ?? 0),
                        dislikesCount: payload.ok ? payload.dislikesCount : (this._newsReactions[id]?.dislikesCount ?? 0),
                        myReaction:    payload.ok ? payload.myReaction    : (this._newsReactions[id]?.myReaction    ?? null),
                    };
                    if (this.current() === 'news') {
                        const rx = this._newsReactions[id];
                        document.querySelectorAll('[data-rx-id="' + id + '"]').forEach((btn) => {
                            const type = btn.dataset.rxType;
                            const count = type === 'like' ? rx.likesCount : rx.dislikesCount;
                            btn.textContent = (type === 'like' ? '👍 ' : '👎 ') + count;
                            btn.classList.toggle('rx-active', rx.myReaction === type);
                        });
                    }
                }
            }
            if (payload.op === 'feedLike') {
                const postId = String(payload.postId);
                if (!this._feedLikes) this._feedLikes = {};
                this._feedLikes[postId] = {
                    likesCount: payload.ok ? (payload.likesCount ?? 0) : (this._feedLikes[postId]?.likesCount ?? 0),
                    likedByViewer: payload.ok ? !!payload.likedByViewer : (this._feedLikes[postId]?.likedByViewer ?? false),
                };
                document.querySelectorAll('[data-feed-like="' + postId + '"]').forEach((btn) => {
                    btn.classList.toggle('feed-liked', this._feedLikes[postId].likedByViewer);
                    const countEl = btn.querySelector('.feed-like-count');
                    if (countEl) countEl.textContent = this._feedLikes[postId].likesCount;
                });
            }
            if (payload.op === 'feedComment') {
                if (payload.ok && payload.comment && this.current() === 'feed-post') {
                    this._appendFeedComment(payload.comment);
                }
                if (payload.ok && payload.commentsCount !== undefined) {
                    document.querySelectorAll('[data-feed-cmcount="' + payload.postId + '"]').forEach((el) => {
                        el.textContent = payload.commentsCount;
                    });
                }
            }
            if (payload.op === 'feedDeletePost') {
                if (payload.ok) {
                    const v = this.current();
                    if (v === 'feed-post') this.back();
                    else if (v === 'feed') this.renderFeed();
                }
            }
        },

        applyAppData(payload) {
            if (!payload || payload.token !== this.token) return;
            this.apps[payload.app] = payload.data || {};
            const view = this.current();
            if (payload.app === 'garage' && view === 'garage') this.renderGarage();
            if (payload.app === 'market' && payload.data && payload.data.browse) {
                const prev = this.apps.market || {};
                prev.listings = payload.data.listings || [];
                prev.myListings = payload.data.myListings || prev.myListings || [];
                this.apps.market = prev;
                if (view === 'market' || view === 'detail') this.renderMarket();
                return;
            }
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
            if (payload.app === 'gallery') {
                const prev = payload.data && payload.data.append ? (this.apps.gallery || { photos: [] }) : { photos: [] };
                prev.photos = (prev.photos || []).concat((payload.data && payload.data.photos) || []);
                prev.nextCursor = payload.data && payload.data.nextCursor;
                prev.error = payload.data && payload.data.error;
                this.apps.gallery = prev;
                if (view === 'gallery') this.renderGallery();
                return;
            }
            if (payload.app === 'clan' && view === 'clan') this.renderClan();
            if (payload.app === 'taxi' && view === 'taxi') { this.taxi = payload.data || this.taxi; this.renderTaxi(); }
            if (payload.app === 'feed') {
                if (payload.data && payload.data.append) {
                    const prev = this.apps.feed || {};
                    const tab = payload.data.tab || 'global';
                    prev[tab] = prev[tab] || { posts: [] };
                    prev[tab].posts = (prev[tab].posts || []).concat(payload.data.posts || []);
                    prev[tab].nextCursor = payload.data.nextCursor;
                    this.apps.feed = prev;
                } else {
                    this.apps.feed = payload.data || {};
                }
                if (view === 'feed') this.renderFeed();
                return;
            }
            if (payload.app === 'feed-post') {
                this.apps['feed-post'] = payload.data || {};
                if (view === 'feed-post') this.renderFeedPost();
                return;
            }
            if (payload.app === 'feed-profile') {
                this.apps['feed-profile'] = payload.data || {};
                if (view === 'feed-profile') this.renderFeedProfile();
                return;
            }
        },

        setCall(payload) {
            const next = PS.applyCall(this.call, payload || { state: 'IDLE' });
            this.call = next;
            if (next.runTimer) this.ensureCallTimer();
            else this.stopCallTimer();
            const island = $('phone-island');
            const active = next.state === 'ACTIVE';
            const ringing = next.state === 'INCOMING_RINGING' || next.state === 'OUTGOING_RINGING';
            island.classList.toggle('call-active', active);
            island.classList.toggle('call-live', active || ringing);
            const mute = $('phone-island-mute');
            if (mute) mute.hidden = !(active && next.myVoiceEnabled === false);
            if (active || ringing) {
                $('phone-island-name').textContent = this.peerLabel();
                if (active) this.paintDuration();
                else {
                    const timer = $('phone-island-time');
                    if (timer) timer.textContent = '';
                }
            } else {
                island.classList.remove('call-active', 'call-live');
            }
            if (next.state === 'INCOMING_RINGING' || next.state === 'OUTGOING_RINGING' || next.state === 'ACTIVE' || PS.terminalState(next.state)) this.renderCall(true);
            else this.renderCall(false);
            if (PS.terminalState(next.state)) {
                const id = next.callId;
                setTimeout(() => {
                    if (this.call.callId === id && PS.terminalState(this.call.state)) {
                        this.call = { state: 'IDLE' };
                        this.renderCall(false);
                        $('phone-island').classList.remove('call-active', 'call-live');
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

        setClock(payload) {
            const hours = Number(payload && payload.hours);
            const minutes = Number(payload && payload.minutes);
            if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
            this.gameClock = { hours: hours, minutes: minutes };
            this.updateClock();
        },

        clockLabel(value) {
            return PS.formatBubbleTime(value);
        },

        updateClock() {
            const clock = $('phone-clock');
            if (!clock || !this.gameClock) return;
            clock.textContent = String(this.gameClock.hours).padStart(2, '0') + ':' + String(this.gameClock.minutes).padStart(2, '0');
        },

        resetCharacter() {
            this.data = {};
            this.stack = ['home'];
            this.thread = null;
            this.apps = {};
            this.taxi = null;
            this.taxiDest = null;
            this.taxiEstimate = null;
            this._taxiQuery = '';
            this._msgQuery = '';
            this._contactQuery = '';
            this._mapQuery = '';
            this._mapGroup = 'all';
            this.propertyTab = 'owned';
            this.clanTab = 'overview';
            this._factionMember = null;
            this._marketSell = false;
            this._draftAttachment = null;
            this._galleryPick = false;
            this._feedPhotoPick = false;
            this._keepDraft = false;
            this._sharePick = false;
            this._cameraReturn = null;
            this._lastPhoto = null;
            const device = $('phone-device');
            if (device) device.classList.remove('is-camera');
            const hud = $('phone-camera-hud');
            if (hud) hud.hidden = true;
            this._compose = '';
            this._pendingBubble = null;
            this._editContact = null;
            this._adding = false;
            this.busy = {};
            this.garageFilter = 'all';
            this.marketFilter = 'all';
            this.factionTab = 'overview';
            this.phoneTab = 'keypad';
            this.dial = '';
            this.call = { state: 'IDLE' };
            this.stopCallTimer();
            const island = $('phone-island');
            if (island) island.classList.remove('call-active', 'call-live');
            this.renderCall(false);
            this.hide();
            this.gameClock = null;
            const toast = $('phone-toast');
            if (toast) toast.hidden = true;
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
            if (PS.callIsLive(this.call && this.call.state)) {
                if (this._callOpen && this.call.state === 'ACTIVE') this.renderCall(false);
                return;
            }
            if (this.current() === 'home') this.close();
            else this.goHome();
        },

        load(app) {
            this.token += 1;
            const token = this.token;
            const content = $('phone-content-' + app);
            if (content) {
                clear(content);
                content.classList.add('is-page');
                const page = el('div', 'phone-app-page');
                for (let i = 0; i < 3; i++) page.append(el('div', 'phone-skel'));
                content.append(page);
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
                feed: () => this.renderFeed(),
                'feed-post': () => this.renderFeedPost(),
                'feed-profile': () => this.renderFeedProfile(),
                settings: () => this.renderSettings(),
                camera: () => this.renderCamera(),
                gallery: () => this.renderGallery(),
            };
            if (map[id]) map[id]();
            const needs = { garage: 'garage', market: 'market', taxi: 'taxi', jobs: 'jobs', map: 'map', faction: 'faction', properties: 'properties', clan: 'clan', news: 'news' };
            if (needs[id] && !this.apps[needs[id]]) this.load(needs[id]);
            if (id === 'feed' && !this.apps.feed) this.load('feed');
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
                    if (this.call.state === 'ACTIVE') {
                        const voiceOn = this.call.myVoiceEnabled === true;
                        const voiceLabel = this.call.voiceAvailable === false
                            ? t('phone.ui.voice_unavailable')
                            : (voiceOn ? t('phone.ui.voice_on') : t('phone.ui.voice_off'));
                        actions.append(btn(voiceOn ? 'btn-green' : '', voiceLabel, () => {
                            if (this.call.voiceAvailable === false) return;
                            post('phoneAction', { op: 'voice', enabled: !this.call.myVoiceEnabled });
                        }));
                    }
                    actions.append(btn('btn-red call-end', t('phone.ui.hangup'), () => post('phoneAction', { op: 'hangup' })));
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
                row.preview = last.message || (last.attachment && last.attachment.type === 'location' ? t('phone.ui.location') : last.attachment ? t('phone.ui.photo') : '');
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
        labelFor(peer) {
            peer = peer || {};
            const id = Number(peer.characterId);
            if (id === 0 || peer.phone === '112') return t('phone.ui.dispatch');
            const contact = (this.data.contacts || []).find((c) => (id > 0 && Number(c.characterId) === id) || (peer.phone && c.phone === peer.phone));
            if (contact && contact.name) return contact.name;
            const rec = id > 0 ? this.peerRecord(id) : { name: '', phone: '' };
            if (rec.name) return rec.name;
            if (peer.displayName && peer.displayName !== peer.phone) return peer.displayName;
            return peer.phone || rec.phone || t('phone.ui.unknown');
        },

        openConversation(peer) {
            if (this._sharePick) { this._keepDraft = true; this._sharePick = false; }
            peer = peer || {};
            const characterId = Number(peer.characterId) || 0;
            const phone = PS.safeText(peer.phone || '');
            this.thread = {
                peer: characterId,
                phone: phone,
                name: this.labelFor({ characterId: characterId, phone: phone, displayName: peer.displayName }),
                messages: characterId > 0 ? PS.conversationMessages(this.data.messages, this.myId(), characterId) : [],
            };
            if (!this._keepDraft) this._draftAttachment = null;
            this._keepDraft = false;
            this._compose = '';
            this._pendingBubble = null;
            this._logNearBottom = true;
            this.openApp('conversation');
        },

        nameForPeer(peer, msg) {
            return this.labelFor({
                characterId: peer,
                phone: this.phoneForPeer(peer),
                displayName: msg && Number(msg.sender_character_id) === Number(peer) ? msg.sender_name : '',
            });
        },
        phoneForPeer(peer) {
            return this.peerRecord(peer).phone || '';
        },

        renderPhoneApp() {
            this.title('phone', 'phone.ui.phone', 'phone');
            const content = $('phone-content-phone');
            const page = this.beginPage(content);
            const tabs = el('div', 'pill-tabs');
            ['keypad', 'recents', 'contacts'].forEach((tab) => {
                tabs.append(btn('pill-tab' + (this.phoneTab === tab ? ' active' : ''), t('phone.ui.' + tab), () => { this.phoneTab = tab; this.renderPhoneApp(); }));
            });
            page.append(tabs);
            if (this.phoneTab === 'contacts') {
                const scroll = el('div', 'phone-app-scroll');
                page.append(scroll);
                this.renderContactsInto(scroll);
                return;
            }
            if (this.phoneTab === 'recents') {
                const scroll = el('div', 'phone-app-scroll');
                page.append(scroll);
                this.renderRecents(scroll);
                return;
            }
            const dialer = el('div', 'dialer');
            const number = el('div', 'dial-number');
            const shown = el('span');
            shown.append(text(this.dial || t('phone.ui.number')));
            const back = el('button', 'dial-back');
            back.type = 'button';
            back.append(text('×'));
            back.addEventListener('click', () => { this.dial = this.dial.slice(0, -1); this.renderPhoneApp(); });
            number.append(shown, back);
            const pad = el('div', 'pad');
            [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].forEach(([digit, letters]) => {
                const key = el('button');
                key.type = 'button';
                key.append(text(digit));
                if (letters) {
                    const meta = el('small');
                    meta.append(text(letters));
                    key.append(meta);
                }
                key.addEventListener('click', () => { this.dial = (this.dial + digit).slice(0, 16); this.renderPhoneApp(); });
                pad.append(key);
            });
            dialer.append(number, pad);
            const foot = el('div', 'phone-app-footer');
            foot.append(btn('btn-green', t('phone.ui.call'), () => this.startCall(this.dial)));
            page.append(dialer, foot);
        },

        renderRecents(content) {
            const rows = this.data.calls || [];
            const missed = rows.filter((call) => call.status === 'missed');
            const newest = missed.reduce((max, call) => Math.max(max, Number(call.id) || 0), 0);
            if (newest && newest !== this._callsSeen) {
                this._callsSeen = newest;
                this.data.missedCalls = 0;
                post('phoneAction', { op: 'markCallsSeen', callId: newest });
                this.renderHome();
            }
            if (!rows.length) { content.append(this.empty(t('phone.ui.empty'))); return; }
            rows.forEach((call) => {
                const item = el('div', 'list-item');
                const title = el('div', 'grow');
                const name = el('div', 'item-title');
                const contact = (this.data.contacts || []).find((c) => c.phone === call.peer_phone);
                name.append(text(contact ? contact.name : (call.peer_name || call.peer_phone || t('phone.ui.unknown'))));
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
            const page = this.beginPage(content);
            const search = field(t('phone.ui.search_messages'), this._msgQuery || '');
            const list = el('div', 'phone-app-scroll');
            search.input.addEventListener('input', () => { this._msgQuery = search.input.value; this.renderThreadList(list); });
            page.append(search.wrap, list);
            this.renderThreadList(list);
        },

        renderThreadList(content) {
            clear(content);
            const q = this.fold(this._msgQuery || '');
            const rows = this.threads().filter((row) => !q || this.fold(row.name).indexOf(q) !== -1 || this.fold(row.preview).indexOf(q) !== -1);
            if (!rows.length) {
                const box = el('div', 'phone-empty-state');
                box.append(text(t('phone.ui.empty_messages')));
                box.append(btn('btn-gold', t('phone.ui.new_message'), () => this.openApp('contacts')));
                content.append(box);
                return;
            }
            rows.forEach((row) => {
                const item = el('button', 'phone-list-row');
                item.type = 'button';
                const av = el('div', 'avatar');
                av.append(text(row.name.slice(0, 2).toUpperCase()));
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(row.name));
                const sub = el('div', 'item-subtitle');
                sub.append(text(row.preview || ''));
                body.append(title, sub);
                item.append(av, body);
                if (row.unread) {
                    const badge = el('div', 'app-badge');
                    badge.style.position = 'static';
                    badge.append(text(String(row.unread)));
                    item.append(badge);
                }
                item.addEventListener('click', () => this.openConversation({ characterId: row.peer, phone: row.phone, displayName: row.name }));
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
            const page = this.beginPage(content);
            if (!row) { page.append(this.empty(t('phone.ui.empty_messages'))); return; }
            post('phoneAction', { op: 'read', characterId: row.peer });
            (this.data.messages || []).forEach((msg) => {
                if (Number(msg.receiver_character_id) === this.myId() && Number(msg.sender_character_id) === Number(row.peer)) msg.read_at = msg.read_at || 'read';
            });
            const log = el('div', 'chat-log phone-app-scroll');
            const ordered = PS.conversationMessages(this.data.messages, this.myId(), row.peer);
            let lastDay = '';
            ordered.forEach((msg) => {
                const instant = PS.messageInstant(msg);
                const key = instant ? PS.dayKey(instant) : '';
                if (key && key !== lastDay) {
                    const sep = el('div', 'phone-day');
                    sep.append(text(PS.dateSeparator(instant, Date.now(), {
                        today: t('phone.ui.today'),
                        yesterday: t('phone.ui.yesterday'),
                        locale: document.documentElement.lang || 'en',
                    })));
                    log.append(sep);
                    lastDay = key;
                }
                const mine = Number(msg.sender_character_id) === this.myId();
                const bubble = el('div', 'bubble ' + (mine ? 'out' : 'in'));
                if (msg.message) bubble.append(text(msg.message));
                this.appendMessageAttachment(bubble, msg.attachment);
                const time = el('span', 'time');
                time.append(text(this.clockLabel(msg)));
                bubble.append(time);
                log.append(bubble);
            });
            if (this._pendingBubble && Number(this._pendingBubble.peer) === Number(row.peer)) {
                const pending = this._pendingBubble;
                const bubble = el('div', 'bubble out');
                if (pending.message) bubble.append(text(pending.message));
                this.appendMessageAttachment(bubble, pending.attachment);
                const time = el('span', 'time');
                if (pending.failed) {
                    const retry = btn('mini', t('phone.ui.retry'), () => {
                        pending.failed = false;
                        this.busy.send = true;
                        post('phoneSend', {
                            targetCharacterId: pending.targetCharacterId,
                            phone: pending.phone,
                            message: pending.message,
                            localId: pending.localId,
                            attachment: this.attachmentPayload(pending.attachment),
                        });
                        this.renderConversation();
                    });
                    time.append(text(t('phone.ui.not_sent') + ' '));
                    bubble.append(time, retry);
                } else {
                    time.append(text(t('phone.ui.send')));
                    bubble.append(time);
                }
                log.append(bubble);
            }
            const compose = el('div', 'chat-compose');
            const input = el('input');
            input.maxLength = 256;
            input.placeholder = t('phone.ui.type_message');
            input.value = this._compose || '';
            const counter = el('span', 'time');
            const paintCount = () => { counter.textContent = input.value.length + '/256'; };
            input.addEventListener('input', () => { this._compose = input.value; paintCount(); });
            input.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            });
            const sendBtn = btn('mini', t('phone.ui.send'), () => send());
            const send = () => {
                const message = input.value.trim();
                const draft = this._draftAttachment;
                if ((!message && !draft) || this.busy.send) return;
                const localId = 'p' + Date.now();
                const target = (row.phone === '112' || Number(row.peer) === 0) ? -112 : row.peer;
                this.busy.send = true;
                this._pendingBubble = {
                    localId: localId,
                    peer: row.peer,
                    targetCharacterId: target,
                    phone: row.phone === '112' || Number(row.peer) === 0 ? '112' : row.phone,
                    message: message,
                    attachment: draft,
                    failed: false,
                };
                this._draftAttachment = null;
                this._compose = '';
                this._logNearBottom = true;
                input.value = '';
                post('phoneSend', {
                    targetCharacterId: this._pendingBubble.targetCharacterId,
                    phone: this._pendingBubble.phone,
                    message: message,
                    localId: localId,
                    attachment: this.attachmentPayload(this._pendingBubble.attachment),
                });
                this.renderConversation();
            };
            paintCount();
            const plus = btn('mini', '+', () => this.openShareSheet(foot));
            compose.append(plus, input, counter, sendBtn);
            const foot = el('div', 'phone-app-footer');
            if (this._draftAttachment) foot.append(this.draftChip());
            foot.append(compose);
            page.append(log, foot);
            const stick = this._logNearBottom !== false;
            if (stick) log.scrollTop = log.scrollHeight;
            log.addEventListener('scroll', () => {
                this._logNearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 64;
            });
        },

        renderContacts() {
            this.title('contacts', 'phone.ui.contacts', 'faction');
            const slot = $('phone-slot-contacts');
            clear(slot);
            slot.append(btn('mini', t('phone.ui.add_contact'), () => { this._adding = !this._adding; this.renderContacts(); }));
            const content = $('phone-content-contacts');
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            page.append(scroll);
            this.renderContactsInto(scroll);
        },

        renderContactsInto(content) {
            if (this._editContact) {
                const editing = this._editContact;
                const name = field(t('phone.ui.name'), editing.name || '');
                name.input.maxLength = 48;
                content.append(name.wrap);
                content.append(btn('btn-gold', t('phone.ui.save'), () => {
                    const next = name.input.value.trim().slice(0, 48);
                    if (!next) return;
                    post('phoneAction', { op: 'editContact', contactId: editing.id, name: next });
                    this._editContact = null;
                }));
                content.append(btn('btn-ghost', t('phone.ui.cancel'), () => { this._editContact = null; this.renderContacts(); }));
            }
            if (this._adding) {
                const name = field(t('phone.ui.name'));
                const phone = field(t('phone.ui.number'));
                name.input.maxLength = 48;
                phone.input.maxLength = 16;
                content.append(name.wrap, phone.wrap, btn('btn-gold', t('phone.ui.save'), () => {
                    post('phoneAddContact', { name: name.input.value.trim(), phone: phone.input.value.trim() });
                    this._adding = false;
                }));
                content.append(btn('btn-ghost', t('phone.ui.cancel'), () => { this._adding = false; this.renderContacts(); }));
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
                actions.append(btn('mini', t('phone.ui.message'), () => this.openConversation({ characterId: c.characterId, phone: c.phone, displayName: c.name })));
                actions.append(btn('mini', t('phone.ui.edit'), () => { this._editContact = c; this._adding = false; this.renderContacts(); }));
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
            if (window.PhoneReasons) {
                return window.PhoneReasons.display(reason, {
                    has: (key) => !!(window.I18n && typeof window.I18n.has === 'function' && window.I18n.has(key)),
                    t,
                });
            }
            return PS.safeText(String(reason || ''));
        },

        renderBank() {
            this.title('bank', 'phone.ui.bank', 'bank');
            const content = $('phone-content-bank');
            const page = this.beginPage(content);
            const cash = Number(this.data.cash) || 0;
            const bank = Number(this.data.bank) || 0;
            const hero = el('div', 'phone-hero');
            const label = el('div', 'bb-label');
            label.append(text(t('phone.ui.bank_balance')));
            const amount = el('div', 'bb-amount');
            amount.append(text(money(bank)));
            const cashLine = el('div', 'muted');
            cashLine.append(text(t('phone.ui.cash') + ' ' + money(cash)));
            hero.append(label, amount, cashLine);
            const head = el('div', 'phone-section');
            head.append(text(t('phone.ui.transactions')));
            const scroll = el('div', 'phone-app-scroll');
            const txs = this.data.transactions || [];
            if (!txs.length) scroll.append(this.empty(t('phone.ui.no_transactions')));
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
                scroll.append(item);
            });
            const footer = el('div', 'phone-app-footer bank-footer');
            footer.append(btn('btn-bank', t('phone.ui.transfer'), () => this.openApp('transfer')));
            footer.append(btn('btn-gold', t('phone.ui.deposit'), () => {
                this.toast(t('phone.ui.deposit_hint'), 'good');
                post('phoneAction', { op: 'nearestAtm' });
            }));
            page.append(hero, head, scroll, footer);
        },

        renderTransfer() {
            this.title('transfer', 'phone.ui.transfer', 'bank');
            const content = $('phone-content-transfer');
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            const draft = this._transferDraft || {};
            const id = field(t('phone.ui.server_id'), draft.id || '');
            const amount = field(t('phone.ui.amount'), draft.amount || '');
            amount.input.inputMode = 'numeric';
            const keep = () => { this._transferDraft = { id: id.input.value, amount: amount.input.value }; };
            id.input.addEventListener('input', keep);
            amount.input.addEventListener('input', keep);
            scroll.append(id.wrap, amount.wrap);
            const chips = el('div', 'phone-chip-wrap');
            (this.data.contacts || []).filter((c) => c.serverId).forEach((c) => {
                chips.append(btn('phone-chip', (c.name || '') + ' #' + c.serverId, () => { id.input.value = String(c.serverId); keep(); }));
            });
            scroll.append(chips);
            const foot = el('div', 'phone-app-footer');
            const go = btn('btn-gold', t('phone.ui.confirm'), () => {
                const targetId = Number(id.input.value);
                const value = Math.floor(Number(amount.input.value));
                if (!targetId || !value || value < 1 || this.busy.transfer) return;
                this.busy.transfer = true;
                go.disabled = true;
                post('phoneBankTransfer', { targetId: targetId, amount: value });
            });
            foot.append(go);
            page.append(scroll, foot);
        },

        vehicleStatus(vehicle, impounded) {
            if (impounded) return 'impounded';
            if (Number(vehicle.destroyed) === 1) return 'destroyed';
            return Number(vehicle.stored) === 1 ? 'stored' : 'out';
        },

        renderGarage() {
            this.title('garage', 'phone.ui.garage', 'garage');
            const content = $('phone-content-garage');
            const data = this.apps.garage;
            if (!data) return;
            if (!this.gate(content, data, 'garage')) return;
            const page = this.beginPage(content);
            const impoundIds = {};
            (data.impound || []).forEach((row) => { impoundIds[Number(row.vehicleId)] = row; });
            const vehicles = (data.vehicles || []).map((vehicle) => Object.assign({}, vehicle, { _status: this.vehicleStatus(vehicle, impoundIds[Number(vehicle.id)]) }));
            const counts = { all: vehicles.length, stored: 0, out: 0, impounded: 0 };
            vehicles.forEach((v) => { if (counts[v._status] !== undefined) counts[v._status] += 1; });
            const tabs = el('div', 'pill-tabs');
            ['all', 'stored', 'out', 'impounded'].forEach((key) => {
                tabs.append(btn('pill-tab' + (this.garageFilter === key ? ' active' : ''), t('phone.ui.' + key) + ' ' + (counts[key] || 0), () => { this.garageFilter = key; this.renderGarage(); }));
            });
            const scroll = el('div', 'phone-app-scroll');
            page.append(tabs, scroll);
            const list = vehicles.filter((v) => this.garageFilter === 'all' || v._status === this.garageFilter);
            if (!list.length) {
                const box = el('div', 'phone-empty-state');
                box.append(text(t('phone.ui.no_vehicles')));
                const dealer = (data.pins || []).find((pin) => /dealership|premium/i.test(String(pin.label || '') + String(pin.id || '')));
                if (dealer) box.append(btn('btn-gold', t('phone.ui.gps_dealership'), () => post('phoneAction', { op: 'gps', x: dealer.x, y: dealer.y })));
                scroll.append(box);
            }
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
                scroll.append(card);
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
            const data = this.apps.market;
            if (!data) return;
            if (!this.gate(content, data, 'market')) return;
            const page = this.beginPage(content);
            const slot = $('phone-slot-market');
            clear(slot);
            slot.append(btn('mini', this._marketSell ? t('phone.ui.back_to_list') : t('phone.ui.sell'), () => { this._marketSell = !this._marketSell; this.renderMarket(); }));
            const tabs = el('div', 'pill-tabs');
            ['all', 'vehicles', 'items', 'properties', 'player_properties', 'businesses', 'ads'].forEach((key) => {
                tabs.append(btn('pill-tab' + (this.marketFilter === key ? ' active' : ''), t(key === 'all' ? 'phone.ui.all' : 'phone.ui.' + key), () => { this.marketFilter = key; this.renderMarket(); }));
            });
            const search = field(t('phone.ui.search'), this._marketQuery || '');
            search.input.dataset.focus = '1';
            const kindOf = (key) => (key === 'vehicles' ? 'vehicle' : key === 'items' ? 'item' : (key === 'properties' || key === 'player_properties') ? 'property' : 'all');
            search.input.addEventListener('input', () => {
                this._marketQuery = search.input.value;
                this._marketPage = 1;
                clearTimeout(this._marketTimer);
                this._marketTimer = setTimeout(() => {
                    post('phoneAction', { op: 'marketBrowse', q: this._marketQuery, page: 1, kind: kindOf(this.marketFilter), token: this.token });
                }, 250);
            });
            const scroll = el('div', 'phone-app-scroll');
            page.append(tabs, search.wrap, scroll);
            if (this._marketSell) {
                const options = data.options || {};
                const price = field(t('phone.ui.price'), this._listPrice || '');
                const qty = field(t('phone.ui.qty'), this._listQty || '1');
                price.input.addEventListener('input', () => { this._listPrice = price.input.value; });
                qty.input.addEventListener('input', () => { this._listQty = qty.input.value; });
                scroll.append(price.wrap, qty.wrap);
                (options.vehicles || []).forEach((vehicle) => {
                    scroll.append(btn('btn-ghost', (vehicle.label || vehicle.model) + ' · ' + (vehicle.plate || ''), () => {
                        post('phoneAction', { op: 'marketListVehicle', vehicleId: vehicle.id, price: price.input.value, token: this.token });
                    }));
                });
                (options.items || []).forEach((item) => {
                    scroll.append(btn('btn-ghost', (item.label || item.item) + ' ×' + item.count, () => {
                        post('phoneAction', { op: 'marketListItem', item: item.item, quantity: qty.input.value || 1, price: price.input.value, token: this.token });
                    }));
                });
                (options.properties || []).forEach((prop) => {
                    scroll.append(btn('btn-ghost', prop.label || ('#' + prop.id), () => {
                        post('phoneAction', { op: 'marketListProperty', propertyId: prop.id, price: price.input.value, token: this.token });
                    }));
                });
                const hint = el('div', 'muted');
                hint.append(text(t('phone.ui.ad_hint')));
                scroll.append(hint);
            }
            const q = (this._marketQuery || '').toLowerCase();
            const rows = this.marketItems().filter((row) => (this.marketFilter === 'all' || row.category === this.marketFilter) && (!q || String(row.title || '').toLowerCase().indexOf(q) !== -1));
            if (!rows.length) {
                const box = el('div', 'phone-empty-state');
                box.append(text(t('phone.ui.no_listings')));
                scroll.append(box);
            }
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
                if (row.plate) {
                    const plate = el('div', 'muted');
                    plate.append(text(String(row.plate)));
                    info.append(plate);
                }
                if (row.mileage != null) {
                    const km = el('div', 'muted');
                    km.append(text(`${window.I18n?.number?.(row.mileage) || row.mileage} km`));
                    info.append(km);
                }
                if (row.quantity > 1) {
                    const qty = el('div', 'muted');
                    qty.append(text(`×${row.quantity}`));
                    info.append(qty);
                }
                const model = String(row.model || '').toLowerCase();
                if (/^[a-z0-9_]+$/.test(model)) {
                    const img = document.createElement('img');
                    img.className = 'asset-preview__thumb';
                    img.alt = '';
                    img.src = 'assets/vehicles/' + encodeURIComponent(model) + '.webp';
                    img.addEventListener('error', () => img.remove());
                    card.append(img);
                }
                card.append(fallback, info);
                card.addEventListener('click', () => { this.detail = row; this.openApp('detail'); });
                scroll.append(card);
            });
            const marketPage = this._marketPage || 1;
            const pager = el('div', 'row-actions');
            pager.append(btn('btn-ghost', '←', () => {
                if (marketPage < 2) return;
                this._marketPage = marketPage - 1;
                post('phoneAction', { op: 'marketBrowse', q: this._marketQuery || '', page: this._marketPage, kind: kindOf(this.marketFilter), token: this.token });
            }));
            pager.append(btn('btn-ghost', '→', () => {
                this._marketPage = marketPage + 1;
                post('phoneAction', { op: 'marketBrowse', q: this._marketQuery || '', page: this._marketPage, kind: kindOf(this.marketFilter), token: this.token });
            }));
            scroll.append(pager);
            if (this._focusListing) {
                const match = rows.find((row) => Number(row.listingId || row.id) === Number(this._focusListing));
                this._focusListing = null;
                if (match) {
                    this.detail = match;
                    this.openApp('detail');
                }
            }
            const owned = data.myListings || [];
            if (owned.length) {
                const head = el('div', 'section-title');
                head.append(text(t('phone.ui.my_ads')));
                scroll.append(head);
                owned.forEach((listing) => {
                    const line = el('div', 'list-item');
                    const body = el('div', 'grow');
                    const title = el('div', 'item-title');
                    title.append(text((listing.listing_type || '') + ' · $' + (listing.asking_price || 0)));
                    const sub = el('div', 'item-subtitle');
                    sub.append(text(String(listing.status || '').toUpperCase()));
                    body.append(title, sub);
                    line.append(body);
                    if (listing.status === 'active') {
                        line.append(btn('btn-ghost', '×', () => post('phoneAction', { op: 'marketCancel', listingId: listing.id, token: this.token })));
                    }
                    scroll.append(line);
                });
            }
            if ((data.mine || []).length) {
                const head = el('div', 'section-title');
                head.append(text(t('phone.ui.my_ads')));
                scroll.append(head);
                data.mine.forEach((ad) => {
                    const line = el('div', 'list-item');
                    const body = el('div', 'grow');
                    const title = el('div', 'item-title');
                    title.append(text(ad.text || ''));
                    const sub = el('div', 'item-subtitle');
                    sub.append(text(t('phone.ui.' + (ad.status || 'pending'))));
                    body.append(title, sub);
                    line.append(body);
                    scroll.append(line);
                });
            }
            const cnn = (data.pins || []).find((pin) => String(pin.id).indexOf('cnn_') === 0);
            if (cnn) scroll.append(btn('btn-ghost', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: cnn.x, y: cnn.y })));
        },

        renderDetail() {
            this.title('detail', 'phone.ui.market_title', 'market');
            const content = $('phone-content-detail');
            const page = this.beginPage(content);
            const row = this.detail;
            if (!row) { page.append(this.empty(t('phone.ui.no_listings'))); return; }
            const scroll = el('div', 'phone-app-scroll');
            const title = el('div', 'item-title');
            title.append(text(row.title || ''));
            scroll.append(title);
            if (row.price != null) {
                const price = el('div', 'mc-price');
                price.append(text(money(row.price)));
                scroll.append(price);
            }
            if (row.seller) {
                const seller = el('div', 'muted');
                seller.append(text(row.seller + (row.phone ? ' · ' + row.phone : '')));
                scroll.append(seller);
            }
            const foot = el('div', 'phone-app-footer');
            const status = String(row.status || row.listingStatus || 'active');
            const dead = status === 'sold' || status === 'expired';
            if (row.x && row.y) foot.append(btn('btn-ghost', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: row.x, y: row.y })));
            if (!dead && row.listingId && row.kind === 'player' && Number(row.characterId) === Number(this.data.myCharacterId)) {
                foot.append(btn('btn-ghost', t('phone.ui.cancel_listing'), () => post('phoneAction', { op: 'marketCancel', listingId: row.listingId, token: this.token })));
            } else if (!dead && row.listingId && row.kind === 'player') {
                foot.append(btn('btn-gold', t('phone.ui.buy'), () => post('phoneAction', { op: 'marketBuy', listingId: row.listingId, token: this.token })));
            }
            if (row.phone) foot.append(btn('btn-ghost', t('phone.ui.message'), () => this.openConversation({
                characterId: row.characterId, phone: row.phone, displayName: row.seller,
            })));
            page.append(scroll, foot);
        },

        paintTaxiChips(wrap, data) {
            clear(wrap);
            const q = this.fold(this._taxiQuery || '');
            const catalog = data.destinations || [];
            const ranked = catalog.filter((d) => {
                if (!q) return d.popular === true;
                return this.fold(d.label).indexOf(q) !== -1;
            }).sort((a, b) => {
                const al = this.fold(a.label);
                const bl = this.fold(b.label);
                const as = al.indexOf(q) === 0 ? 0 : 1;
                const bs = bl.indexOf(q) === 0 ? 0 : 1;
                if (as !== bs) return as - bs;
                if (!!b.popular !== !!a.popular) return a.popular ? -1 : 1;
                return al < bl ? -1 : 1;
            }).slice(0, q ? 8 : 6);
            ranked.forEach((dest) => {
                const selected = this.taxiDest && this.taxiDest.id === dest.id;
                wrap.append(btn('phone-chip' + (selected ? ' active' : ''), dest.label, () => {
                    this.taxiDest = dest;
                    post('taxiEstimate', { destinationId: dest.id });
                    this.renderTaxi();
                }));
            });
        },

        renderTaxi() {
            this.title('taxi', 'phone.ui.taxi', 'taxi');
            const content = $('phone-content-taxi');
            const data = this.taxi || this.apps.taxi;
            if (!data) return;
            if (!this.gate(content, data, 'taxi')) return;
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            const foot = el('div', 'phone-app-footer');
            if (data.isDriver && data.onDuty) {
                scroll.append(btn('btn-ghost', t('phone.ui.available'), () => post('taxiSetAvailable', { available: data.driverAvailable === false })));
                const offers = data.pendingOffers || [];
                if (!offers.length && !(data.activeRide && data.activeRide.isDriver)) scroll.append(this.empty(t('phone.ui.no_offers')));
                offers.forEach((ride) => {
                    const card = el('div', 'panel');
                    const title = el('div', 'item-title');
                    title.append(text(ride.passengerName || t('phone.ui.passenger')));
                    const sub = el('div', 'muted');
                    const dest = ride.destination && ride.destination.label ? ride.destination.label : '';
                    sub.append(text((dest ? dest + ' · ' : '') + money(ride.fare || 0)));
                    card.append(title, sub, btn('btn-gold', t('phone.ui.accept_ride'), () => post('taxiAcceptRide', { rideId: ride.id })));
                    scroll.append(card);
                });
                const active = data.activeRide;
                if (active && active.isDriver) {
                    const card = el('div', 'panel');
                    card.append(text(this.rideLabel(active.status) + ' · ' + money(active.fare || active.meterFare || 0)));
                    if (active.destination && active.destination.label) {
                        const dest = el('div', 'muted');
                        dest.append(text(t('phone.ui.destination') + ' ' + active.destination.label));
                        card.append(dest);
                    }
                    if (active.status === 'accepted') card.append(btn('btn-gold', t('phone.ui.pickup'), () => post('taxiPickup', {})));
                    if (active.status === 'in_progress') card.append(btn('btn-gold', t('phone.ui.complete'), () => post('taxiComplete', {})));
                    card.append(btn('btn-ghost', t('phone.ui.cancel_ride'), () => post('taxiCancelRide', {})));
                    scroll.append(card);
                }
                page.append(scroll);
                return;
            }
            const active = data.activeRide;
            if (active && active.isPassenger) {
                const card = el('div', 'panel');
                const title = el('div', 'item-title');
                title.append(text(this.rideLabel(active.status)));
                const sub = el('div', 'muted');
                sub.append(text((active.driverName || t('phone.ui.driver')) + ' · ' + money(active.fare || 0)));
                card.append(title, sub);
                if (active.destination && active.destination.label) {
                    const dest = el('div', 'muted');
                    dest.append(text(t('phone.ui.destination') + ' ' + active.destination.label));
                    card.append(dest);
                }
                if (active.status !== 'completed') card.append(btn('btn-ghost', t('phone.ui.cancel_ride'), () => post('taxiCancelRide', {})));
                if (active.status === 'completed') {
                    (data.tipOptions || []).forEach((amount) => card.append(btn('mini', t('phone.ui.tip') + ' ' + money(amount), () => post('taxiTip', { amount: amount }))));
                }
                scroll.append(card);
                page.append(scroll);
                return;
            }
            const from = el('div', 'panel');
            const pickupTitle = el('div', 'item-title');
            pickupTitle.append(text(t('phone.ui.pickup')));
            const pickupSub = el('div', 'item-subtitle');
            pickupSub.append(text(data.pickupStreet || t('phone.ui.current_location')));
            from.append(pickupTitle, pickupSub);
            const search = field(t('phone.ui.where_to'), this._taxiQuery || '');
            const chips = el('div', 'phone-chip-wrap');
            search.input.addEventListener('input', () => {
                this._taxiQuery = search.input.value;
                this.paintTaxiChips(chips, data);
            });
            scroll.append(from, search.wrap, el('div', 'phone-section'));
            scroll.lastChild.append(text(t('phone.ui.popular_places')));
            scroll.append(chips, btn('btn-ghost', t('phone.ui.use_waypoint'), () => post('taxiUseWaypoint', {})));
            this.paintTaxiChips(chips, data);
            const fare = el('div', 'panel');
            const destName = el('div', 'item-title');
            destName.append(text(this.taxiDest ? (this.taxiDest.label || t('phone.ui.destination')) : t('phone.ui.destination')));
            const price = el('div', 'mc-price');
            price.append(text(this.taxiEstimate ? money(this.taxiEstimate.fare) : '—'));
            fare.append(destName, price);
            if (this.taxiEstimate && this.taxiEstimate.distanceKm != null) {
                const dist = el('div', 'muted');
                dist.append(text(t('phone.ui.distance') + ' ' + Number(this.taxiEstimate.distanceKm).toFixed(1) + ' km'));
                fare.append(dist);
            }
            const request = btn('btn-taxi', t('phone.ui.request_ride'), () => {
                if (!this.taxiDest || this.busy.taxi) return;
                this.busy.taxi = true;
                request.disabled = true;
                if (this.taxiDest.waypoint) {
                    post('taxiRequestRide', { destination: { x: this.taxiDest.x, y: this.taxiDest.y, z: this.taxiDest.z, label: this.taxiDest.label } });
                } else {
                    post('taxiRequestRide', { destinationId: this.taxiDest.id });
                }
            });
            request.disabled = !this.taxiDest;
            foot.append(fare, request);
            page.append(scroll, foot);
        },

        renderJobs() {
            this.title('jobs', 'phone.ui.jobs', 'jobs');
            const content = $('phone-content-jobs');
            const data = this.apps.jobs;
            if (!data) return;
            if (!this.gate(content, data, 'jobs')) return;
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            const current = data.currentJob;
            const head = el('div', 'phone-section');
            head.append(text(t('phone.ui.my_job')));
            scroll.append(head);
            const card = el('div', 'panel');
            const title = el('div', 'item-title');
            title.append(text(current ? (current.label || current.id) : t('phone.ui.no_job')));
            card.append(title);
            const rows = (data.jobs || []).slice().sort((a, b) => {
                const rank = (job) => (current && job.id === current.id ? 0 : (job.access && job.access.allowed === false ? 2 : 1));
                const diff = rank(a) - rank(b);
                if (diff) return diff;
                return String(a.label || '').localeCompare(String(b.label || ''));
            });
            if (current) {
                const prog = rows.find((row) => row.id === current.id) || {};
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
                const place = (data.workplaces || []).find((row) => row.id === current.id);
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
            scroll.append(card);
            const all = el('div', 'phone-section');
            all.append(text(t('phone.ui.all_jobs')));
            scroll.append(all);
            if (!rows.length) scroll.append(this.empty(t('phone.ui.browse_jobs')));
            rows.forEach((job) => {
                const item = el('div', 'list-item');
                const body = el('div', 'grow');
                const name = el('div', 'item-title');
                const state = current && job.id === current.id ? t('phone.ui.job_current') : (job.access && job.access.allowed === false ? t('phone.ui.job_locked') : t('phone.ui.job_available'));
                name.append(text((job.label || job.id) + ' · ' + state));
                const sub = el('div', 'item-subtitle');
                sub.append(text(job.description || ''));
                body.append(name, sub);
                if (job.access && job.access.allowed === false) {
                    (job.access.requirements || []).forEach((req) => {
                        const line = el('div', 'muted');
                        line.append(text(t('phone.ui.requirements') + ' · ' + this.reqLabel(req)));
                        body.append(line);
                    });
                } else if (job.level) {
                    const lvl = el('div', 'muted');
                    lvl.append(text(t('phone.ui.level') + ' ' + job.level));
                    body.append(lvl);
                }
                item.append(body);
                const place = (data.workplaces || []).find((row) => row.id === job.id);
                if (place && place.x) item.append(btn('mini', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: place.x, y: place.y })));
                scroll.append(item);
            });
            page.append(scroll);
        },

        renderMap() {
            this.title('map', 'phone.ui.map', 'map');
            const content = $('phone-content-map');
            const data = this.apps.map;
            if (!data) return;
            if (!this.gate(content, data, 'map')) return;
            const page = this.beginPage(content);
            const search = field(t('phone.ui.search'), this._mapQuery || '');
            const groups = ['all', 'services', 'jobs', 'vehicle', 'government', 'entertainment', 'other'];
            const tabs = el('div', 'pill-tabs');
            groups.forEach((cat) => {
                tabs.append(btn('pill-tab' + ((this._mapGroup || 'all') === cat ? ' active' : ''), cat === 'all' ? t('phone.ui.all') : t('phone.ui.map_' + cat), () => {
                    this._mapGroup = cat;
                    this.renderMap();
                }));
            });
            const scroll = el('div', 'phone-app-scroll');
            const paint = () => {
                clear(scroll);
                const q = this.fold(this._mapQuery || '');
                const group = this._mapGroup || 'all';
                (data.pins || []).filter((pin) => group === 'all' || pin.group === group).filter((pin) => {
                    if (!q) return true;
                    return this.fold((pin.label || '') + ' ' + (pin.category || '') + ' ' + (pin.area || '') + ' ' + (pin.group || '')).indexOf(q) !== -1;
                }).forEach((pin) => {
                    const item = el('div', 'phone-list-row');
                    const body = el('div', 'grow');
                    const title = el('div', 'item-title');
                    title.append(text(pin.label || ''));
                    const sub = el('div', 'item-subtitle');
                    sub.append(text(pin.area || pin.category || ''));
                    body.append(title, sub);
                    item.append(body, btn('mini', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: pin.x, y: pin.y })));
                    scroll.append(item);
                });
            };
            search.input.addEventListener('input', () => { this._mapQuery = search.input.value; paint(); });
            page.append(search.wrap, tabs, scroll);
            paint();
        },

        renderFaction() {
            this.title('faction', 'phone.ui.faction', 'faction');
            const content = $('phone-content-faction');
            const data = this.apps.faction;
            if (!data) return;
            if (!this.gate(content, data, 'faction')) return;
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            const panel = data.panel;
            if (!panel || !panel.isFaction) {
                const head = el('div', 'phone-section');
                head.append(text(t('phone.ui.factions')));
                const card = el('div', 'panel');
                card.append(text(t('phone.ui.no_faction')));
                const apply = panel && panel.apply;
                if (apply && apply.requirements && apply.requirements.length) {
                    const req = el('div', 'phone-section');
                    req.append(text(t('phone.ui.requirements')));
                    card.append(req);
                    apply.requirements.forEach((row) => {
                        const line = el('div', 'muted');
                        line.append(text(this.reqLabel(row)));
                        card.append(line);
                    });
                }
                scroll.append(head, card);
                page.append(scroll);
                return;
            }
            const dash = data.dashboard || {};
            const perms = dash.permissions || {};
            const canManage = !!(perms.invite || perms.rankMembers || perms.kickMembers || perms.warn || perms.manageResignations || perms.pardonFp || perms.renameRanks || perms.motd);
            const tabs = ['overview', 'members', 'announcements', 'vehicles'].concat(canManage ? ['management'] : []);
            if (this.factionTab === 'management' && !canManage) this.factionTab = 'overview';
            const nav = el('div', 'pill-tabs');
            tabs.forEach((tab) => {
                nav.append(btn('pill-tab' + (this.factionTab === tab ? ' active' : ''), t('phone.ui.' + tab), () => { this.factionTab = tab; this.renderFaction(); }));
            });
            page.append(nav, scroll);
            if (this.factionTab === 'members') return this.renderFactionMembers(scroll, dash);
            if (this.factionTab === 'announcements') return this.renderFactionNews(scroll, dash);
            if (this.factionTab === 'vehicles') return this.renderFactionVehicles(scroll, data.fleet);
            if (this.factionTab === 'management') return this.renderFactionManage(scroll, dash);
            const card = el('div', 'panel');
            const name = el('div', 'item-title');
            name.append(text((dash.label || panel.label || '')));
            const members = dash.members || [];
            const online = members.filter((m) => m.online).length;
            const meta = el('div', 'muted');
            meta.append(text((dash.gradeLabel || panel.gradeLabel || '') + ' · ' + (dash.onDuty || panel.onDuty ? t('phone.ui.on_duty_short') : t('phone.ui.off_duty_short')) + ' · ' + online + '/' + members.length));
            card.append(name, meta);
            const report = dash.report || {};
            if (report.target) {
                const line = el('div', 'muted');
                line.append(text(t('phone.ui.weekly_activity') + ' ' + (report.current || 0) + ' / ' + report.target));
                const bar = el('div', 'progress');
                const span = el('span');
                span.style.width = Math.max(0, Math.min(100, ((Number(report.current) || 0) / Number(report.target)) * 100)) + '%';
                bar.append(span);
                card.append(line, bar);
            }
            if (dash.myFp != null) {
                const fp = el('div', 'muted');
                fp.append(text(t('phone.ui.faction_points') + ' ' + dash.myFp));
                card.append(fp);
            }
            if (typeof dash.societyBalance === 'number') {
                const bal = el('div', 'muted');
                bal.append(text(t('phone.ui.society') + ' ' + money(dash.societyBalance)));
                card.append(bal);
            }
            const fleet = data.fleet;
            card.append(btn('btn-ghost', t('phone.ui.duty'), () => post('phoneAction', { op: 'duty', token: this.token })));
            if (fleet && fleet.x) card.append(btn('btn-gold', t('phone.ui.gps_hq'), () => post('phoneAction', { op: 'gps', x: fleet.x, y: fleet.y })));
            if (fleet && fleet.depotX) card.append(btn('btn-ghost', t('phone.ui.gps_depot'), () => post('phoneAction', { op: 'gps', x: fleet.depotX, y: fleet.depotY })));
            if (panel.job === 'taxi') card.append(btn('btn-ghost', t('phone.ui.taxi'), () => this.openApp('taxi')));
            scroll.append(card);
        },

        renderFactionMembers(content, dash) {
            const perms = dash.permissions || {};
            const selected = (dash.members || []).find((member) => Number(member.characterId) === Number(this._factionMember));
            if (selected) {
                const sheet = el('div', 'panel');
                const title = el('div', 'item-title');
                title.append(text(selected.name || ''));
                const sub = el('div', 'muted');
                sub.append(text((selected.gradeLabel || '') + ' · ' + (selected.online ? t('phone.ui.online') : t('phone.ui.offline'))));
                sheet.append(title, sub);
                if (selected.warns) {
                    const warns = el('div', 'muted');
                    warns.append(text(t('phone.ui.warnings') + ' ' + selected.warns));
                    sheet.append(warns);
                }
                if (selected.daysInFaction != null) {
                    const days = el('div', 'muted');
                    days.append(text(t('phone.ui.join_days') + ' ' + selected.daysInFaction));
                    sheet.append(days);
                }
                if (perms.promote || perms.rankMembers) {
                    sheet.append(btn('mini', '+', () => post('phoneAction', { op: 'factionRank', characterId: selected.characterId, delta: 1, token: this.token })));
                    sheet.append(btn('mini', '-', () => post('phoneAction', { op: 'factionRank', characterId: selected.characterId, delta: -1, token: this.token })));
                }
                if (perms.warn) {
                    const reason = field(t('phone.ui.warn'), this._warnDraft || '');
                    reason.input.addEventListener('input', () => { this._warnDraft = reason.input.value; });
                    sheet.append(reason.wrap, btn('mini', t('phone.ui.warn'), () => post('phoneAction', { op: 'factionWarn', characterId: selected.characterId, reason: reason.input.value, token: this.token })));
                }
                if (perms.pardonFp) sheet.append(btn('mini', t('phone.ui.pardon'), () => post('phoneAction', { op: 'factionPardon', characterId: selected.characterId, token: this.token })));
                if (perms.kickMembers || perms.uninvite) sheet.append(btn('mini danger', t('phone.ui.remove'), () => post('phoneAction', { op: 'factionKick', characterId: selected.characterId, token: this.token })));
                content.append(sheet);
            }
            (dash.members || []).forEach((member) => {
                const item = el('button', 'phone-list-row');
                item.type = 'button';
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(member.name || ''));
                const sub = el('div', 'item-subtitle');
                sub.append(text((member.gradeLabel || '') + ' · ' + (member.online ? t('phone.ui.online') : t('phone.ui.offline')) + (member.onDuty ? ' · ' + t('phone.ui.on_duty_short') : '')));
                body.append(title, sub);
                item.append(body);
                item.addEventListener('click', () => { this._factionMember = this._factionMember === member.characterId ? null : member.characterId; this.renderFaction(); });
                content.append(item);
            });
        },

        renderFactionManage(content, dash) {
            const perms = dash.permissions || {};
            if (perms.invite) {
                const input = field(t('phone.ui.invite_placeholder'));
                content.append(input.wrap, btn('btn-gold', t('phone.ui.invite'), () => post('phoneAction', { op: 'factionInvite', serverId: Number(input.input.value), token: this.token })));
            }
            if (perms.manageResignations) {
                const head = el('div', 'phone-section');
                head.append(text(t('phone.ui.resignations')));
                content.append(head);
                const rows = dash.pendingResignations || [];
                if (!rows.length) content.append(this.empty(t('phone.ui.empty')));
                rows.forEach((row) => {
                    const card = el('div', 'panel');
                    card.append(text((row.name || '') + (row.reason ? ' · ' + row.reason : '')));
                    card.append(btn('btn-gold', t('phone.ui.accept'), () => post('phoneAction', { op: 'factionResign', resignationId: row.id, action: 'accept', token: this.token })));
                    card.append(btn('btn-ghost', t('phone.ui.reject'), () => post('phoneAction', { op: 'factionResign', resignationId: row.id, action: 'decline', token: this.token })));
                    content.append(card);
                });
            }
            if (perms.renameRanks) {
                const head = el('div', 'phone-section');
                head.append(text(t('phone.ui.ranks')));
                content.append(head);
                (dash.grades || []).forEach((grade) => {
                    const line = el('div', 'list-item');
                    const body = el('div', 'grow');
                    body.append(text((grade.label || '') + ' · ' + grade.grade));
                    const input = field(grade.label || '', this._rankDraft && this._rankDraft.grade === grade.grade ? this._rankDraft.label : grade.label);
                    input.input.addEventListener('input', () => { this._rankDraft = { grade: grade.grade, label: input.input.value }; });
                    line.append(body, btn('mini', t('phone.ui.save'), () => post('phoneAction', { op: 'factionRenameRank', grade: grade.grade, label: input.input.value, token: this.token })));
                    content.append(line, input.wrap);
                });
            }
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
            if (fleet && fleet.depotX) content.append(btn('btn-gold', t('phone.ui.gps_depot'), () => post('phoneAction', { op: 'gps', x: fleet.depotX, y: fleet.depotY })));
            else if (fleet && fleet.x) content.append(btn('btn-gold', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: fleet.x, y: fleet.y })));
            (fleet && fleet.vehicles || []).forEach((vehicle) => {
                const item = el('div', 'phone-list-row');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(vehicle.label || vehicle.model || ''));
                const sub = el('div', 'item-subtitle');
                const lock = vehicle.available ? t('phone.ui.unlocked') : t('phone.ui.rank_locked');
                sub.append(text(lock + ' · ' + t('phone.ui.min_rank') + ' ' + (vehicle.minGrade || 0)));
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
            const data = this.apps.properties;
            if (!data) return;
            if (!this.gate(content, data, 'properties')) return;
            const page = this.beginPage(content);
            const owned = data.owned || {};
            const rented = data.rented || {};
            const tab = this.propertyTab === 'rented' ? 'rented' : 'owned';
            const nav = el('div', 'pill-tabs');
            [['owned', (owned.rows || []).length], ['rented', (rented.rows || []).length]].forEach(([key, count]) => {
                nav.append(btn('pill-tab' + (tab === key ? ' active' : ''), t('phone.ui.' + key) + ' ' + count, () => { this.propertyTab = key; this.renderProperties(); }));
            });
            const scroll = el('div', 'phone-app-scroll');
            const bucket = tab === 'rented' ? rented : owned;
            const rows = bucket.rows || [];
            if (!rows.length) {
                const box = el('div', 'phone-empty-state');
                box.append(text(t('phone.ui.no_properties')));
                box.append(btn('btn-gold', t('phone.ui.browse_market'), () => this.openApp('market')));
                scroll.append(box);
            }
            rows.forEach((row) => {
                const card = el('div', 'list-item');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(row.label || ''));
                const sub = el('div', 'muted');
                const entry = row.entry || {};
                sub.append(text((tab === 'owned' ? t('phone.ui.owned') : t('phone.ui.rented')) + ' · ' + (row.locked ? t('phone.ui.locked') : t('phone.ui.unlocked'))));
                body.append(title, sub);
                if (row.rentPrice) {
                    const rent = el('div', 'muted');
                    rent.append(text(t('phone.ui.rent') + ' ' + money(row.rentPrice)));
                    body.append(rent);
                }
                card.append(body);
                if (entry.x) card.append(btn('mini', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: entry.x, y: entry.y })));
                scroll.append(card);
            });
            const limit = tab === 'owned' ? 30 : 20;
            if (rows.length >= limit) {
                scroll.append(btn('btn-ghost', t('phone.ui.load_more'), () => post('phoneAction', { op: 'propertiesMore', filter: tab, page: (bucket.page || 1) + 1, token: this.token })));
            }
            page.append(nav, scroll);
        },

        renderClan() {
            this.title('clan', 'phone.ui.clan', 'clan');
            const content = $('phone-content-clan');
            const data = this.apps.clan;
            if (!data) return;
            if (!this.gate(content, data, 'clan')) return;
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            const dash = data.dashboard;
            if (!dash || dash.inClan === false || !dash.name) { scroll.append(this.empty(t('phone.ui.no_clan'))); page.append(scroll); return; }
            const perms = dash.permissions || {};
            const canManage = !!(perms.invite || perms.promote || perms.kick || perms.store);
            const tabs = ['overview', 'members'].concat(canManage ? ['management'] : []);
            if (this.clanTab === 'management' && !canManage) this.clanTab = 'overview';
            const nav = el('div', 'pill-tabs');
            tabs.forEach((tab) => nav.append(btn('pill-tab' + (this.clanTab === tab ? ' active' : ''), t(tab === 'overview' ? 'phone.ui.overview' : tab === 'members' ? 'phone.ui.members' : 'phone.ui.management'), () => { this.clanTab = tab; this.renderClan(); })));
            page.append(nav, scroll);
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
            if (this.clanTab !== 'members') scroll.append(card);
            if (perms.store && this.clanTab === 'overview') {
                scroll.append(btn('btn-gold', t('phone.ui.clan_store'), () => post('phoneAction', { op: 'openClanShop' })));
            }
            if (this.clanTab === 'management' && perms.invite) {
                const input = field(t('phone.ui.invite_placeholder'));
                scroll.append(input.wrap, btn('btn-gold', t('phone.ui.invite'), () => post('phoneAction', { op: 'clanInvite', serverId: Number(input.input.value), token: this.token })));
            }
            if (this.clanTab === 'overview') return;
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
                if (this.clanTab === 'management' && !self && member.characterId) {
                    if (perms.promote) {
                        item.append(btn('mini', '+', () => post('phoneAction', { op: 'clanRank', characterId: member.characterId, delta: 1, token: this.token })));
                        item.append(btn('mini', '-', () => post('phoneAction', { op: 'clanRank', characterId: member.characterId, delta: -1, token: this.token })));
                    }
                    if (perms.kick) {
                        item.append(btn('mini danger', t('phone.ui.remove'), () => post('phoneAction', { op: 'clanKick', characterId: member.characterId, token: this.token })));
                    }
                }
                scroll.append(item);
            });
        },

        renderNews() {
            this.title('news', 'phone.ui.news', 'news');
            const content = $('phone-content-news');
            const data = this.apps.news;
            if (!data) return;
            if (!this.gate(content, data, 'news')) return;
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            page.append(scroll);
            const updates = data.updates || [];
            if (!updates.length) { scroll.append(this.empty(t('phone.ui.news_empty'))); return; }

            if (!this._newsReactions) this._newsReactions = {};
            const reactions = this._newsReactions;
            const self = this;

            function mdToHtml(src) {
                if (!src) return '';
                return src
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
                    .replace(/^- (.+)$/gm, '• $1')
                    .replace(/\n\n/g, '<br><br>')
                    .replace(/\n/g, '<br>');
            }

            updates.forEach((item) => {
                const card = el('div', 'panel news-update-card');

                const meta = el('div', 'news-update-meta');
                const catEl = el('span', 'news-cat news-cat-' + (item.category || 'update').replace(/[^a-z0-9]/gi, '-').toLowerCase());
                catEl.append(text(item.category || 'update'));
                const dateEl = el('span', 'muted');
                if (item.created_at) {
                    try { dateEl.append(text(new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))); }
                    catch (_) { dateEl.append(text(item.created_at.slice(0, 10))); }
                }
                meta.append(catEl, dateEl);
                card.append(meta);

                const titleEl = el('div', 'news-update-title');
                titleEl.append(text(item.title || ''));
                card.append(titleEl);

                if (item.summary) {
                    const sumEl = el('div', 'news-update-summary');
                    sumEl.append(text(item.summary));
                    card.append(sumEl);
                }

                // Expandable full content
                const bodyEl = el('div', 'news-update-body hidden');
                bodyEl.innerHTML = mdToHtml(item.content || '');
                card.append(bodyEl);
                if (item.content && item.summary !== item.content) {
                    const readMoreBtn = btn('btn-ghost news-update-readmore', t('phone.ui.news_read_more'), () => {
                        const isHidden = bodyEl.classList.contains('hidden');
                        bodyEl.classList.toggle('hidden', !isHidden);
                        readMoreBtn.textContent = isHidden ? t('phone.ui.news_read_less') : t('phone.ui.news_read_more');
                    });
                    card.append(readMoreBtn);
                }

                // Reactions
                const rx = reactions[item.id] || {};
                const likesCount = rx.likesCount ?? item.likes_count ?? 0;
                const dislikesCount = rx.dislikesCount ?? item.dislikes_count ?? 0;
                const myRx = rx.myReaction !== undefined ? rx.myReaction : (item.my_reaction ?? null);

                const rxRow = el('div', 'news-update-rx');
                const likeBtn = btn('btn-ghost news-rx-btn' + (myRx === 'like' ? ' rx-active' : ''), '👍 ' + likesCount, () => {
                    post('phoneAction', { op: 'reactUpdate', updateId: item.id, reaction: 'like', token: self.token });
                });
                likeBtn.dataset.rxId = item.id;
                likeBtn.dataset.rxType = 'like';
                const dislikeBtn = btn('btn-ghost news-rx-btn' + (myRx === 'dislike' ? ' rx-active' : ''), '👎 ' + dislikesCount, () => {
                    post('phoneAction', { op: 'reactUpdate', updateId: item.id, reaction: 'dislike', token: self.token });
                });
                dislikeBtn.dataset.rxId = item.id;
                dislikeBtn.dataset.rxType = 'dislike';

                rxRow.append(likeBtn, dislikeBtn);
                card.append(rxRow);

                const authorEl = el('div', 'muted news-update-author');
                authorEl.append(text('— ' + (item.author_name || '')));
                card.append(authorEl);

                scroll.append(card);
            });
        },

        // ===================== SOCIAL FEED =====================

        _feedRelTime(raw) {
            if (!raw) return '';
            try {
                const d = new Date(raw);
                const diff = Math.floor((Date.now() - d.getTime()) / 1000);
                if (diff < 60) return diff + 's';
                if (diff < 3600) return Math.floor(diff / 60) + 'm';
                if (diff < 86400) return Math.floor(diff / 3600) + 'h';
                if (diff < 604800) return Math.floor(diff / 86400) + 'd';
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            } catch (_) { return ''; }
        },

        _buildFeedCard(feedPost, clickable) {
            const self = this;
            if (!this._feedLikes) this._feedLikes = {};
            const postId = String(feedPost.id);
            const likeState = this._feedLikes[postId] || { likesCount: Number(feedPost.likes_count) || 0, likedByViewer: !!Number(feedPost.liked_by_viewer) };
            this._feedLikes[postId] = likeState;

            const card = el('div', 'feed-card');
            card.dataset.feedPostId = postId;

            // Header
            const header = el('div', 'feed-card-header');
            const avatar = el('div', 'feed-avatar');
            const initials = ((feedPost.firstname || '?')[0] + (feedPost.lastname || '?')[0]).toUpperCase();
            avatar.append(text(initials));
            const authorWrap = el('div', 'feed-author-wrap');
            const authorName = el('div', 'feed-author-name');
            authorName.append(text((feedPost.firstname || '') + ' ' + (feedPost.lastname || '')));
            authorName.addEventListener('click', () => {
                feedPost.character_id && self.openFeedProfile(feedPost.character_id);
            });
            const ts = el('span', 'feed-ts');
            ts.append(text(this._feedRelTime(feedPost.created_at)));
            if (feedPost.updated_at && feedPost.updated_at !== feedPost.created_at) {
                const edited = el('span', 'feed-edited');
                edited.append(text(' · ' + t('phone.ui.feed_edited')));
                ts.append(edited);
            }
            authorWrap.append(authorName, ts);
            header.append(avatar, authorWrap);

            // Own post: delete
            if (Number(feedPost.character_id) === Number(this.data && this.data.myCharId)) {
                const del = btn('feed-del-btn', '×', () => {
                    post('phoneAction', { op: 'feedDeletePost', postId: feedPost.id, token: self.token });
                });
                header.append(del);
            }
            card.append(header);

            // Body text
            if (feedPost.body) {
                const body = el('div', 'feed-body');
                body.append(text(feedPost.body));
                card.append(body);
            }

            // Photo
            if (feedPost.media_url) {
                const img = document.createElement('img');
                img.src = feedPost.media_url;
                img.className = 'feed-photo';
                img.loading = 'lazy';
                img.addEventListener('click', () => {
                    if (window.Phone && Phone.openMediaViewer) Phone.openMediaViewer(feedPost.media_url);
                });
                card.append(img);
            }

            // Actions row
            const actions = el('div', 'feed-actions');

            const likeBtn = el('button', 'feed-action-btn' + (likeState.likedByViewer ? ' feed-liked' : ''));
            likeBtn.dataset.feedLike = postId;
            const heartSvg = el('span', 'feed-heart');
            heartSvg.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
            const likeCount = el('span', 'feed-like-count');
            likeCount.append(text(String(likeState.likesCount)));
            likeBtn.append(heartSvg, likeCount);
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isLiked = likeBtn.classList.contains('feed-liked');
                post('phoneAction', { op: isLiked ? 'feedUnlike' : 'feedLike', postId: feedPost.id, token: self.token });
                likeBtn.classList.toggle('feed-liked', !isLiked);
                const cur = parseInt(likeCount.textContent) || 0;
                likeCount.textContent = String(isLiked ? Math.max(0, cur - 1) : cur + 1);
            });

            const cmBtn = el('button', 'feed-action-btn');
            const cmSvg = el('span');
            cmSvg.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
            const cmCount = el('span', 'feed-like-count');
            cmCount.dataset.feedCmcount = postId;
            cmCount.append(text(String(Number(feedPost.comments_count) || 0)));
            cmBtn.append(cmSvg, cmCount);
            cmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                self.openFeedPost(feedPost.id);
            });

            actions.append(likeBtn, cmBtn);
            card.append(actions);

            if (clickable) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => self.openFeedPost(feedPost.id));
            }

            return card;
        },

        openFeedPost(postId) {
            delete this.apps['feed-post'];
            this.openApp('feed-post');
            post('phoneAction', { op: 'feedGetPost', postId: postId, token: this.token });
        },

        openFeedProfile(characterId) {
            delete this.apps['feed-profile'];
            this.openApp('feed-profile');
            post('phoneAction', { op: 'feedGetProfile', characterId: characterId, token: this.token });
        },

        _appendFeedComment(comment) {
            const list = document.getElementById('feed-comment-list');
            if (!list) return;
            const item = this._buildCommentItem(comment);
            list.append(item);
        },

        _buildCommentItem(comment) {
            const wrap = el('div', 'feed-comment' + (comment.parent_comment_id ? ' feed-comment-reply' : ''));
            const initials = ((comment.firstname || '?')[0] + (comment.lastname || '?')[0]).toUpperCase();
            const av = el('div', 'feed-cm-avatar');
            av.append(text(initials));
            const body = el('div', 'feed-cm-body');
            const name = el('span', 'feed-cm-name');
            name.append(text((comment.firstname || '') + ' ' + (comment.lastname || '')));
            const ts = el('span', 'feed-ts');
            ts.append(text(' · ' + this._feedRelTime(comment.created_at)));
            const txt = el('div', 'feed-cm-text');
            txt.append(text(comment.body || ''));
            body.append(name, ts, txt);
            wrap.append(av, body);
            return wrap;
        },

        renderFeed() {
            const self = this;
            this.title('feed', 'phone.ui.feed', 'feed');
            const content = $('phone-content-feed');
            if (!content) return;
            clear(content);

            const data = this.apps.feed;

            // Tabs
            if (!this._feedTab) this._feedTab = 'contacts';
            const nav = el('div', 'pill-tabs');
            ['contacts', 'global'].forEach((tab) => {
                nav.append(btn('pill-tab' + (this._feedTab === tab ? ' active' : ''), t('phone.ui.feed_' + tab), () => {
                    self._feedTab = tab;
                    if (!self.apps.feed || !self.apps.feed[tab]) self.load('feed');
                    else self.renderFeed();
                }));
            });

            // Compose button
            const composeRow = el('div', 'feed-compose-row');
            const composeTrigger = btn('feed-compose-btn', t('phone.ui.feed_whats_happening'), () => self._openFeedComposer());
            composeRow.append(composeTrigger);

            const page = this.beginPage(content);
            page.append(nav, composeRow);

            if (!data) {
                const loader = el('div', 'phone-loader');
                loader.append(text(t('phone.ui.loading')));
                page.append(loader);
                this.load('feed');
                return;
            }

            const tabData = data[this._feedTab] || {};
            const posts = tabData.posts || [];

            if (data.error) {
                const err = el('div', 'phone-empty-state');
                err.append(text(t('phone.ui.feed_error')));
                err.append(btn('btn-gold', t('phone.ui.retry'), () => { delete self.apps.feed; self.renderFeed(); }));
                page.append(err);
                return;
            }

            const scroll = el('div', 'phone-app-scroll feed-scroll');

            if (!posts.length) {
                const empty = this.empty(
                    this._feedTab === 'contacts'
                        ? t('phone.ui.feed_empty_contacts')
                        : t('phone.ui.feed_empty_global')
                );
                if (this._feedTab === 'contacts') {
                    empty.append(btn('btn-ghost', t('phone.ui.open_contacts'), () => self.openApp('contacts')));
                }
                scroll.append(empty);
            } else {
                posts.forEach((p) => scroll.append(this._buildFeedCard(p, true)));
                if (tabData.nextCursor) {
                    scroll.append(btn('btn-ghost', t('phone.ui.load_more'), () => {
                        post('phoneAction', { op: 'feedLoadMore', tab: self._feedTab, beforeId: tabData.nextCursor, token: self.token });
                    }));
                }
            }

            // Poll every 12 seconds while feed is open
            if (this._feedPollTimer) clearTimeout(this._feedPollTimer);
            this._feedPollTimer = setTimeout(function poll() {
                if (self.current() !== 'feed') return;
                self.load('feed');
                self._feedPollTimer = setTimeout(poll, 12000);
            }, 12000);

            page.append(scroll);
        },

        renderFeedPost() {
            const self = this;
            this.title('feed-post', 'phone.ui.feed', 'feed');
            const content = $('phone-content-feed-post');
            if (!content) return;
            clear(content);

            const data = this.apps['feed-post'];

            if (!data || !data.post) {
                const loader = el('div', 'phone-loader');
                loader.append(text(t('phone.ui.loading')));
                content.append(loader);
                return;
            }

            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');

            // Post card
            scroll.append(this._buildFeedCard(data.post, false));

            // Comment list
            const cmSection = el('div', 'feed-comments-section');
            const cmHead = el('div', 'feed-comments-head');
            cmHead.append(text(t('phone.ui.feed_comments')));
            cmSection.append(cmHead);

            const cmList = el('div', 'feed-comment-list');
            cmList.id = 'feed-comment-list';
            const comments = data.comments || [];
            if (!comments.length) {
                const none = el('div', 'muted feed-no-comments');
                none.append(text(t('phone.ui.feed_no_comments')));
                cmList.append(none);
            } else {
                comments.forEach((c) => cmList.append(this._buildCommentItem(c)));
            }
            cmSection.append(cmList);

            // Composer
            const cmComposer = el('div', 'feed-cm-composer');
            const cmInput = el('textarea', 'feed-cm-input');
            cmInput.placeholder = t('phone.ui.feed_add_comment');
            cmInput.maxLength = 400;
            const cmSend = btn('btn-gold feed-cm-send', t('phone.ui.feed_send'), () => {
                const body = cmInput.value.trim();
                if (!body) return;
                cmInput.value = '';
                post('phoneAction', { op: 'feedComment', postId: data.post.id, body: body, token: self.token });
            });
            cmComposer.append(cmInput, cmSend);
            cmSection.append(cmComposer);

            scroll.append(cmSection);
            page.append(scroll);
        },

        renderFeedProfile() {
            const self = this;
            this.title('feed-profile', 'phone.ui.feed', 'feed');
            const content = $('phone-content-feed-profile');
            if (!content) return;
            clear(content);

            const data = this.apps['feed-profile'];

            if (!data || !data.profile) {
                const loader = el('div', 'phone-loader');
                loader.append(text(t('phone.ui.loading')));
                content.append(loader);
                return;
            }

            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');

            const profileCard = el('div', 'feed-profile-card');
            const av = el('div', 'feed-profile-avatar');
            const initials = ((data.profile.name || '?? ').split(' ').map((w) => w[0] || '').join('')).toUpperCase().slice(0, 2);
            av.append(text(initials));
            const info = el('div', 'feed-profile-info');
            const name = el('div', 'feed-profile-name');
            name.append(text(data.profile.name || ''));
            const posts = el('div', 'feed-profile-sub');
            posts.append(text(String(data.profile.postCount || 0) + ' ' + t('phone.ui.feed_posts')));
            info.append(name, posts);
            profileCard.append(av, info);
            scroll.append(profileCard);

            (data.posts || []).forEach((p) => scroll.append(this._buildFeedCard(p, true)));

            page.append(scroll);
        },

        _openFeedComposer() {
            const self = this;
            const content = $('phone-content-feed');
            if (!content) return;

            const overlay = el('div', 'feed-composer-overlay');
            const box = el('div', 'feed-composer-box');

            const head = el('div', 'feed-composer-head');
            const title = el('span', 'feed-composer-title');
            title.append(text(t('phone.ui.feed_create_post')));
            const close = btn('feed-composer-close', '×', () => overlay.remove());
            head.append(title, close);

            const textarea = el('textarea', 'feed-composer-text');
            textarea.placeholder = t('phone.ui.feed_whats_happening');
            textarea.maxLength = 500;

            // Photo picker
            let selectedMediaId = null;
            const photoRow = el('div', 'feed-composer-photo-row');
            const addPhotoBtn = btn('btn-ghost', t('phone.ui.feed_add_photo'), () => {
                // Open gallery in picker mode
                self._galleryPick = false;
                self._feedPhotoPick = true;
                self.openApp('gallery');
                overlay.remove();
            });
            photoRow.append(addPhotoBtn);

            const photoPreview = el('div', 'feed-composer-preview');
            photoPreview.id = 'feed-composer-preview';

            const postBtn = btn('btn-gold', t('phone.ui.feed_post'), () => {
                const body = textarea.value.trim();
                const mediaId = self._pendingFeedMediaId || null;
                if (!body && !mediaId) return;
                overlay.remove();
                self._pendingFeedMediaId = null;
                post('phoneAction', { op: 'feedCreatePost', body: body, mediaId: mediaId, token: self.token });
            });

            box.append(head, textarea, photoRow, photoPreview, postBtn);
            overlay.append(box);
            content.append(overlay);
            textarea.focus();
        },

        renderSettings() {
            this.title('settings', 'phone.ui.settings', 'settings');
            const content = $('phone-content-settings');
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            page.append(scroll);
            const accountHead = el('div', 'item-title');
            accountHead.append(text(t('phone.ui.account')));
            const card = el('div', 'panel');
            card.append(accountHead);
            [['phone.ui.name', this.data.myName], ['phone.ui.my_number', this.data.myPhoneNumber], ['phone.ui.server_id', this.data.myId]].forEach(([key, value]) => {
                const line = el('div', 'list-item');
                const body = el('div', 'grow');
                const title = el('div', 'item-title');
                title.append(text(t(key)));
                const sub = el('div', 'item-subtitle');
                sub.append(text(value == null ? '' : String(value)));
                body.append(title, sub);
                line.append(body);
                card.append(line);
            });
            scroll.append(card);
            const level = Number(this.data.level) || 1;
            const respect = Number(this.data.respect) || 0;
            const needRp = Number(this.data.levelCostRp) || (level * 4);
            const needMoney = Number(this.data.levelCostMoney) || (level * 1000);
            const purse = Math.max(Number(this.data.bank) || 0, Number(this.data.cash) || 0);
            const canBuy = respect >= needRp && purse >= needMoney && !this.busy.level;
            const progHead = el('div', 'item-title');
            progHead.append(text(t('phone.ui.progression')));
            const prog = el('div', 'panel');
            prog.append(progHead);
            prog.append(text(t('phone.ui.level') + ' ' + level + ' · ' + respect + ' RP'));
            const next = el('div', 'muted');
            next.append(text(t('phone.ui.next_level') + ' ' + (level + 1)));
            const rpLine = el('div', 'muted');
            rpLine.append(text('RP ' + respect + ' / ' + needRp));
            const moneyLine = el('div', 'muted');
            moneyLine.append(text(money(purse) + ' / ' + money(needMoney)));
            prog.append(next, rpLine, moneyLine);
            const buy = btn('btn-gold', t('phone.ui.buy_level', { level: level + 1 }), () => {
                if (!canBuy) return;
                this.busy.level = true;
                buy.disabled = true;
                post('phoneAction', { op: 'buyLevel' });
                this.renderSettings();
            });
            buy.disabled = !canBuy;
            prog.append(buy);
            scroll.append(prog);
            const phoneHead = el('div', 'item-title');
            phoneHead.append(text(t('phone.ui.phone')));
            const toggles = el('div', 'panel');
            toggles.append(phoneHead);
            const prefs = this.data.prefs || { ringtone: true, notifySound: true, voiceCalls: true };
            [['ringtone', 'phone.ui.ringtone', true], ['notifySound', 'phone.ui.notify_sound', true], ['voiceCalls', 'phone.ui.voice_calls', true]].forEach(([key, label, defaultOn]) => {
                const current = prefs[key] == null ? defaultOn : !!prefs[key];
                const row = btn('phone-switch' + (current ? ' on' : ''), t(label), () => {
                    if (this.busy.settings) return;
                    this._settingsSnapshot = Object.assign({}, prefs);
                    prefs[key] = !current;
                    this.data.prefs = prefs;
                    this.busy.settings = true;
                    post('phoneAction', {
                        op: 'settings',
                        ringtone: prefs.ringtone !== false,
                        notifySound: prefs.notifySound !== false,
                        voiceCalls: prefs.voiceCalls !== false,
                    });
                    this.renderSettings();
                });
                const knob = el('i');
                row.append(knob);
                toggles.append(row);
            });
            scroll.append(toggles);
        },

        safeMediaUrl(url) {
            const value = String(url || '');
            if (/^https:\/\/racket\.cat\/media\//.test(value) || /^https:\/\/racket\.cat\/api\/media\//.test(value)) return value;
            return '';
        },

        attachmentPayload(draft) {
            if (!draft) return null;
            if (draft.type === 'photo') return { type: 'photo', mediaId: draft.mediaId || draft.id };
            if (draft.type === 'location') return { type: 'location', mode: draft.mode || 'current' };
            return null;
        },

        appendMessageAttachment(bubble, attachment) {
            if (!attachment) return;
            if (attachment.type === 'photo') {
                const url = this.safeMediaUrl(attachment.thumbnailUrl || attachment.url);
                if (!url) return;
                const button = el('button', 'msg-photo');
                button.type = 'button';
                const image = document.createElement('img');
                image.alt = '';
                image.src = url;
                button.append(image);
                button.addEventListener('click', () => this.openPhotoViewer(attachment));
                bubble.append(button);
            } else if (attachment.type === 'location') {
                const card = el('div', 'msg-location');
                const title = el('div', 'item-title');
                title.append(text(attachment.label || t('phone.ui.location')));
                const sub = el('div', 'muted');
                sub.append(text(attachment.area || ''));
                card.append(title, sub, btn('mini', t('phone.ui.set_gps'), () => post('phoneAction', { op: 'gps', x: attachment.x, y: attachment.y })));
                bubble.append(card);
            }
        },

        draftChip() {
            const draft = this._draftAttachment;
            const row = el('div', 'composer-attach');
            if (draft && draft.type === 'photo') {
                const url = this.safeMediaUrl(draft.thumbnailUrl || draft.url);
                if (url) {
                    const image = document.createElement('img');
                    image.alt = '';
                    image.src = url;
                    row.append(image);
                }
                row.append(text(t('phone.ui.photo')));
            } else if (draft && draft.type === 'location') {
                row.append(text(t('phone.ui.location')));
            }
            row.append(btn('mini', '×', () => { this._draftAttachment = null; this.renderConversation(); }));
            return row;
        },

        openShareSheet(foot) {
            document.getElementById('phone-share-sheet')?.remove();
            const sheet = el('div', 'phone-share-sheet');
            sheet.id = 'phone-share-sheet';
            sheet.append(btn('btn-ghost', t('phone.ui.camera'), () => {
                sheet.remove();
                this._cameraReturn = 'conversation';
                post('phoneAction', { op: 'cameraStart', returnTo: 'conversation' });
            }));
            sheet.append(btn('btn-ghost', t('phone.ui.photo'), () => {
                sheet.remove();
                this._galleryPick = true;
                this._keepDraft = true;
                this.openApp('gallery');
            }));
            sheet.append(btn('btn-ghost', t('phone.ui.current_location'), () => {
                sheet.remove();
                this._draftAttachment = { type: 'location', mode: 'current' };
                this.renderConversation();
            }));
            sheet.append(btn('btn-ghost', t('phone.ui.map_waypoint'), () => {
                sheet.remove();
                this._draftAttachment = { type: 'location', mode: 'waypoint' };
                this.renderConversation();
            }));
            sheet.append(btn('btn-ghost', t('phone.ui.cancel'), () => sheet.remove()));
            foot.append(sheet);
        },

        openPhotoViewer(photo) {
            document.getElementById('phone-photo-viewer')?.remove();
            const url = this.safeMediaUrl(photo && (photo.url || photo.thumbnailUrl));
            if (!url) return;
            const layer = el('div', 'phone-share-sheet');
            layer.id = 'phone-photo-viewer';
            const image = document.createElement('img');
            image.alt = '';
            image.src = this.safeMediaUrl(photo.url) || url;
            image.style.width = '100%';
            image.style.borderRadius = '10px';
            layer.append(image);
            if (photo.createdAt) {
                const when = el('div', 'muted');
                when.append(text(String(photo.createdAt)));
                layer.append(when);
            }
            layer.append(btn('btn-ghost', t('phone.ui.save_to_gallery'), () => post('phoneAction', { op: 'gallerySave', mediaId: photo.id || photo.mediaId })));
            layer.append(btn('btn-ghost', t('phone.ui.share'), () => {
                layer.remove();
                this._draftAttachment = { type: 'photo', mediaId: photo.id || photo.mediaId, url: photo.url, thumbnailUrl: photo.thumbnailUrl };
                this._sharePick = true;
                this.openApp('contacts');
            }));
            layer.append(btn('btn-ghost', t('phone.ui.delete'), () => {
                post('phoneAction', { op: 'galleryDelete', mediaId: photo.id || photo.mediaId, token: this.token });
                layer.remove();
            }));
            layer.append(btn('btn-gold', t('phone.ui.close'), () => layer.remove()));
            ($('phone-device')?.querySelector('.phone-hardware') || $('phone-device'))?.append(layer);
        },

        renderCamera() {
            this.title('camera', 'phone.ui.camera', 'camera');
            const content = $('phone-content-camera');
            const page = this.beginPage(content);
            page.append(btn('btn-gold', t('phone.ui.take_photo'), () => {
                this._cameraReturn = null;
                post('phoneAction', { op: 'cameraStart' });
            }));
        },

        renderGallery() {
            this.title('gallery', 'phone.ui.gallery', 'gallery');
            const content = $('phone-content-gallery');
            const data = this.apps.gallery;
            if (!data) {
                this.token += 1;
                const page = this.beginPage(content);
                for (let i = 0; i < 3; i++) page.append(el('div', 'phone-skel'));
                post('phoneAction', { op: 'gallery', token: this.token });
                return;
            }
            if (data.error) {
                const page = this.beginPage(content);
                const box = el('div', 'phone-empty-state');
                box.append(text(data.error));
                box.append(btn('btn-gold', t('phone.ui.retry'), () => { delete this.apps.gallery; this.renderGallery(); }));
                page.append(box);
                return;
            }
            const page = this.beginPage(content);
            const scroll = el('div', 'phone-app-scroll');
            const photos = data.photos || [];
            if (!photos.length) scroll.append(this.empty(t('phone.ui.gallery_empty')));
            const grid = el('div', 'phone-photo-grid');
            photos.forEach((photo) => {
                const url = this.safeMediaUrl(photo.thumbnailUrl || photo.url);
                if (!url) return;
                const cell = el('button');
                cell.type = 'button';
                const image = document.createElement('img');
                image.alt = '';
                image.src = url;
                cell.append(image);
                cell.addEventListener('click', () => {
                    if (this._galleryPick) {
                        this._galleryPick = false;
                        this._draftAttachment = { type: 'photo', mediaId: photo.id, url: photo.url, thumbnailUrl: photo.thumbnailUrl };
                        this._keepDraft = true;
                        if (this.thread) this.showView('conversation', false);
                        else this.back();
                        return;
                    }
                    if (this._feedPhotoPick) {
                        this._feedPhotoPick = false;
                        this._pendingFeedMediaId = photo.id || photo.mediaId;
                        this.back();
                        // Re-open composer with photo pre-selected
                        setTimeout(() => {
                            this._openFeedComposer();
                            const preview = document.getElementById('feed-composer-preview');
                            if (preview && photo.url) {
                                preview.innerHTML = '';
                                const img = document.createElement('img');
                                img.src = photo.url;
                                img.className = 'feed-composer-preview-img';
                                preview.append(img);
                            }
                        }, 100);
                        return;
                    }
                    this.openPhotoViewer(photo);
                });
                grid.append(cell);
            });
            scroll.append(grid);
            if (data.nextCursor) {
                scroll.append(btn('btn-ghost', t('phone.ui.load_more'), () => {
                    post('phoneAction', { op: 'gallery', cursor: data.nextCursor, token: this.token });
                }));
            }
            page.append(scroll);
        },

        bindCameraHud() {
            if (this._cameraHud) return;
            this._cameraHud = true;
            const stage = $('phone-camera-stage');
            const shutter = $('phone-camera-shutter');
            const flip = $('phone-camera-flip');
            const close = $('phone-camera-close');
            const roll = $('phone-camera-roll');
            if (stage) {
                stage.addEventListener('mousemove', (event) => {
                    if (!$('phone-device')?.classList.contains('is-camera')) return;
                    if (!this._lookOrigin) this._lookOrigin = { x: event.clientX, y: event.clientY };
                    const dx = event.clientX - this._lookOrigin.x;
                    const dy = event.clientY - this._lookOrigin.y;
                    this._lookOrigin = { x: event.clientX, y: event.clientY };
                    if (!dx && !dy) return;
                    post('phoneAction', { op: 'cameraLook', dx: dx, dy: dy });
                });
                stage.addEventListener('wheel', (event) => {
                    if (!$('phone-device')?.classList.contains('is-camera')) return;
                    event.preventDefault();
                    post('phoneAction', { op: 'cameraZoom', delta: event.deltaY > 0 ? 0.08 : -0.08 });
                }, { passive: false });
            }
            shutter?.addEventListener('click', () => post('phoneAction', { op: 'cameraShutter' }));
            flip?.addEventListener('click', () => post('phoneAction', { op: 'cameraFlip' }));
            close?.addEventListener('click', () => post('phoneAction', { op: 'cameraClose' }));
            roll?.addEventListener('click', () => {
                post('phoneAction', { op: 'cameraClose' });
                this.openApp('gallery');
            });
        },

        setCamera(payload) {
            const device = $('phone-device');
            const hud = $('phone-camera-hud');
            if (!device || !hud) return;
            if (!payload || payload.open === false) {
                device.classList.remove('is-camera');
                hud.hidden = true;
                hud.classList.remove('is-capturing');
                return;
            }
            device.classList.add('is-open');
            device.classList.add('is-camera');
            hud.hidden = false;
            hud.classList.toggle('is-capturing', payload.chrome === false);
            const flip = $('phone-camera-flip');
            const close = $('phone-camera-close');
            if (flip) flip.textContent = payload.mode === 'selfie' ? t('phone.ui.rear_camera') : t('phone.ui.front_camera');
            if (close) close.textContent = '×';
            const roll = $('phone-camera-roll');
            if (roll && this._lastPhoto) {
                const url = this.safeMediaUrl(this._lastPhoto.thumbnailUrl || this._lastPhoto.url);
                roll.style.backgroundImage = url ? 'url("' + url + '")' : '';
                roll.style.backgroundSize = 'cover';
            }
        },

        onCameraResult(payload) {
            const media = payload && payload.media;
            if (!media || !media.id) return;
            this._lastPhoto = media;
            if (payload.returnTo === 'conversation') {
                this._draftAttachment = { type: 'photo', mediaId: media.id, url: media.url, thumbnailUrl: media.thumbnailUrl };
                this._keepDraft = true;
                if (this.thread) this.showView('conversation', false);
            }
            delete this.apps.gallery;
        },

        empty(message) {
            const node = el('div', 'empty');
            node.append(text(message));
            return node;
        },

        fold(value) {
            return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        },

        reqLabel(req) {
            if (!req) return '';
            if (req.type === 'level') return t('phone.ui.req_level', { level: req.required || 0 });
            if (req.type === 'license') {
                const key = 'phone.ui.req_license_' + (req.license || '');
                if (window.I18n && typeof I18n.has === 'function' && I18n.has(key)) return t(key);
                return t('phone.ui.req_license');
            }
            if (req.type === 'quest') return t('phone.ui.req_quest');
            if (req.type === 'clan') return t('phone.ui.req_clan');
            return '';
        },

        beginPage(content) {
            clear(content);
            content.classList.add('is-page');
            const page = el('div', 'phone-app-page');
            content.append(page);
            return page;
        },

        gate(content, data, appId) {
            if (!data) {
                this.beginPage(content);
                const page = content.firstChild;
                for (let i = 0; i < 3; i++) page.append(el('div', 'phone-skel'));
                return null;
            }
            if (data.error) {
                const page = this.beginPage(content);
                const box = el('div', 'phone-empty-state');
                const msg = el('div');
                msg.append(text(String(data.error)));
                box.append(msg, btn('btn-gold', t('phone.ui.retry'), () => this.load(appId)));
                page.append(box);
                return null;
            }
            return data;
        },

        rideLabel(status) {
            const key = {
                pending: 'phone.ui.ride_pending',
                accepted: 'phone.ui.ride_accepted',
                in_progress: 'phone.ui.ride_in_progress',
                completed: 'phone.ui.ride_completed',
            }[status];
            return key ? t(key) : PS.safeText(status || '');
        },
    };

    window.Phone = Phone;
}());
