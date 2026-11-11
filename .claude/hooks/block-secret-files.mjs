#!/usr/bin/env node
// PreToolUse hook for Bash: refuse shell commands that touch real secrets files
// (.env, .env.local, .env.production, ..., supabase CLI credentials). .env.example is allowed.
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // never block on a malformed payload
}

const cmd = String(input?.tool_input?.command ?? "");
const SECRET_ENV = /(^|[^A-Za-z0-9_])\.env(\.(local|development|production|staging|test))*([^A-Za-z0-9_.]|$)/;
const SUPABASE_CREDS = /(^|[\s"'=/])~?\/?\.supabase(\/|\s|$)|supabase\/\.env|\bSUPABASE_(SERVICE_ROLE_KEY|ACCESS_TOKEN|DB_PASSWORD)\b/;
const DUMP_ENV = /(^|[;&|]\s*)(printenv|env)(\s*$|\s*[;&|])/;

if (SECRET_ENV.test(cmd) || SUPABASE_CREDS.test(cmd) || DUMP_ENV.test(cmd)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Blocked: this command would read or print a secrets file or key (.env*, Supabase credentials). Use .env.example to see variable names; ask the user to edit .env.local themselves.",
      },
    })
  );
}
process.exit(0);
