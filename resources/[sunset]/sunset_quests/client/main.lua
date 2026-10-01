-- ============================================================
--  sunset_quests — client: /quests command + progress events
-- ============================================================

local panelOpen = false
local panelRendered = false
local panelRenderToken = 0

AddEventHandler('sunset:nui:questLogRendered', function(data)
    if tonumber(data and data.renderToken) == panelRenderToken then
        panelRendered = true
    end
end)

local function openQuests()
    local list = Sunset.AwaitCallback('sunset:quests:list')
    if type(list) ~= 'table' then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('quests.message.quest_log_unavailable_right_now'), 'error')
    end
    panelRendered = false
    panelRenderToken = panelRenderToken + 1
    exports.sunset_ui:Send('questLogShow', { quests = list, renderToken = panelRenderToken })

    -- The UI is loaded on demand. Never capture the mouse until CEF confirms
    -- that the panel was actually painted; otherwise a failed module load
    -- leaves the player with an invisible modal and a trapped cursor.
    local deadline = GetGameTimer() + 3000
    while not panelRendered and GetGameTimer() < deadline do Wait(25) end
    if not panelRendered then
        exports.sunset_ui:Send('questLogHide', {})
        exports.sunset_ui:SetFocus(false, false, false, 'force')
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('quests.message.quest_log_failed_to_load_try_again_once'), 'error')
    end

    exports.sunset_ui:SetFocus(true, true, false, 'quests')
    panelOpen = true
end

RegisterCommand('quests', function()
    if panelOpen then
        panelOpen = false
        exports.sunset_ui:Send('questLogHide', {})
        exports.sunset_ui:ReleaseFocusUnlessModal('quests')
        return
    end
    openQuests()
end, false)
TriggerEvent('chat:addSuggestion', '/quests', exports.sunset_core:Translate('quests.command.description'))

AddEventHandler('sunset:nui:questLogClose', function()
    panelOpen = false
    exports.sunset_ui:Send('questLogHide', {})
    exports.sunset_ui:ReleaseFocusUnlessModal('quests')
end)

AddEventHandler('sunset:nui:questLocaleRefresh', function()
    if not panelOpen then return end
    local list = Sunset.AwaitCallback('sunset:quests:list')
    if type(list) == 'table' then
        exports.sunset_ui:Send('questLogShow', { quests = list, renderToken = panelRenderToken })
    end
end)

AddEventHandler('sunset:nui:questClaim', function(data)
    local questKey = data and data.questKey
    if not questKey then return end
    local ok, err = Sunset.AwaitCallback('sunset:quests:claim', questKey)
    if ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('quests.message.reward_claimed'), 'success')
        if panelOpen then openQuests() end
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('quests.message.claim_failed'), 'error')
    end
end)

RegisterNetEvent('sunset:quests:objectiveComplete', function()
    -- subtle audio confirmation
    PlaySoundFrontend(-1, 'CHECKPOINT_PERFECT', 'HUD_MINI_GAME_SOUNDSET', true)
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if panelOpen then
        exports.sunset_ui:Send('questLogHide', {})
        exports.sunset_ui:SetFocus(false, false, false, 'force')
    end
end)
