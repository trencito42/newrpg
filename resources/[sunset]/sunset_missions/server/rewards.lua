local Cfg = SunsetMissions.Config

function MSN_CalculateReward(session, conditionPct, escaped)
    local def     = SunsetMissions.GetMission(session.mission)
    local base    = math.random(def.rewards.min, def.rewards.max)
    local total   = base
    local details = { base = base, conditionBonus = 0, escapeBonus = 0, reputationBonus = 0 }

    -- condition 0-100 → up to +20% base
    local condBonus = math.floor(base * Cfg.conditionBonusMax * (math.max(0, math.min(100, conditionPct)) / 100.0))
    total = total + condBonus
    details.conditionBonus = condBonus

    -- escape bonus only when client explicitly reports escape AND pursuit was a thing
    if escaped == true then
        local escBonus = math.floor(base * Cfg.escapeBonus)
        total = total + escBonus
        details.escapeBonus = escBonus
    end

    local char = exports.sunset_core:GetCharacter(session.player)
    if char then
        local rep     = MSN_GetReputation(char.id, def.contact)
        local repFrac = math.min(rep / 500.0, 1.0)
        local repBonus = math.floor(base * Cfg.reputationBonusMax * repFrac)
        total = total + repBonus
        details.reputationBonus = repBonus
    end

    details.total = total
    return total, details
end

function MSN_PayReward(source, session, conditionPct, escaped)
    local total, details = MSN_CalculateReward(session, conditionPct, escaped)
    local def  = SunsetMissions.GetMission(session.mission)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return 0, details end

    exports.sunset_core:AddMoney(source, 'cash', total, 'mission_' .. session.mission)
    MSN_AddReputation(char.id, def.contact, 25)
    MSN_SetCooldown(char.id, session.mission)
    MSN_EndSession(source, 'complete', total, details)
    return total, details
end
