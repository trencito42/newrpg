RegisterNetEvent('sunset_profile_media:client:captureAvatar', function(data)
    if not data or not data.token then return end

    -- Safe asynchronous execution with local clone ped
    CreateThread(function()
        local playerPed = PlayerPedId()
        local coords = GetEntityCoords(playerPed)
        local model = GetEntityModel(playerPed)

        -- If screenshot-basic is not exported or available, fail gracefully
        if not exports['screenshot-basic'] then
            return
        end

        -- Trigger headshot / portrait capture via screenshot-basic
        exports['screenshot-basic']:requestScreenshotUpload(
            Config.UploadEndpoint,
            'files[]',
            {
                headers = {
                    ['X-Media-Token'] = data.token,
                    ['X-Media-Type'] = 'player_avatar',
                    ['X-Media-Hash'] = data.hash or ''
                }
            },
            function(res)
                -- Completed capture
            end
        )
    end)
end)

RegisterNetEvent('sunset_profile_media:client:captureVehicle', function(data)
    if not data or not data.token or not data.vehicleId then return end

    CreateThread(function()
        if not exports['screenshot-basic'] then
            return
        end

        exports['screenshot-basic']:requestScreenshotUpload(
            Config.UploadEndpoint,
            'files[]',
            {
                headers = {
                    ['X-Media-Token'] = data.token,
                    ['X-Media-Type'] = 'vehicle_preview',
                    ['X-Vehicle-Id'] = tostring(data.vehicleId),
                    ['X-Media-Hash'] = data.hash or ''
                }
            },
            function(res)
                -- Completed vehicle capture
            end
        )
    end)
end)
