exports.sunset_core:RegisterCallback('sunset:world:canUseFactionLift', function(source, factionId)
    factionId = tostring(factionId or '')
    if factionId == '' then return false end

    -- [SEC3] removed Player(source).state.sunsetFaction trust: state bags are client-writable
    -- (sv_stateBagStrictMode=false), so any player could unlock faction lifts. Server character data only.
    if #factionId > 64 then return false end

    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false end

    local md = char.metadata or {}
    if md.faction == factionId then return true end
    if char.job == factionId then return true end

    return false
end)
