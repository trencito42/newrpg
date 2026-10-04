-- Phone news feed: fetches official updates from the panel and records player reactions.

local PANEL_URL = 'http://127.0.0.1:3000'

local function httpGet(url, cb)
    PerformHttpRequest(url, function(statusCode, body)
        if statusCode == 200 then
            local ok, data = pcall(json.decode, body)
            cb(ok and type(data) == 'table' and data or nil)
        else
            cb(nil)
        end
    end, 'GET', '', { ['Accept'] = 'application/json' })
end

local function httpPost(url, payload, cb)
    PerformHttpRequest(url, function(statusCode, body)
        if statusCode == 200 or statusCode == 201 then
            local ok, data = pcall(json.decode, body)
            cb(ok and type(data) == 'table' and data or nil)
        else
            cb(nil)
        end
    end, 'POST', json.encode(payload), { ['Content-Type'] = 'application/json', ['Accept'] = 'application/json' })
end

exports.sunset_core:RegisterCallback('sunset:phoneGetUpdates', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    local result, done = nil, false
    httpGet(PANEL_URL .. '/api/phone/updates?character_id=' .. tostring(char.id), function(data)
        result = data
        done = true
    end)

    local deadline = GetGameTimer() + 6000
    while not done and GetGameTimer() < deadline do
        Wait(50)
    end

    return result or { updates = {} }
end)

exports.sunset_core:RegisterCallback('sunset:phoneReactUpdate', function(source, updateId, reaction)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    if not exports.sunset_core:RateLimit(source, 'phoneReactUpdate', 800) then
        return nil, { localeKey = 'phone.message.invalid_recipient_or_message' }
    end

    updateId = tonumber(updateId)
    reaction = tostring(reaction or '')
    if not updateId or (reaction ~= 'like' and reaction ~= 'dislike') then
        return nil, { code = 'invalid_params' }
    end

    local result, done = nil, false
    httpPost(PANEL_URL .. '/api/phone/updates/react', {
        update_id    = updateId,
        character_id = tonumber(char.id),
        reaction     = reaction,
    }, function(data)
        result = data
        done   = true
    end)

    local deadline = GetGameTimer() + 6000
    while not done and GetGameTimer() < deadline do
        Wait(50)
    end

    return result or { ok = false }
end)
