/* Public asset-link payload. Untrusted strings stay strings; unknown fields are dropped. */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.AssetPublic = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TYPES = { item: true, vehicle: true, property: true, business: true };
    const META = { durability: true, ammo: true, liters: true, fishKg: true };

    function clip(value, max) {
        const text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
        return text.length > max ? text.slice(0, max) : text;
    }

    function key(value) {
        const text = clip(value, 40).toLowerCase();
        return /^[a-z0-9_]+$/.test(text) ? text : '';
    }

    function num(value, min, max, floor) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < min || n > max) return null;
        return floor ? Math.floor(n) : n;
    }

    function sanitize(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        if (!TYPES[raw.type]) return null;
        const assetId = clip(raw.assetId != null ? raw.assetId : raw.id, 64);
        if (!assetId) return null;
        const out = {
            type: raw.type,
            assetId,
            label: clip(raw.label, 80),
            displayName: clip(raw.displayName, 64),
            plate: clip(raw.plate, 12),
            area: clip(raw.area, 80),
            item: key(raw.item),
            icon: key(raw.icon),
            imageModel: key(raw.imageModel),
            description: clip(raw.description, 180),
            businessType: clip(raw.businessType, 32),
            category: clip(raw.category, 24),
            ownerName: clip(raw.ownerName, 32),
            listingStatus: clip(raw.listingStatus, 16),
            contactPhone: clip(raw.contactPhone, 20).replace(/[^0-9+()\- ]/g, ''),
        };
        const quantity = num(raw.quantity, 1, 100000, true);
        const mileage = num(raw.mileage, 0, 99999999, true);
        const condition = num(raw.condition, 0, 100, true);
        const price = num(raw.price, 0, 100000000, true);
        const listingId = num(raw.listingId, 1, 2000000000, true);
        if (quantity != null) out.quantity = quantity;
        if (mileage != null) out.mileage = mileage;
        if (condition != null) out.condition = condition;
        if (price != null) out.price = price;
        if (listingId != null) out.listingId = listingId;
        if (raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)) {
            const meta = {};
            Object.keys(META).forEach((name) => {
                const value = num(raw.meta[name], -1000000, 1000000, false);
                if (value != null) meta[name] = value;
            });
            if (Object.keys(meta).length) out.meta = meta;
        }
        return out;
    }

    function chipText(raw) {
        const asset = sanitize(raw);
        if (!asset) return '';
        if (asset.type === 'vehicle') {
            return [asset.displayName || asset.label, asset.plate].filter(Boolean).join(' · ');
        }
        if (asset.type === 'item') {
            const name = asset.label || asset.item || '';
            return asset.quantity > 1 ? `${name} ×${asset.quantity}` : name;
        }
        return asset.label || asset.displayName || '';
    }

    function listingBanner(status) {
        if (status === 'active') return 'active';
        if (status === 'sold') return 'sold';
        if (status === 'expired' || status === 'cancelled') return 'expired';
        return 'unavailable';
    }

    function codePoints(text) {
        return Array.from(String(text ?? ''));
    }

    function codePointLength(text) {
        return codePoints(text).length;
    }

    function clampIndex(text, index) {
        const len = codePointLength(text);
        const n = Math.floor(Number(index));
        if (!Number.isFinite(n) || n < 0) return 0;
        return n > len ? len : n;
    }

    function splitAt(text, index) {
        const chars = codePoints(text);
        const at = clampIndex(text, index);
        return { before: chars.slice(0, at).join(''), after: chars.slice(at).join('') };
    }

    function commandBody(text, index) {
        const raw = String(text ?? '');
        const match = raw.match(/^(\/\S+\s+)([\s\S]*)$/);
        if (!match) return { text: raw, index: clampIndex(raw, index) };
        const prefix = codePointLength(match[1]);
        return {
            text: match[2],
            index: clampIndex(match[2], (Number(index) || 0) - prefix),
        };
    }

    function renderRichText(parent, options) {
        if (!parent || typeof document === 'undefined') return;
        const spec = options || {};
        const asset = sanitize(spec.attachment);
        const label = chipText(asset);
        const parts = splitAt(spec.text || '', spec.attachmentIndex);
        parent.textContent = '';
        parent.appendChild(document.createTextNode(parts.before));
        if (asset && label) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chat-asset-chip';
            chip.dataset.type = asset.type;
            chip.textContent = label;
            chip.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof spec.onOpen === 'function') spec.onOpen(asset, chip);
            });
            parent.appendChild(chip);
        }
        parent.appendChild(document.createTextNode(parts.after));
    }

    function promotionAllowed(existing, nowSec, cooldownSec) {
        if (!existing) return true;
        if (existing.status === 'pending' || existing.status === 'approved') return false;
        if (existing.status === 'published') {
            const published = Number(existing.publishedAt) || 0;
            return (Number(nowSec) || 0) - published >= (Number(cooldownSec) || 0);
        }
        return true;
    }

    return {
        sanitize, chipText, listingBanner, promotionAllowed,
        codePointLength, clampIndex, splitAt, commandBody, renderRichText,
    };
});
