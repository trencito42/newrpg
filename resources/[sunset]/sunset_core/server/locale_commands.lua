local function reply(source, message)
    if source == 0 then
        print(message)
        return
    end
    TriggerClientEvent('chat:addMessage', source, { args = { 'SYSTEM', message } })
end

local function languageCommand(source, args)
    if source == 0 then
        print('This command is available to connected players only.')
        return
    end

    local locale = type(args[1]) == 'string' and args[1]:lower() or nil
    if not locale then
        reply(source, Sunset.TFor(source, 'locale.current', { language = Sunset.GetPlayerLocale(source) }))
        reply(source, Sunset.TFor(source, 'locale.usage'))
        return
    end
    if not Sunset.IsValidLocale(locale) then
        reply(source, Sunset.TFor(source, 'locale.invalid'))
        return
    end
    if not Sunset.SetPlayerLocale(source, locale) then
        reply(source, Sunset.TFor(source, 'locale.save_failed'))
        return
    end
    reply(source, Sunset.TFor(source, 'locale.changed', { language = locale == 'ro' and 'română' or 'English' }))
end

RegisterCommand('language', languageCommand, false)
RegisterCommand('lang', languageCommand, false)
