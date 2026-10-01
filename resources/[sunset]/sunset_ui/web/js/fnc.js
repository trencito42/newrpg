(() => {
    'use strict';
    const post = (name, data = {}) => fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => {});

    const FncUI = {
        active: false,
        forced: false,
        tokens: 0,
        currentName: '',
        reason: '',

        ensureDom() {
            if (document.getElementById('fnc-modal-root')) return;
            const wrap = document.createElement('div');
            wrap.id = 'fnc-modal-root';
            wrap.className = 'fnc-modal-wrapper hidden';
            wrap.innerHTML = `
                <div class="fnc-backdrop"></div>
                <div class="fnc-card">
                    <div class="fnc-header">
                        <div class="fnc-icon-badge"><i class="ph-fill ph-identification-card"></i></div>
                        <div>
                            <h2 class="fnc-title" id="fnc-modal-title">${I18n.t('ui.fnc.forced_title')}</h2>
                            <p class="fnc-subtitle" id="fnc-modal-subtitle">${I18n.t('ui.fnc.requested_sub')}</p>
                        </div>
                    </div>
                    <div class="fnc-body">
                        <div class="fnc-info-row">
                            <span class="fnc-label">${I18n.t('ui.fnc.current_name')}</span>
                            <span class="fnc-val" id="fnc-current-name">${I18n.t('common.player')}</span>
                        </div>
                        <div class="fnc-info-row" id="fnc-reason-row" style="display:none;">
                            <span class="fnc-label">${I18n.t('ui.fnc.admin_reason')}</span>
                            <span class="fnc-val fnc-val--reason" id="fnc-reason-text">${I18n.t('ui.fnc.default_reason')}</span>
                        </div>
                        <div class="fnc-field-group">
                            <label for="fnc-input-name" class="fnc-input-label">${I18n.t('ui.fnc.new_nickname')}</label>
                            <div class="fnc-input-wrap">
                                <i class="ph-bold ph-user fnc-input-icon"></i>
                                <input type="text" id="fnc-input-name" class="fnc-input" placeholder="${I18n.t('ui.fnc.placeholder')}" maxlength="24" autocomplete="off" spellcheck="false" />
                            </div>
                            <div class="fnc-hint" id="fnc-hint-text">${I18n.t('ui.fnc.hint')}</div>
                            <div class="fnc-error-msg hidden" id="fnc-error-box"></div>
                        </div>
                    </div>
                    <div class="fnc-actions">
                        <button type="button" class="fnc-btn fnc-btn-cancel" id="fnc-btn-cancel"><i class="ph-bold ph-x"></i> ${I18n.t('common.cancel')}</button>
                        <button type="button" class="fnc-btn fnc-btn-confirm" id="fnc-btn-submit"><i class="ph-bold ph-check"></i> ${I18n.t('ui.fnc.change_name')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(wrap);

            document.getElementById('fnc-btn-cancel')?.addEventListener('click', () => {
                if (!this.forced) this.hide();
            });
            document.querySelector('#fnc-modal-root .fnc-backdrop')?.addEventListener('click', () => {
                if (!this.forced) this.hide();
            });

            const submitBtn = document.getElementById('fnc-btn-submit');
            const inputField = document.getElementById('fnc-input-name');

            const doSubmit = () => {
                const val = inputField?.value?.trim() || '';
                if (!val || val.length < 3 || val.length > 24) {
                    this.showError(I18n.t('dynamic.fnc.name_must_be_between_3_and_24_characters'));
                    return;
                }
                if (!/^[a-zA-Z0-9._-]+$/.test(val)) {
                    this.showError(I18n.t('dynamic.fnc.name_may_only_contain_letters_digits_dots_and_hyphens_e_g_diablo'));
                    return;
                }
                this.clearError();
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<i class="ph-bold ph-spinner ph-spin"></i> ${I18n.t('ui.fnc.checking')}`;
                }
                post('fncSubmit', { name: val }).then(() => {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<i class="ph-bold ph-check"></i> ${I18n.t('ui.fnc.change_name')}`;
                    }
                });
            };

            submitBtn?.addEventListener('click', doSubmit);
            inputField?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doSubmit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (!this.forced) this.hide();
                }
            });
        },

        show(data) {
            this.ensureDom();
            this.active = true;
            this.forced = data?.forced !== false;
            this.currentName = data?.currentName || I18n.t('common.player');
            this.reason = data?.reason || '';
            this.tokens = data?.tokens || 1;

            const root = document.getElementById('fnc-modal-root');
            const titleEl = document.getElementById('fnc-modal-title');
            const subEl = document.getElementById('fnc-modal-subtitle');
            const curEl = document.getElementById('fnc-current-name');
            const reasonRow = document.getElementById('fnc-reason-row');
            const reasonText = document.getElementById('fnc-reason-text');
            const cancelBtn = document.getElementById('fnc-btn-cancel');
            const inputField = document.getElementById('fnc-input-name');

            if (curEl) curEl.textContent = this.currentName;

            if (this.reason && this.reason !== '') {
                if (reasonRow) reasonRow.style.display = 'flex';
                if (reasonText) reasonText.textContent = this.reason;
            } else {
                if (reasonRow) reasonRow.style.display = 'none';
            }

            if (titleEl) titleEl.textContent = this.forced ? I18n.t('ui.fnc.forced_title_fnc') : I18n.t('ui.fnc.title');
            if (subEl) subEl.textContent = this.forced ? I18n.t('ui.fnc.required_sub') : I18n.t('ui.fnc.choose_sub');

            if (cancelBtn) {
                cancelBtn.style.display = this.forced ? 'none' : 'inline-flex';
            }

            if (inputField) {
                inputField.value = '';
                setTimeout(() => inputField.focus(), 80);
            }
            this.clearError();
            root?.classList.remove('hidden');
        },

        showError(msg) {
            const box = document.getElementById('fnc-error-box');
            if (box) {
                box.textContent = msg;
                box.classList.remove('hidden');
            }
        },

        clearError() {
            const box = document.getElementById('fnc-error-box');
            if (box) {
                box.textContent = '';
                box.classList.add('hidden');
            }
        },

        hide() {
            if (!this.active) return;
            this.active = false;
            document.getElementById('fnc-modal-root')?.classList.add('hidden');
            post('fncClose');
        }
    };

    window.FncUI = FncUI;

    window.addEventListener('message', (event) => {
        const { action, data } = event.data || {};
        if (action === 'fncModalShow') {
            FncUI.show(data);
        } else if (action === 'fncModalHide') {
            FncUI.hide();
        } else if (action === 'fncModalError') {
            FncUI.showError(data?.error || I18n.t('ui.fnc.failed'));
        } else if (action === 'sessionForceClose') {
            FncUI.hide();
        }
    });
})();
