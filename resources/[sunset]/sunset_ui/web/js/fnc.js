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
                <form class="fnc-card" id="fnc-form" autocomplete="off">
                    <h2 class="fnc-title" id="fnc-modal-title">${I18n.t('ui.fnc.forced_title')}</h2>
                    <p class="fnc-subtitle" id="fnc-modal-subtitle">${I18n.t('ui.fnc.requested_sub')}</p>
                    <div class="fnc-meta">
                        <span>${I18n.t('ui.fnc.current_name')} <strong id="fnc-current-name">${I18n.t('common.player')}</strong></span>
                        <span id="fnc-reason-row" style="display:none;">${I18n.t('ui.fnc.admin_reason')} <strong class="fnc-reason" id="fnc-reason-text"></strong></span>
                    </div>
                    <label for="fnc-input-name">${I18n.t('ui.fnc.new_nickname')}</label>
                    <input type="text" id="fnc-input-name" class="fnc-input" placeholder="${I18n.t('ui.fnc.placeholder')}" maxlength="24" autocomplete="off" spellcheck="false" />
                    <div class="fnc-hint" id="fnc-hint-text">${I18n.t('ui.fnc.hint')}</div>
                    <div class="fnc-error-msg hidden" id="fnc-error-box"></div>
                    <div class="fnc-actions">
                        <button type="button" class="fnc-btn fnc-btn-cancel" id="fnc-btn-cancel">${I18n.t('common.cancel')}</button>
                        <button type="submit" class="fnc-btn fnc-btn-confirm" id="fnc-btn-submit">${I18n.t('ui.fnc.change_name')}</button>
                    </div>
                </form>
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

            const resetSubmit = () => {
                if (!submitBtn) return;
                submitBtn.disabled = false;
                submitBtn.textContent = I18n.t('ui.fnc.change_name');
            };
            this.resetSubmit = resetSubmit;

            const doSubmit = () => {
                const val = inputField?.value?.trim() || '';
                if (val.length < 3 || val.length > 24 || !/^[A-Za-z][A-Za-z0-9 ]*$/.test(val) || /  /.test(val)) {
                    this.showError(I18n.t('ui.fnc.hint'));
                    return;
                }
                this.clearError();
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = I18n.t('ui.fnc.checking');
                }
                post('fncSubmit', { nickname: val, name: val });
            };

            document.getElementById('fnc-form')?.addEventListener('submit', (event) => {
                event.preventDefault();
                doSubmit();
            });
            inputField?.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
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
            if (this.resetSubmit) this.resetSubmit();
            this.clearError();
            root?.classList.remove('hidden');
        },

        showError(msg) {
            const box = document.getElementById('fnc-error-box');
            if (box) {
                box.textContent = msg;
                box.classList.remove('hidden');
            }
            if (this.resetSubmit) this.resetSubmit();
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
