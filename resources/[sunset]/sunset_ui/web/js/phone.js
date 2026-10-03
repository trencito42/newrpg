const Phone = {
    data: null,
    taxiData: null,
    taxiEstimate: null,
    screen: 'home',
    chatTarget: null,

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[char]));
    },

    // [SEC2] Avatars are player-supplied: only ever allow a strict base64 image data URL
    // in <img src> (prevents attribute breakout / script injection into other players' NUI).
    safeAvatarSrc(value) {
        const v = String(value ?? '');
        return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : '';
    },

    init() {
        if (this._ready) return;
        this._ready = true;

        this.setupHomeBar();
        this.setupKeys();

        $$('[data-phone-app]').forEach((btn) => {
            btn.addEventListener('click', () => this.openApp(btn.dataset.phoneApp));
        });
        $('#phone-back-messages')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.goHome();
        });
        $('#phone-back-contacts')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.goHome();
        });
        $('#phone-back-chat')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('messages');
        });
        $('#phone-bank-transfer-open')?.addEventListener('click', () => this.openBankTransfer());
        $('#phone-bank-transfer-close')?.addEventListener('click', () => this.closeBankTransfer());
        $('#phone-bank-transfer-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitBankTransfer();
        });
        $('#phone-back-settings')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.goHome();
        });
        $('#phone-back-taxi')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.goHome();
        });
        $('#phone-chat-send')?.addEventListener('click', () => this.sendMessage());
        $('#phone-chat-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        $('#phone-chat-input')?.addEventListener('input', (e) => {
            const val = (e.target.value || '').trim();
            const sendBtn = $('#phone-chat-send');
            if (sendBtn) sendBtn.classList.toggle('has-text', val.length > 0);
        });
        $('#phone-chat-call-btn')?.addEventListener('click', () => {
            const is112 = this.chatTarget?.isEmergency || this.chatTarget?.charId === -112 || String(this.chatTarget?.charId) === '-112' || this.chatTarget?.phone === '112';
            if (is112) {
                this.trigger112Emergency();
            } else if (this.chatTarget?.phone) {
                notify(I18n.t('phone.calling', { contact: this.chatTarget.name || this.chatTarget.phone }), 'info');
            }
        });

        // Messages UI event handlers
        $('#phone-btn-new-msg')?.addEventListener('click', () => {
            this.showView('contacts');
        });
        $('#phone-thread-search')?.addEventListener('input', () => {
            this.renderThreads();
        });

        // Contacts UI event handlers
        $('#phone-btn-add-contact')?.addEventListener('click', () => {
            $('#phone-add-contact-modal')?.classList.remove('hidden');
            const nameInput = $('#phone-new-name');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }
            if ($('#phone-new-phone')) $('#phone-new-phone').value = '';
            if ($('#phone-new-avatar-preview')) $('#phone-new-avatar-preview').textContent = '+';
        });
        $('#phone-contact-cancel')?.addEventListener('click', () => {
            this._pendingContactAdd = false;
            $('#phone-add-contact-modal')?.classList.add('hidden');
        });
        $('#phone-contact-save')?.addEventListener('click', () => {
            this.submitNewContact();
        });
        $('#phone-new-name')?.addEventListener('input', (e) => {
            const val = (e.target.value || '').trim();
            const prev = $('#phone-new-avatar-preview');
            if (prev) prev.textContent = val ? val.charAt(0).toUpperCase() : '+';
        });
        $('#phone-new-phone')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitNewContact();
        });
        $('#phone-contact-search')?.addEventListener('input', () => {
            this.renderContacts();
        });
        $('#phone-my-card')?.addEventListener('click', () => {
            notify(I18n.t('ui.phone.your_number', { number: this.data?.myPhoneNumber || '555-0000' }), 'info');
        });
    },

    setupKeys() {
        if (this._keysBound) return;
        this._keysBound = true;
        window.addEventListener('keydown', (e) => {
            const device = $('#phone-device');
            if (!device?.classList.contains('is-open')) return;
            const tag = (e.target && e.target.tagName) || '';
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

            if (e.key === 'p' || e.key === 'P') {
                if (!typing) {
                    e.preventDefault();
                    e.stopPropagation();
                    post('phoneClose', {});
                    return;
                }
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.goHomeOrClose();
            }
        });
    },

    setupHomeBar() {
        const zone = $('#phone-home-zone');
        const bar = $('#phone-home-indicator');
        if (!zone || zone._bound) return;
        zone._bound = true;

        let startY = 0;
        let dragging = false;
        let moved = false;

        const finish = (endY) => {
            const delta = startY - endY;
            zone.classList.remove('is-dragging');
            if (bar) bar.style.transform = '';
            dragging = false;

            if (delta > 30) {
                post('phoneClose', {});
            } else if (!moved) {
                this.goHomeOrClose();
            }
            moved = false;
        };

        zone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            zone.setPointerCapture(e.pointerId);
            startY = e.clientY;
            dragging = true;
            moved = false;
            zone.classList.add('is-dragging');
        });

        zone.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const delta = startY - e.clientY;
            if (Math.abs(delta) > 4) moved = true;
            if (delta > 0 && bar) {
                bar.style.transform = `translateY(-${Math.min(delta * 0.45, 36)}px)`;
            }
        });

        zone.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            zone.releasePointerCapture(e.pointerId);
            finish(e.clientY);
        });

        zone.addEventListener('pointercancel', (e) => {
            if (!dragging) return;
            finish(e.clientY);
        });
    },

    formatMoney(n) {
        return '$' + (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    updateClock() {
        const now = new Date();
        const el = $('#phone-time');
        if (el) el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.updateHomeDate(now);
    },

    updateHomeDate(now = new Date()) {
        const el = $('#phone-home-date');
        if (!el) return;
        el.textContent = I18n.date(now, { weekday: 'long', month: 'long', day: 'numeric' });
    },

    formatMsgTime(raw) {
        if (!raw) return '';
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return '';
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        if (sameDay) {
            return I18n.time(d, { hour: 'numeric', minute: '2-digit' });
        }
        return I18n.date(d, { month: 'short', day: 'numeric' });
    },

    show(payload) {
        this.init();
        this.data = payload || {};
        this.chatTarget = null;
        this.screen = 'home';
        this.updateClock();
        if (!this._clockTimer) {
            this._clockTimer = setInterval(() => this.updateClock(), 30000);
        }
        this.renderHome();
        this.renderThreads();
        this.renderContacts();
        this.renderBank();
        this.renderSettings();
        this.showView('home');
        const device = $('#phone-device');
        device?.classList.remove('hidden');
        requestAnimationFrame(() => device?.classList.add('is-open'));
    },

    hide() {
        if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
        const device = $('#phone-device');
        device?.classList.remove('is-open');
        setTimeout(() => device?.classList.add('hidden'), 400);
        this.chatTarget = null;
        // [NUI PERF] stop the clock tick while the phone is hidden
        if (this._clockTimer) {
            clearInterval(this._clockTimer);
            this._clockTimer = null;
        }
    },

    update(payload) {
        this.data = { ...(this.data || {}), ...(payload || {}) };
        this.renderThreads();
        this.renderContacts();
        this.renderBank();
        if (this._pendingContactAdd) {
            this.finishContactAdd();
        }
        if (this.chatTarget) {
            this.chatTarget.online = this.isContactOnline(this.chatTarget.charId);
            const sub = $('#phone-chat-subtitle');
            const phone = this.chatTarget.phone;
            if (sub) {
                if (this.chatTarget.isEmergency) {
                    sub.textContent = I18n.t('dynamic.phone.imessage_dispatch_112');
                } else if (phone) {
                    sub.textContent = `${phone} · ${this.chatTarget.online ? 'iMessage' : I18n.t('ui.factions.offline')}`;
                } else {
                    sub.textContent = this.chatTarget.online ? 'iMessage' : I18n.t('ui.factions.offline');
                }
            }
            this.renderChat(this.chatTarget);
        }
    },

    addMessage(msg) {
        if (!this.data || !msg) return;
        this.data.messages = this.data.messages || [];
        const exists = this.data.messages.some((m) => m.id === msg.id);
        if (!exists) {
            this.data.messages.unshift(msg);
        }
        if (msg.sender_avatar && msg.sender_character_id) {
            this.data.avatarsByChar = this.data.avatarsByChar || {};
            this.data.avatarsByChar[msg.sender_character_id] = msg.sender_avatar;
        }
        this.renderThreads();
        if (this.chatTarget) {
            const isRelevant = Number(this.chatTarget.charId) === Number(msg.sender_character_id) || Number(this.chatTarget.charId) === Number(msg.receiver_character_id);
            if (isRelevant) {
                this.renderChat(this.chatTarget);
            }
        }
    },

    goHome() {
        this.chatTarget = null;
        this.showView('home');
    },

    goHomeOrClose() {
        if (this.screen === 'home') {
            post('phoneClose', {});
        } else {
            this.goHome();
        }
    },

    close() {
        if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
        post('phoneClose', {});
    },

    trigger112Emergency() {
        if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
        // Lua closes the phone before opening 112. A second close races the
        // new modal and can steal its cursor after it is already visible.
        post('phoneTrigger112', {});
    },

    openApp(app) {
        if (app === 'emergency112') {
            this.trigger112Emergency();
            return;
        }
        if (app === 'taxi') {
            this.showView('taxi');
            this.taxiData = this.taxiData || null;
            this.renderTaxi();
            post('taxiRefresh', {});
            return;
        }
        this.showView(app);
    },

    showView(name) {
        if (this.screen === 'taxi' && name !== 'taxi') {
            if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
        }
        this.screen = name;
        $$('.phone-view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === name));
        const wp = $('#phone-wallpaper');
        if (wp) wp.classList.toggle('phone-wallpaper--app', name !== 'home');
        const island = $('.phone-dynamic-island');
        if (island) island.style.width = name === 'home' ? '108px' : '96px';
    },

    renderHome() {
        // wallpaper + dock already in HTML
    },

    getIosAvatarGradient(name) {
        const palettes = [
            ['#0a84ff', '#007aff'],
            ['#5e5ce6', '#4845d2'],
            ['#bf5af2', '#9933cc'],
            ['#ff375f', '#d70035'],
            ['#ff9f0a', '#ea580c'],
            ['#30d158', '#16a34a'],
            ['#64d2ff', '#0284c7'],
            ['#8e8e93', '#636366'],
        ];
        let hash = 0;
        const str = String(name || '');
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const idx = Math.abs(hash) % palettes.length;
        return `linear-gradient(135deg, ${palettes[idx][0]} 0%, ${palettes[idx][1]} 100%)`;
    },

    // [AVATAR] Returns avatar HTML: real image if available, gradient+initial fallback
    avatarHtml(name, charId, isEmergency) {
        const initial = (name || '?').charAt(0).toUpperCase();
        const avatars = this.data?.avatarsByChar || {};
        const avatar = charId ? avatars[charId] : null;
        if (isEmergency) {
            return `<div class="phone-thread__avatar phone-thread__avatar--emergency" style="background: linear-gradient(135deg, #ff3b30 0%, #d70015 100%);">🚨</div>`;
        }
        if (avatar) {
            return `<div class="phone-thread__avatar"><img src="${this.safeAvatarSrc(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`;
        }
        return `<div class="phone-thread__avatar" style="background: ${this.getIosAvatarGradient(name)};">${this.escapeHtml(initial)}</div>`;
    },

    buildThreads() {
        const d = this.data || {};
        const myId = d.myCharacterId;
        const threads = new Map();

        (d.messages || []).forEach((m) => {
            const isMine = m.sender_character_id === myId;
            const otherCharId = isMine ? m.receiver_character_id : m.sender_character_id;
            const is112 = otherCharId === 0 || otherCharId === -112 || String(otherCharId) === '-112';
            let otherName = isMine ? (m.receiver_name || I18n.t('common.player')) : (m.sender_name || I18n.t('common.player'));
            if (is112) otherName = I18n.t('ui.phone.emergency_112');

            const key = String(otherCharId);
            const existing = threads.get(key) || {
                charId: otherCharId,
                name: otherName,
                isEmergency: is112,
                preview: '',
                messages: [],
                online: is112,
            };
            if (!existing.preview) existing.preview = m.message;
            existing.messages.push(m);
            threads.set(key, existing);
        });

        (d.contacts || []).forEach((c) => {
            const key = String(c.characterId);
            if (!key || key === 'undefined') return;
            if (!threads.has(key)) {
                threads.set(key, {
                    charId: c.characterId,
                    name: this.contactLabel(c),
                    isEmergency: false,
                    preview: I18n.t('ui.phone.no_messages_yet'),
                    messages: [],
                    online: c.online === true,
                });
            } else {
                const t = threads.get(key);
                t.online = c.online === true;
                t.name = this.contactLabel(c) || t.name;
            }
        });

        return Array.from(threads.values()).sort((a, b) => {
            const ta = a.messages[0]?.id || 0;
            const tb = b.messages[0]?.id || 0;
            return tb - ta;
        });
    },

    isContactOnline(charId) {
        const id = Number(charId);
        if (!id || id <= 0) return false;
        const contact = (this.data?.contacts || []).find((c) => Number(c.characterId) === id);
        return contact ? contact.online === true : false;
    },

    contactLabel(contact) {
        const name = String(contact?.name || '').trim();
        if (name) return name;
        if (contact?.phone) return String(contact.phone);
        return I18n.t('ui.mdc.unknown');
    },

    renderThreads() {
        const list = $('#phone-thread-list');
        if (!list) return;
        list.innerHTML = '';
        let threads = this.buildThreads();

        const query = ($('#phone-thread-search')?.value || '').trim().toLowerCase();
        if (query) {
            threads = threads.filter((t) =>
                (t.name || '').toLowerCase().includes(query) ||
                (t.preview || '').toLowerCase().includes(query)
            );
        }

        if (!threads.length) {
            list.innerHTML = `
                <div class="phone-empty-state">
                    <div class="phone-empty-state__icon">💬</div>
                    <div class="phone-empty-state__title">${I18n.t('ui.phone.no_messages')}</div>
                    <p class="phone-empty-state__desc">
                        ${query ? I18n.t('ui.phone.no_conversations_match') : I18n.t('ui.phone.start_chat_hint')}
                    </p>
                </div>
            `;
            return;
        }

        threads.forEach((t) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `phone-thread ${t.isEmergency ? 'phone-thread--emergency' : ''}`;
            const lastMsg = t.messages[0];
            const timeStr = lastMsg ? this.formatMsgTime(lastMsg.created_at) : '';

            btn.innerHTML = `
                ${this.avatarHtml(t.name, t.charId, t.isEmergency)}
                <div class="phone-thread__body">
                    <div class="phone-thread__row">
                        <span class="phone-thread__name">
                            ${this.escapeHtml(t.name)}
                            ${t.isEmergency ? '<span class="phone-contact-badge phone-contact-badge--emergency">SOS</span>' : ''}
                        </span>
                        ${timeStr ? `<span class="phone-thread__time">${this.escapeHtml(timeStr)}</span>` : ''}
                    </div>
                    <div class="phone-thread__preview">${this.escapeHtml(t.preview || '')}</div>
                </div>
                <span class="phone-thread__chevron">›</span>`;
            btn.addEventListener('click', () => this.openChat({
                name: t.name,
                charId: t.charId,
                isEmergency: t.isEmergency,
                online: t.isEmergency ? true : this.isContactOnline(t.charId),
            }));
            list.appendChild(btn);
        });
    },

    renderContacts() {
        const list = $('#phone-contact-list');
        if (!list) return;

        // Update My Card with current player's profile and phone number
        const myCardName = $('#phone-my-card-name');
        const myCardPhone = $('#phone-my-card-phone');
        const myCardAvatar = $('#phone-my-card-avatar');
        if (myCardName) myCardName.textContent = this.data?.myName || 'My Card';
        if (myCardPhone) myCardPhone.textContent = this.data?.myPhoneNumber || '555-0000';
        if (myCardAvatar) {
            const myAvatar = this.data?.myAvatar || null;
            if (myAvatar) {
                myCardAvatar.innerHTML = `<img src="${this.safeAvatarSrc(myAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                myCardAvatar.style.background = 'transparent';
            } else {
                myCardAvatar.textContent = (this.data?.myName || '?').charAt(0).toUpperCase();
            }
        }

        list.innerHTML = '';
        const rawContacts = this.data?.contacts || [];
        const query = ($('#phone-contact-search')?.value || '').trim().toLowerCase();

        // 112 Emergency contact matches search or shows by default
        const emergencyMatches = !query ||
            '112'.includes(query) ||
            'urgente'.includes(query) ||
            'urgente'.includes(query) ||
            'politie'.includes(query) ||
            'politie'.includes(query) ||
            'medic'.includes(query) ||
            'medici'.includes(query) ||
            'salvare'.includes(query) ||
            'sos'.includes(query) ||
            'emergency'.includes(query) ||
            'pompieri'.includes(query) ||
            'dispecerat'.includes(query);

        let contacts = rawContacts.slice();
        if (query) {
            contacts = contacts.filter((c) =>
                (c.name || '').toLowerCase().includes(query) ||
                (c.phone || '').toLowerCase().includes(query)
            );
        }

        contacts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (!emergencyMatches && !contacts.length) {
            list.innerHTML = `
                <div class="phone-empty-state">
                    <div class="phone-empty-state__icon">👥</div>
                    <div class="phone-empty-state__title">${I18n.t('common.no_results')}</div>
                    <p class="phone-empty-state__desc">${I18n.t('ui.phone.no_contacts_match', { query: this.escapeHtml(query) })}</p>
                </div>
            `;
            return;
        }

        // Render 112 Emergency Services as a normal contact at the top of the contacts list
        if (emergencyMatches) {
            const emRow = document.createElement('div');
            emRow.className = 'phone-contact-row phone-contact-row--emergency';
            emRow.innerHTML = `
                <button type="button" class="phone-contact-row__main" title="${I18n.t('ui.phone.call_112_emergency')}">
                    <div class="phone-contact-row__avatar phone-contact-row__avatar--emergency">
                        <svg viewBox="0 0 24 24" fill="white" class="phone-contact-row__sos-icon"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                        <span class="phone-contact-row__status-dot is-online"></span>
                    </div>
                    <div class="phone-contact-row__details">
                        <div class="phone-contact-row__name">
                            ${I18n.t('ui.phone.emergency_112')}
                            <span class="phone-contact-badge phone-contact-badge--emergency">SOS</span>
                        </div>
                        <div class="phone-contact-row__meta">
                            <span class="phone-contact-num">112</span>
                            <span>·</span>
                            <span class="phone-contact-desc">${I18n.t('ui.phone.emergency_services')}</span>
                        </div>
                    </div>
                </button>
                <div class="phone-contact-row__actions">
                    <button type="button" class="phone-contact-act-btn phone-contact-act-btn--call" title="${I18n.t('ui.phone.call_112_dispatch')}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-2.2 2.2a15.053 15.053 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 3.9c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-.99-1.02z"/></svg>
                    </button>
                    <button type="button" class="phone-contact-act-btn phone-contact-act-btn--chat" title="${I18n.t('ui.phone.message_112')}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </button>
                </div>
            `;

            emRow.querySelector('.phone-contact-row__main').addEventListener('click', () => {
                this.trigger112Emergency();
            });
            emRow.querySelector('.phone-contact-act-btn--call').addEventListener('click', (e) => {
                e.stopPropagation();
                this.trigger112Emergency();
            });
            emRow.querySelector('.phone-contact-act-btn--chat').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openChat({
                    name: '112 Emergency',
                    charId: -112,
                    phone: '112',
                    isEmergency: true,
                    online: true,
                });
            });

            list.appendChild(emRow);
        }

        // Render regular contacts
        contacts.forEach((c) => {
            const row = document.createElement('div');
            row.className = 'phone-contact-row';
            const label = this.contactLabel(c);
            const isOnline = c.online === true;
            const phoneText = String(c.phone || '').trim();
            // [AVATAR] Use real headshot if available, gradient fallback otherwise
            const avatarImg = c.avatar || (this.data?.avatarsByChar || {})[c.characterId] || null;
            const avatarContent = avatarImg
                ? `<img src="${this.safeAvatarSrc(avatarImg)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : this.escapeHtml(label.charAt(0).toUpperCase());
            const avatarStyle = avatarImg ? '' : ` style="background: ${this.getIosAvatarGradient(label)};"`;

            row.innerHTML = `
                <button type="button" class="phone-contact-row__main">
                    <div class="phone-contact-row__avatar ${isOnline ? 'is-online' : ''}"${avatarStyle}>
                        ${avatarContent}
                        <span class="phone-contact-row__status-dot ${isOnline ? 'is-online' : ''}"></span>
                    </div>
                    <div class="phone-contact-row__details">
                        <div class="phone-contact-row__name">${this.escapeHtml(label)}</div>
                        <div class="phone-contact-row__meta">
                            ${phoneText ? `<span class="phone-contact-num">${this.escapeHtml(phoneText)}</span>` : ''}
                            <span class="${isOnline ? 'phone-contact-row__online-badge' : 'phone-contact-row__offline-badge'}">
                                ${isOnline ? '● Online' : '○ Offline'}
                            </span>
                        </div>
                    </div>
                </button>
                <div class="phone-contact-row__actions">
                    <button type="button" class="phone-contact-act-btn phone-contact-act-btn--call" title="${I18n.t('ui.phone.call')}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-2.2 2.2a15.053 15.053 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 3.9c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-.99-1.02z"/></svg>
                    </button>
                    <button type="button" class="phone-contact-act-btn phone-contact-act-btn--chat" title="${I18n.t('ui.phone.send_imessage')}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </button>
                    <button type="button" class="phone-contact-act-btn phone-contact-act-btn--del" title="${I18n.t('ui.phone.delete_contact')}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            `;

            row.querySelector('.phone-contact-row__main').addEventListener('click', () => {
                this.openChat({
                    name: label,
                    charId: c.characterId,
                    phone: c.phone,
                    online: isOnline,
                });
            });

            row.querySelector('.phone-contact-act-btn--call').addEventListener('click', (e) => {
                e.stopPropagation();
                notify(I18n.t('ui.phone.calling', { name: label, number: phoneText || I18n.t('ui.phone.unknown_number') }), 'info');
            });

            row.querySelector('.phone-contact-act-btn--chat').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openChat({
                    name: label,
                    charId: c.characterId,
                    phone: c.phone,
                    online: isOnline,
                });
            });

            row.querySelector('.phone-contact-act-btn--del').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteContact(c.id, label);
            });

            list.appendChild(row);
        });
    },

    submitNewContact() {
        const name = ($('#phone-new-name')?.value || '').trim();
        const phone = ($('#phone-new-phone')?.value || '').trim();
        if (!phone) {
            notify(I18n.t('phone.enter_number'), 'error');
            return;
        }
        this._pendingContactAdd = true;
        post('phoneAddContact', { name, phone });
    },

    finishContactAdd() {
        this._pendingContactAdd = false;
        $('#phone-add-contact-modal')?.classList.add('hidden');
        if ($('#phone-new-name')) $('#phone-new-name').value = '';
        if ($('#phone-new-phone')) $('#phone-new-phone').value = '';
        if ($('#phone-new-avatar-preview')) $('#phone-new-avatar-preview').textContent = '+';
        this.showView('contacts');
        this.renderContacts();
    },

    deleteContact(contactId, contactName) {
        if (!contactId) return;
        post('phoneDeleteContact', { contactId });
    },

    openChat(target) {
        this.chatTarget = target;
        const online = target.online !== undefined ? target.online : this.isContactOnline(target.charId);
        const is112 = target.isEmergency || target.charId === -112 || String(target.charId) === '-112' || target.phone === '112';

        const titleEl = $('#phone-chat-title');
        if (titleEl) titleEl.textContent = target.name || target.phone || I18n.t('ui.phone.chat');

        const sub = $('#phone-chat-subtitle');
        if (sub) {
            if (is112) {
                sub.textContent = I18n.t('dynamic.phone.imessage_112_dispatch');
            } else if (target.phone) {
                sub.textContent = `${target.phone} · ${online ? 'iMessage' : I18n.t('ui.factions.offline')}`;
            } else {
                sub.textContent = online ? 'iMessage' : I18n.t('ui.factions.offline');
            }
        }

        const navAvatar = $('#phone-chat-nav-avatar');
        if (navAvatar) {
            if (is112) {
                navAvatar.textContent = '🚨';
                navAvatar.style.background = 'linear-gradient(135deg, #ff3b30 0%, #d70015 100%)';
                navAvatar.innerHTML = '🚨';
            } else {
                const avatarImg = (this.data?.avatarsByChar || {})[target.charId] || target.avatar || null;
                if (avatarImg) {
                    navAvatar.innerHTML = `<img src="${this.safeAvatarSrc(avatarImg)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    navAvatar.style.background = 'transparent';
                } else {
                    navAvatar.textContent = (target.name || '?').charAt(0).toUpperCase();
                    navAvatar.style.background = this.getIosAvatarGradient(target.name);
                }
            }
        }

        const input = $('#phone-chat-input');
        if (input) {
            input.placeholder = is112 ? I18n.t('ui.phone.message_to_112') : 'iMessage';
            input.value = '';
        }
        const sendBtn = $('#phone-chat-send');
        if (sendBtn) sendBtn.classList.remove('has-text');

        this.renderChat(target);
        this.showView('chat');
    },

    renderChat(target) {
        const wrap = $('#phone-chat-messages');
        if (!wrap || !this.data) return;
        wrap.innerHTML = '';
        const myId = this.data.myCharacterId;
        const is112 = target.isEmergency || target.charId === -112 || String(target.charId) === '-112' || target.phone === '112';

        const msgs = (this.data.messages || []).filter((m) => {
            if (is112) {
                return m.sender_character_id === 0 || m.receiver_character_id === 0 || m.sender_character_id === -112 || m.receiver_character_id === -112;
            }
            if (target.charId) {
                return m.sender_character_id === target.charId || m.receiver_character_id === target.charId;
            }
            return false;
        }).reverse();

        // Authentic iOS conversation header banner
        const infoBanner = document.createElement('div');
        infoBanner.className = 'phone-chat__info-banner';
        infoBanner.innerHTML = is112
            ? `<span>🚨 ${I18n.t('ui.phone.dispatch_banner')}</span>`
            : '<span>' + I18n.t('ui.phone.imessage_with', { name: this.escapeHtml(target.name || I18n.t('ui.phone.contact')) }) + '</span>';
        wrap.appendChild(infoBanner);

        if (!msgs.length) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'phone-chat__empty';
            emptyEl.innerHTML = is112
                ? '<div class="phone-chat__empty-icon">🚨</div><p>' + I18n.t('ui.phone.dispatch_empty') + '</p>'
                : '<div class="phone-chat__empty-icon">👋</div><p>' + I18n.t('ui.phone.say_hi', { name: this.escapeHtml(target.name || I18n.t('ui.phone.them')) }) + '</p>';
            wrap.appendChild(emptyEl);
            return;
        }

        msgs.forEach((m) => {
            const mine = m.sender_character_id === myId;
            const row = document.createElement('div');
            row.className = `phone-bubble-wrap ${mine ? 'phone-bubble-wrap--out' : 'phone-bubble-wrap--in'}`;
            const bubble = document.createElement('div');
            bubble.className = `phone-bubble ${mine ? 'phone-bubble--out' : 'phone-bubble--in'}`;
            bubble.textContent = m.message;
            const timeEl = document.createElement('span');
            timeEl.className = 'phone-bubble__time';
            timeEl.textContent = (mine ? 'Delivered · ' : '') + this.formatMsgTime(m.created_at);
            row.appendChild(bubble);
            row.appendChild(timeEl);
            wrap.appendChild(row);
        });
        wrap.scrollTop = wrap.scrollHeight;
    },

    sendMessage() {
        const input = $('#phone-chat-input');
        const message = (input?.value || '').trim();
        if (!message) return;

        const is112 = this.chatTarget?.isEmergency || this.chatTarget?.charId === -112 || String(this.chatTarget?.charId) === '-112' || this.chatTarget?.phone === '112';

        if (!is112 && !this.chatTarget?.charId && !this.chatTarget?.phone) {
            notify(I18n.t('phone.invalid_contact'), 'error');
            return;
        }

        post('phoneSend', {
            targetCharacterId: is112 ? -112 : (this.chatTarget.charId || 0),
            phone: is112 ? '112' : (this.chatTarget.phone || null),
            message,
        });

        if (input) {
            input.value = '';
            input.focus();
        }
        const sendBtn = $('#phone-chat-send');
        if (sendBtn) sendBtn.classList.remove('has-text');
    },

    renderBank() {
        const d = this.data || {};
        $('#phone-bank-bank').textContent = this.formatMoney(d.bank);
        $('#phone-bank-cash').textContent = this.formatMoney(d.cash);
        this.renderBankTransactions(d.transactions || []);
    },

    bankReasonLabel(reason) {
        const map = {
            payday: I18n.t('ui.phone.tx_payday'),
            shop: I18n.t('ui.phone.tx_shop'),
            shop_refund: I18n.t('ui.phone.tx_shop_refund'),
            atm_deposit: I18n.t('ui.phone.tx_atm_deposit'),
            atm_withdraw: I18n.t('ui.phone.tx_atm_withdraw'),
            bank_transfer_out: I18n.t('ui.phone.tx_transfer_out'),
            bank_transfer_in: I18n.t('ui.phone.tx_transfer_in'),
            buy_level: I18n.t('ui.phone.tx_buy_level'),
        };
        const key = String(reason || '').toLowerCase();
        return map[key] || reason || I18n.t('ui.phone.tx_default');
    },

    formatTxDate(raw) {
        if (!raw) return '—';
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return String(raw);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = d.toDateString() === yesterday.toDateString();
        const time = I18n.time(d, { hour: '2-digit', minute: '2-digit' });
        if (sameDay) return I18n.t('ui.phone.today_time', { time });
        if (isYesterday) return I18n.t('ui.phone.yesterday_time', { time });
        return I18n.date(d, { day: 'numeric', month: 'short' }) + `, ${time}`;
    },

    renderBankTransactions(transactions) {
        const list = $('#phone-bank-tx-list');
        if (!list) return;
        list.innerHTML = '';

        const iconIn = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
        const iconOut = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';

        (transactions || []).slice(0, 30).forEach((tx) => {
            const isIncome = tx.direction === 'in';
            const el = document.createElement('div');
            el.className = 'phone-fleeca__tx-item';
            el.innerHTML = `
                <div class="phone-fleeca__tx-info">
                    <div class="phone-fleeca__tx-icon ${isIncome ? 'is-in' : 'is-out'}">${isIncome ? iconIn : iconOut}</div>
                    <div class="phone-fleeca__tx-details">
                        <div class="phone-fleeca__tx-title">${this.escapeHtml(this.bankReasonLabel(tx.reason))}</div>
                        <div class="phone-fleeca__tx-date">${this.escapeHtml(this.formatTxDate(tx.created_at))}</div>
                    </div>
                </div>
                <div class="phone-fleeca__tx-amount ${isIncome ? 'is-in' : 'is-out'}">${isIncome ? '+' : '-'}${this.formatMoney(tx.amount)}</div>
            `;
            list.appendChild(el);
        });

        if (!list.children.length) {
            list.innerHTML = `<p class="phone-fleeca__tx-empty">${I18n.t('ui.phone.no_transactions')}</p>`;
        }
    },

    openBankTransfer() {
        $('#phone-bank-transfer-modal')?.classList.add('is-open');
    },

    closeBankTransfer() {
        $('#phone-bank-transfer-modal')?.classList.remove('is-open');
        const form = $('#phone-bank-transfer-form');
        if (form) form.reset();
    },

    showBankNotify(msg, isError = false) {
        const el = $('#phone-bank-notify');
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('is-error', isError);
        el.classList.add('is-show');
        setTimeout(() => el.classList.remove('is-show'), 3000);
    },

    submitBankTransfer() {
        const targetId = Number($('#phone-bank-target-id')?.value);
        const amount = Number($('#phone-bank-amount')?.value);
        if (!targetId || targetId < 1) {
            this.showBankNotify(I18n.t('ui.phone.invalid_player_id'), true);
            return;
        }
        if (!amount || amount < 1) {
            this.showBankNotify(I18n.t('ui.phone.invalid_amount'), true);
            return;
        }
        if (amount > Number(this.data?.bank || 0)) {
            this.showBankNotify(I18n.t('ui.phone.insufficient_funds'), true);
            return;
        }
        post('phoneBankTransfer', { targetId, amount });
        this.closeBankTransfer();
    },

    renderSettings() {
        const d = this.data || {};
        const name = d.myName || I18n.t('common.player');
        $('#phone-settings-name').textContent = name;
        $('#phone-settings-id').textContent = I18n.t('dynamic.phone.player_id_value0', { value0: d.myId || '—' });
        const avatar = $('#phone-settings-avatar');
        if (avatar) {
            const myAvatar = d.myAvatar || null;
            if (myAvatar) {
                avatar.innerHTML = `<img src="${this.safeAvatarSrc(myAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                avatar.style.background = 'transparent';
            } else {
                avatar.textContent = name.charAt(0).toUpperCase();
            }
        }
    },

    updateTaxi(payload) {
        if (payload === null || payload === undefined) {
            if (this.screen === 'taxi') this.renderTaxi();
            return;
        }

        const isDistancePatch = payload.driverDistanceKm !== undefined
            || payload.passengerDistanceKm !== undefined
            || payload.nearDestination !== undefined
            || payload.driverStatusText !== undefined;

        if (isDistancePatch && this.taxiData) {
            Object.assign(this.taxiData, payload);
            if (this.screen !== 'taxi') return;
            if (this.taxiMode === 'map' && window.TaxiPhoneMap?.map) {
                this.updateTaxiLiveFields();
                return;
            }
            this.updateTaxiLiveFields();
            return;
        }

        this.taxiData = payload || this.taxiData;
        if (this.screen !== 'taxi') return;
        if (this.taxiMode === 'map' && window.TaxiPhoneMap?.map && this.taxiData) {
            TaxiPhoneMap.update(this.taxiData?.playerPos, this.taxiDest);
            return;
        }
        this.renderTaxi();
    },

    formatTaxiDistance(km) {
        if (km === null || km === undefined) return '—';
        const n = Number(km);
        if (Number.isNaN(n)) return '—';
        if (n < 1) return `${Math.round(n * 1000)} m`;
        return `${n.toFixed(1)} km`;
    },

    updateTaxiLiveFields() {
        const d = this.taxiData;
        if (!d) return;

        const ride = d.activeRide;
        const needsCard = ride && (ride.status === 'accepted' || ride.status === 'in_progress');
        const hasLiveEl = $('#phone-taxi-driver-dist') || $('#phone-taxi-passenger-dist');
        if (needsCard && !hasLiveEl && this.screen === 'taxi') {
            this.renderTaxi();
            return;
        }

        const driverDist = $('#phone-taxi-driver-dist');
        const passengerDist = $('#phone-taxi-passenger-dist');
        const driverStatus = $('#phone-taxi-driver-status');
        const passengerStatus = $('#phone-taxi-passenger-status');
        const completeBtn = $('#phone-taxi-complete');

        if (driverDist && d.driverDistanceKm !== undefined) {
            driverDist.textContent = this.formatTaxiDistance(d.driverDistanceKm);
        }
        if (passengerDist && d.passengerDistanceKm !== undefined) {
            passengerDist.textContent = this.formatTaxiDistance(d.passengerDistanceKm);
        }
        if (driverStatus && d.driverStatusText) {
            driverStatus.textContent = d.driverStatusText;
        }
        if (passengerStatus && d.passengerStatusText) {
            passengerStatus.textContent = d.passengerStatusText;
        }
        if (completeBtn) {
            const canComplete = d.nearDestination === true;
            completeBtn.disabled = !canComplete;
            completeBtn.title = canComplete ? '' : I18n.t('ui.phone.drive_to_destination');
        }
    },

    taxiDest: null,
    taxiMode: 'map',
    taxiSearch: '',

    mountTaxiLeafletMap(d) {
        const el = $('#phone-taxi-leaflet');
        if (!el || !window.TaxiPhoneMap) return;
        TaxiPhoneMap.mount(el, {
            player: d?.playerPos,
            destination: this.taxiDest,
            onPick: (x, y) => post('taxiPickMap', { x, y }),
        });
    },

    onTaxiPick(dest) {
        if (!dest) return;
        this.taxiDest = dest;
        const labelEl = $('#phone-taxi-dest-label');
        if (labelEl) labelEl.textContent = dest.label || I18n.t('ui.phone.selected_pin');
        const requestBtn = $('#phone-taxi-request');
        if (requestBtn) requestBtn.disabled = false;
        if (window.TaxiPhoneMap?.map) TaxiPhoneMap.setDestination(dest.x, dest.y);
        this.estimateTaxiDest();
    },

    estimateTaxiDest() {
        if (!this.taxiDest) return;
        if (this.taxiDest.destinationId) {
            post('taxiEstimate', { destinationId: this.taxiDest.destinationId });
        } else {
            post('taxiEstimate', { destination: this.taxiDest });
        }
    },

    requestTaxiDest() {
        if (!this.taxiDest) return;
        if (this.taxiDest.destinationId) {
            post('taxiRequestRide', { destinationId: this.taxiDest.destinationId });
        } else {
            post('taxiRequestRide', { destination: this.taxiDest });
        }
    },

    renderTaxiPassengerBooking(d) {
        if (this.taxiMode === 'gps') this.taxiMode = 'map';
        const mode = this.taxiMode || 'map';
        const places = d.destinations || [];
        const q = (this.taxiSearch || '').toLowerCase();
        const filtered = places.filter((p) => !q || p.label.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));

        return `
            <div class="phone-taxi-card">
                <div class="phone-taxi-card__label">${I18n.t('ui.phone.where_to')}</div>
                <div class="phone-taxi-modes phone-taxi-modes--two">
                    <button type="button" class="phone-taxi-mode ${mode === 'map' ? 'is-active' : ''}" data-taxi-mode="map">${I18n.t('ui.phone.map')}</button>
                    <button type="button" class="phone-taxi-mode ${mode === 'list' ? 'is-active' : ''}" data-taxi-mode="list">${I18n.t('ui.phone.places')}</button>
                </div>

                <div class="phone-taxi-panel ${mode === 'map' ? '' : 'hidden'}" data-panel="map">
                    <p class="phone-taxi-hint">${I18n.t('ui.phone.map_hint')}</p>
                    <div class="phone-taxi-map" id="phone-taxi-map">
                        <div class="phone-taxi-map__leaflet" id="phone-taxi-leaflet"></div>
                    </div>
                </div>

                <div class="phone-taxi-panel ${mode === 'list' ? '' : 'hidden'}" data-panel="list">
                    <input type="search" class="phone-taxi-search" id="phone-taxi-search" placeholder="${I18n.t('ui.phone.search_places')}" value="${this.taxiSearch || ''}">
                    <div class="phone-taxi-places" id="phone-taxi-places">
                        ${filtered.slice(0, 40).map((p) => `
                            <button type="button" class="phone-taxi-place" data-place-id="${p.id}">
                                <span class="phone-taxi-place__name">${this.escapeHtml(p.label)}</span>
                                <span class="phone-taxi-place__cat">${this.escapeHtml(p.category || '')}</span>
                            </button>`).join('')}
                        ${filtered.length > 40 ? `<p class="phone-taxi-hint">${I18n.t('ui.phone.more_refine', { count: filtered.length - 40 })}</p>` : ''}
                        ${!filtered.length ? `<p class="phone-taxi-hint">${I18n.t('ui.phone.no_places')}</p>` : ''}
                    </div>
                </div>

                <div class="phone-taxi-dest-summary">
                    <span>${I18n.t('ui.phone.destination')}</span>
                    <strong id="phone-taxi-dest-label">${this.escapeHtml(this.taxiDest?.label || I18n.t('ui.phone.not_selected'))}</strong>
                </div>
                <div class="phone-taxi-estimate">
                    <div><span>${I18n.t('ui.phone.distance')}</span><strong id="phone-taxi-distance">—</strong></div>
                    <div><span>${I18n.t('ui.phone.estimated_fare')}</span><strong id="phone-taxi-fare">—</strong></div>
                </div>
                <button type="button" class="phone-taxi-btn phone-taxi-btn--primary" id="phone-taxi-request" ${this.taxiDest ? '' : 'disabled'}>${I18n.t('ui.phone.request_cab')}</button>
            </div>
            <p class="phone-taxi-hint">${I18n.t('ui.phone.pickup_hint')}</p>`;
    },

    setTaxiEstimate(payload) {
        this.taxiEstimate = payload;
        const fareEl = $('#phone-taxi-fare');
        const distEl = $('#phone-taxi-distance');
        if (fareEl && payload) fareEl.textContent = this.formatMoney(payload.fare);
        if (distEl && payload) distEl.textContent = `${(payload.distanceKm || 0).toFixed(1)} km`;
    },

    renderTaxi() {
        const body = $('#phone-taxi-body');
        const title = $('#phone-taxi-title');
        if (!body) return;

        const d = this.taxiData;
        if (!d || !d.destinations) {
            if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
            body.dataset.taxiView = 'empty';
            body.innerHTML = `<p class="phone-empty">${this.escapeHtml(d?.error || I18n.t('ui.phone.loading_cab'))}</p>`;
            if (title) title.textContent = I18n.t('dynamic.phone.downtown_cab');
            return;
        }

        if (title) title.textContent = d.appName || I18n.t('dynamic.phone.downtown_cab');

        const ride = d.activeRide;
        const isDriver = d.isDriver && d.onDuty;
        const targetView = isDriver ? 'driver' : (ride ? 'ride' : 'passenger');

        // Fast path: if already in passenger mode and just updating estimate or destinations, don't recreate DOM!
        if (body.dataset.taxiView === 'passenger' && targetView === 'passenger') {
            if (window.TaxiPhoneMap?.map) {
                TaxiPhoneMap.update(d.playerPos, this.taxiDest);
            }
            if (this.taxiEstimate) this.setTaxiEstimate(this.taxiEstimate);
            return;
        }

        body.dataset.taxiView = targetView;

        let html = '';

        if (isDriver) {
            if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
            const stats = d.driverStats || {};
            html += `<div class="phone-taxi-card">
                <div class="phone-taxi-card__label">${I18n.t('ui.phone.driver_mode')}</div>
                <div class="phone-taxi-toggle">
                    <span>${I18n.t('ui.phone.available_for_rides')}</span>
                    <button type="button" class="phone-taxi-switch ${d.driverAvailable ? 'is-on' : ''}" id="phone-taxi-available-toggle">${d.driverAvailable ? I18n.t('ui.phone.on_caps') : I18n.t('ui.phone.off_caps')}</button>
                </div>
                <div class="phone-taxi-estimate phone-taxi-estimate--stats">
                    <div><span>${I18n.t('ui.phone.today')}</span><strong>${I18n.t('ui.phone.rides_count', { count: stats.todayRides || 0 })} · ${this.formatMoney(stats.todayEarnings || 0)}</strong></div>
                    <div><span>${I18n.t('ui.phone.this_shift')}</span><strong>${I18n.t('ui.phone.rides_count', { count: stats.sessionRides || 0 })} · ${this.formatMoney(stats.sessionEarnings || 0)}</strong></div>
                </div>
                <p class="phone-taxi-hint">${I18n.t('ui.phone.driver_hint', { percent: d.pricing?.companyCut || 12 })}</p>
            </div>`;

            if (ride) {
                html += this.renderActiveRideCard(ride, true);
            } else {
                const offers = d.pendingOffers || [];
                if (offers.length) {
                    html += `<div class="phone-taxi-section-title">${I18n.t('ui.phone.incoming_requests')}</div>`;
                    offers.forEach((offer) => {
                        html += `<div class="phone-taxi-offer">
                            <div class="phone-taxi-offer__top">
                                <strong>${this.escapeHtml(offer.passengerName || I18n.t('ui.phone.passenger'))}</strong>
                                <span class="phone-taxi-fare">${this.formatMoney(offer.fare)}</span>
                            </div>
                            <div class="phone-taxi-offer__route">→ ${this.escapeHtml(offer.destination?.label || I18n.t('ui.phone.destination'))}</div>
                            <div class="phone-taxi-offer__meta">${(offer.distanceKm || 0).toFixed(1)} km</div>
                            <button type="button" class="phone-taxi-btn phone-taxi-btn--primary" data-taxi-accept="${offer.id}">${I18n.t('ui.phone.accept_ride')}</button>
                        </div>`;
                    });
                } else {
                    html += `<p class="phone-empty">${I18n.t('ui.phone.no_ride_requests')}</p>`;
                }
            }
        } else if (ride) {
            if (window.TaxiPhoneMap) TaxiPhoneMap.destroy();
            html += this.renderActiveRideCard(ride, false);
        } else {
            html += this.renderTaxiPassengerBooking(d);
        }

        body.innerHTML = html;
        this.bindTaxiEvents(d, ride, isDriver);
        if (!isDriver && !ride) {
            this.mountTaxiLeafletMap(d);
        }
        if (this.taxiEstimate) this.setTaxiEstimate(this.taxiEstimate);
    },

    updateTaxiPlacesList(d) {
        const placesContainer = $('#phone-taxi-places');
        if (!placesContainer) return;
        const places = d?.destinations || [];
        const q = (this.taxiSearch || '').toLowerCase().trim();
        const filtered = places.filter((p) => !q || p.label.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));

        placesContainer.innerHTML = `
            ${filtered.slice(0, 40).map((p) => `
                <button type="button" class="phone-taxi-place" data-place-id="${p.id}">
                    <span class="phone-taxi-place__name">${this.escapeHtml(p.label)}</span>
                    <span class="phone-taxi-place__cat">${this.escapeHtml(p.category || '')}</span>
                </button>`).join('')}
            ${filtered.length > 40 ? `<p class="phone-taxi-hint">${I18n.t('ui.phone.more_refine', { count: filtered.length - 40 })}</p>` : ''}
            ${!filtered.length ? `<p class="phone-taxi-hint">${I18n.t('ui.phone.no_places')}</p>` : ''}
        `;

        placesContainer.querySelectorAll('[data-place-id]').forEach((btn) => {
            btn.addEventListener('click', () => post('taxiPickPlace', { destinationId: btn.dataset.placeId }));
        });
    },

    renderActiveRideCard(ride, isDriver) {
        const d = this.taxiData || {};
        const statusLabels = {
            pending: I18n.t('ui.phone.ride_pending'),
            accepted: isDriver ? I18n.t('ui.phone.ride_pickup') : (d.driverStatusText || I18n.t('ui.phone.ride_on_the_way')),
            in_progress: I18n.t('ui.phone.ride_in_progress'),
            completed: I18n.t('ui.phone.ride_completed'),
            cancelled: I18n.t('ui.phone.ride_cancelled'),
        };
        let actions = '';
        if (isDriver) {
            if (ride.status === 'accepted') {
                actions = `<button type="button" class="phone-taxi-btn phone-taxi-btn--primary" id="phone-taxi-pickup">${I18n.t('ui.phone.passenger_picked_up')}</button>
                           <button type="button" class="phone-taxi-btn" id="phone-taxi-cancel">${I18n.t('ui.phone.cancel_ride')}</button>`;
            } else if (ride.status === 'in_progress') {
                const canComplete = d.nearDestination === true;
                actions = `<button type="button" class="phone-taxi-btn phone-taxi-btn--primary" id="phone-taxi-complete" ${canComplete ? '' : 'disabled'} title="${canComplete ? '' : I18n.t('ui.phone.drive_to_destination')}">${I18n.t('ui.phone.complete_trip')}</button>`;
            }
        } else if (ride.status === 'pending' || ride.status === 'accepted') {
            actions = `<button type="button" class="phone-taxi-btn" id="phone-taxi-cancel">${I18n.t('ui.phone.cancel_ride')}</button>`;
        } else if (!isDriver && ride.status === 'in_progress') {
            const tips = (this.taxiData?.tipOptions || [25, 50, 100]).map((amt) =>
                `<button type="button" class="phone-taxi-btn phone-taxi-btn--tip" data-taxi-tip="${amt}">${I18n.t('ui.phone.tip_amount', { amount: amt })}</button>`
            ).join('');
            actions = `<div class="phone-taxi-tips"><span>${I18n.t('ui.phone.tip_driver')}</span><div class="phone-taxi-tip-row">${tips}</div></div>`;
        }

        let distanceRows = '';
        if (!isDriver && (ride.status === 'accepted' || ride.status === 'in_progress')) {
            distanceRows += `<div class="phone-taxi-row phone-taxi-row--live">
                <span>${I18n.t('ui.phone.driver')}</span>
                <strong id="phone-taxi-driver-status">${this.escapeHtml(d.driverStatusText || I18n.t('ui.phone.driver_en_route'))}</strong>
            </div>
            <div class="phone-taxi-row phone-taxi-row--live">
                <span>${I18n.t('ui.phone.distance')}</span>
                <strong id="phone-taxi-driver-dist">${this.formatTaxiDistance(d.driverDistanceKm)}</strong>
            </div>`;
        }
        if (isDriver && ride.status === 'accepted') {
            distanceRows += `<div class="phone-taxi-row phone-taxi-row--live">
                <span>${I18n.t('ui.phone.passenger')}</span>
                <strong id="phone-taxi-passenger-status">${this.escapeHtml(d.passengerStatusText || I18n.t('ui.phone.en_route_to_passenger'))}</strong>
            </div>
            <div class="phone-taxi-row phone-taxi-row--live">
                <span>${I18n.t('ui.phone.distance')}</span>
                <strong id="phone-taxi-passenger-dist">${this.formatTaxiDistance(d.passengerDistanceKm)}</strong>
            </div>`;
        }
        if (isDriver && ride.status === 'in_progress' && !d.nearDestination) {
            distanceRows += `<p class="phone-taxi-hint phone-taxi-hint--warn">${I18n.t('ui.phone.drive_to_complete')}</p>`;
        }

        return `<div class="phone-taxi-card phone-taxi-card--active">
            <div class="phone-taxi-status phone-taxi-status--${this.escapeHtml(ride.status)}">${this.escapeHtml(statusLabels[ride.status] || ride.status)}</div>
            <div class="phone-taxi-row"><span>${I18n.t('ui.phone.destination')}</span><strong>${this.escapeHtml(ride.destination?.label || '—')}</strong></div>
            <div class="phone-taxi-row"><span>${I18n.t('ui.phone.fare')}</span><strong>${this.formatMoney(ride.fare)}</strong></div>
            ${ride.driverName ? `<div class="phone-taxi-row"><span>${I18n.t('ui.phone.driver')}</span><strong>${ride.driverName}</strong></div>` : ''}
            ${ride.passengerName && isDriver ? `<div class="phone-taxi-row"><span>${I18n.t('ui.phone.passenger')}</span><strong>${ride.passengerName}</strong></div>` : ''}
            ${distanceRows}
            ${actions}
        </div>`;
    },

    bindTaxiEvents(d, ride, isDriver) {
        $('#phone-taxi-available-toggle')?.addEventListener('click', () => {
            const on = !d.driverAvailable;
            post('taxiSetAvailable', { available: on });
        });

        $$('[data-taxi-accept]').forEach((btn) => {
            btn.addEventListener('click', () => post('taxiAcceptRide', { rideId: Number(btn.dataset.taxiAccept) }));
        });

        $('#phone-taxi-cancel')?.addEventListener('click', () => post('taxiCancelRide', {}));
        $('#phone-taxi-pickup')?.addEventListener('click', () => post('taxiPickup', {}));
        $('#phone-taxi-complete')?.addEventListener('click', () => post('taxiComplete', {}));

        $$('[data-taxi-tip]').forEach((btn) => {
            btn.addEventListener('click', () => post('taxiTip', { amount: Number(btn.dataset.taxiTip) }));
        });

        $$('[data-taxi-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const newMode = btn.dataset.taxiMode;
                if (this.taxiMode === newMode) return;
                this.taxiMode = newMode;

                $$('[data-taxi-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.taxiMode === newMode));
                const mapPanel = $('[data-panel="map"]');
                const listPanel = $('[data-panel="list"]');
                if (mapPanel) mapPanel.classList.toggle('hidden', newMode !== 'map');
                if (listPanel) listPanel.classList.toggle('hidden', newMode !== 'list');

                if (newMode === 'map') {
                    if (window.TaxiPhoneMap?.map) {
                        TaxiPhoneMap.invalidate();
                    } else {
                        this.mountTaxiLeafletMap(d);
                    }
                }
            });
        });

        const search = $('#phone-taxi-search');
        if (search) {
            search.addEventListener('input', () => {
                this.taxiSearch = search.value;
                this.updateTaxiPlacesList(d);
            });
        }

        $$('[data-place-id]').forEach((btn) => {
            btn.addEventListener('click', () => post('taxiPickPlace', { destinationId: btn.dataset.placeId }));
        });

        $('#phone-taxi-request')?.addEventListener('click', () => this.requestTaxiDest());
    },
};

window.Phone = Phone;
