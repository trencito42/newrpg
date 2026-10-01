import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

test.skip(process.env.PANEL_E2E_AUTH !== "1", "Opt in with a disposable panel_test MariaDB fixture");

async function fixtureDb() {
  if (!process.env.DB_NAME?.startsWith("panel_test") || process.env.DB_PORT !== "3307") {
    throw new Error("Authenticated E2E tests may only mutate the disposable panel_test DB on port 3307");
  }
  return mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
}

async function login(page: Page, username = "e2e_citizen") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e_password_only");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
}

test("successful login, owner finances, logout and anonymous denial", async ({ page, context }) => {
  await login(page);
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === "sunset_panel_session");
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.value.length).toBeGreaterThan(32);
  expect(await page.content()).not.toContain(sessionCookie!.value);
  await page.goto("/players/E2E_Citizen");
  await expect(page.getByText("Cash on Hand (Private)")).toBeVisible();
  await expect(page.getByText("$4,321")).toBeVisible();
  await expect(page.getByText("$9,876")).toBeVisible();
  await expect(page.getByText("PRIVATE_WARNING_DETAILS_SENTINEL")).toHaveCount(0);
  await expect(page.getByText("PRIVATE_STAFF_SENTINEL")).toHaveCount(0);
  await page.locator('form[action="/api/auth/logout"]:visible button').first().click();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("character switch form and session revocation work", async ({ page, browser }) => {
  await login(page);
  await page.goto("/account");
  await page.locator('form[action="/api/auth/switch-character"] button').first().click();
  await page.reload();
  await expect(page.getByText("E2E Second", { exact: true }).last().locator("xpath=../../..")).toContainText("Active Character");

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    await login(otherPage);
    await page.goto("/account");
    await page.getByRole("button", { name: "Revoke Others" }).click();
    await expect.poll(async () => {
      const db = await fixtureDb();
      try {
        const [rows] = await db.query<mysql.RowDataPacket[]>(
          "SELECT COUNT(*) AS active_count FROM panel_web_sessions s JOIN accounts a ON a.id=s.account_id WHERE a.username='e2e_citizen' AND s.revoked_at IS NULL AND s.expires_at > NOW()"
        );
        return Number(rows[0].active_count);
      } finally { await db.end(); }
    }).toBe(1);
    await otherPage.goto("/account");
    await expect(otherPage).toHaveURL(/\/login$/);
  } finally {
    await otherContext.close();
  }
});

test("poll vote, duplicate vote and cross-poll option are enforced", async ({ page }) => {
  const db = await fixtureDb();
  let pollA = 0, optionA = 0, optionB = 0;
  try {
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT p.id, o.id option_id, p.title_en FROM panel_polls p JOIN panel_poll_options o ON o.poll_id=p.id WHERE p.title_en IN ('E2E Poll A','E2E Poll B')"
    );
    pollA = rows.find((row) => row.title_en === "E2E Poll A")!.id;
    optionA = rows.find((row) => row.title_en === "E2E Poll A")!.option_id;
    optionB = rows.find((row) => row.title_en === "E2E Poll B")!.option_id;
    const [account] = await db.query<mysql.RowDataPacket[]>("SELECT id FROM accounts WHERE username='e2e_citizen'");
    await db.execute("DELETE FROM panel_poll_votes WHERE poll_id=? AND account_id=?", [pollA, account[0].id]);
    await db.execute("UPDATE panel_poll_options SET votes_count=0 WHERE id=?", [optionA]);
  } finally { await db.end(); }

  await login(page);
  const cross = await page.evaluate(async ({ pollA, optionB }) => {
    const response = await fetch("/api/polls/vote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId: pollA, optionId: optionB }),
    });
    return response.status;
  }, { pollA, optionB });
  expect(cross).toBe(400);
  await page.goto(`/polls/${pollA}`);
  await page.getByText("Choice A", { exact: true }).first().click();
  await page.getByRole("button", { name: "Submit Ballot" }).click();
  await expect(page.getByText(/vote has been securely recorded|already cast your vote/i)).toBeVisible();
  await expect.poll(async () => {
    const check = await fixtureDb();
    try {
      const [rows] = await check.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM panel_poll_votes v JOIN accounts a ON a.id=v.account_id WHERE a.username='e2e_citizen' AND v.poll_id=? AND v.option_id=?",
        [pollA, optionA]
      );
      return Number(rows[0].n);
    } finally { await check.end(); }
  }).toBe(1);
  const duplicate = await page.evaluate(async ({ pollA, optionA }) => {
    const response = await fetch("/api/polls/vote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId: pollA, optionId: optionA }),
    });
    return response.status;
  }, { pollA, optionA });
  expect(duplicate).toBe(409);
});

test("support ticket is created atomically", async ({ page }) => {
  await login(page);
  const foreignBan = await page.evaluate(async () => {
    const response = await fetch("/api/unban", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banId: 999999, reason: "This ban does not belong to my test account." }),
    });
    return response.status;
  });
  expect(foreignBan).toBe(403);
  await page.goto("/support/tickets");
  const subject = `E2E ticket ${Date.now()}`;
  await page.getByPlaceholder("Brief summary of your question").fill(subject);
  await page.getByPlaceholder("Provide all relevant details for staff to assist you").fill("This is an isolated end-to-end ticket fixture.");
  await page.getByRole("button", { name: "Submit Support Ticket" }).click();
  await expect(page.getByText(subject)).toBeVisible();
});

test("complaint evidence and thread are visible only to involved accounts or staff", async ({ page, browser }) => {
  const db = await fixtureDb();
  let complaintId = 0;
  try {
    const [admin] = await db.query<mysql.RowDataPacket[]>(
      "SELECT a.id account_id, c.id character_id FROM accounts a JOIN players p ON p.account_id=a.id JOIN characters c ON c.player_id=p.id WHERE a.username='e2e_admin' LIMIT 1"
    );
    const [insert] = await db.execute<mysql.ResultSetHeader>(
      "INSERT INTO panel_complaints (accuser_account_id,accuser_character_id,accused_character_id,accused_name,category,title,evidence_text) VALUES (?,?,?,?,'other',?,?)",
      [admin[0].account_id, admin[0].character_id, admin[0].character_id, "E2E Admin", "E2E private complaint", "PRIVATE_COMPLAINT_EVIDENCE_SENTINEL"]
    );
    complaintId = insert.insertId;
    await page.goto("/support/complaints");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(`/support/complaints/${complaintId}`);
    await expect(page.getByText("PRIVATE_COMPLAINT_EVIDENCE_SENTINEL")).toHaveCount(0);
    const anonymousApi = await page.evaluate(async (id) => (await fetch(`/api/complaints/${id}`)).status, complaintId);
    expect(anonymousApi).toBe(401);

    await login(page);
    await page.goto("/support/complaints");
    await expect(page.getByText("E2E private complaint")).toHaveCount(0);
    await page.goto(`/support/complaints/${complaintId}`);
    await expect(page.getByText("PRIVATE_COMPLAINT_EVIDENCE_SENTINEL")).toHaveCount(0);
    const outsiderApi = await page.evaluate(async (id) => (await fetch(`/api/complaints/${id}`)).status, complaintId);
    expect(outsiderApi).toBe(404);

    const staffContext = await browser.newContext();
    try {
      const staffPage = await staffContext.newPage();
      await login(staffPage, "e2e_admin");
      await staffPage.goto("/support/complaints");
      await expect(staffPage.getByText("E2E private complaint")).toBeVisible();
      await staffPage.goto(`/support/complaints/${complaintId}`);
      await expect(staffPage.getByText("PRIVATE_COMPLAINT_EVIDENCE_SENTINEL")).toBeVisible();
    } finally { await staffContext.close(); }
  } finally {
    if (complaintId) await db.execute("DELETE FROM panel_complaints WHERE id=?", [complaintId]);
    await db.end();
  }
});

test("staff can queue actions, citizen cannot spoof actor or inspect another queue", async ({ page, browser }) => {
  const db = await fixtureDb();
  let targetAccountId = 0;
  let targetCharacterId = 0;
  try {
    const [target] = await db.query<mysql.RowDataPacket[]>(
      "SELECT a.id account_id, c.id character_id FROM accounts a JOIN players p ON p.account_id=a.id JOIN characters c ON c.player_id=p.id WHERE a.username='e2e_citizen' ORDER BY c.id LIMIT 1"
    );
    targetAccountId = Number(target[0].account_id);
    targetCharacterId = Number(target[0].character_id);
    await db.execute("DELETE FROM panel_action_queue WHERE actor_account_id=(SELECT id FROM accounts WHERE username='e2e_admin')");
  } finally { await db.end(); }
  await login(page, "e2e_admin");
  await page.goto("/staff/dashboard");
  await expect(page.getByText("Staff Moderation Center")).toBeVisible();
  await page.goto("/players/E2E_Citizen");
  await expect(page.getByText("Staff actions")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByPlaceholder("Reason (required)").fill("Isolated test warning request");
  await page.getByRole("button", { name: "Send to FiveM" }).click();
  const status = page.getByRole("status").filter({ hasText: "Queued" });
  await expect(status).toBeVisible();
  const queueId = Number((await status.innerText()).match(/#(\d+)/)?.[1]);
  expect(queueId).toBeGreaterThan(0);

  for (const action of ["ban", "mute", "unban", "set_faction"] as const) {
    const requestId = randomUUID();
    const body = {
      requestId, action, targetAccountId, targetCharacterId,
      reason: `Isolated ${action} queue test`,
      ...(action === "mute" ? { durationMin: 5 } : {}),
      ...(action === "set_faction" ? { factionId: null, factionGrade: 0 } : {}),
    };
    const first = await page.evaluate(async (payload) => {
      const response = await fetch("/api/staff/actions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      return { status: response.status, data: await response.json() };
    }, body);
    expect(first.status, action).toBe(202);
    expect(first.data.status, action).toBe("pending");
    const duplicate = await page.evaluate(async (payload) => {
      const response = await fetch("/api/staff/actions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      return response.json();
    }, body);
    expect(duplicate.id, action).toBe(first.data.id);
  }

  const citizenContext = await browser.newContext();
  const citizenPage = await citizenContext.newPage();
  try {
    await login(citizenPage);
    const read = await citizenPage.evaluate(async (id) => (await fetch(`/api/staff/actions?id=${id}`)).status, queueId);
    expect(read).toBe(404);
    const spoof = await citizenPage.evaluate(async (requestId) => {
      const response = await fetch("/api/staff/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "ban", targetAccountId: 5, reason: "spoofed actor" }),
      });
      return response.status;
    }, randomUUID());
    expect(spoof).toBe(403);
  } finally { await citizenContext.close(); }
});
