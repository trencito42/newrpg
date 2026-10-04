-- Curated display names for third-party streamed vehicle packs.
-- Presentation only: technical model/spawn ids remain unchanged for DB, handling, hashes, and thumbnails.
-- Existing first-party addon labels from shared/display_names.lua stay authoritative.
-- Empty brand values are deliberate where the repository does not identify a reliable lore manufacturer.

local rows = [[
abfbuff|Buffalo Wide|Bravado
ballvenm|Baller Venuum|Gallivanter
ballvmark|Baller Interceptor|Gallivanter
briosoav|Brioso X|Grotti
briosoxpd|Brioso X Interceptor|Grotti
carrion|Carrion|
carrionmech|Carrion Service|
carrionpd|Carrion Interceptor|
cazador|Cazador|
cazadorpd|Cazador Interceptor|
cazadortcr|Cazador TCR|
clubc|Carbon Club|BF
clubp|Club Painted|BF
clubr|Club R|BF
clubrhyc|Club R Hycade|BF
clubrpd|Club R Interceptor|BF
cometnor|Comet Noire|Pfister
cometven|Comet Venuum|Pfister
coquettepiston|Coquette X|Invetero
coqvenm|Coquette Venuum|Invetero
cyphx|Cypher X|Ubermacht
dawn|Dawn|
dawnpd|Dawn Interceptor|
drafthyc|Drafter Hycade|Obey
draftven|Drafter Venuum|Obey
draftvmark|Drafter Interceptor|Obey
dubmono|Dubsta Mono|Benefactor
elegyxa19|Elegy X|Annis
elegyxa19ven|Elegy X Venuum|Annis
flashgrs|Flash GRS|
flashgrspd|Flash GRS Interceptor|
flattruckm|Flat Truck|
gaterback|Tailgater Sportback|Obey
gazatar|Gazer Wide|
hweevil|Weevil Halloween|BF
hycadetail|Tailgater Hycade|Obey
hycbansh|Banshee Hycade|Bravado
hycbuff|Buffalo Hycade|Bravado
hycdeity|Deity Hycade|Enus
hycenty|Entity MT Hycade|Overflod
hycgaunt|Gauntlet Hycade|Bravado
hycignus|Ignus Hycade|Pegassi
hycpargn|Paragon Hycade|Enus
hycr300|300R Hycade|Annis
hycsedan|Rhinehart Hycade|Ubermacht
hyctailpd|Tailgater Hycade Interceptor|Obey
hycwagen|Wagen Hycade|
hyczr350|ZR350 Hycade|Annis
issiwider|Issi Widebody|Weeny
jestvenm|Jester Venuum|Dinka
jubven|Jubilee Venuum|Enus
jubvenpd|Jubilee Venuum Interceptor|Enus
kanjoep4|Kanjo EP4|Dinka
kanjox|Kanjo X|Dinka
kcjub|Jubilee Offroad|Enus
komtmark|Komoda Interceptor|Lampadati
komtour|Komoda Touring|Lampadati
kurxa19|Kuruma X|Karin
kurxmark|Kuruma Interceptor|Karin
neonvenm|Neon Venuum|Pfister
omnvenpd|Omnis Venuum Interceptor|Obey
paragonven|Paragon Venuum|Enus
parawide|Paragon X|Enus
parawmark|Paragon Interceptor|Enus
reblax|Rebla X|Ubermacht
reblaxpd|Rebla X Interceptor|Ubermacht
remusx|Remus X|Annis
rhinea19x|Rhinehart X|Ubermacht
rhinea19xpd|Rhinehart X Interceptor|Ubermacht
rsxven|Itali RSX Venuum|Grotti
rt3000varis|RT3000 Varis|Dinka
rt3kavan|RT3000 X|Dinka
rwagvenm|Wagen Venuum|
schlag|Schlagen GTR|Benefactor
schlagpd|Schlagen GTR Interceptor|Benefactor
sedanwid|Rhinehart Widebody|Ubermacht
sen5tour|Sentinel V Touring|Ubermacht
sen5tourhyc|Sentinel V Touring Hycade|Ubermacht
sent5bxane|Sentinel V Xane|Ubermacht
sent5hyc|Sentinel V Hycade|Ubermacht
sent5wide|Sentinel V Widebody|Ubermacht
shenron|Shenron|
shenronpd|Shenron Interceptor|
sitavenm|Corsita Venuum|Lampadati
sr8|SR8|Obey
sr8elem|SR8 Element|Obey
sr8pd|SR8 Interceptor|Obey
srhatpd|SR Hatch Interceptor|Obey
srspback|SR Sportback|Obey
str|Schneider STR|
strcoupe|Schneider STR Coupe|
strcoupepd|Schneider STR Coupe Interceptor|
strman|Schneider STR Custom|
strmark|Schneider STR Interceptor|
strwag|Schneider STR Wagon|
strwagmark|Schneider STR Wagon Interceptor|
sugoix|Sugoi X|Dinka
sultlong|Sultan Longbody|Karin
sultlpd|Sultan Longbody Interceptor|Karin
tailgatersr|Tailgater SR|Obey
tailsr66|Tailgater SR66|Obey
tailstmk|Tailgater Interceptor|Obey
taurion|Taurion|
taurionpd|Taurion Interceptor|
temphyc|Tempesta Hycade|Pegassi
temptwins|Tempesta Twins|Pegassi
tenfhyc|10F Hycade|Obey
tenfhycpd|10F Hycade Interceptor|Obey
tenfvenm|10F Venuum|Obey
thraxven|Thrax Venuum|Truffade
toroslbwk|Toros Widebody|Pegassi
torosven|Toros Venuum|Pegassi
tragambo|Trager Ambulance|
trager|Trager|
tragmech|Trager Mechanic|
tragpd|Trager Interceptor|
turisgt3|Turismo GT3|Grotti
uranusx|Uranus X|
varx|Var X|
verusreg|Verus Regen|Dinka
xlsstr|XLS STR|Benefactor
xlsstrpd|XLS STR Interceptor|Benefactor
zentven|Zentorno Venuum|Pegassi
zr350piston|ZR350 X|Annis
tol22m5|Rhinehart G30|Ubermacht
tol240sx|Remus 240|Annis
tol3j50|J50 Concept|
tol675ltsp|T20 LT Spider|Progen
tol700|700R|
tola6|Tailgater A6|Obey
tolap2|Aphelion|Overflod
tolaudidy|10F Concept|Obey
tolbt62r|Apex R|Progen
tolc63|Schafter C63|Benefactor
tolc7|Coquette C7|Invetero
tolcharger2|Buffalo STX-R|Bravado
tolcurus|Toros S|Pegassi
toldemon|Gauntlet Demon|Bravado
toldurus|Durus|
tole36prb|Sentinel Classic RS|Ubermacht
tole36v|Sentinel Classic Safari|Ubermacht
tole6314|Zion V10|Ubermacht
tolevo9|Kuruma IX|Karin
tolexor|Exor|
tolf360|Turismo 360|Grotti
tolf8spider|Furia Spider|Grotti
tolfxxk|Turismo XX|Grotti
tolgtam21|Schlagen GT|Benefactor
tolgtr|Elegy R35|Annis
tolgtrlw|Elegy R35 Widebody|Annis
tolka|Entity KR|Overflod
tollam2|Tempesta V10|Pegassi
tollwalk458|Itali Widebody|Grotti
tolm5cs22|Rhinehart CS|Ubermacht
tolm5e60|Oracle V10|Ubermacht
tolm6x6|Dubsta 6x6|Benefactor
tolmig|MIG GT|
tolmm6x6|Dubsta 6x6 Custom|Benefactor
tolmus2|Dominator Custom|Vapid
tolmustan|Dominator GT|Vapid
tolmustang|Dominator GTX|Vapid
tolpeigerzen|Peiger Zen|
tolr33|Elegy Retro R33|Annis
tolr8c|10F Coupe|Obey
tolr8v10|10F V10|Obey
tolraid|Raid Prototype|
tolraptorv2|Caracara Baja|Vapid
tolrrmansory|Jubilee Atelier|Enus
tolrs5|Tailgater RS5|Obey
tolrs6|Tailgater RS6|Obey
tolrs7c821|Tailgater RS7|Obey
tolrsurus|Toros RS|Pegassi
tols63amg|Schafter S63|Benefactor
]]

for line in rows:gmatch('[^\r\n]+') do
    local model, label, brand = line:match('^([^|]+)|([^|]+)|(.*)$')
    if model and label then
        local key = SunsetVehicleNames.Key(model)
        if key ~= '' and SunsetVehicleNames.Addons[key] == nil then
            SunsetVehicleNames.Addons[key] = {
                label = label,
                brand = brand ~= '' and brand or nil,
            }
        end
    end
end
