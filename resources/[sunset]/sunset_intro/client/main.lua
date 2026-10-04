-- Shows the server presentation once per account, after the character is in the world.
-- Skip and the last slide both persist the account. Later logins and new characters
-- on that account do not open it again.

local introOpen = false
local introShown = false
local checking = false

local function openIntro()
    if introOpen or introShown then return end
    introOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'openPresentation' })
end

local function closeIntro()
    introOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'closePresentation' })
end

local function considerIntro()
    if introShown or introOpen or checking then return end
    checking = true
    CreateThread(function()
        Wait(1200)
        if introShown or introOpen then
            checking = false
            return
        end
        local seen = Sunset.AwaitCallback('sunset:intro:hasSeen')
        checking = false
        if seen == true then
            introShown = true
            return
        end
        if seen == false then
            openIntro()
        end
    end)
end

RegisterNUICallback('finishPresentation', function(_, cb)
    cb({ ok = true })
    CreateThread(function()
        local saved = Sunset.AwaitCallback('sunset:intro:markSeen')
        if saved == true then
            introShown = true
        end
        closeIntro()
    end)
end)

AddEventHandler('sunset:client:playerSpawned', function()
    considerIntro()
end)

AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    local char = exports.sunset_core:GetCharacter()
    if char and char.id then
        considerIntro()
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if introOpen then
        SetNuiFocus(false, false)
        introOpen = false
    end
end)
