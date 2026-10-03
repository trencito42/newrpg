/* ═══════════════════════════════════════════════════════════════
   SUNSETMP — Change Password Modal Controller (js/changepass.js)
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    let isModalOpen = false;

    function getElements() {
        return {
            modal: document.getElementById('changepass-modal'),
            form: document.getElementById('changepass-form'),
            oldPass: document.getElementById('cp-old-pass'),
            newPass: document.getElementById('cp-new-pass'),
            confirmPass: document.getElementById('cp-confirm-pass'),
            feedback: document.getElementById('cp-feedback'),
            submitBtn: document.getElementById('changepass-submit'),
            cancelBtn: document.getElementById('changepass-cancel'),
            closeBtn: document.getElementById('changepass-close'),
        };
    }

    function showFeedback(message, type = 'error') {
        const els = getElements();
        if (!els.feedback) return;
        els.feedback.textContent = message;
        els.feedback.className = `changepass-feedback ${type}`;
        els.feedback.classList.remove('hidden');
    }

    function clearFeedback() {
        const els = getElements();
        if (!els.feedback) return;
        els.feedback.textContent = '';
        els.feedback.className = 'changepass-feedback hidden';
    }

    function openModal() {
        const els = getElements();
        if (!els.modal) return;

        isModalOpen = true;
        clearFeedback();
        if (els.form) els.form.reset();

        els.modal.classList.remove('hidden');
        els.modal.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            if (els.oldPass) els.oldPass.focus();
        }, 100);
    }

    function closeModal() {
        const els = getElements();
        if (!els.modal) return;

        isModalOpen = false;
        els.modal.classList.add('hidden');
        els.modal.setAttribute('aria-hidden', 'true');
        clearFeedback();
        if (els.form) els.form.reset();

        try {
            fetch('https://sunset_ui/closeChangePassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }).catch(() => {});
        } catch (_) {}
    }

    function setupEventListeners() {
        const els = getElements();
        if (!els.modal) return;

        if (els.closeBtn) els.closeBtn.addEventListener('click', closeModal);
        if (els.cancelBtn) els.cancelBtn.addEventListener('click', closeModal);

        // Toggle password view
        document.querySelectorAll('.cp-toggle-pass').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;

                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';

                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = isPassword ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye';
                }
            });
        });

        if (els.form) {
            els.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearFeedback();

                const oldPassword = els.oldPass ? els.oldPass.value.trim() : '';
                const newPassword = els.newPass ? els.newPass.value.trim() : '';
                const confirmPassword = els.confirmPass ? els.confirmPass.value.trim() : '';

                if (!oldPassword) {
                    showFeedback(I18n.t('interface.enter_your_current_password_2'), 'error');
                    return;
                }

                if (!newPassword || newPassword.length < 6) {
                    showFeedback(I18n.t('interface.the_new_password_must_contain_at_least_6_characters'), 'error');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    showFeedback(I18n.t('ui.change_password.mismatch'), 'error');
                    return;
                }

                if (els.submitBtn) {
                    els.submitBtn.disabled = true;
                    const btnText = els.submitBtn.querySelector('.cp-btn-text');
                    if (btnText) btnText.textContent = I18n.t('interface.processing');
                }

                try {
                    const response = await fetch('https://sunset_ui/changePasswordSubmit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            oldPassword,
                            newPassword,
                            confirmPassword,
                        }),
                    });

                    const res = await response.json();
                    if (res && res.success) {
                        showFeedback(res.message || I18n.t('ui.change_password.success'), 'success');
                        setTimeout(() => {
                            closeModal();
                        }, 1800);
                    } else {
                        showFeedback(res && res.message ? res.message : I18n.t('interface.could_not_change_the_password'), 'error');
                    }
                } catch (err) {
                    showFeedback(I18n.t('ui.change_password.connection_error'), 'error');
                } finally {
                    if (els.submitBtn) {
                        els.submitBtn.disabled = false;
                        const btnText = els.submitBtn.querySelector('.cp-btn-text');
                        if (btnText) btnText.textContent = I18n.t('interface.save_password');
                    }
                }
            });
        }

        // Handle Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                closeModal();
            }
        });
    }

    // Message listener from Lua
    window.addEventListener('message', (event) => {
        const item = event.data;
        if (!item || !item.action) return;

        if (item.action === 'openChangePassword') {
            openModal();
        } else if (item.action === 'closeChangePassword') {
            closeModal();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
})();
