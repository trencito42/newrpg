fx_version 'cerulean'
game 'gta5'

this_is_a_map 'yes'

-- YTYP must be registered BEFORE YMAP streams, so entities with custom
-- archetype hashes (grass_block, sand_block, dirt_block, cobblestone_block,
-- brick_stone_block) resolve to their YDR/YTD assets.
files {
    'stream/villa_island.ytyp'
}
data_file 'DLC_ITYP_REQUEST' 'stream/villa_island.ytyp'
