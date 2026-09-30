(() => {
    'use strict';
    const post = (name, data = {}) => fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => {});

    const FncUI = {
        active: false,
        tokens: 0,
        currentName: '',

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
                            <h2 class="fnc-title">FREE NAME CHANGE</h2>
                            <p class="fnc-subtitle">Alege-ți noul nume de caracter</p>
                        </div>
                    </div>
                    <div class="fnc-body">
                        <div class="fnc-info-row">
                            <span class="fnc-label">Nume Curent:</span>
                            <span class="fnc-val" id="fnc-current-name">Player</span>
                        </div>
                        <div class="fnc-field-group">
                            <label for="fnc-input-name" class="fnc-input-label">Nume Nou (Format: Prenume Nume sau Prenume_Nume)</label>
                            <div class="fnc-input-wrap">
                                <i class="ph-bold ph-user fnc-input-icon"></i>
                                <input type="text" id="fnc-input-name" class="fnc-input" placeholder="ex: Alexandru_Popa" maxlength="24" autocomplete="off" spellcheck="false" />
                            </div>
                            <div class="fnc-hint" id="fnc-hint-text">Minim 2 caractere pentru prenume și nume. Fără caractere speciale.</div>
                            <div class="fnc-error-msg hidden" id="fnc-error-box"></div>
                        </div>
                    </div>
                    <div class="fnc-actions">
                        <button type="button" class="fnc-btn fnc-btn-cancel" id="fnc-btn-cancel"><i class="ph-bold ph-x"></i> Anulează</button>
                        <button type="button" class="fnc-btn fnc-btn-confirm" id="fnc-btn-submit"><i class="ph-bold ph-check"></i> Schimbă Numele</button>
                    </div>
                </div>
            `;
            document.body.appendChild(wrap);

            document.getElementById('fnc-btn-cancel')?.addEventListener('click', () => this.hide());
            document.querySelector('#fnc-modal-root .fnc-backdrop')?.addEventListener('click', () => this.hide());

            const submitBtn = document.getElementById('fnc-btn-submit');
            const inputField = document.getElementById('fnc-input-name');

            const doSubmit = () => {
                const val = inputField?.value?.trim() || '';
                if (!val) {
                    this.showError('Te rugăm să introduci un nume valid!');
                    return;
                }
                const match = val.match(/^([a-zA-Z0-9]+)[_\s]+([a-zA-Z0-9]+)$/);
                if (!match || match[1].length < 2 || match[2].length < 2) {
                    this.showError('Format invalid! Exemplu corect: Andrei_Popa sau Andrei Popa (minim 2 litere fiecare).');
                    return;
                }
                this.clearError();
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Se verifică...';
                }
                post('fncSubmit', { name: val }).then(() => {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="ph-bold ph-check"></i> Schimbă Numele';
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
                    this.hide();
                }
            });
        },

        show(data) {
            this.ensureDom();
            this.active = true;
            this.currentName = data?.currentName || 'Player';
            this.tokens = data?.tokens || 1;

            const root = document.getElementById('fnc-modal-root');
            const curEl = document.getElementById('fnc-current-name');
            const inputField = document.getElementById('fnc-input-name');
            if (curEl) curEl.textContent = this.currentName;
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
            FncUI.showError(data?.error || 'Eroare la schimbarea numelui.');
        } else if (action === 'sessionForceClose') {
            FncUI.hide();
        }
    });
})();
