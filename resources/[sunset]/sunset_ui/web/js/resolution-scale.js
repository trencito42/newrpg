/* Canonical NUI resolution scale.
   Reference is 1920x1080. The limiting axis wins, so ultrawide
   stays tied to height. User preference multiplies the result
   and is clamped to 80%–125%. Standalone NUI pages load this
   same file; CSS variables do not cross resource documents. */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ResolutionScale = api;
    if (typeof document !== 'undefined' && typeof window !== 'undefined') install(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    var REF_W = 1920;
    var REF_H = 1080;
    var MIN_SCALE = 0.67;
    var MAX_SCALE = 2;
    var USER_MIN = 0.8;
    var USER_MAX = 1.25;
    var USER_PRESETS = [0.8, 0.9, 1, 1.1, 1.2, 1.25];

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function resolutionScale(width, height) {
        var w = Number(width);
        var h = Number(height);
        if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return 1;
        return clamp(Math.min(w / REF_W, h / REF_H), MIN_SCALE, MAX_SCALE);
    }

    function userScale(value) {
        var n = Number(value);
        if (!isFinite(n)) return 1;
        return clamp(n, USER_MIN, USER_MAX);
    }

    function finalScale(width, height, preference) {
        return resolutionScale(width, height) * userScale(preference);
    }

    /* Phone keeps a 340x720 layout and scales as one device.
       Fit stops it leaving the screen; target matches the reference. */
    function phoneScale(width, height, preference) {
        var target = finalScale(width, height, preference);
        var fit = (Number(height) - 36) / 720;
        if (!isFinite(fit) || fit <= 0) return target;
        return Math.min(target, fit);
    }

    return {
        REF_W: REF_W,
        REF_H: REF_H,
        MIN_SCALE: MIN_SCALE,
        MAX_SCALE: MAX_SCALE,
        USER_MIN: USER_MIN,
        USER_MAX: USER_MAX,
        USER_PRESETS: USER_PRESETS,
        resolutionScale: resolutionScale,
        userScale: userScale,
        finalScale: finalScale,
        phoneScale: phoneScale,
    };
});

function install(api) {
    var KEY = 'racket.uiScale';
    var frame = 0;

    function readUser() {
        try {
            return api.userScale(window.localStorage.getItem(KEY) || '1');
        } catch (err) {
            return 1;
        }
    }

    function apply() {
        var width = window.innerWidth;
        var height = window.innerHeight;
        var preference = readUser();
        var resolution = api.resolutionScale(width, height);
        var finalValue = resolution * preference;
        var node = document.documentElement;
        node.style.setProperty('--ui-resolution-scale', resolution.toFixed(4));
        node.style.setProperty('--ui-user-scale', preference.toFixed(4));
        node.style.setProperty('--ui-scale', finalValue.toFixed(4));
        node.style.setProperty('--ui-ref-width', String(api.REF_W));
        node.style.setProperty('--ui-ref-height', String(api.REF_H));
    }

    function schedule() {
        if (frame) return;
        frame = window.requestAnimationFrame(function () {
            frame = 0;
            apply();
        });
    }

    api.setUserScale = function (value) {
        var next = api.userScale(value);
        try { window.localStorage.setItem(KEY, String(next)); } catch (err) {}
        apply();
        return next;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
        apply();
    }
    window.addEventListener('resize', schedule);
}
