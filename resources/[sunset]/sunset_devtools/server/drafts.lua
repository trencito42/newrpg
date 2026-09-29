-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — server/drafts.lua
--  File-based draft storage. Writes JSON to the resource folder.
--  Never touches production DB tables.
-- ═══════════════════════════════════════════════════════════════

DevToolsDrafts = {}

local DRAFT_PATH = GetResourcePath(GetCurrentResourceName()) .. '/' .. SunsetDevTools.Config.draftFile
local drafts = {}  -- in-memory cache: { [key] = draftEntry }

local function log(...)
    if GetConvar(SunsetDevTools.Config.debugConvar, 'false') == 'true' then
        print(('[devtools/drafts] ' .. tostring(select(1, ...))):format(select(2, ...)))
    end
end

local function saveToDisk()
    local encoded = json.encode(drafts)
    if not encoded then return end
    local file = io.open(DRAFT_PATH, 'w')
    if not file then
        print('^1[devtools] Could not write draft file: ' .. DRAFT_PATH .. '^7')
        return
    end
    file:write(encoded)
    file:close()
    log('Saved %d drafts to %s', #drafts, DRAFT_PATH)
end

local function loadFromDisk()
    local file = io.open(DRAFT_PATH, 'r')
    if not file then
        drafts = {}
        return
    end
    local raw = file:read('*a')
    file:close()
    if not raw or raw == '' then drafts = {} return end
    local ok, decoded = pcall(json.decode, raw)
    if ok and type(decoded) == 'table' then
        drafts = decoded
        log('Loaded %d draft entries from disk', (function()
            local c = 0
            for _ in pairs(drafts) do c = c + 1 end
            return c
        end)())
    else
        drafts = {}
        print('^1[devtools] Draft file corrupt — starting fresh.^7')
    end
end

-- Load on resource start
loadFromDisk()

function DevToolsDrafts.save(entry)
    if type(entry) ~= 'table' or not entry.key then return end
    local key = (entry.adapter or 'unknown') .. '/' .. entry.key
    drafts[key] = {
        adapter = entry.adapter,
        key     = entry.key,
        label   = entry.label,
        v4      = entry.v4,
        snippet = entry.snippet,
        savedAt = os.date('%Y-%m-%d %H:%M:%S'),
    }
    saveToDisk()
end

function DevToolsDrafts.getAll()
    return drafts
end

function DevToolsDrafts.clear(adapterKey)
    if adapterKey then
        for k in pairs(drafts) do
            if k:match('^' .. adapterKey .. '/') then
                drafts[k] = nil
            end
        end
    else
        drafts = {}
    end
    saveToDisk()
end

exports('GetDrafts', function() return DevToolsDrafts.getAll() end)
exports('ClearDrafts', function(ak) DevToolsDrafts.clear(ak) end)
