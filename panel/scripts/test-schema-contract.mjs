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
        if (ts.isStringLiteral(sql) || ts.isNoSubstitutionTemplateLiteral(sql)) {
          if (/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|EXPLAIN)\b/i.test(sql.text)) {
            const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
            statements.push({ file, line, sql: sql.text });
          }
        } else if (ts.isTemplateExpression(sql) || ts.isIdentifier(sql)) {
          const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
          const reviewed = file === "src/lib/db.ts" ||
            (file === "src/app/factions/page.tsx" && line === 104) ||
            (file === "src/app/players/page.tsx" && (line === 47 || line === 55));
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

// The only non-wrapper dynamic SQL in panel/src: finite, server-authored
// fragments for faction IN-list size and player directory search variants.
const search = "WHERE c.firstname LIKE ? OR c.lastname LIKE ? OR CONCAT(c.firstname, ' ', c.lastname) LIKE ?";
statements.push(
  { file: "src/app/factions/page.tsx", line: 104, sql: "SELECT job, COUNT(*) AS member_count FROM characters WHERE job IN (?) GROUP BY job" },
  { file: "src/app/players/page.tsx", line: 47, sql: "SELECT COUNT(*) AS total FROM characters c" },
  { file: "src/app/players/page.tsx", line: 47, sql: `SELECT COUNT(*) AS total FROM characters c ${search}` },
  { file: "src/app/players/page.tsx", line: 55, sql: "SELECT c.id, c.firstname, c.lastname, c.level, c.respect_points, c.job, c.last_played FROM characters c ORDER BY c.level DESC, c.respect_points DESC, c.id ASC LIMIT ? OFFSET ?" },
  { file: "src/app/players/page.tsx", line: 55, sql: `SELECT c.id, c.firstname, c.lastname, c.level, c.respect_points, c.job, c.last_played FROM characters c ${search} ORDER BY c.level DESC, c.respect_points DESC, c.id ASC LIMIT ? OFFSET ?` },
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
