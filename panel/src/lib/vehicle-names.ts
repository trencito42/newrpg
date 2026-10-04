/**
 * Model ids are technical identifiers. Friendly labels live in the shared
 * vehicle catalog; this fallback keeps the web panel readable for streamed
 * addons that are intentionally absent from the dealership catalog.
 */
const ADDON_LABEL_DATA = `tempesta2|Tempesta Widebody
sentinel_rts|Sentinel RTS Track
d7cyp|Cypher GTS Spec
schlagenstr|Schlagen STR AMG
cometcup|Comet Cup Edition
h4rxst2|Harx ST2 GT
abfbuff|Buffalo Wide
ballvenm|Baller Venuum
ballvmark|Baller Interceptor
briosoav|Brioso X
briosoxpd|Brioso X Interceptor
carrion|Carrion
carrionmech|Carrion Service
carrionpd|Carrion Interceptor
cazador|Cazador
cazadorpd|Cazador Interceptor
cazadortcr|Cazador TCR
clubc|Carbon Club
clubp|Club Painted
clubr|Club R
clubrhyc|Club R Hycade
clubrpd|Club R Interceptor
cometnor|Comet Noire
cometven|Comet Venuum
coquettepiston|Coquette X
coqvenm|Coquette Venuum
cyphx|Cypher X
dawn|Dawn
dawnpd|Dawn Interceptor
drafthyc|Drafter Hycade
draftven|Drafter Venuum
draftvmark|Drafter Interceptor
dubmono|Dubsta Mono
elegyxa19|Elegy X
elegyxa19ven|Elegy X Venuum
flashgrs|Flash GRS
flashgrspd|Flash GRS Interceptor
flattruckm|Flat Truck
gaterback|Tailgater Sportback
gazatar|Gazer Wide
hweevil|Weevil Halloween
hycadetail|Tailgater Hycade
hycbansh|Banshee Hycade
hycbuff|Buffalo Hycade
hycdeity|Deity Hycade
hycenty|Entity MT Hycade
hycgaunt|Gauntlet Hycade
hycignus|Ignus Hycade
hycpargn|Paragon Hycade
hycr300|300R Hycade
hycsedan|Rhinehart Hycade
hyctailpd|Tailgater Hycade Interceptor
hycwagen|Wagen Hycade
hyczr350|ZR350 Hycade
issiwider|Issi Widebody
jestvenm|Jester Venuum
jubven|Jubilee Venuum
jubvenpd|Jubilee Venuum Interceptor
kanjoep4|Kanjo EP4
kanjox|Kanjo X
kcjub|Jubilee Offroad
komtmark|Komoda Interceptor
komtour|Komoda Touring
kurxa19|Kuruma X
kurxmark|Kuruma Interceptor
neonvenm|Neon Venuum
omnvenpd|Omnis Venuum Interceptor
paragonven|Paragon Venuum
parawide|Paragon X
parawmark|Paragon Interceptor
reblax|Rebla X
reblaxpd|Rebla X Interceptor
remusx|Remus X
rhinea19x|Rhinehart X
rhinea19xpd|Rhinehart X Interceptor
rsxven|Itali RSX Venuum
rt3000varis|RT3000 Varis
rt3kavan|RT3000 X
rwagvenm|Wagen Venuum
schlag|Schlagen GTR
schlagpd|Schlagen GTR Interceptor
sedanwid|Rhinehart Widebody
sen5tour|Sentinel V Touring
sen5tourhyc|Sentinel V Touring Hycade
sent5bxane|Sentinel V Xane
sent5hyc|Sentinel V Hycade
sent5wide|Sentinel V Widebody
shenron|Shenron
shenronpd|Shenron Interceptor
sitavenm|Corsita Venuum
sr8|SR8
sr8elem|SR8 Element
sr8pd|SR8 Interceptor
srhatpd|SR Hatch Interceptor
srspback|SR Sportback
str|Schneider STR
strcoupe|Schneider STR Coupe
strcoupepd|Schneider STR Coupe Interceptor
strman|Schneider STR Custom
strmark|Schneider STR Interceptor
strwag|Schneider STR Wagon
strwagmark|Schneider STR Wagon Interceptor
sugoix|Sugoi X
sultlong|Sultan Longbody
sultlpd|Sultan Longbody Interceptor
tailgatersr|Tailgater SR
tailsr66|Tailgater SR66
tailstmk|Tailgater Interceptor
taurion|Taurion
taurionpd|Taurion Interceptor
temphyc|Tempesta Hycade
temptwins|Tempesta Twins
tenfhyc|10F Hycade
tenfhycpd|10F Hycade Interceptor
tenfvenm|10F Venuum
thraxven|Thrax Venuum
toroslbwk|Toros Widebody
torosven|Toros Venuum
tragambo|Trager Ambulance
trager|Trager
tragmech|Trager Mechanic
tragpd|Trager Interceptor
turisgt3|Turismo GT3
uranusx|Uranus X
varx|Var X
verusreg|Verus Regen
xlsstr|XLS STR
xlsstrpd|XLS STR Interceptor
zentven|Zentorno Venuum
zr350piston|ZR350 X
tol22m5|Rhinehart G30
tol240sx|Remus 240
tol3j50|J50 Concept
tol675ltsp|T20 LT Spider
tol700|700R
tola6|Tailgater A6
tolap2|Aphelion
tolaudidy|10F Concept
tolbt62r|Apex R
tolc63|Schafter C63
tolc7|Coquette C7
tolcharger2|Buffalo STX-R
tolcurus|Toros S
toldemon|Gauntlet Demon
toldurus|Durus
tole36prb|Sentinel Classic RS
tole36v|Sentinel Classic Safari
tole6314|Zion V10
tolevo9|Kuruma IX
tolexor|Vigero ZX
tolf360|Turismo 360
tolf8spider|Furia Spider
tolfxxk|Turismo XX
tolgtam21|Schlagen GT
tolgtr|Elegy R35
tolgtrlw|Elegy R35 Widebody
tolka|Entity KR
tollam2|Tempesta V10
tollwalk458|Itali Widebody
tolm5cs22|Rhinehart CS
tolm5e60|Oracle V10
tolm6x6|Dubsta 6x6
tolmig|MIG GT
tolmm6x6|Dubsta 6x6 Custom
tolmus2|Dominator Custom
tolmustan|Dominator GT
tolmustang|Dominator GTX
tolpeigerzen|Peiger Zen
tolr33|Elegy Retro R33
tolr8c|10F Coupe
tolr8v10|10F V10
tolraid|Raid Prototype
tolraptorv2|Caracara Baja
tolrrmansory|Jubilee Atelier
tolrs5|Tailgater RS5
tolrs6|Tailgater RS6
tolrs7c821|Tailgater RS7
tolrsurus|Toros RS
tols63amg|Schafter S63`;

const ADDON_LABELS = new Map(
  ADDON_LABEL_DATA.split("\n").map((row) => {
    const separator = row.indexOf("|");
    return [row.slice(0, separator), row.slice(separator + 1)] as const;
  })
);

export function vehicleDisplayName(model: string | null | undefined, label?: string | null): string {
  const clean = label?.trim();
  if (clean && !/^(null|carnotfound|undefined|nil)$/i.test(clean)) return clean;

  const key = (model || "").trim().toLowerCase();
  const addonLabel = ADDON_LABELS.get(key);
  if (addonLabel) return addonLabel;

  const fallback = key.replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  if (!fallback || /^0x[0-9a-f]+$/i.test(fallback)) return "Vehicle";
  return fallback.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
