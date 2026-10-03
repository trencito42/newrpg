SunsetProperties = SunsetProperties or {}

SunsetProperties.RentMin = 50
SunsetProperties.RentMax = 5000
SunsetProperties.DefaultRentPrice = 500
SunsetProperties.MaxRentersMin = 1
SunsetProperties.MaxRentersMax = 10
SunsetProperties.AdminLevel = 3
SunsetProperties.BucketBase = 20000
-- 0 = unlimited owned houses per character
SunsetProperties.MaxOwnedPerCharacter = 0

-- Stable GTA Online interiors. Routing buckets isolate each physical house.
SunsetProperties.Interiors = {
    standard        = { labelKey = "config.properties.label.standard_apartment.3c545f61", label = 'Standard Apartment', coords = vector4(266.03, -1007.26, -101.01, 357.0) },
    motel           = { labelKey = "config.properties.label.motel_room.ff461fc3", label = 'Motel Room', coords = vector4(151.31, -1007.74, -99.00, 340.0) },
    modern          = { labelKey = "config.properties.label.modern_apartment.299fb1b8", label = 'Modern Apartment', coords = vector4(-786.87, 315.75, 217.64, 268.0) },
    highend         = { labelKey = "config.properties.label.high_end_apartment.8db6a143", label = 'High-end Apartment', coords = vector4(-774.17, 342.04, 196.69, 90.0) },
    executive       = { labelKey = "config.properties.label.executive_suite.d9714aee", label = 'Executive Suite', coords = vector4(-787.16, 315.81, 187.91, 270.0) },
    mansion         = { labelKey = "config.properties.label.luxury_mansion.916b71ba", label = 'Luxury Mansion', coords = vector4(-774.17, 342.04, 196.69, 90.0) },
    villa           = { labelKey = "config.properties.label.vinewood_villa.9d45a748", label = 'Vinewood Villa', coords = vector4(-787.16, 315.81, 187.91, 270.0) },
    penthouse       = { labelKey = "config.properties.label.casino_penthouse.717a992c", label = 'Casino Penthouse', coords = vector4(964.03, 58.73, 112.55, 59.0) },
    stilt           = { labelKey = "config.properties.label.stilt_house.db079fb8", label = 'Stilt House', coords = vector4(373.88, 412.37, 145.7, 180.0) },
    low             = { labelKey = "config.properties.label.low_end_apartment.0fbe28f9", label = 'Low-end Apartment', coords = vector4(261.45, -998.81, -99.01, 90.0) },
    low_apartment   = { labelKey = "config.properties.label.low_end_apartment.0fbe28f9", label = 'Low-end Apartment', coords = vector4(261.45, -998.81, -99.01, 90.0) },
    small_apartment = { labelKey = "config.properties.label.small_apartment.b7f7a8dd", label = 'Small Apartment', coords = vector4(261.45, -998.81, -99.01, 90.0) },
    medium          = { labelKey = "config.properties.label.medium_house.d7802fd7", label = 'Medium House', coords = vector4(266.03, -1007.26, -101.01, 357.0) },
    medium_house    = { labelKey = "config.properties.label.medium_house.d7802fd7", label = 'Medium House', coords = vector4(266.03, -1007.26, -101.01, 357.0) },
}
