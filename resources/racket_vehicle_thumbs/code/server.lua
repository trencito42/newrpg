local cfg = RacketThumbs
local activeQueue = nil
local pendingCatalog = nil
local serial = 0
local advance

-- FiveM Lua sandbox restricts both io.open and io.popen for system paths.
-- ImageMagick detection runs in processor.js (Node.js) which has the fs permission.
-- Lua-side diagnostic just checks if the resource directory exists as a proxy.
local function findImageMagick()
    return 'detected via processor.js (Node.js)'
end

local function tell(source, message, kind)
    print(('[racket_vehicle_thumbs] %s'):format(message))
    if source and source > 0 and GetPlayerPing(source) > 0 then
        TriggerClientEvent('chat:addMessage', source, {
            color = kind == 'error' and { 255, 100, 100 } or { 215, 181, 88 },
            args = { 'VEH THUMBS', message },
        })
    end
end

local function allowed(source)
    if not source or source <= 0 then return false end
    if IsPlayerAceAllowed(source, 'racket.thumbs') then return true end
    if GetResourceState('sunset_admin') ~= 'started' then return false end
    local ok, result = pcall(function()
        return exports.sunset_admin:IsAdmin(source, cfg.MinAdminLevel)
    end)
    return ok and result == true
end

local function cleanModel(value)
    if type(value) ~= 'string' then return nil end
    local model = value:lower():match('^%s*(.-)%s*$')
    if #model < 1 or #model > 64 or not model:match('^[a-z0-9_]+$') then return nil end
    return model
end

local function newToken()
    serial = serial + 1
    return ('%x-%x-%x'):format(os.time(), GetGameTimer(), serial)
end

local function outputExists(model)
    local file = io.open(('@racket_vehicle_thumbs/%s/%s.png'):format(cfg.OutputDir, model), 'rb')
    if not file then return false end
    file:close()
    return true
end

local function clearQueue(message, kind)
    local queue = activeQueue
    activeQueue = nil
    if not queue then return end
    TriggerClientEvent('racket_thumbs:cleanup', queue.source)
    if message then tell(queue.source, message, kind) end
end

local function finishCurrent(success, detail)
    local queue = activeQueue
    if not queue then return end
    local item = queue.items[queue.index]
    if success then queue.success = queue.success + 1 else queue.failed = queue.failed + 1 end
    TriggerClientEvent('racket_thumbs:cleanup', queue.source, queue.token)
    tell(queue.source, ('[%d/%d] %s: %s'):format(
        queue.index, #queue.items, item, success and 'saved' or ('FAILED — ' .. tostring(detail or 'unknown error'))
    ), success and 'info' or 'error')
    queue.index = queue.index + 1
    queue.token = nil
    queue.stage = nil
    SetTimeout(350, function()
        if activeQueue == queue then advance() end
    end)
end

local function stageTimeout(queue, token, stage, milliseconds)
    SetTimeout(milliseconds, function()
        if activeQueue == queue and queue.token == token and queue.stage == stage then
            finishCurrent(false, stage .. ' timed out')
        end
    end)
end

advance = function()
    local queue = activeQueue
    if not queue then return end
    if GetPlayerPing(queue.source) <= 0 then
        clearQueue('Capture operator disconnected.', 'error')
        return
    end
    if queue.index > #queue.items then
        tell(queue.source, ('Finished: %d saved, %d failed, %d skipped.'):format(
            queue.success, queue.failed, queue.skipped
        ))
        activeQueue = nil
        return
    end
    local model = queue.items[queue.index]
    local token = newToken()
    queue.token = token
    queue.stage = 'prepare'
    tell(queue.source, ('[%d/%d] %s: preparing'):format(queue.index, #queue.items, model))
    TriggerClientEvent('racket_thumbs:begin', queue.source, token, model)
    stageTimeout(queue, token, 'prepare', cfg.ModelLoadTimeoutMs + cfg.SettleMs + cfg.BgSettleMs + 8000)
end

local function beginQueue(source, items, skipped)
    if activeQueue or pendingCatalog then
        tell(source, 'A thumbnail batch is already running.', 'error')
        return
    end
    if #items == 0 then
        tell(source, ('Nothing to capture (%d already present).'):format(skipped or 0))
        return
    end
    activeQueue = { source = source, items = items, index = 1, token = nil,
        stage = nil, success = 0, failed = 0, skipped = skipped or 0 }
    tell(source, ('Queued %d vehicles (%d skipped).'):format(#items, skipped or 0))
    advance()
end

local function fetchCatalogModels()
    local found = {}
    -- Live dealership entries and owned vehicles are the existing source of truth.
    local ok, rows = pcall(function()
        return MySQL.query.await('SELECT model FROM dealership_vehicles UNION SELECT DISTINCT model FROM vehicles')
    end)
    if ok and type(rows) == 'table' then
        for _, row in ipairs(rows) do
            local model = cleanModel(row.model)
            if model then found[model] = true end
        end
    else
        print('[racket_vehicle_thumbs] Catalog SQL failed; using client registered models only.')
    end
    return found
end

RegisterCommand('vehthumb', function(source, args)
    if not allowed(source) then
        TriggerClientEvent('chat:addMessage', source, {args = {'VEH THUMBS: No permission. Requires admin level 5 or racket.thumbs ACE.'}})
        return
    end
    local model = cleanModel(args[1])
    if not model then
        tell(source, 'Usage: /vehthumb <spawnname>', 'error')
        return
    end
    beginQueue(source, { model }, 0)
end, false)

RegisterCommand('vehthumbs', function(source, args)
    if not allowed(source) then
        TriggerClientEvent('chat:addMessage', source, {args = {'VEH THUMBS: No permission. Requires admin level 5 or racket.thumbs ACE.'}})
        return
    end
    local mode = tostring(args[1] or ''):lower()
    if mode == '' then
        tell(source, 'Usage: /vehthumbs missing | all | listmissing | status | stop')
        return
    end
    if mode == 'stop' then
        if activeQueue and activeQueue.source == source then
            clearQueue('Thumbnail batch stopped.')
        elseif pendingCatalog and pendingCatalog.source == source then
            pendingCatalog = nil
            tell(source, 'Catalog request stopped.')
        else
            tell(source, 'No batch owned by you is running.', 'error')
        end
        return
    end
    if mode == 'status' then
        local res = GetCurrentResourceName()
        local resPath = GetResourcePath(res)
        local ssState = GetResourceState('screenshot-basic')
        local imPath = findImageMagick()
        local rawDir = resPath .. '/' .. cfg.RawDir
        local outDir = resPath .. '/' .. cfg.OutputDir
        local rawOk = false
        local fw = io.open(rawDir .. '/.wtest', 'w')
        if fw then fw:close() os.remove(rawDir .. '/.wtest') rawOk = true end
        local outOk = false
        local fo = io.open(outDir .. '/.wtest', 'w')
        if fo then fo:close() os.remove(outDir .. '/.wtest') outOk = true end
        local batchStatus
        if activeQueue then
            batchStatus = ('running (%d total, %d done, %d failed)'):format(
                #activeQueue.items, activeQueue.index - 1, activeQueue.failed
            )
        else
            batchStatus = 'idle'
        end
        tell(source, 'resource: ready')
        tell(source, 'screenshot-basic: ' .. ssState)
        tell(source, 'ImageMagick: ' .. imPath)
        tell(source, 'capture mode: dual-pass alpha')
        tell(source, 'raw dir: ' .. rawDir .. ' — ' .. (rawOk and 'writable' or 'NOT WRITABLE'))
        tell(source, 'output dir: ' .. outDir .. ' — ' .. (outOk and 'writable' or 'NOT WRITABLE'))
        tell(source, 'batch: ' .. batchStatus)
        return
    end
    if mode ~= 'missing' and mode ~= 'all' and mode ~= 'listmissing' then
        tell(source, 'Usage: /vehthumbs missing | all | listmissing | status | stop', 'error')
        return
    end
    if activeQueue or pendingCatalog then
        tell(source, 'A thumbnail batch is already running.', 'error')
        return
    end
    if GetResourceState('screenshot-basic') ~= 'started' then
        tell(source, 'screenshot-basic is not running.', 'error')
        return
    end
    local token = newToken()
    pendingCatalog = { source = source, mode = mode, token = token }
    TriggerClientEvent('racket_thumbs:catalogRequest', source, token)
    SetTimeout(15000, function()
        if pendingCatalog and pendingCatalog.token == token then
            pendingCatalog = nil
            tell(source, 'Vehicle catalog request timed out.', 'error')
        end
    end)
end, false)

RegisterNetEvent('racket_thumbs:catalogResponse', function(token, clientModels)
    local source = source
    local request = pendingCatalog
    if not request or request.source ~= source or request.token ~= token or not allowed(source) then return end
    pendingCatalog = nil
    local found = fetchCatalogModels()
    if type(clientModels) == 'table' then
        for index, value in ipairs(clientModels) do
            if index > 1500 then break end
            local model = cleanModel(value)
            if model then found[model] = true end
        end
    end
    local models = {}
    for model in pairs(found) do models[#models + 1] = model end
    table.sort(models)
    local items, skipped = {}, 0
    for _, model in ipairs(models) do
        if request.mode ~= 'all' and outputExists(model) then
            skipped = skipped + 1
        else
            items[#items + 1] = model
        end
    end
    if request.mode == 'listmissing' then
        tell(source, ('Missing %d of %d registered/catalog vehicles.'):format(#items, #models))
        for i = 1, math.min(30, #items) do tell(source, items[i]) end
        if #items > 30 then tell(source, ('...and %d more; see server console for the full list.'):format(#items - 30)) end
        if #items > 30 then print('[racket_vehicle_thumbs] Missing: ' .. table.concat(items, ', ')) end
        return
    end
    beginQueue(source, items, skipped)
end)

RegisterNetEvent('racket_thumbs:blackReady', function(token)
    local source = source
    local queue = activeQueue
    if not queue or queue.source ~= source or queue.token ~= token or queue.stage ~= 'prepare' then return end
    if GetResourceState('screenshot-basic') ~= 'started' then
        finishCurrent(false, 'screenshot-basic stopped')
        return
    end
    queue.stage = 'captureBlack'
    stageTimeout(queue, token, 'captureBlack', cfg.CaptureTimeoutMs)
    local blackPath = ('%s/%s/%s_b.png'):format(GetResourcePath(GetCurrentResourceName()), cfg.RawDir, token)
    local ok, err = pcall(function()
        exports['screenshot-basic']:requestClientScreenshot(source, {
            fileName = blackPath, encoding = 'png',
        }, function(captureError, savedPath)
            if activeQueue ~= queue or queue.token ~= token or queue.stage ~= 'captureBlack' then return end
            if captureError or not savedPath then
                finishCurrent(false, 'black capture failed: ' .. tostring(captureError or 'empty result'))
                return
            end
            queue.stage = 'captureWhite'
            stageTimeout(queue, token, 'captureWhite', cfg.CaptureTimeoutMs + cfg.BgSettleMs + 2000)
            TriggerClientEvent('racket_thumbs:captureWhite', queue.source, token)
        end)
    end)
    if not ok then finishCurrent(false, 'black screenshot error: ' .. tostring(err)) end
end)

RegisterNetEvent('racket_thumbs:whiteReady', function(token)
    local source = source
    local queue = activeQueue
    if not queue or queue.source ~= source or queue.token ~= token or queue.stage ~= 'captureWhite' then return end
    if GetResourceState('screenshot-basic') ~= 'started' then
        finishCurrent(false, 'screenshot-basic stopped')
        return
    end
    queue.stage = 'captureWhiteShot'
    stageTimeout(queue, token, 'captureWhiteShot', cfg.CaptureTimeoutMs)
    local whitePath = ('%s/%s/%s_w.png'):format(GetResourcePath(GetCurrentResourceName()), cfg.RawDir, token)
    local ok, err = pcall(function()
        exports['screenshot-basic']:requestClientScreenshot(source, {
            fileName = whitePath, encoding = 'png',
        }, function(captureError, savedPath)
            if activeQueue ~= queue or queue.token ~= token or queue.stage ~= 'captureWhiteShot' then return end
            if captureError or not savedPath then
                finishCurrent(false, 'white capture failed: ' .. tostring(captureError or 'empty result'))
                return
            end
            queue.stage = 'processing'
            stageTimeout(queue, token, 'processing', cfg.ProcessingTimeoutMs)
            TriggerEvent('racket_thumbs:process', token, queue.items[queue.index], {
                rawDir = cfg.RawDir, outputDir = cfg.OutputDir,
                padding = cfg.PaddingPixels, debug = cfg.Debug,
            })
        end)
    end)
    if not ok then finishCurrent(false, 'white screenshot error: ' .. tostring(err)) end
end)

RegisterNetEvent('racket_thumbs:clientFailed', function(token, reason)
    local source = source
    local queue = activeQueue
    if not queue or queue.source ~= source or queue.token ~= token then return end
    finishCurrent(false, tostring(reason or 'client setup failed'):sub(1, 160))
end)

AddEventHandler('racket_thumbs:processed', function(token, success, result)
    local queue = activeQueue
    if not queue or queue.token ~= token or queue.stage ~= 'processing' then return end
    finishCurrent(success == true, result)
end)

AddEventHandler('playerDropped', function()
    if activeQueue and activeQueue.source == source then activeQueue = nil end
    if pendingCatalog and pendingCatalog.source == source then pendingCatalog = nil end
end)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    local res = GetCurrentResourceName()
    local resPath = GetResourcePath(res)
    print('[racket_vehicle_thumbs] starting')
    local ssState = GetResourceState('screenshot-basic')
    print('[racket_vehicle_thumbs] screenshot-basic: ' .. ssState)
    local imPath = findImageMagick()
    print('[racket_vehicle_thumbs] ImageMagick: ' .. imPath)
    local rawDir = resPath .. '/' .. cfg.RawDir
    local outDir = resPath .. '/' .. cfg.OutputDir
    local rawOk = false
    local fw = io.open(rawDir .. '/.wtest', 'w')
    if fw then fw:close() os.remove(rawDir .. '/.wtest') rawOk = true end
    print('[racket_vehicle_thumbs] raw dir: ' .. (rawOk and 'writable' or 'NOT WRITABLE'))
    local outOk = false
    local fo = io.open(outDir .. '/.wtest', 'w')
    if fo then fo:close() os.remove(outDir .. '/.wtest') outOk = true end
    print('[racket_vehicle_thumbs] output dir: ' .. (outOk and 'writable' or 'NOT WRITABLE'))
    local notReady = {}
    if ssState ~= 'started' then notReady[#notReady + 1] = 'screenshot-basic not started' end
    if not rawOk then notReady[#notReady + 1] = 'raw dir not writable' end
    if not outOk then notReady[#notReady + 1] = 'output dir not writable' end
    if #notReady > 0 then
        print('[racket_vehicle_thumbs] NOT READY: ' .. table.concat(notReady, '; '))
    else
        print('[racket_vehicle_thumbs] ready')
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        clearQueue()
        pendingCatalog = nil
    end
end)
