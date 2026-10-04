/* Compact public asset card. Labels are text nodes. One card for chat, CNN, and market. */
(function () {
    'use strict';

    const Public = window.AssetPublic;
    let card = null;
    let current = null;

    function t(key, params) {
        return window.I18n?.t?.(key, params) || key;
    }

    function row(label, value) {
        const line = document.createElement('div');
        line.className = 'asset-preview__row';
        const name = document.createElement('span');
        name.textContent = label;
        const val = document.createElement('strong');
        val.textContent = value;
        line.append(name, val);
        return line;
    }

    function ensure() {
        if (card) return card;
        card = document.createElement('div');
        card.id = 'asset-preview';
        card.className = 'asset-preview hidden';
        card.setAttribute('role', 'dialog');
        card.addEventListener('click', (event) => event.stopPropagation());
        document.body.appendChild(card);
        document.addEventListener('click', () => close());
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
        return card;
    }

    function close() {
        current = null;
        card?.classList.add('hidden');
    }

    function statusLine(status) {
        const banner = Public?.listingBanner?.(status) || 'unavailable';
        if (banner === 'active') return null;
        if (banner === 'sold') return t('asset.listing_sold');
        if (banner === 'expired') return t('asset.listing_expired');
        return t('asset.unavailable');
    }

    function render(asset) {
        const node = ensure();
        node.textContent = '';
        const title = document.createElement('div');
        title.className = 'asset-preview__title';
        title.textContent = asset.displayName || asset.label || asset.item || '';
        node.appendChild(title);

        if (asset.type === 'vehicle' && asset.imageModel) {
            const img = document.createElement('img');
            img.className = 'asset-preview__thumb';
            img.alt = '';
            img.src = `assets/vehicles/${encodeURIComponent(asset.imageModel)}.webp`;
            img.addEventListener('error', () => img.remove());
            node.appendChild(img);
        } else if (asset.type === 'item' && asset.icon) {
            const img = document.createElement('img');
            img.className = 'asset-preview__thumb';
            img.alt = '';
            img.src = `assets/items/${encodeURIComponent(asset.icon)}.png`;
            img.addEventListener('error', () => img.remove());
            node.appendChild(img);
        }

        if (asset.type === 'vehicle') {
            if (asset.plate) node.appendChild(row(t('asset.plate'), asset.plate));
            if (asset.mileage != null) node.appendChild(row(t('asset.mileage'), t('asset.mileage_value', { km: window.I18n?.number?.(asset.mileage) || String(asset.mileage) })));
            if (asset.condition != null) node.appendChild(row(t('asset.condition'), `${asset.condition}%`));
            if (asset.category) node.appendChild(row(t('asset.class'), asset.category));
        } else if (asset.type === 'item') {
            if (asset.quantity) node.appendChild(row(t('asset.quantity'), String(asset.quantity)));
            if (asset.description) {
                const desc = document.createElement('p');
                desc.className = 'asset-preview__desc';
                desc.textContent = asset.description;
                node.appendChild(desc);
            }
            if (asset.meta) {
                Object.keys(asset.meta).forEach((key) => {
                    node.appendChild(row(key, String(asset.meta[key])));
                });
            }
        } else if (asset.type === 'property') {
            if (asset.area) node.appendChild(row(t('asset.location'), asset.area));
        } else if (asset.type === 'business') {
            if (asset.businessType) node.appendChild(row(t('asset.business_type'), asset.businessType));
        }
        if (asset.ownerName) node.appendChild(row(t('asset.owner'), asset.ownerName));
        if (asset.price != null && asset.listingStatus === 'active') {
            node.appendChild(row(t('asset.price'), `$${window.I18n?.number?.(asset.price) || asset.price}`));
        }
        const note = statusLine(asset.listingId ? asset.listingStatus : 'active');
        if (asset.listingId && note) {
            const line = document.createElement('div');
            line.className = 'asset-preview__note';
            line.dataset.role = 'listing-note';
            line.textContent = note;
            node.appendChild(line);
        }
        if (asset.contactPhone) {
            node.appendChild(row(t('asset.contact_seller'), asset.contactPhone));
        }
        if (asset.listingId && asset.listingStatus === 'active') {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'asset-preview__action';
            button.textContent = t('asset.view_market');
            button.addEventListener('click', () => {
                if (typeof window.post === 'function') window.post('assetViewListing', { listingId: asset.listingId });
            });
            node.appendChild(button);
        }
        node.classList.remove('hidden');
    }

    function open(raw, anchor) {
        const asset = Public?.sanitize?.(raw);
        if (!asset) return;
        current = asset;
        render(asset);
        if (anchor && card) {
            const rect = anchor.getBoundingClientRect();
            card.style.left = `${Math.max(8, rect.left)}px`;
            card.style.top = `${Math.min(window.innerHeight - 16, rect.bottom + 6)}px`;
        }
        if (asset.listingId && typeof window.post === 'function') {
            window.post('assetListingState', { listingId: asset.listingId });
        }
    }

    function applyStatus(payload) {
        if (!current || !card || Number(payload?.listingId) !== Number(current.listingId)) return;
        current.listingStatus = payload.status || current.listingStatus;
        render(current);
    }

    window.AssetPreview = { open, close, applyStatus };
})();
