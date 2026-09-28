local open = false

local function closeChat()
    if not open then return end
    open = false
    exports.rpg_ui:Hide('chat')
    exports.rpg_ui:ReleaseFocus('chat')
end

RegisterCommand('rpg_chat_open', function()
    if open or not LocalPlayer.state['rpg:active'] then return end
    local acquired, err = exports.rpg_ui:AcquireFocus('chat', false, false)
    if not acquired then
        exports.rpg_ui:Notify(err or 'Another interface is currently open.', 'warning')
        return
    end
    open = true
    exports.rpg_ui:Show('chat', {})
end, false)

RegisterKeyMapping('rpg_chat_open', 'Open RPG chat', 'keyboard', 'T')

AddEventHandler('rpg:chat:submit', function(value)
    if not open then return end
    TriggerServerEvent('rpg:chat:submit', value)
    closeChat()
end)

AddEventHandler('rpg:chat:close', closeChat)

RegisterNetEvent('rpg:chat:message', function(message, kind)
    TriggerEvent('rpg:ui:chatMessage', message, kind)
end)

RegisterNetEvent('rpg:chat:system', function(message, kind)
    TriggerEvent('rpg:ui:chatMessage', message, kind or 'system')
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() then closeChat() end
end)
