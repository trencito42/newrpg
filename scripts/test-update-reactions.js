const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const phoneReact = fs.readFileSync(path.join(root, "panel/src/app/api/phone/updates/react/route.ts"), "utf8");
const panelReact = fs.readFileSync(path.join(root, "panel/src/app/api/updates/[slug]/react/route.ts"), "utf8");
const likers = fs.readFileSync(path.join(root, "panel/src/lib/update-likers-query.ts"), "utf8");
const sync = fs.readFileSync(path.join(root, "panel/src/lib/update-reaction-sync.ts"), "utf8");

assert.match(phoneReact, /clearAccountUpdateReactionForCharacter/);
assert.match(panelReact, /clearCharacterUpdateReactionsForAccount/);
assert.match(likers, /ROW_NUMBER\(\) OVER/);
assert.match(likers, /PARTITION BY COALESCE\(pl\.account_id, r\.reactor_id\)/);
assert.match(sync, /reactor_type = 'account'/);
assert.match(sync, /reactor_type = 'character'/);

console.log("test-update-reactions: 5 checks passed");
