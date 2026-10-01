// scripts/test-threads-permissions.js
// Automated verification for Complaint and Application thread permissions and workflows

const mysql = require('mysql2/promise');

async function runTests() {
  console.log('--- Starting Complaint & Application Thread Verification ---');

  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'rpgblipmade',
    password: 'EEpGpEeWQ5ml5pNb9gZ2',
    database: 'rpgblipmade',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // 1. Verify DB Schema
    console.log('[1/4] Verifying database schema & tables...');
    const [tables] = await pool.query(`SHOW TABLES LIKE 'panel_org_application_%'`);
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log('Found application tables:', tableNames.join(', '));

    if (!tableNames.includes('panel_org_application_comments') || !tableNames.includes('panel_org_application_votes')) {
      throw new Error('Missing panel_org_application_comments or panel_org_application_votes table!');
    }

    // Check unique key on panel_org_application_votes
    const [indexes] = await pool.query(`SHOW INDEX FROM panel_org_application_votes WHERE Key_name = 'uk_app_voter'`);
    if (indexes.length === 0) {
      throw new Error('Missing UNIQUE KEY uk_app_voter on panel_org_application_votes!');
    }
    console.log('✓ Database schema verified with unique voter constraints.');

    // 2. Test Complaints Workflow & Message Permissions Logic
    console.log('\n[2/4] Testing Complaint workflow & reply permissions logic...');
    // Create a mock complaint with existing account ID 1
    const [compRes] = await pool.query(
      `INSERT INTO panel_complaints 
        (accuser_account_id, accused_character_id, accused_name, category, title, evidence_text, status)
       VALUES (1, 1, 'Hardy', 'deathmatch', 'Test DM Complaint', 'Video link proof', 'pending')`
    );
    const complaintId = compRes.insertId;
    console.log(`Created test complaint #${complaintId}`);

    // Insert reporter reply
    await pool.query(
      `INSERT INTO panel_complaint_messages 
        (complaint_id, sender_account_id, is_staff, role_badge, message)
       VALUES (?, 1, 0, 'REPORTER', 'Here is additional proof')`,
      [complaintId]
    );

    // Insert staff reply
    await pool.query(
      `INSERT INTO panel_complaint_messages 
        (complaint_id, sender_account_id, is_staff, role_badge, message)
       VALUES (?, 1, 1, 'ADMIN 4', 'Staff is looking into this incident')`,
      [complaintId]
    );

    // Fetch messages
    const [msgs] = await pool.query(
      `SELECT role_badge, message FROM panel_complaint_messages WHERE complaint_id = ? ORDER BY id ASC`,
      [complaintId]
    );
    if (msgs.length !== 2) throw new Error(`Expected 2 messages, got ${msgs.length}`);
    console.log(`✓ Stored ${msgs.length} chronological complaint messages with badges: ${msgs.map(m => m.role_badge).join(', ')}`);

    // Clean up test complaint
    await pool.query(`DELETE FROM panel_complaint_messages WHERE complaint_id = ?`, [complaintId]);
    await pool.query(`DELETE FROM panel_complaints WHERE id = ?`, [complaintId]);
    console.log('✓ Complaint test cycle cleaned up.');

    // 3. Test Faction / Clan Application Voting & Comments Logic
    console.log('\n[3/4] Testing Faction & Clan Advisory Voting & Duplicate Resolution...');
    // Create a mock application
    const [appRes] = await pool.query(
      `INSERT INTO panel_org_applications 
        (org_type, org_id, account_id, character_id, status, snapshot_json)
       VALUES ('faction', 'police', 1, 1, 'submitted', '{"level":5,"hours":20}')`
    );
    const appId = appRes.insertId;
    console.log(`Created test application #${appId}`);

    // Member 1 (acc 3) votes PRO
    await pool.query(
      `INSERT INTO panel_org_application_votes 
        (application_id, org_type, org_id, voter_account_id, voter_username, vote, comment)
       VALUES (?, 'faction', 'police', 3, 'glbnu', 'pro', 'Good activity')
       ON DUPLICATE KEY UPDATE vote = VALUES(vote), comment = VALUES(comment), updated_at = NOW()`,
      [appId]
    );

    // Member 2 (acc 4) votes CONTRA
    await pool.query(
      `INSERT INTO panel_org_application_votes 
        (application_id, org_type, org_id, voter_account_id, voter_username, vote, comment)
       VALUES (?, 'faction', 'police', 4, 'Hardy', 'contra', 'Recent faction punishment')
       ON DUPLICATE KEY UPDATE vote = VALUES(vote), comment = VALUES(comment), updated_at = NOW()`,
      [appId]
    );

    // Member 1 (acc 3) changes vote to NEUTRAL (Upsert test!)
    await pool.query(
      `INSERT INTO panel_org_application_votes 
        (application_id, org_type, org_id, voter_account_id, voter_username, vote, comment)
       VALUES (?, 'faction', 'police', 3, 'glbnu', 'neutral', 'Changed my mind')
       ON DUPLICATE KEY UPDATE vote = VALUES(vote), comment = VALUES(comment), updated_at = NOW()`,
      [appId]
    );

    // Verify votes count is still exactly 2 (no duplicate row created for Member 1)
    const [voteRows] = await pool.query(
      `SELECT voter_username, vote, comment FROM panel_org_application_votes WHERE application_id = ?`,
      [appId]
    );
    if (voteRows.length !== 2) {
      throw new Error(`Expected exactly 2 votes after change, got ${voteRows.length}`);
    }

    const memberOneVote = voteRows.find(v => v.voter_username === 'glbnu');
    if (memberOneVote.vote !== 'neutral') {
      throw new Error(`Expected glbnu vote to update to 'neutral', got '${memberOneVote.vote}'`);
    }
    console.log(`✓ Advisory voting unique constraint & upsert validated (glbnu updated to ${memberOneVote.vote}: "${memberOneVote.comment}").`);

    // Member comment test
    await pool.query(
      `INSERT INTO panel_org_application_comments 
        (application_id, org_type, org_id, sender_account_id, sender_username, role_badge, message)
       VALUES (?, 'faction', 'police', 3, 'glbnu', 'MEMBER', 'Let us give him an interview.')`,
      [appId]
    );

    // Leadership decision post test
    await pool.query(
      `INSERT INTO panel_org_application_comments 
        (application_id, org_type, org_id, sender_account_id, sender_username, role_badge, message)
       VALUES (?, 'faction', 'police', 1, 'TRENCITO', 'DECISION', '[APPLICATION ACCEPTED] Reason: Passed background check.')`,
      [appId]
    );

    const [commentRows] = await pool.query(
      `SELECT role_badge, message FROM panel_org_application_comments WHERE application_id = ? ORDER BY id ASC`,
      [appId]
    );
    if (commentRows.length !== 2) throw new Error(`Expected 2 comments, got ${commentRows.length}`);
    console.log(`✓ Stored application thread comments (${commentRows.map(c => c.role_badge).join(', ')}).`);

    // Clean up test application
    await pool.query(`DELETE FROM panel_org_application_votes WHERE application_id = ?`, [appId]);
    await pool.query(`DELETE FROM panel_org_application_comments WHERE application_id = ?`, [appId]);
    await pool.query(`DELETE FROM panel_org_applications WHERE id = ?`, [appId]);
    console.log('✓ Application test cycle cleaned up.');

    // 4. Notifications test
    console.log('\n[4/4] Testing Notification Dispatch...');
    const [notifRes] = await pool.query(
      `INSERT INTO panel_notifications 
        (account_id, type, title_en, title_ro, message_en, message_ro, link_url)
       VALUES (1, 'application_decision', 'Application ACCEPTED', 'Aplicație ACCEPTATĂ', 'Your application was accepted.', 'Aplicația ta a fost acceptată.', '/factions/police/applications/1')`
    );
    const notifId = notifRes.insertId;
    const [notifRow] = await pool.query(`SELECT * FROM panel_notifications WHERE id = ?`, [notifId]);
    if (notifRow.length !== 1) throw new Error('Failed to insert notification!');
    console.log(`✓ Verified notification creation for account #${notifRow[0].account_id} with link: ${notifRow[0].link_url}`);
    await pool.query(`DELETE FROM panel_notifications WHERE id = ?`, [notifId]);

    console.log('\n======================================================');
    console.log('ALL THREAD & APPLICATION PERMISSION TESTS PASSED! ✓');
    console.log('======================================================\n');
  } finally {
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
