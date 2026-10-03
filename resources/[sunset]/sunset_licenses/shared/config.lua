SunsetLicenses = SunsetLicenses or {}

-- Licenses expire after this many completed paydays, matching the RPG progression loop.
SunsetLicenses.PaydayExpiry = 150
SunsetLicenses.InstructorAuthorizationSeconds = 300
SunsetLicenses.InstructorMaxDistance = 12.0
SunsetLicenses.CandidateFailMistakes = 3.0

-- Exam fee scales from Sunset.Config.StartingCash (default $250 → $25 at 10%, min $30).
SunsetLicenses.ExamFeePercentOfStartingCash = 0.10
SunsetLicenses.ExamFeeMin = 30
SunsetLicenses.ExamFeeMax = 100
SunsetLicenses.TheoryTimeSec = 600

-- LSSI promotions use completed management reviews, not raw test count. This keeps
-- senior ranks tied to teaching quality and can be tuned without changing code.
SunsetLicenses.InstructorPromotionRequirements = {
    [2] = { reviewed = 5, maxAverageMistakes = 1.5 },
    [3] = { reviewed = 10, maxAverageMistakes = 1.0 },
    [4] = { reviewed = 18, maxAverageMistakes = 0.75 },
    [5] = { reviewed = 25, maxAverageMistakes = 0.5 },
    [6] = { reviewed = 35, maxAverageMistakes = 0.5 },
    [7] = { reviewed = 50, maxAverageMistakes = 0.25 },
}

SunsetLicenses.Types = {
    driver = {
        labelKey = "config.licenses.label.driving_license.65011966", label = 'Driving License',
        short = 'Driver',
        facility = 'driving_school',
        instructorFaction = false,
        vehicleClasses = { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20 },
    },
    pilot = {
        labelKey = "config.licenses.label.pilot_license.b6bad512", label = 'Pilot License',
        short = 'Pilot',
        facility = 'airport',
        instructorFaction = true,
        vehicleClasses = { 15, 16 },
    },
    boat = {
        labelKey = "config.licenses.label.boat_license.0f59cfe9", label = 'Boat License',
        short = 'Boat',
        facility = 'marina',
        instructorFaction = true,
        vehicleClasses = { 14 },
    },
    weapon = {
        labelKey = "config.licenses.label.firearm_license.08798924", label = 'Firearm License',
        short = 'Weapon',
        facility = 'range',
        instructorFaction = true,
        vehicleClasses = {},
    },
    hunting = {
        labelKey = "config.licenses.label.hunting_license.ab95524c", label = 'Hunting License',
        short = 'Hunting',
        facility = 'hunting_range',
        instructorFaction = true,
        vehicleClasses = {},
        -- Must hold a valid Firearm License before attempting this exam.
        prerequisites = { 'weapon' },
    },
}

SunsetLicenses.Facilities = {
    driving_school = {
        labelKey = "config.licenses.label.driving_school.2074d451", label = 'Driving School',
        blip = { sprite = 525, color = 5, scale = 0.85 },
        marker = vector3(240.12, -1379.35, 33.74),
        markerRadius = 2.5,
        license = 'driver',
    },
    airport = {
        labelKey = "config.licenses.label.flight_school_lsia.dfb070f1", label = 'Flight School — LSIA',
        blip = { sprite = 307, color = 2, scale = 0.9 },
        marker = vector3(-1037.2, -2737.8, 20.17),
        markerRadius = 3.0,
        license = 'pilot',
        spawn = vector4(-1145.2, -2864.5, 13.95, 330.0),
        testVehicle = 'maverick',
    },
    marina = {
        labelKey = "config.licenses.label.boat_school_marina.5b45e9c1", label = 'Boat School — Marina',
        blip = { sprite = 410, color = 3, scale = 0.85 },
        marker = vector3(-794.5, -1510.2, 1.6),
        markerRadius = 3.0,
        license = 'boat',
        spawn = vector4(-798.2, -1502.5, 0.12, 110.0),
        testVehicle = 'dinghy',
    },
    range = {
        labelKey = "config.licenses.label.lssi_weapon_range_sandy_shores.41f8afe5", label = 'LSSI Weapon Range — Sandy Shores',
        blip = { sprite = 313, color = 1, scale = 0.85 },
        marker = vector3(1690.5, 3748.8, 34.7),
        markerRadius = 2.5,
        license = 'weapon',
    },
    -- [SECTION 8] Hunting license exam facility. Located at the LSSI outdoor shooting range
    -- in Blaine County, near the hunting contract zones. Both the exam booth marker and the
    -- range targets are in this area.
    hunting_range = {
        labelKey = "config.licenses.label.lssi_hunting_range_blaine_county.e2a4dd95", label = 'LSSI Hunting Range — Blaine County',
        blip = { sprite = 153, color = 2, scale = 0.85 },
        marker = vector3(2569.0, 3465.0, 56.0),
        markerRadius = 3.0,
        license = 'hunting',
    },
}

SunsetLicenses.MeleeWeapons = {
    WEAPON_UNARMED = true,
    WEAPON_KNIFE = true,
    WEAPON_SWITCHBLADE = true,
    WEAPON_BAT = true,
    WEAPON_CROWBAR = true,
    WEAPON_FLASHLIGHT = true,
    WEAPON_NIGHTSTICK = true,
    WEAPON_HAMMER = true,
    WEAPON_GOLFCLUB = true,
    WEAPON_BOTTLE = true,
    WEAPON_DAGGER = true,
    WEAPON_HATCHET = true,
    WEAPON_KNUCKLE = true,
    WEAPON_MACHETE = true,
    WEAPON_WRENCH = true,
    WEAPON_POOLCUE = true,
    WEAPON_BATTLEAXE = true,
    WEAPON_STONE_HATCHET = true,
    WEAPON_FIREEXTINGUISHER = true,
    WEAPON_PETROLCAN = true,
    WEAPON_HAZARDCAN = true,
    WEAPON_FERTILIZERCAN = true,
    WEAPON_BALL = true,
    WEAPON_SNOWBALL = true,
    GADGET_PARACHUTE = true,
}

-- weaponDamageEvent may send unsigned joaat; normalize before hash comparisons.
function SunsetLicenses.normalizeWeaponHash(hash)
    hash = tonumber(hash) or 0
    if hash > 2147483647 then
        hash = hash - 4294967296
    end
    return hash
end

function SunsetLicenses.isMeleeWeaponHash(weaponHash)
    weaponHash = SunsetLicenses.normalizeWeaponHash(weaponHash)
    if weaponHash == 0 then return true end
    return SunsetLicenses.MeleeWeaponHashes
        and SunsetLicenses.MeleeWeaponHashes[weaponHash] == true
end

function SunsetLicenses.isFirearmWeapon(weaponName)
    if not weaponName or weaponName == '' then return false end
    weaponName = string.upper(weaponName)
    if SunsetLicenses.MeleeWeapons[weaponName] then return false end
    return weaponName:sub(1, 7) == 'WEAPON_'
end

function SunsetLicenses.vehicleClassForLicense(classId)
    classId = tonumber(classId) or -1
    for licenseType, def in pairs(SunsetLicenses.Types) do
        for _, cls in ipairs(def.vehicleClasses or {}) do
            if cls == classId then return licenseType end
        end
    end
    return nil
end

SunsetLicenses.Theory = {
    driver = {
        titleKey = "config.licenses.title.driving_school_theory.808cf389", title = 'Driving School — Theory',
        intro = 'Read each question carefully. You need 3/4 correct to pass. On the road: stop at reds, yield to pedestrians, and stay in your lane.',
        passScore = 3,
        questions = {
            {
                q = 'What should you do at a red traffic light?',
                options = { 'Speed through if clear', 'Stop and wait for green', 'Honk and go', 'Reverse' },
            },
            {
                q = 'When may you use your phone while driving?',
                options = { 'Never while the vehicle is moving', 'At any time', 'Only on highways', 'Only at night' },
            },
            {
                q = 'Who has priority at a pedestrian crossing?',
                options = { 'The vehicle', 'Pedestrians on the crossing', 'Whoever is faster', 'Emergency vehicles only' },
            },
            {
                q = 'What does a solid double yellow line mean?',
                options = { 'Pass freely', 'No passing / stay in lane', 'Parking allowed', 'U-turn required' },
            },
        },
    },
    pilot = {
        titleKey = "config.licenses.title.flight_school_theory.6e38e0ac", title = 'Flight School — Theory',
        intro = 'Aircraft are dangerous without training. Maintain altitude in checkpoints, avoid buildings, and land gently at LSIA with the engine off.',
        passScore = 3,
        questions = {
            {
                q = 'Before takeoff you must:',
                options = { 'Check fuel and controls', 'Skip preflight', 'Take off immediately', 'Land first' },
            },
            {
                q = 'If you lose engine power you should:',
                options = { 'Panic and bail', 'Attempt a controlled landing', 'Fly upside down', 'Increase throttle only' },
            },
            {
                q = 'Helicopter yaw is controlled mainly by:',
                options = { 'Rudder pedals / anti-torque', 'Brakes', 'Horn', 'Seatbelt' },
            },
            {
                q = 'After landing you must:',
                options = { 'Leave engine running', 'Shut down engine safely', 'Take off again', 'Abandon aircraft' },
            },
        },
    },
    boat = {
        titleKey = "config.licenses.title.boat_school_theory.a1871c64", title = 'Boat School — Theory',
        intro = 'On the water: wear a life jacket mindset, watch for swimmers, and complete all buoys before returning to the marina.',
        passScore = 3,
        questions = {
            {
                q = 'Near swimmers you should:',
                options = { 'Speed up', 'Slow down and keep distance', 'Rev engine', 'Ignore them' },
            },
            {
                q = 'At night boats need:',
                options = { 'No lights', 'Proper navigation lights', 'Only horn', 'Flares only' },
            },
            {
                q = 'Before starting the engine:',
                options = { 'Check fuel and area is clear', 'Jump in water', 'Speed away', 'Close eyes' },
            },
            {
                q = 'Returning to dock you should:',
                options = { 'Ram the pier', 'Approach slowly', 'Full throttle', 'Abandon boat' },
            },
        },
    },
    hunting = {
        titleKey = "config.licenses.title.lssi_hunting_license_theory.dd146763", title = 'LSSI Hunting License — Theory',
        intro = 'Wildlife management requires safe, ethical practice. You need 5/8 correct. Read each question carefully — several have real-world safety implications.',
        passScore = 5,
        questions = {
            {
                q = 'The first rule when handling a hunting firearm is:',
                options = { 'Treat every firearm as loaded', 'Point at the sky when unsure', 'Keep finger on trigger for quick reaction', 'Check with others before firing' },
            },
            {
                q = 'Before pulling the trigger you must identify:',
                options = { 'Your target and what lies beyond it', 'Only that the animal is moving', 'That no one is watching', 'That the animal is large enough' },
            },
            {
                q = 'A safe backdrop means:',
                options = { 'No roads, structures, or people beyond the target', 'Open sky behind the animal', 'Shooting only downhill', 'Shooting only at dawn' },
            },
            {
                q = 'You should NEVER fire near:',
                options = { 'Roads, populated areas, or structures', 'Wooded areas during daylight', 'Flat open terrain', 'Hills or ridges' },
            },
            {
                q = 'A legal hunting zone is:',
                options = { 'A designated wildlife management area away from the city', 'Any area outside Los Santos', 'Anywhere animals are spotted', 'Private land only' },
            },
            {
                q = 'For humane, effective shot placement on large game, aim for:',
                options = { 'The vital chest region — heart and lungs', 'The head only', 'The legs to slow the animal first', 'The rump for a clean exit' },
            },
            {
                q = 'Correct hunting equipment means:',
                options = { 'A legal hunting firearm with appropriate caliber for the species', 'Any available weapon including automatics or explosives', 'The largest firearm available', 'Any weapon if the hunter holds a Firearm License' },
            },
            {
                q = 'A protected species means:',
                options = { 'It may NOT be hunted or harvested under any contract', 'It requires a higher-rank contract', 'It can be hunted only at night', 'It grants bonus trophies if harvested' },
            },
        },
    },

    weapon = {
        titleKey = "config.licenses.title.firearm_safety_theory.d7568e81", title = 'Firearm Safety — Theory',
        intro = 'Treat every gun as loaded. Keep the muzzle pointed in a safe direction and only fire at range targets during the practical.',
        passScore = 3,
        questions = {
            {
                q = 'First rule of firearm safety:',
                options = { 'Always treat as loaded', 'Point at friends', 'Keep finger on trigger', 'Ignore surroundings' },
            },
            {
                q = 'You may discharge only:',
                options = { 'Anywhere in the city', 'At authorized range targets', 'At vehicles', 'At buildings' },
            },
            {
                q = 'Without a license you may carry:',
                options = { 'Any rifle', 'Melee tools only (no firearms)', 'Explosives', 'Heavy MG' },
            },
            {
                q = 'After the practical you must:',
                options = { 'Keep the test weapon', 'Holster / clear and end test', 'Sell the gun', 'Shoot in town' },
            },
        },
    },
}

SunsetLicenses.Practical = {
    driver = {
        vehicle = 'blista',
        spawn = vector4(216.57, -1381.31, 30.38, 271.30),
        spawns = {
            vector4(216.57, -1381.31, 30.38, 271.30),
            vector4(218.75, -1384.64, 30.39, 271.85),
            vector4(222.47, -1387.95, 30.37, 267.42),
        },
        departGate = vector4(220.96, -1406.25, 29.33, 145.74),
        gateRadius = 10.0,
        engineOffOnSpawn = true,
        maxPenalties = 4,
        speedCountdownSec = 5,
        speedGraceKmh = 0,
        minImpactKmh = 12,
        hardImpactKmh = 18,
        minImpactDamage = 4.0,
        hudMessageHoldMs = 5000,
        maxCollisions = 3,
        briefing = {
            {
                titleKey = "config.licenses.title.driving_school.79f1f3ba", title = 'Driving School',
                messageKey = "config.licenses.message.welcome_to_driving_school_listen_carefully_we_will_get_you_on_th.cc544aad", message = 'Welcome to Driving School. Listen carefully — we will get you on the road safely.',
            },
            {
                messageKey = "config.licenses.message.let_s_get_on_the_road_press_2_to_start_the_engine.61fba62a", message = "Let's get on the road. Press 2 to start the engine.",
                require = 'engine_on',
            },
            {
                messageKey = "config.licenses.message.buckle_up_press_k_to_fasten_your_seatbelt.64feda5c", message = 'Buckle up — press K to fasten your seatbelt.',
                require = 'seatbelt',
            },
            {
                messageKey = "config.licenses.message.press_h_to_set_your_headlights_for_traffic.1a532e41", message = 'Press H to set your headlights for traffic.',
                require = 'lights',
            },
            {
                messageKey = "config.licenses.message.exit_through_the_dmv_gate_and_follow_the_route_markers.825452f3", message = 'Exit through the DMV gate and follow the route markers.',
                require = 'depart',
            },
        },
        checkpointRadius = 10.0,
        maxTimeSec = 1200,
        speedLimitDefault = 80,
        speedLimitHard = 115,
        maxSpeedStrikes = 4,
        speedZones = {
            { from = 1, to = 3, limit = 70 },
            { from = 4, to = 6, limit = 100 },
            { from = 7, to = 9, limit = 90 },
            { from = 10, to = 14, limit = 80 },
        },
        checkpointHints = {
            'Watch for cross traffic as you leave the DMV area.',
            'Stay in lane — city speed limit 70 km/h.',
            'Keep a steady pace through south Los Santos.',
            'Highway ahead — you may go up to 100 km/h, not more.',
            'Vinewood Hills — watch the curves and slow for turns.',
            'Stay right and mind oncoming traffic.',
            'Reduce speed before the downhill sections.',
            'Residential area — slow down and stay alert.',
            'Approaching downtown — ease off the throttle.',
            'City streets again — max 80 km/h.',
            'Watch for pedestrians and tight corners.',
            'Almost back — drive smoothly, no rushing.',
            'Enter the DMV zone slowly.',
            'Final approach — prepare to park at the lot.',
        },
        finishHint = 'Park in the marked spot, shut off the engine, and press E.',
        checkpoints = {
            vector3(184.23, -1396.56, 29.08),
            vector3(219.33, -1147.71, 29.16),
            vector3(284.90, -877.49, 29.11),
            vector3(771.18, -15.32, 61.75),
            vector3(1129.63, 366.75, 91.29),
            vector3(855.23, 22.28, 78.91),
            vector3(979.01, -175.79, 72.55),
            vector3(1189.87, -442.33, 66.75),
            vector3(1194.34, -712.68, 59.49),
            vector3(1234.10, -1323.58, 34.74),
            vector3(735.79, -1432.23, 30.63),
            vector3(445.57, -1429.79, 29.17),
            vector3(227.32, -1424.06, 29.09),
            vector3(243.88, -1401.63, 30.40),
        },
        finish = vector3(281.51, -1353.65, 31.76),
        finishRadius = 8.0,
        requireEngineOff = true,
    },
    pilot = {
        checkpointRadius = 35.0,
        maxTimeSec = 600,
        checkpoints = {
            vector3(-1080.0, -2880.0, 45.0),
            vector3(-980.0, -2950.0, 55.0),
            vector3(-880.0, -2850.0, 50.0),
            vector3(-1000.0, -2750.0, 48.0),
        },
        finish = vector3(-1145.2, -2864.5, 13.95),
        finishRadius = 25.0,
        requireEngineOff = true,
    },
    boat = {
        checkpointRadius = 18.0,
        maxTimeSec = 480,
        checkpoints = {
            vector3(-820.0, -1520.0, 0.0),
            vector3(-860.0, -1580.0, 0.0),
            vector3(-780.0, -1620.0, 0.0),
            vector3(-740.0, -1540.0, 0.0),
        },
        finish = vector3(-798.2, -1502.5, 0.12),
        finishRadius = 15.0,
        requireEngineOff = true,
    },
    hunting = {
        weapon = 'WEAPON_SNIPERRIFLE',
        ammo = 15,
        targetsRequired = 4,
        avoidTargets = 2,
        targetRadius = 2.0,
        maxTimeSec = 240,
        maxMistakes = 2,
        briefing = {
            {
                titleKey = "config.licenses.title.lssi_hunting_range.41d3861c", title = 'LSSI Hunting Range',
                messageKey = "config.licenses.message.welcome_to_the_hunting_license_practical_demonstrate_safe_accura.d2d76bdd", message = 'Welcome to the Hunting License practical. Demonstrate safe, accurate wildlife shooting.',
            },
            {
                messageKey = "config.licenses.message.step_to_the_firing_position_press_e_when_you_are_ready_to_receiv.34744216", message = 'Step to the firing position. Press E when you are ready to receive the test rifle and begin.',
                require = 'ready',
            },
            {
                messageKey = "config.licenses.message.engage_all_deer_targets_orange_markers_do_not_shoot_the_protecte.6cdcc005", message = 'Engage all DEER targets (orange markers). Do NOT shoot the PROTECTED animals (red markers). Return to the booth when done.',
            },
        },
        -- Valid targets: deer silhouettes. Avoid targets: protected animal positions.
        targets = {
            vector4(2581.0, 3480.0, 56.5, 270.0),
            vector4(2578.0, 3485.0, 57.0, 280.0),
            vector4(2583.0, 3491.0, 57.5, 265.0),
            vector4(2575.0, 3476.0, 56.0, 275.0),
            vector4(2585.0, 3474.0, 56.5, 260.0),
        },
        -- Avoid targets: "protected animals" — shooting these costs a mistake.
        avoidPositions = {
            vector4(2571.0, 3483.0, 56.0, 270.0),
            vector4(2590.0, 3488.0, 57.0, 260.0),
        },
        zoneCenter = vector3(2569.0, 3467.0, 56.0),
        zoneRadius = 60.0,
    },

    weapon = {
        weapon = 'WEAPON_PISTOL',
        ammo = 48,
        targetsRequired = 5,
        targetRadius = 1.2,
        maxTimeSec = 300,
        briefing = {
            {
                titleKey = "config.licenses.title.lssi_firearms_range.8b897852", title = 'LSSI Firearms Range',
                messageKey = "config.licenses.message.welcome_to_the_lssi_range_treat_every_weapon_as_loaded_and_keep_.c0833d9c", message = 'Welcome to the LSSI range. Treat every weapon as loaded and keep the muzzle downrange.',
            },
            {
                messageKey = "config.licenses.message.step_to_the_firing_line_press_e_when_you_are_ready_to_receive_yo.4446e6b1", message = 'Step to the firing line. Press E when you are ready to receive your training pistol.',
                require = 'ready',
            },
            {
                messageKey = "config.licenses.message.hit_every_marked_target_then_return_to_the_booth_to_finish.631c40e8", message = 'Hit every marked target, then return to the booth to finish.',
            },
        },
        targets = {
            vector4(1693.5, 3762.0, 34.7, 270.0),
            vector4(1696.0, 3762.0, 34.7, 270.0),
            vector4(1698.5, 3762.0, 34.7, 270.0),
            vector4(1693.5, 3759.0, 34.7, 270.0),
            vector4(1698.5, 3759.0, 34.7, 270.0),
        },
        zoneCenter = vector3(1696.0, 3760.5, 34.7),
        zoneRadius = 22.0,
    },
}
