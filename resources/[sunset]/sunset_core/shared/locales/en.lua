-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — English locale (shared/locales/en.lua)
--  Add player-facing strings here; use Sunset.T('key', ...) to look up.
-- ═══════════════════════════════════════════════════════════════

Sunset = Sunset or {}
Sunset.Locales = Sunset.Locales or {}

Sunset.Locales['en'] = {
    -- General
    ['not_near_location']          = 'You are not near a valid location.',
    ['action_cooldown']            = 'This action is on cooldown. Please wait.',
    ['no_character']               = 'You do not have an active character.',
    ['invalid_target']             = 'Invalid target player.',
    ['admin_only']                 = 'This command is only available to administrators.',
    ['staff_only']                 = 'This command is available only for staff (admins and helpers).',
    ['insufficient_funds']         = 'You do not have enough money.',
    ['permission_denied']          = 'You do not have permission to do that.',

    -- Spawn / respawn
    ['spawn_failed_fallback']      = 'Could not stream your spawn location. Placed at a safe fallback.',
    ['spawn_collision_timeout']    = 'World loading timed out — you may see missing ground briefly.',

    -- Properties
    ['property_already_entering']  = 'You are already entering or inside a property.',
    ['property_already_exiting']   = 'You are already leaving this property.',
    ['property_enter_failed']      = 'Could not load the interior. Try again.',
    ['property_exit_failed']       = 'Could not load the exterior. Try again.',
    ['property_not_inside']        = 'You are not inside a house.',
    ['property_locked']            = 'This property is locked.',
    ['property_no_access']         = 'You do not have access to this property.',
    ['property_buy_success']       = 'Property purchased successfully.',
    ['property_buy_failed']        = 'Could not complete the purchase.',
    ['property_sold']              = 'Property sold successfully.',
    ['property_rent_started']      = 'You are now renting this property.',
    ['property_rent_ended']        = 'Your rental has ended.',
    ['property_rent_paid']         = 'Rent of $%d paid.',
    ['property_rent_due']          = 'Your rent of $%d is due. Pay at the property.',
    ['property_locked_toggle']     = 'Property %s.',

    -- Detention
    ['detention_cuffed']           = 'You have been handcuffed.',
    ['detention_uncuffed']         = 'You have been released from handcuffs.',
    ['detention_jailed']           = 'You have been sent to jail for %d minutes.',
    ['detention_released']         = 'You have been released from jail.',
    ['detention_jail_time_left']   = 'Jail time remaining: %d minute(s).',

    -- Jobs
    ['job_started']                = '%s job started.',
    ['job_ended']                  = '%s job ended.',
    ['job_not_active']             = 'You do not have an active job.',
    ['job_paid']                   = 'You received $%d for your work.',

    -- Chat / notifications
    ['muted']                      = 'You have been muted for %d minutes. Reason: %s.',
    ['unmuted']                    = 'You have been unmuted.',
    ['pm_sent_to']                 = 'PM sent to %s',
    ['pm_received_from']           = 'PM from %s',

    -- Admin
    ['teleported_by_admin']        = 'You were teleported by an administrator.',
    ['money_given']                = 'You received $%d from an administrator.',
    ['fnc_forced']                 = 'Admin %s has forced you to change your name (FNC)! Reason: %s. Choose a new name.',
    ['fnc_name_changed']           = 'Your name has been successfully changed to %s!',
    ['fnc_name_taken']             = 'This name is already taken by another player! Please choose a different name.',
    ['fnc_name_invalid']           = 'Name may only contain letters, digits, dots and hyphens (e.g. diablo69, alex.ro, Viper_99)!',
    ['fnc_name_length']            = 'Name must be between 3 and 24 characters!',
    ['warn_received']              = 'You received a warning from %s. Reason: %s (%d/3).',
    ['auto_banned_warns']          = 'Player %s has been account banned (7 days) for accumulating 3/3 warns.',

    -- Turfs
    ['turf_not_adjacent']          = 'You cannot attack this territory! It must be adjacent to territories already owned by your gang.',
    ['turf_war_started']           = 'Territory war started at %s!',
    ['turf_war_won']               = 'Your gang has captured %s!',
    ['turf_war_lost']              = 'Your gang lost the battle for %s.',

    -- CNN ads
    ['cnn_ad_help']                = 'Type ~/g~/ad [text]~s~ to publish a CNN announcement ($%d).',
}
