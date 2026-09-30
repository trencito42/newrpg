local function showDocuments(kind)
    if IsNuiFocused() then return end
    local data = Sunset.AwaitCallback('sunset:getDocuments', kind or 'all')
    if not data then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('documents.message.could_not_load_documents'), 'error')
        return
    end
    exports.sunset_ui:Send('documentsShow', data)
    exports.sunset_ui:SetFocus(true, true)
end

RegisterCommand('documents', function() showDocuments('all') end, false)
RegisterCommand('id', function() showDocuments('id') end, false)
RegisterCommand('licenses', function() showDocuments('licenses') end, false)

AddEventHandler('sunset:nui:documentsClose', function()
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('documentsHide', {})
end)
