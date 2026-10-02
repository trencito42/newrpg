fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'pitd_tol_car_pack_a'
author 'PITD'
description 'PITD Unbranded TOL Car Pack A'
version '1.0.0'

files {
    'carcols.meta',
    'carvariations.meta',
    'handling.meta',
    'vehicles.meta',
    'vehiclelayouts.meta',
}

data_file 'HANDLING_FILE'          'handling.meta'
data_file 'VEHICLE_METADATA_FILE'  'vehicles.meta'
data_file 'CARCOLS_FILE'           'carcols.meta'
data_file 'VEHICLE_VARIATION_FILE' 'carvariations.meta'
data_file 'VEHICLE_LAYOUTS_FILE'   'vehiclelayouts.meta'

client_script 'vehicle_names.lua'
