import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import ts from "typescript";

const socketPath = process.env.PANEL_TEST_DB_SOCKET;
const database = process.env.PANEL_TEST_DB_NAME;
if (!socketPath?.startsWith("/tmp/newrpg-panel-db.") || !database?.startsWith("panel_test")) {
  throw new Error("Refusing schema test outside a disposable panel_test database/socket");
}

const queryNames = new Set(["dbQuery", "dbQuerySingle", "dbExecute", "query", "queryOne", "execute"]);
const fragments = {
  "src/app/api/staff/players/route.ts": { whereClause: ["", "WHERE a.username LIKE ?"] },
  "src/app/clans/[id]/applications/page.tsx": { statusFilter: ["a.status IN ('submitted', 'under_review')", "a.status = 'accepted'", "a.status = 'rejected'", "a.status = 'withdrawn'", "1=1"] },
  "src/app/factions/[slug]/applications/page.tsx": { statusFilter: ["a.status IN ('submitted', 'under_review')", "a.status = 'accepted'", "a.status = 'rejected'", "a.status = 'withdrawn'", "1=1"] },
  "src/app/players/page.tsx": { whereClause: ["", "WHERE a.username LIKE ?"] },
  "src/app/staff/audit/page.tsx": { whereClause: ["", "WHERE pal.action LIKE ? OR actor_acc.username LIKE ? OR target_acc.username LIKE ? OR pal.reason LIKE ?"] },
  "src/app/staff/players/page.tsx": { whereClause: ["", "WHERE a.username LIKE ?"] },
  "src/app/staff/sanctions/page.tsx": { whereSql: ["", "WHERE s.action = ?", "WHERE (s.target_name LIKE ? OR s.admin_name LIKE ? OR s.reason LIKE ?)", "WHERE s.action = ? AND (s.target_name LIKE ? OR s.admin_name LIKE ? OR s.reason LIKE ?)"] },
  "src/app/support/complaints/page.tsx": { whereSql: ["", "WHERE (c.accuser_account_id = ? OR p_accused.account_id = ?)", "WHERE c.status = 'pending'", "WHERE (c.accuser_account_id = ? OR p_accused.account_id = ?) AND c.status = 'under_review'"] },
  "src/lib/player-identity.ts": { placeholders: ["?", "?,?"] },
};
function expandTemplate(node, file) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (!ts.isTemplateExpression(node)) return null;
  let values = [node.head.text];
  for (const span of node.templateSpans) {
    const key = ts.isIdentifier(span.expression) ? span.expression.text : "";
    const alternatives = fragments[file]?.[key];
    if (!alternatives) return null;
    values = values.flatMap((value) => alternatives.map((fragment) => value + fragment + span.literal.text));
  }
  return values;
}
function expandVariable(ast, file, name) {
  let initializer = null;
  const appends = [];
  function scan(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer;
    if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left) && node.left.text === name && node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) {
      appends.push({ position: node.getStart(ast), optional: Boolean(node.parent?.parent && ts.isIfStatement(node.parent.parent)), values: expandTemplate(node.right, file) });
    }
    ts.forEachChild(node, scan);
  }
  scan(ast);
  if (!initializer) return null;
  let values = expandTemplate(initializer, file);
  if (!values || appends.some((entry) => !entry.values)) return null;
  for (const append of appends.sort((a, b) => a.position - b.position)) {
    const variants = append.optional ? ["", ...append.values] : append.values;
    values = values.flatMap((value) => variants.map((fragment) => value + fragment));
  }
  return values;
}
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
}
walk("src");

const statements = [];
let dynamic = 0;
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const name = ts.isIdentifier(expression) ? expression.text : ts.isPropertyAccessExpression(expression) ? expression.name.text : "";
      if (queryNames.has(name) && node.arguments.length > 0) {
        const sql = node.arguments[0];
        const expanded = ts.isIdentifier(sql) ? expandVariable(ast, file, sql.text) : expandTemplate(sql, file);
        if (expanded) {
          const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
          for (const statement of expanded) {
            if (/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|EXPLAIN)\b/i.test(statement)) {
              statements.push({ file, line, sql: statement });
            }
          }
        } else if (ts.isTemplateExpression(sql) || ts.isIdentifier(sql)) {
          const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
          const reviewed = file === "src/lib/db.ts" || file === "src/app/factions/page.tsx";
          if (!reviewed) {
            dynamic++;
            console.warn(`Dynamic query requires review: ${file}:${line}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

// Faction membership uses a finite server-authored IN-list placeholder count.
statements.push(
  { file: "src/app/factions/page.tsx", line: 104, sql: "SELECT job, COUNT(*) AS member_count FROM characters WHERE job IN (?) GROUP BY job" },
);

const connection = await mysql.createConnection({ socketPath, user: "root", database });
let failed = 0;
for (const item of statements) {
  try {
    const prepared = await connection.prepare(item.sql);
    await prepared.close();
  } catch (error) {
    failed++;
    console.error(`${item.file}:${item.line}: ${error.code || error.message}`);
  }
}
await connection.end();
console.log(`Prepared ${statements.length} static panel queries against ${database}: ${failed} failed, ${dynamic} dynamic query expressions require manual review.`);
if (failed || dynamic) process.exitCode = 1;
