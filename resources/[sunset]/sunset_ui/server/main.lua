-- [AUDIT NUI-ERR] Receive NUI JS error reports forwarded by the client.
-- Logs to server console so staff see them without needing access to a player's F8.
RegisterNetEvent('sunset:server:nuiError', function(errType, message, source, lineno)
    local src = tostring(tonumber(GetInvokingResource()) or source or '?')
    local player = GetPlayerName(src) or 'unknown'
    print(('^1[NUI-ERROR src=%s (%s) type=%s line=%s]^7 %s'):format(
        src, player, tostring(errType), tostring(lineno), tostring(message):sub(1, 300)))
end)
