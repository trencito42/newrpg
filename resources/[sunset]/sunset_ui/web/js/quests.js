// Quest log panel (sunset_quests) — 1:1 Racket Quest Log design (racket_quests_ui.html)
(() => {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    const post = (name, data = {}) => fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => {});

    const ICONS = {
        scroll: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
        objective: `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        gift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>`
    };

    const QuestLog = {
        open: false,
        quests: [],
        activeCategory: 'all',

        ensureDom() {
            if (document.getElementById('quest-wrapper')) return;
            const wrap = document.createElement('div');
            wrap.id = 'quest-wrapper';
            wrap.innerHTML = `
                <div class="quest-panel">
                    <!-- Header -->
                    <div class="q-header">
                        <div class="qh-title-container">
                            <div class="qh-icon">${ICONS.scroll}</div>
                            <h1 class="qh-title" id="quest-title-text">${I18n.t('quest.log_title')}</h1>
                        </div>
                        <div class="qh-actions">
                            <div class="active-count" id="quest-count">0 ACTIVE</div>
                            <button type="button" class="esc-hint" id="quest-close-btn">ESC</button>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="q-tabs" id="quest-tabs">
                        <button type="button" class="tab-btn active" data-cat="all">TOATE</button>
                        <button type="button" class="tab-btn" data-cat="main">STORY</button>
                        <button type="button" class="tab-btn" data-cat="careers">CARIERE</button>
                        <button type="button" class="tab-btn" data-cat="criminal">CRIMINAL</button>
                        <button type="button" class="tab-btn" data-cat="social">SOCIAL</button>
                        <button type="button" class="tab-btn" data-cat="clans">CLANURI</button>
                    </div>

                    <!-- List -->
                    <div class="q-list" id="quest-list"></div>

                    <!-- Footer -->
                    <div class="q-footer" id="quest-footer-text">
                        ${I18n.t('quest.close_hint')}
                    </div>
                </div>
            `;
            document.body.appendChild(wrap);

            document.getElementById('quest-close-btn')?.addEventListener('click', () => post('questLogClose'));

            wrap.querySelectorAll('.tab-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    wrap.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeCategory = btn.dataset.cat || 'all';
                    this.render();
                });
            });
        },

        statusMeta(q) {
            if (q.status === 'claimed') {
                return {
                    cardCls: 'is-claimed',
                    badgeCls: 'completed',
                    label: I18n.t('quest.claimed'),
                    icon: ICONS.check
                };
            }
            if (q.status === 'complete') {
                return {
                    cardCls: 'is-ready',
                    badgeCls: 'ready',
                    label: I18n.t('quest.ready_to_claim'),
                    icon: ICONS.gift
                };
            }
            return {
                cardCls: '',
                badgeCls: 'active',
                label: I18n.t('quest.in_progress'),
                icon: ICONS.objective
            };
        },

        categoryColor(cat) {
            cat = (cat || 'main').toLowerCase();
            if (cat === 'careers') return 'blue';
            if (cat === 'criminal') return 'crimson';
            if (cat === 'social' || cat === 'factions') return 'purple';
            if (cat === 'clans') return 'gold';
            return 'green';
        },

        render() {
            const listEl = document.getElementById('quest-list');
            if (!listEl) return;
            const allQuests = this.quests || [];
            const countEl = document.getElementById('quest-count');
            const activeCount = allQuests.filter((q) => q.status !== 'claimed').length;
            if (countEl) {
                countEl.textContent = `${activeCount} ${I18n.t(activeCount === 1 ? 'quest.active_one' : 'quest.active_many', { count: activeCount }).toUpperCase()}`;
            }

            let filtered = allQuests;
            if (this.activeCategory && this.activeCategory !== 'all') {
                filtered = allQuests.filter((q) => (q.category || 'main').toLowerCase() === this.activeCategory.toLowerCase());
            }

            if (!filtered.length) {
                listEl.innerHTML = `<div class="q-empty">${I18n.t('quest.empty')}</div>`;
                return;
            }

            listEl.innerHTML = filtered.map((q) => {
                const meta = this.statusMeta(q);
                const catColor = this.categoryColor(q.category);
                const pct = q.target > 0 ? Math.min(100, Math.floor(((q.progress || 0) / q.target) * 100)) : 0;
                
                const r = q.reward || {};
                const rewardBits = [];
                if (r.money) rewardBits.push(`<div class="reward-item">$${I18n.number(Number(r.money))}</div>`);
                if (r.xp) rewardBits.push(`<div class="reward-item">${esc(r.xp)}<span>XP</span></div>`);
                if (r.rp) rewardBits.push(`<div class="reward-item">${esc(r.rp)}<span>RP</span></div>`);
                const rewardsHtml = rewardBits.length
                    ? `<div class="qc-rewards">${rewardBits.join('')}</div>`
                    : '<div class="qc-rewards"></div>';

                const claimBtn = q.status === 'complete'
                    ? `<button type="button" class="quest-claim-btn" data-key="${esc(q.questKey)}">${ICONS.gift} ${I18n.t('quest.claim')}</button>`
                    : '';

                return `
                    <div class="quest-card ${meta.cardCls}" data-cat="${catColor}">
                        <div class="qc-header">
                            <div class="qc-info">
                                <div class="qc-subtitle">${esc(q.chainLabel || '')}</div>
                                <h2 class="qc-title">${esc(q.label)}</h2>
                            </div>
                            <div class="qc-badge ${meta.badgeCls}">${esc(meta.label)}</div>
                        </div>
                        <p class="qc-desc">${esc(q.description || '')}</p>
                        <div class="qc-objective">
                            <div class="obj-icon">${meta.icon}</div>
                            <span class="obj-text">${esc(q.objectiveLabel || '')}</span>
                            <span class="obj-progress">— ${q.progress || 0}/${q.target || 1}</span>
                        </div>
                        <div class="qc-progress-bar">
                            <div class="qc-progress-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="qc-footer-row">
                            ${rewardsHtml}
                            ${claimBtn}
                        </div>
                    </div>`;
            }).join('');

            listEl.querySelectorAll('.quest-claim-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    btn.disabled = true;
                    post('questClaim', { questKey: btn.dataset.key });
                });
            });
        },

        show(data) {
            this.ensureDom();
            this.updateChrome();
            this.quests = (data && data.quests) || [];
            this.render();
            const wrap = document.getElementById('quest-wrapper');
            wrap?.classList.add('visible');
            this.open = true;
            const renderToken = Number(data?.renderToken || 0);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                post('questLogRendered', { renderToken });
            }));
        },

        updateChrome() {
            const title = document.getElementById('quest-title-text');
            const footer = document.getElementById('quest-footer-text');
            if (title) title.textContent = I18n.t('quest.log_title');
            if (footer) footer.textContent = I18n.t('quest.close_hint');
        },

        hide() {
            this.open = false;
            const wrap = document.getElementById('quest-wrapper');
            wrap?.classList.remove('visible');
        },

        requestClose() {
            if (this.open) post('questLogClose');
        },
    };

    // ESC key closes quest log
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && QuestLog.open) {
            e.preventDefault();
            e.stopPropagation();
            QuestLog.requestClose();
        }
    });

    window.QuestLog = QuestLog;
    window.addEventListener('sunset:localeChanged', () => {
        if (!QuestLog.open) return;
        QuestLog.updateChrome();
        QuestLog.render();
        post('questLocaleRefresh');
    });
})();
