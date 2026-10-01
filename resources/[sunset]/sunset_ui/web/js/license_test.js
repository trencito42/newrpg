const LicenseTestHud = {
    _metaLine(data = {}) {
        const parts = [];
        if (data.step != null && data.total) parts.push(I18n.t('ui.licenses.step_of', { step: data.step, total: data.total }));
        if (data.checkpoints) parts.push(I18n.t('ui.licenses.checkpoint_of', { current: data.checkpoint ?? 0, total: data.checkpoints }));
        if (data.penalties !== undefined && data.maxPenalties !== undefined) {
            parts.push(I18n.t('ui.licenses.penalties_of', { current: data.penalties, max: data.maxPenalties }));
        } else if (data.collisions !== undefined && data.maxCollisions !== undefined) {
            parts.push(I18n.t('ui.licenses.hits_of', { current: data.collisions, max: data.maxCollisions }));
        }
        if (data.speed !== undefined && data.speedLimit !== undefined) {
            parts.push(`${data.speed}/${data.speedLimit} km/h`);
        }
        if (data.timeLeftSec != null) {
            const left = Math.max(0, Number(data.timeLeftSec) || 0);
            const m = Math.floor(left / 60);
            const s = left % 60;
            parts.push(I18n.t('ui.licenses.time_left', { time: `${m}:${String(s).padStart(2, '0')}` }));
        }
        return parts.join(' · ') || (data.meta || '');
    },

    // The server sends these warnings localized; match both languages.
    _isWarningMessage(message) {
        return /^(REDUCE SPEED|PENALTY|REDUCE VITEZA|PENALIZARE)/i.test(String(message || ''));
    },

    _tone(data = {}) {
        if (data.state === 'warning') return 'danger';
        if (this._isWarningMessage(data.message)) {
            return 'danger';
        }
        if (data.state === 'success') return 'success';
        return 'default';
    },

    _title(data = {}) {
        if (data.licenseType === 'driver') return I18n.t('ui.licenses.driving_test_title');
        return (data.title || I18n.t('ui.licenses.license_test')).toUpperCase();
    },

    show(data = {}) {
        if (!window.Hud) return;
        const plainMessage = data.state === 'warning'
            || this._isWarningMessage(data.message);
        Hud.showTask({
            icon: data.licenseType === 'driver' ? 'driver' : 'license',
            title: this._title(data),
            message: data.message || I18n.t('ui.licenses.follow_examiner'),
            plainDesc: plainMessage,
            progress: data.progress,
            progressText: this._metaLine(data),
            tone: this._tone(data),
            licenseType: data.licenseType,
        });
    },

    update(data = {}) {
        this.show(data);
    },

    hide() {
        if (window.Hud) Hud.hideTask();
    },
};

window.LicenseTestHud = LicenseTestHud;
