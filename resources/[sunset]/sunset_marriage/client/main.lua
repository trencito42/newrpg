-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Marriage System (client/main.lua)
--  Commands: /propose [id], /divorce, /marriage (status)
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetMarriage.Config

-- /propose [id]
RegisterCommand('propose', function(source, args)
    local targetId = tonumber(args[1])
    if not targetId then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('marriage.message.usage_propose_player_id'), 'warning')
    end
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:marriage:propose', targetId)
        if not res then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('marriage.msg.could_not_propose'), 'error')
        end
    end)
end, false)

-- /divorce
RegisterCommand('divorce', function()
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:marriage:divorce')
        if not res then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('marriage.msg.could_not_divorce'), 'error')
        end
    end)
end, false)

-- /marriage (status)
RegisterCommand('marriage', function()
    CreateThread(function()
        local res = Sunset.AwaitCallback('sunset:marriage:status')
        if not res then return end
        if res.married then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('marriage.msg.married_to_married', { partner_name = tostring(res.partnerName), partner_online = res.partnerOnline and exports.sunset_core:Translate('marriage.word.online') or exports.sunset_core:Translate('marriage.word.offline'), married_at = tostring(res.marriedAt) }), 'info', 8000)
        else
            exports.sunset_ui:Notify(exports.sunset_core:Translate('marriage.message.you_are_not_married_use_propose_id_to_propose'), 'info')
        end
    end)
end, false)

-- Proposal received → show accept/decline UI
RegisterNetEvent('sunset:marriage:proposalReceived', function(data)
    exports.sunset_ui:Send('marriageProposal', data)
    exports.sunset_ui:SetFocus(true, true, false, 'marriage')
end)

-- NUI callbacks
AddEventHandler('sunset:nui:marriageRespond', function(data)
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:marriage:respond', data.accept == true)
        if not res then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('marriage.msg.could_not_respond'), 'error')
        end
        exports.sunset_ui:Send('marriageHide', {})
        exports.sunset_ui:SetFocus(false, false, false, 'marriage')
    end)
end)

AddEventHandler('sunset:nui:marriageClose', function()
    exports.sunset_ui:Send('marriageHide', {})
    exports.sunset_ui:SetFocus(false, false, false, 'marriage')
end)

CreateThread(function()
    Wait(1500)
    TriggerEvent('chat:addSuggestion', '/propose', 'Propose marriage to a nearby player', { { name = 'id', helpKey = "config.marriage.help.player_server_id.3ddbbd0a", help = 'Player server ID' } })
    TriggerEvent('chat:addSuggestion', '/divorce', 'File for divorce')
    TriggerEvent('chat:addSuggestion', '/marriage', 'Check your marriage status')
end)
