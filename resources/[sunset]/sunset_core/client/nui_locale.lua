-- Include this helper from resources that own a standalone NUI document.
-- SendNUIMessage targets the including resource's NUI frame, while the locale
-- itself remains owned and validated by sunset_core.
local function syncStandaloneNuiLocale(locale)
    if type(locale) ~= 'string' or locale == '' then
        local ok, current = pcall(function() return exports.sunset_core:GetLocale() end)
        locale = ok and current or 'en'
    end
    SendNUIMessage({ action = 'localeSet', data = { locale = locale } })
end

AddEventHandler('sunset:client:onLocaleChanged', syncStandaloneNuiLocale)

AddEventHandler('onClientResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    CreateThread(function()
        Wait(250)
        syncStandaloneNuiLocale()
    end)
end)
