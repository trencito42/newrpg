import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

const socketPath = process.env.PANEL_TEST_DB_SOCKET;
const database = process.env.PANEL_TEST_DB_NAME;
if (!socketPath?.startsWith("/tmp/newrpg-panel-db.") || !database?.startsWith("panel_test")) {
  throw new Error("Refusing invariant test outside a disposable panel_test database/socket");
}
const db = await mysql.createConnection({ socketPath, user: "root", database });
let checks = 0;
function assert(condition, message) { if (!condition) throw new Error(message); checks++; }
async function expectCode(operation, code) {
  try { await operation(); } catch (error) { assert(error.code === code, `${code} expected, got ${error.code}`); return; }
  throw new Error(`${code} expected but operation succeeded`);
}

try {
  await db.beginTransaction();
  const [account] = await db.execute(
    "INSERT INTO accounts(username,password_hash,password_salt) VALUES (?,?,?)",
    [`panel_test_${Date.now()}`, "test_only", "test_only"]
  );
  const actor = account.insertId;
  const pollSql = "INSERT INTO panel_polls(title_en,title_ro,status,ends_at,created_by) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 1 DAY),?)";
  const [pollA] = await db.execute(pollSql, ["Test A", "Test A", "active", actor]);
  const [pollB] = await db.execute(pollSql, ["Test B", "Test B", "active", actor]);
  const [optionA] = await db.execute("INSERT INTO panel_poll_options(poll_id,label_en,label_ro) VALUES (?,?,?)", [pollA.insertId, "A", "A"]);
  const [optionB] = await db.execute("INSERT INTO panel_poll_options(poll_id,label_en,label_ro) VALUES (?,?,?)", [pollB.insertId, "B", "B"]);

  await expectCode(() => db.execute(
    "INSERT INTO panel_poll_votes(poll_id,option_id,account_id) VALUES (?,?,?)",
    [pollA.insertId, optionB.insertId, actor]
  ), "ER_NO_REFERENCED_ROW_2");
  await db.execute("INSERT INTO panel_poll_votes(poll_id,option_id,account_id) VALUES (?,?,?)", [pollA.insertId, optionA.insertId, actor]);
  await expectCode(() => db.execute("INSERT INTO panel_poll_votes(poll_id,option_id,account_id) VALUES (?,?,?)", [pollA.insertId, optionA.insertId, actor]), "ER_DUP_ENTRY");

  const requestId = randomUUID();
  const actionSql = "INSERT INTO panel_action_queue(request_id,actor_account_id,action,target_account_id,reason) VALUES (?,?,?,?,?)";
  const [action] = await db.execute(actionSql, [requestId, actor, "warn", actor, "test only"]);
  await expectCode(() => db.execute(actionSql, [requestId, actor, "warn", actor, "test only"]), "ER_DUP_ENTRY");
  const [claim] = await db.execute("UPDATE panel_action_queue SET status='processing',claimed_at=NOW() WHERE id=? AND status='pending'", [action.insertId]);
  assert(claim.affectedRows === 1, "pending action was not claimed");
  const [secondClaim] = await db.execute("UPDATE panel_action_queue SET status='processing' WHERE id=? AND status='pending'", [action.insertId]);
  assert(secondClaim.affectedRows === 0, "action was claimed twice");
  const [complete] = await db.execute("UPDATE panel_action_queue SET status='completed',completed_at=NOW() WHERE id=? AND status='processing'", [action.insertId]);
  assert(complete.affectedRows === 1, "processing action did not complete");
  await db.rollback();

  // Separate committed fixture lets two connections race for one account vote.
  const [raceAccount] = await db.execute(
    "INSERT INTO accounts(username,password_hash,password_salt) VALUES (?,?,?)",
    [`panel_race_${Date.now()}`, "test_only", "test_only"]
  );
  const [racePoll] = await db.execute(pollSql, ["Race", "Race", "active", raceAccount.insertId]);
  const [raceOption] = await db.execute(
    "INSERT INTO panel_poll_options(poll_id,label_en,label_ro) VALUES (?,?,?)",
    [racePoll.insertId, "One", "One"]
  );
  const second = await mysql.createConnection({ socketPath, user: "root", database });
  try {
    const voteSql = "INSERT INTO panel_poll_votes(poll_id,option_id,account_id) VALUES (?,?,?)";
    const voteArgs = [racePoll.insertId, raceOption.insertId, raceAccount.insertId];
    await db.beginTransaction();
    await second.beginTransaction();
    await db.execute(voteSql, voteArgs);
    const concurrent = expectCode(() => second.execute(voteSql, voteArgs), "ER_DUP_ENTRY");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await db.commit();
    await concurrent;
    await second.rollback();
    const [votes] = await db.execute("SELECT COUNT(*) AS n FROM panel_poll_votes WHERE poll_id=?", [racePoll.insertId]);
    assert(Number(votes[0].n) === 1, "concurrent vote created more than one row");
  } finally {
    await second.rollback();
    await second.end();
    await db.execute("DELETE FROM panel_polls WHERE id=?", [racePoll.insertId]);
    await db.execute("DELETE FROM accounts WHERE id=?", [raceAccount.insertId]);
  }
  console.log(`${checks} database invariant checks passed (test fixtures rolled back or removed).`);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
