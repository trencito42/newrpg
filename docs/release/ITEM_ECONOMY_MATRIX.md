# Item Economy Matrix

Canonical static inventory map generated from current code on 2026-10-03. “Review” means no literal shop, craft output, or direct server reward was detected; it is a release checklist item, not proof that an item is impossible to obtain.

| item_id | label | source(s) | sink(s) | used_by | sell_value | craft_input | craft_output | quest use | faction use | obtainable? | orphan? | notes |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|
| water | Water Bottle | shop | use | sunset_core, sunset_inventory, sunset_pass | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| bread | Bread | shop | use | sunset_core, sunset_inventory, sunset_pass | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| burger | Burger | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| sandwich | Sandwich | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| pizza_slice | Pizza Slice | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| hotdog | Hot Dog | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| chips | Potato Chips | shop | use | sunset_luckywheel | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| cookies | Cookies | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| chocolate | Chocolate Bar | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| apple | Apple | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| banana | Banana | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| soda | Sprunk | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| coffee | Coffee | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| energy_drink | Energy Drink | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| juice | Fruit Juice | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| beer | Beer | configured gameplay/loot | use | sunset_casino, sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| wine | Wine Glass | configured gameplay/loot | use | sunset_casino, sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| whiskey | Whiskey | configured gameplay/loot | use | sunset_casino, sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| cocktail | Cocktail | configured gameplay/loot | use | sunset_casino, sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| champagne | Champagne | configured gameplay/loot | use | sunset_casino, sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| casino_chips | Casino Chips | server reward | server consume | sunset_blackjack, sunset_casino, sunset_luckywheel, sunset_roulette, sunset_slots | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| phone | Phone | shop | none detected | sunset_core, sunset_inventory, sunset_menu, sunset_phone, sunset_ui | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| id_card | ID Card | configured gameplay/loot | none detected | sunset_core, sunset_documents, sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| repairkit | Repair Kit | crafting | use | sunset_core, sunset_luckywheel | — | no | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| bandage | Bandage | crafting, shop | craft input, use | sunset_core, sunset_inventory, sunset_luckywheel, sunset_pass | — | yes | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| medkit | Field Medkit | crafting | use | sunset_core | — | no | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| painkillers | Painkillers | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| cigarette | Cigarette | shop | use | sunset_inventory | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| lockpick | Lockpick | crafting, shop | server consume, use | sunset_carjack, sunset_core, sunset_pass, sunset_robbery, sunset_ui | — | no | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| metal_scrap | Metal Scrap | configured gameplay/loot | craft input | sunset_jobs | — | yes | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| plastic | Plastic | configured gameplay/loot | craft input | sunset_jobs | — | yes | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| cloth | Cloth | configured gameplay/loot | craft input | sunset_jobs | — | yes | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| chemicals | Chemicals | shop | craft input | sunset_drugs | — | yes | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| gunpowder | Gunpowder | server reward | craft input | sunset_carjack | — | yes | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| sealed_pouch | Sealed Pouch | crafting | use | sunset_core | — | no | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| shiv | Shiv | crafting | none detected | sunset_core | — | no | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| gas_can | Gas Can | shop | use | sunset_inventory, sunset_vehicles | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fresh_fish | Fresh Fish | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fish_common | Common Fish | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fish_uncommon | Uncommon Fish | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fish_rare | Rare Fish | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fish_epic | Epic Fish | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fish_legendary | Legendary Fish | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| bait_worm | Worm Bait | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| bait_lure | Artificial Lure | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| bait_premium | Premium Bait | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fishing_rod_1 | Fishing Rod Mk1 | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fishing_rod_2 | Fishing Rod Mk2 | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fishing_rod_3 | Fishing Rod Mk3 | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fishing_rod_4 | Fishing Rod Mk4 | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| fishing_rod_5 | Fishing Rod Mk5 | configured gameplay/loot | none detected | sunset_fishingshop, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_flashlight | Heavy-Duty Flashlight | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_bat | Baseball Bat | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_knife | Utility Knife | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_snspistol | SNS Pistol | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_pistol | Pistol | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_vintagepistol | Vintage Pistol | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_pumpshotgun | Pump Shotgun | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weapon_sniperrifle | Hunting Rifle | shop | none detected | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| venison | Venison | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| boar_meat | Boar Meat | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| animal_hide | Animal Hide | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| coyote_pelt | Coyote Pelt | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| antlers | Antlers | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| hunting_knife | Hunting Knife | shop | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| ammo_rifle | Rifle Ammo (10) | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| salvage_parts | Salvage Parts | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| marine_electronics | Marine Electronics | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| sealed_cargo | Sealed Cargo | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| marine_artifact | Marine Artifact | configured gameplay/loot | none detected | sunset_core, sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| scuba_gear | Basic Scuba Set | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| standard_tank | Standard Dive Tank | none detected | none detected | catalog only | — | no | no | no | no | review | yes | Static literal analysis; dynamic loot paths require live verification. |
| advanced_tank | Advanced Dive Tank | configured gameplay/loot | none detected | sunset_jobs | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| ammo_9mm | 9mm Ammo Box (24) | crafting, shop | use | sunset_core | — | no | yes | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| ammo_shotgun | 12 Gauge Shells (12) | shop | use | catalog only | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_silver_watch | Stolen Silver Watch | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_luxury_watch | Stolen Luxury Watch | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_gold_watch | Stolen Gold Watch | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_diamond_watch | Stolen Diamond Watch | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_collector_watch | Stolen Collector Watch | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_bracelet | Stolen Bracelet | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_gold_chain | Stolen Gold Chain | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_gold_bracelet | Stolen Gold Bracelet | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| stolen_diamond_jewelry | Stolen Designer Jewelry | configured gameplay/loot | none detected | sunset_robbery | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weed_leaf | Weed Leaf | configured gameplay/loot | none detected | sunset_drugs, sunset_test_agent | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| weed_brick | Weed Brick | configured gameplay/loot | none detected | sunset_drugs, sunset_test_agent | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| coke_leaf | Coca Leaf | configured gameplay/loot | none detected | sunset_drugs, sunset_test_agent | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| coke_brick | Coke Brick | configured gameplay/loot | none detected | sunset_drugs, sunset_test_agent | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| meth_chemical | Meth Chemical | configured gameplay/loot | none detected | sunset_drugs, sunset_test_agent | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
| meth_bag | Meth Bag | configured gameplay/loot | none detected | sunset_drugs, sunset_test_agent | — | no | no | no | no | yes | no | Static literal analysis; dynamic loot paths require live verification. |
