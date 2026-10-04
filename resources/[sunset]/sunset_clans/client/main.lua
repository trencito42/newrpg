local function openClanPanel()
    local data, err = Sunset.AwaitCallback('sunset:clanDashboard')
    if not data then
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.clan_panel_could_not_be_opened'), 'error', 7000)
    end
    exports.sunset_ui:Send('clanPanelShow', data)
    exports.sunset_ui:SetFocus(true, true)
end

local function openClanDirectory()
    local data, err = Sunset.AwaitCallback('sunset:clanDirectory')
    if not data then
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.clan_directory_could_not_be_opened'), 'error', 7000)
    end
    exports.sunset_ui:Send('clanDirectoryShow', { clans = data })
    exports.sunset_ui:SetFocus(true, true)
end

RegisterCommand('clan', openClanPanel, false)
RegisterCommand('group', openClanPanel, false)
TriggerEvent('chat:addSuggestion', '/clan', 'Open your clan unit panel — crew, command, identity')
TriggerEvent('chat:addSuggestion', '/group', 'Same as /clan — clan unit panel')

RegisterCommand('clans', openClanDirectory, false)
TriggerEvent('chat:addSuggestion', '/clans', 'Browse all server clans')

RegisterNetEvent('sunset:clans:dashboardRefresh', function(data)
    if type(data) ~= 'table' then return end
    exports.sunset_ui:Send('clanUpdate', data)
end)

RegisterNetEvent('sunset:clans:openDashboard', openClanPanel)
RegisterNetEvent('sunset:clans:openDirectory', openClanDirectory)

AddEventHandler('sunset:nui:clanPanelsReady', function()
    exports.sunset_ui:SetFocus(true, true)
end)

AddEventHandler('sunset:nui:clanBrowse', function()
    local data, err = Sunset.AwaitCallback('sunset:clanDirectory')
    if not data then
        exports.sunset_ui:Send('clanBrowseInline', { clans = {}, error = err })
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.clan_directory_could_not_be_loaded'), 'error', 7000)
    end
    exports.sunset_ui:Send('clanBrowseInline', { clans = data })
end)

AddEventHandler('sunset:nui:clanProfile', function(data)
    local clanId = tonumber(data and data.clanId)
    local profile, err = Sunset.AwaitCallback('sunset:clanProfile', clanId)
    if not profile then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.could_not_load_clan_profile'), 'error', 7000)
        return
    end
    exports.sunset_ui:Send('clanProfileShow', profile)
end)

RegisterCommand('cmotd', function(_, args)
    local msg = table.concat(args, ' ')
    if msg == '' then
        local data, err = Sunset.AwaitCallback('sunset:clanGetMotd')
        if not data then return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.clan_motd_could_not_be_loaded'), 'error') end
        exports.sunset_ui:Send('chatMessage', {
            id = 0,
            type = 'clan_motd',
            clanTag = data.tag,
            clanName = data.name,
            name = data.name,
            message = data.message ~= '' and data.message or exports.sunset_core:Translate('factions.ui.no_message_of_the_day_has'),
            command = '/cmotd',
            time = '',
        })
        return
    end
    local ok, err = Sunset.AwaitCallback('sunset:clanManage', { action = 'motd', message = msg })
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_motd_updated'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.motd_update_failed_officers_can_set'), 'error') end
end, false)
TriggerEvent('chat:addSuggestion', '/cmotd', 'Read clan MOTD, or set it if you are an officer', { { name = 'message', helpKey = "config.clans.help.optional_new_motd.ec77ea50", help = 'optional new MOTD' } })

RegisterCommand('acceptclan', function()
    local data, err = Sunset.AwaitCallback('sunset:clanAcceptInvite')
    if not data then
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.could_not_accept_clan_invite'), 'error', 8000)
    end
    exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.msg.you_joined', { name = data.name or exports.sunset_core:Translate('clans.word.the_clan') }), 'success', 8000)
    exports.sunset_ui:Send('clanPanelShow', data)
end, false)
TriggerEvent('chat:addSuggestion', '/acceptclan', 'Accept a pending clan invitation')

RegisterCommand('declineclan', function()
    local ok, err = Sunset.AwaitCallback('sunset:clanDeclineInvite')
    if not ok then
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.could_not_decline_invite'), 'error', 7000)
    end
    exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_invite_declined'), 'info')
end, false)
TriggerEvent('chat:addSuggestion', '/declineclan', 'Decline a pending clan invitation')
TriggerEvent('chat:addSuggestion', '/c', 'Clan chat — visible to your clan members only')

local function clanWarnCommand(_, args)
    local targetId = tonumber(args[1])
    local reason = table.concat(args, ' ', 2)
    if not targetId or reason == '' then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.usage_cwarn_id_reason'), 'error')
    end
    local ok, err = Sunset.AwaitCallback('sunset:clanManage', {
        action = 'warn',
        targetId = targetId,
        reason = reason,
    })
    if ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_warning_issued'), 'warning')
        exports.sunset_ui:Send('clanPanelShow', ok)
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('clans.msg.clan_warning_failed'), 'error', 8000)
    end
end

RegisterCommand('cwarn', clanWarnCommand, false)
RegisterCommand('cw', clanWarnCommand, false)
TriggerEvent('chat:addSuggestion', '/cwarn', 'Issue a clan warning', { { name = 'id' }, { name = 'reason' } })
TriggerEvent('chat:addSuggestion', '/cw', 'Alias for /cwarn', { { name = 'id' }, { name = 'reason' } })

local function handleClanManageUi(data)
    data = data or {}
    local action = data.action
    local ok, err

    if action == 'create' then
        ok, err = Sunset.AwaitCallback('sunset:clanCreate', data)
        if ok then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.msg.clan_created', { name = tostring(ok.name or '') }), 'success', 8000)
            exports.sunset_ui:Send('clanPanelShow', ok)
            return
        end
        -- [BUGFIX] 'ok' can be a string message from rare fallback paths
        -- ('Clan created but could not be loaded...'): treat as success-with-note.
        if type(ok) == 'nil' and err == nil then
            err = 'Creation failed with no message from the server. Check the name/tag (min 3 letters, no special characters) and that you have 500 Racket Credits.'
        end
    else
        ok, err = Sunset.AwaitCallback('sunset:clanManage', data)
        if ok then
            if action == 'invite' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_invite_sent'), 'success')
            elseif action == 'kick' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.member_removed_from_clan'), 'success')
            elseif action == 'rankUp' or action == 'rankDown' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.member_rank_updated'), 'success')
            elseif action == 'warn' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_warning_issued'), 'warning')
            elseif action == 'rankLabels' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_rank_names_saved'), 'success')
            elseif action == 'motd' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_motd_updated_8cc5ba'), 'success')
            elseif action == 'settings' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_settings_saved'), 'success')
            elseif action == 'leave' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.you_left_the_clan'), 'info')
            elseif action == 'dissolve' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.message.clan_dissolved'), 'warning')
            end
            exports.sunset_ui:Send('clanPanelShow', ok)
            return
        end
    end

    if err and tostring(err) ~= '' then
        exports.sunset_ui:Notify(tostring(err), 'error', 8000)
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('clans.msg.clan_action_failed', { action = tostring(action or 'unknown') }), 'error', 8000)
    end
    print(('[sunset_clans] clanManage failed (%s): %s'):format(tostring(action or 'unknown'), tostring(err or 'nil')))
end

AddEventHandler('sunset:nui:clanManage', function(data)
    CreateThread(function()
        handleClanManageUi(data)
    end)
end)

RegisterCommand('leaveclan', function()
    CreateThread(function()
        handleClanManageUi({ action = 'leave' })
    end)
end, false)
TriggerEvent('chat:addSuggestion', '/leaveclan', 'Leave your current clan')

RegisterCommand('dissolveclan', function()
    CreateThread(function()
        handleClanManageUi({ action = 'dissolve' })
    end)
end, false)
TriggerEvent('chat:addSuggestion', '/dissolveclan', 'Dissolve your clan (leader only)')
