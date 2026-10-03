Sunset = Sunset or {}

--- Civilian jobs (Job Center) — separate from factions (LSPD, EMS, gangs...)
Sunset.CivilianJobs = {
    unemployed = {
        labelKey = "config.core.label.unemployed.87907609", label = 'Unemployed',
        type = 'civilian',
        grades = { [0] = { labelKey = "config.core.label.freelancer.93450ee3", label = 'Freelancer', salary = 0, perms = {} } },
    },
    trucker = {
        labelKey = "config.core.label.trucker.5022daaf", label = 'Trucker',
        type = 'civilian',
        descriptionKey = "config.core.description.haul_cargo_across_san_andreas_depot_at_the_docks.bf3898e1", description = 'Haul cargo across San Andreas. Depot at the docks.',
        grades = { [0] = { labelKey = "config.core.label.driver.ee0cd508", label = 'Driver', salary = 450, perms = {} } },
        npcCoords = { x = 1208.77, y = -3114.84 },
    },
    garbage = {
        labelKey = "config.core.label.garbage_collector.507c88e7", label = 'Garbage Collector',
        type = 'civilian',
        descriptionKey = "config.core.description.collect_bins_on_city_routes_and_unload_at_the_depot.6c25ec60", description = 'Collect bins on city routes and unload at the depot.',
        grades = { [0] = { labelKey = "config.core.label.collector.b4f822ab", label = 'Collector', salary = 400, perms = {} } },
        npcCoords = { x = -321.70, y = -1545.94 },
    },
    courier = {
        labelKey = "config.core.label.courier.7d7f13f5", label = 'Courier',
        type = 'civilian',
        descriptionKey = "config.core.description.pick_up_packages_and_deliver_them_on_foot.6e79922e", description = 'Pick up packages and deliver them on foot.',
        grades = { [0] = { labelKey = "config.core.label.runner.88ee3076", label = 'Runner', salary = 350, perms = {} } },
        npcCoords = { x = 78.45, y = 112.22 },
    },
    fisherman = {
        labelKey = "config.core.label.fisherman.4336e474", label = 'Fisherman',
        type = 'civilian',
        descriptionKey = "config.core.description.fish_at_coastal_spots_and_sell_your_catch.8a753499", description = 'Fish at coastal spots and sell your catch.',
        grades = { [0] = { labelKey = "config.core.label.angler.12b836bc", label = 'Angler', salary = 380, perms = {} } },
        npcCoords = { x = -1593.23, y = 5207.74 },  -- Billy Ray
    },
    mechanic = {
        labelKey = "config.core.label.roadside_mechanic.df7609b8", label = 'Roadside Mechanic',
        type = 'civilian',
        descriptionKey = "config.core.description.respond_to_service_mechanic_calls_and_repair_vehicles.3c238968", description = 'Respond to /service mechanic calls and repair vehicles.',
        grades = { [0] = { labelKey = "config.core.label.apprentice.763336d7", label = 'Apprentice', salary = 420, perms = {} } },
        npcCoords = { x = -347.45, y = -133.22 },
    },
    hunter = {
        labelKey = "config.core.label.hunter.e6d4e7db", label = 'Hunter',
        type = 'civilian',
        descriptionKey = "config.core.description.hunt_wildlife_under_licensed_contract_requires_firearm_and_hunti.7e61f6e0", description = 'Hunt wildlife under licensed contract. Requires Firearm and Hunting Licenses.',
        grades = { [0] = { labelKey = "config.core.label.novice_hunter.0c83aefc", label = 'Novice Hunter', salary = 0, perms = {} } },
        npcCoords = { x = 1838.0, y = 3673.0 },
    },
    diver = {
        labelKey = "config.core.label.marine_salvage_diver.e571fcc6", label = 'Marine Salvage Diver',
        type = 'civilian',
        descriptionKey = "config.core.description.dive_and_recover_submerged_cargo_from_wrecks_across_the_coast.111d4dd0", description = 'Dive and recover submerged cargo from wrecks across the coast.',
        grades = { [0] = { labelKey = "config.core.label.trainee_diver.1ad212e6", label = 'Trainee Diver', salary = 0, perms = {} } },
        npcCoords = { x = -812.0, y = -1282.0 },
    },
    busdriver = {
        labelKey = "config.core.label.bus_driver.ea1fb367", label = 'Bus Driver',
        type = 'civilian',
        descriptionKey = "config.core.description.operate_public_transit_bus_routes_across_los_santos_and_transpor.57e8fce3", description = 'Operate public transit bus routes across Los Santos and transport passengers.',
        grades = { [0] = { labelKey = "config.core.label.transit_driver.e4a4e7f2", label = 'Transit Driver', salary = 420, perms = {} } },
        npcCoords = { x = 435.44, y = -646.28 },
    },
    lockpicking = {
        labelKey = "config.core.label.lockpicking.0bcebfe4", label = 'Lockpicking',
        type = 'criminal',
        descriptionKey = "config.core.description.skill_for_breaking_into_vehicles_improves_success_rate_when_usin.a2887eb8", description = 'Skill for breaking into vehicles. Improves success rate when using a lockpick.',
        grades = { [0] = { labelKey = "config.core.label.novice.1f60cb72", label = 'Novice', salary = 0, perms = {} } },
    },
}

