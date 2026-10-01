// Quest log panel (sunset_quests) — forza tracker styling (quests-guides-jobs.html).
// No skew / no backdrop-filter (CEF artifacts); see quests.css.
(() => {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    const post = (name, data = {}) => fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => {});

    const QuestLog = {
        open: false,
        quests: [],

        ensureDom() {
            if (document.getElementById('quest-shell')) return;
            const wrap = document.createElement('div');
            wrap.id = 'quest-shell';
            wrap.className = 'quest-shell';
            wrap.setAttribute('aria-hidden', 'true');
            wrap.innerHTML = `
                <div class="quest-shell__header">
                    <div class="quest-shell__title"><i class="ph-fill ph-scroll"></i> ${I18n.t('quest.log_title')}</div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span class="quest-shell__count" id="quest-count"></span>
                        <button type="button" class="quest-shell__close" id="quest-shell-close">ESC</button>
                    </div>
                </div>
                <div class="quest-shell__body" id="quest-body"></div>
                <div class="quest-shell__hint">${I18n.t('quest.close_hint')}</div>
            `;
            document.body.appendChild(wrap);
            document.getElementById('quest-shell-close')?.addEventListener('click', () => post('questLogClose'));
        },

        statusMeta(q) {
            if (q.status === 'claimed') return { cls: 'is-claimed', label: I18n.t('quest.claimed'), icon: 'ph-check-circle' };
            if (q.status === 'complete') return { cls: 'is-complete', label: I18n.t('quest.ready_to_claim'), icon: 'ph-gift' };
            return { cls: '', label: I18n.t('quest.in_progress'), icon: 'ph-hourglass-medium' };
        },

        render() {
            const body = document.getElementById('quest-body');
            if (!body) return;
            const list = this.quests || [];
            const countEl = document.getElementById('quest-count');
            const active = list.filter((q) => q.status !== 'claimed').length;
            if (countEl) countEl.textContent = I18n.t(active === 1 ? 'quest.active_one' : 'quest.active_many', { count: active });

            if (!list.length) {
                body.innerHTML = `<div class="quest-shell__empty">${I18n.t('quest.empty')}</div>`;
                return;
            }

            body.innerHTML = list.map((q) => {
                const meta = this.statusMeta(q);
                const pct = q.target > 0 ? Math.min(100, Math.floor(((q.progress || 0) / q.target) * 100)) : 0;
                const r = q.reward || {};
                const rewardBits = [];
                if (r.money) rewardBits.push(`<span>$<b>${Number(r.money).toLocaleString('en-US')}</b></span>`);
                if (r.xp) rewardBits.push(`<span><b>${esc(r.xp)}</b> XP</span>`);
                if (r.rp) rewardBits.push(`<span><b>${esc(r.rp)}</b> RP</span>`);
                const rewardHtml = rewardBits.length
                    ? `<div class="quest-card__reward">${rewardBits.join('')}</div>`
                    : '<div class="quest-card__reward"></div>';
                const claimBtn = q.status === 'complete'
                    ? `<button type="button" class="quest-card__claim" data-key="${esc(q.questKey)}"><i class="ph-bold ph-gift"></i> ${I18n.t('quest.claim')}</button>`
                    : '';
                return `
                    <div class="quest-card ${meta.cls}">
                        <div class="quest-card__head">
                            <div>
                                <div class="quest-card__chain">${esc(q.chainLabel || '')}</div>
                                <div class="quest-card__name">${esc(q.label)}</div>
                            </div>
                            <div class="quest-card__badge">${esc(meta.label)}</div>
                        </div>
                        <div class="quest-card__desc">${esc(q.description || '')}</div>
                        <div class="quest-card__objective"><i class="ph-fill ${meta.icon}"></i> ${esc(q.objectiveLabel || '')} — ${q.progress || 0}/${q.target || 1}</div>
                        <div class="quest-card__progress"><div class="quest-card__progress-fill" style="width:${pct}%"></div></div>
                        <div class="quest-card__footer">${rewardHtml}${claimBtn}</div>
                    </div>`;
            }).join('');

            body.querySelectorAll('.quest-card__claim').forEach((btn) => {
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
            const shell = document.getElementById('quest-shell');
            shell?.classList.add('active');
            shell?.setAttribute('aria-hidden', 'false');
            this.open = true;
            const renderToken = Number(data?.renderToken || 0);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                post('questLogRendered', { renderToken });
            }));
        },

        updateChrome() {
            const title = document.querySelector('.quest-shell__title');
            const hint = document.querySelector('.quest-shell__hint');
            if (title) title.innerHTML = `<i class="ph-fill ph-scroll"></i> ${I18n.t('quest.log_title')}`;
            if (hint) hint.textContent = I18n.t('quest.close_hint');
        },

        hide() {
            this.open = false;
            const shell = document.getElementById('quest-shell');
            shell?.classList.remove('active');
            shell?.setAttribute('aria-hidden', 'true');
        },

        requestClose() {
            if (this.open) post('questLogClose');
        },
    };

    // ESC closes while the panel owns focus.
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
    });
})();
