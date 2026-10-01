import mysql from "mysql2/promise";
import crypto from "node:crypto";

const socketPath = process.env.PANEL_TEST_DB_SOCKET;
const database = process.env.PANEL_TEST_DB_NAME;
if (!socketPath?.startsWith("/tmp/newrpg-panel-db.") || !database?.startsWith("panel_test")) {
  throw new Error("Refusing E2E fixture creation outside a disposable panel_test database/socket");
}
const db = await mysql.createConnection({ socketPath, user: "root", database });
const password = "e2e_password_only";
const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const hash = `$scrypt$32768$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;

async function insert(sql, params) {
  const [row] = await db.execute(sql, params);
  return row.insertId;
}

try {
  await db.beginTransaction();
  const citizen = await insert(
    "INSERT INTO accounts(username,email,language,password_hash,password_salt) VALUES (?,?,?,?,?)",
    ["e2e_citizen", "private-e2e@example.invalid", "en", hash, "unused"]
  );
  const admin = await insert(
    "INSERT INTO accounts(username,language,password_hash,password_salt,admin_level) VALUES (?,?,?,?,3)",
    ["e2e_admin", "en", hash, "unused"]
  );
  const player = await insert("INSERT INTO players(license,name,account_id) VALUES (?,?,?)",
    ["license:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "E2E Citizen", citizen]);
  const adminPlayer = await insert("INSERT INTO players(license,name,account_id) VALUES (?,?,?)",
    ["license:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "E2E Admin", admin]);
  const charSql = `INSERT INTO characters
    (player_id,slot,firstname,lastname,dateofbirth,position,appearance,metadata,level,paydays_received,cash,bank)
    VALUES (?,?,?,?,'2000-01-01','{}','{}','{}',10,50,4321,9876)`;
  const firstChar = await insert(charSql, [player, 1, "E2E", "Citizen"]);
  await insert(charSql, [player, 2, "E2E", "Second"]);
  await insert(charSql, [adminPlayer, 1, "E2E", "Admin"]);
  await insert("INSERT INTO vehicles(character_id,plate,model) VALUES (?,?,?)", [firstChar, "E2E123", "sultan"]);
  await insert("INSERT INTO properties(label,interior,entry,interior_pos,owner_character_id) VALUES (?,?,'{}','{}',?)",
    ["E2E Test House", "standard", firstChar]);
  await insert(`INSERT INTO admin_sanctions
    (action,target_account_id,target_character_id,target_name,admin_account_id,admin_name,reason)
    VALUES ('warn',?,?,?,?,?,?)`,
    [citizen, firstChar, "E2E Citizen", admin, "PRIVATE_STAFF_SENTINEL", "PRIVATE_WARNING_DETAILS_SENTINEL"]);
  const pollSql = `INSERT INTO panel_polls(title_en,title_ro,status,ends_at,created_by)
    VALUES (?,?,'active',DATE_ADD(NOW(), INTERVAL 1 DAY),?)`;
  const pollA = await insert(pollSql, ["E2E Poll A", "Sondaj E2E A", admin]);
  const pollB = await insert(pollSql, ["E2E Poll B", "Sondaj E2E B", admin]);
  const optionSql = "INSERT INTO panel_poll_options(poll_id,label_en,label_ro) VALUES (?,?,?)";
  await insert(optionSql, [pollA, "Choice A", "Alegerea A"]);
  await insert(optionSql, [pollB, "Choice B", "Alegerea B"]);
  await db.commit();
  console.log(JSON.stringify({ citizen, admin, firstChar, pollA, pollB, password: "test-only fixture password configured" }));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
