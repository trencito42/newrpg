-- chat_log.lua — central player chat log writer (table owner: sunset_chat).
-- Retention: CHAT_LOG_RETENTION_DAYS convar (default 90). Purged rows are not recoverable;
-- this is operational moderation history, not legal hold / evidence vault.

ChatLog = ChatLog or {}

local DEFAULT_RETENTION_DAYS = 90
local BATCH_DELETE_LIMIT = 2000

function ChatLog.retentionDays()
    local n = tonumber(GetConvar('CHAT_LOG_RETENTION_DAYS', tostring(DEFAULT_RETENTION_DAYS)))
    if not n or n < 1 then return DEFAULT_RETENTION_DAYS end
    return math.floor(n)
end

local function resolveAccountId(char)
    if type(char) ~= 'table' then return nil end
    if char.account_id then return tonumber(char.account_id) end
    local playerId = tonumber(char.player_id)
    if not playerId then return nil end
    local ok, row = pcall(function()
        return MySQL.single.await('SELECT account_id FROM players WHERE id = ? LIMIT 1', { playerId })
    end)
    if ok and type(row) == 'table' then return tonumber(row.account_id) end
    return nil
end

local function snapshotFromSource(source)
    if not source or source == 0 then return nil end
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(source) end)
    if not ok or type(char) ~= 'table' or not char.id then return nil end
    local name = nil
    pcall(function() name = exports.sunset_core:GetPlayerBaseName(source) end)
    if not name or name == '' then name = GetPlayerName(source) or 'Player' end
    return {
        character_id = tonumber(char.id),
        account_id = resolveAccountId(char),
        player_name_snapshot = tostring(name):sub(1, 128),
        faction_id = select(1, Sunset.GetCharacterFaction(char)),
        clan_id = nil,
    }
end

local function resolveClanId(_source, charId)
    if not charId then return nil end
    local ok2, row = pcall(function()
        return MySQL.scalar.await('SELECT clan_id FROM clan_members WHERE character_id = ? LIMIT 1', { charId })
    end)
    if ok2 then return tonumber(row) end
    return nil
end

local function encodeMetadata(meta)
    if type(meta) ~= 'table' or next(meta) == nil then return nil end
    local ok, encoded = pcall(json.encode, meta)
    if ok and type(encoded) == 'string' then return encoded end
    return nil
end

--- @param opts table|number legacy: source as first arg
function ChatLog.record(sourceOrOpts, message, channelType, status, extra)
    local opts = sourceOrOpts
    if type(sourceOrOpts) == 'number' then
        opts = {
            source = sourceOrOpts,
            message = message,
            channelType = channelType,
            status = status or 'sent',
            extra = extra,
        }
    end
    if type(opts) ~= 'table' then return end

    local msg = tostring(opts.message or '')
    if msg == '' then return end
    msg = msg:sub(1, 4000)
    local channel = tostring(opts.channelType or opts.channel_type or 'unknown'):sub(1, 32)
    local st = (opts.status == 'blocked') and 'blocked' or 'sent'
    local meta = opts.metadata or opts.extra

    local characterId = tonumber(opts.characterId or opts.character_id)
    local accountId = tonumber(opts.accountId or opts.account_id)
    local playerName = opts.playerName or opts.player_name_snapshot
    local factionId = opts.factionId or opts.faction_id
    local clanId = tonumber(opts.clanId or opts.clan_id)
    local targetCharacterId = tonumber(opts.targetCharacterId or opts.target_character_id)
    local targetName = opts.targetName or opts.target_name_snapshot

    if not characterId and opts.source and opts.source > 0 then
        local snap = snapshotFromSource(opts.source)
        if not snap then return end
        characterId = snap.character_id
        accountId = accountId or snap.account_id
        playerName = playerName or snap.player_name_snapshot
        if not factionId and snap.faction_id and snap.faction_id ~= '' and snap.faction_id ~= 'unemployed' then
            factionId = snap.faction_id
        end
    end
    if not characterId then return end
    playerName = tostring(playerName or 'Unknown'):sub(1, 128)
    if factionId == '' or factionId == 'unemployed' then factionId = nil end
    if factionId then factionId = tostring(factionId):sub(1, 64) end
    if not clanId then
        clanId = resolveClanId(opts.source, characterId)
    end
    if targetName then targetName = tostring(targetName):sub(1, 128) end

    local metadataJson = encodeMetadata(meta)
    CreateThread(function()
        pcall(function()
            MySQL.insert.await([[
                INSERT INTO chat_logs
                    (character_id, account_id, player_name_snapshot, message, channel_type,
                     faction_id, clan_id, target_character_id, target_name_snapshot, status, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ]], {
                characterId,
                accountId,
                playerName,
                msg,
                channel,
                factionId,
                clanId,
                targetCharacterId,
                targetName,
                st,
                metadataJson,
            })
        end)
    end)
end

exports('LogChatMessage', ChatLog.record)

CreateThread(function()
    Wait(120000)
    while true do
        local days = ChatLog.retentionDays()
        for _ = 1, 20 do
            local ok, n = pcall(function()
                return MySQL.update.await(
                    'DELETE FROM chat_logs WHERE created_at < (NOW() - INTERVAL ? DAY) LIMIT ?',
                    { days, BATCH_DELETE_LIMIT }
                )
            end)
            if not ok or (tonumber(n) or 0) < BATCH_DELETE_LIMIT then break end
            Wait(1000)
        end
        Wait(6 * 3600 * 1000)
    end
end)
