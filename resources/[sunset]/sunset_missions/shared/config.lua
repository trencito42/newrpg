SunsetMissions = SunsetMissions or {}

SunsetMissions.Config = {
    interactionRadius    = 2.5,
    vehicleDetectRadius  = 25.0,
    deliveryRadius       = 10.0,
    pickupValidRadius    = 30.0,
    pursuitSpawnMinDist  = 100.0,
    pursuitDespawnDist   = 600.0,
    pursuitSearchDist    = 250.0,
    contactBlipSprite    = 66,
    contactBlipColor     = 1,
    contactBlipScale     = 0.9,

    -- reward modifiers
    conditionBonusMax    = 0.20,
    escapeBonus          = 0.10,
    reputationBonusMax   = 0.15,
}

SunsetMissions.Missions = {}

function SunsetMissions.GetMission(id)
    return SunsetMissions.Missions[id]
end

function SunsetMissions.RegisterMission(id, def)
    SunsetMissions.Missions[id] = def
end
