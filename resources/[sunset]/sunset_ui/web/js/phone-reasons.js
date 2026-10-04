/* Canonical bank-history reasons.
   Stable ids map to phone.ui.reason_<id>. Human legacy strings use ALIASES.
   Unknown free text is shown sanitized and never sent to I18n.t(). */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PhoneReasons = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const ALIASES = {
        'cnn ad submission': 'cnn_ad_submission',
        'dyno cancelled refund': 'dyno_cancelled_refund',
        'dyno error refund': 'dyno_error_refund',
        'dyno run': 'dyno_run',
        'lucky wheel prize': 'lucky_wheel_prize',
    };

    const CANONICAL_IDS = [
        'admin_givemoney', 'appearance', 'appearance_refund', 'arrest_bounty',
        'bait_shop', 'bait_shop_refund', 'bank_transfer', 'boat_rental', 'boat_rental_refund',
        'busdriver_fare', 'busdriver_route_bonus', 'business_withdraw', 'buy_level',
        'carjack_sale', 'casino_bar', 'casino_bar_refund', 'casino_buy_chips',
        'casino_buy_chips_refund', 'casino_sell_chips', 'clan_extend_lifetime', 'clan_upgrade_slots',
        'cnn_ad_submission', 'courier_delivery', 'dice_refund', 'dice_wager', 'dice_win',
        'diver_contract_complete', 'diver_sell', 'dyno_cancelled_refund', 'dyno_error_refund', 'dyno_run',
        'ecu_tune_refund', 'ecu_tune_save', 'event_reward', 'fence', 'fence_sale', 'fire_incident',
        'fish_sell_247', 'fish_sell_247_retry', 'fish_sell_legacy', 'fish_sell_legacy_retry',
        'fishing_tournament_reward', 'fuel_pump', 'garbage_bin', 'garbage_unload',
        'gear_rental', 'gear_rental_refund', 'hospital', 'house_rent_income', 'house_sale',
        'hunter_contract_complete', 'hunter_sell', 'illegal_sale', 'impound_fee',
        'job', 'license_exam', 'license_exam_refund', 'ls_customs_repair', 'lucky_wheel_prize',
        'market_buy', 'market_fee', 'market_sale', 'marriage_divorce', 'marriage_proposal',
        'marriage_refund', 'mechanic_repair', 'mission', 'player_transfer_rollback',
        'property_purchase', 'property_rent', 'purchase', 'quest',
        'quest_chop', 'quest_clan_join', 'quest_clan_store', 'quest_clan_war', 'quest_clothing',
        'quest_contact', 'quest_dedication', 'quest_faction', 'quest_first_car', 'quest_first_shift',
        'quest_garage_park', 'quest_hunt_contracts', 'quest_hunt_range', 'quest_jobcenter',
        'quest_license_driver', 'quest_lockpick_practice', 'quest_mechanic_repairs',
        'quest_onboarding_atm', 'quest_onboarding_guide', 'quest_onboarding_store',
        'quest_reach_level10', 'quest_rental', 'quest_rental_drive', 'quest_required',
        'quest_robbery', 'quest_skill_tier', 'quest_trade', 'quest_trucker_shifts',
        'race_entry', 'race_night_reward', 'race_prize', 'race_prize_retry', 'race_refund',
        'race_refund_disconnect', 'race_refund_dnf', 'race_refund_restart',
        'race_solo_entry', 'race_solo_reward', 'race_solo_reward_retry', 'radar_fine',
        'refund_vehicle_insurance_claim', 'refund_vehicle_insurance_renew',
        'rod_upgrade', 'rod_upgrade_refund', 'salary', 'sale', 'shop', 'shop_refund',
        'skin_shop', 'street_drug_sale', 'sunset_pass', 'taxi', 'taxi_fare', 'taxi_ride',
        'taxi_ride_refund', 'taxi_ride_retry', 'taxi_tip', 'taxi_tip_refund', 'ticket',
        'trucker_delivery', 'trucker_trailer_loss', 'turf_loadout', 'turf_payout',
        'vehicle_insurance_claim', 'vehicle_insurance_renew', 'vehicle_rental', 'vehicle_rental_refund',
        'atm_deposit', 'atm_withdraw',
    ];

    function sanitize(reason) {
        return String(reason || '')
            .replace(/<[^>]*>/g, '')
            .replace(/[<>]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
    }

    function canonical(reason) {
        const raw = sanitize(reason);
        if (!raw) return '';
        const alias = ALIASES[raw.toLowerCase()];
        if (alias) return alias;
        const refund = raw.match(/^refund:([a-z][a-z0-9_]*)$/);
        if (refund) return 'refund_' + refund[1];
        if (/^[a-z][a-z0-9_]*$/.test(raw)) return raw;
        return '';
    }

    function display(reason, i18n) {
        const raw = sanitize(reason);
        if (!raw) return '';
        const has = i18n && typeof i18n.has === 'function' ? i18n.has : () => false;
        const translate = i18n && typeof i18n.t === 'function' ? i18n.t : (key) => key;
        const id = canonical(raw);
        if (!id) return raw;
        const specific = 'phone.ui.reason_' + id;
        if (has(specific)) return translate(specific);
        const prefix = id.match(/^(quest|job|mission)_/);
        if (prefix) {
            const generic = 'phone.ui.reason_' + prefix[1];
            if (has(generic)) return translate(generic);
        }
        return raw;
    }

    return { sanitize, canonical, display, CANONICAL_IDS, ALIASES };
});
