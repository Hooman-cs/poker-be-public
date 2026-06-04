/**
 * @fileoverview Admin seed script — creates the first admin (or additional
 * admins) from the server shell. There is NO public admin-registration
 * endpoint by design — admin creation is a deliberate, traceable shell action.
 *
 * USAGE:
 *
 *   Interactive:
 *     npx tsx scripts/createAdmin.ts
 *     npx tsx --env-file=.env.local scripts/createAdmin.ts (if you don't have env vars in your shell)
 *     npx tsx --env-file=.env.local scripts/createAdmin.ts --password="your-12-char-password" (to skip password prompt)
 *
 *   Non-interactive (suitable for automation / CI seeds):
 *     npx tsx scripts/createAdmin.ts \
 *       --name="Alice Admin" \
 *       --email=alice@example.com \
 *       --mobile=9876543210 \
 *       --password=at-least-12-chars
 *
 *   Mixed: any flag you pass is used; anything missing is prompted for.
 *
 * NOTES:
 *   - Password input in interactive mode is masked (terminal echo off).
 *   - The Admin model's pre-save hook hashes the password with bcrypt;
 *     this script never touches plaintext beyond passing it in.
 *   - Validation (email format, 10-digit mobile, ≥12-char password) is
 *     enforced by the model. The script surfaces the model's error message
 *     and exits non-zero on failure.
 *   - MUST be run with the env (MONGODB_URI, DB_NAME) loaded. Use
 *     `--env-file=.env.local` or set vars in the shell.
 *
 * WHY THIS LIVES IN scripts/ AT REPO ROOT:
 *   It's operational — run from a shell, not part of the Next.js app build.
 *   Putting it under src/ would make Next include it; repo-root keeps it
 *   cleanly outside the app graph. See ARCHITECTURE.md.
 */

import readline from 'node:readline';
import mongoose from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Admin from '@/models/admin';

interface AdminInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

/**
 * Parses --key=value flags from process.argv. Returns whatever subset was
 * provided. Anything not on the command line will be prompted for.
 */
function parseArgs(): Partial<AdminInput> {
  const out: Partial<AdminInput> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(name|email|mobile|password)=(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    out[key as keyof AdminInput] = value;
  }
  return out;
}

/**
 * Reads one line of input from a shared readline interface. Used for ALL
 * prompts — name, email, mobile, and password. Sharing one interface across
 * all prompts is the fix for the previous bug where readline's hold on stdin
 * collided with a separately-attached raw-mode listener for the password
 * prompt (typing produced no input on VS Code's PowerShell terminal).
 */
function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Reads a password from the SAME readline interface used for other prompts,
 * but suppresses terminal echo so typed characters aren't visible. There is
 * no per-character feedback (no asterisks, no backspace flash) — the user
 * types blindly and hits Enter. This is the same UX as `sudo`, `ssh`, and
 * `git credential` prompts; it's the established convention, not a regression.
 *
 * Implementation note: this hijacks readline's internal `_writeToOutput` for
 * the duration of one prompt. That property is a longstanding but undocumented
 * convention — Node has kept it stable for years, and most "masked password
 * via readline" community examples rely on it. If Node ever rewrites readline,
 * this is the line that breaks; the script is small enough to repair quickly.
 *
 * Backspace and other editing keys work normally inside readline; they just
 * have no visible effect because output is suppressed.
 */
function promptPassword(rl: readline.Interface, question: string): Promise<string> {
  return new Promise<string>((resolve) => {
    // Save the original output function; restore it after the prompt resolves.
    const rlAny = rl as unknown as {
      _writeToOutput: (s: string) => void;
      output: NodeJS.WritableStream;
    };
    const originalWrite = rlAny._writeToOutput;

    // Show the question once, then suppress everything until newline.
    let promptShown = false;
    rlAny._writeToOutput = (s: string) => {
      if (!promptShown && s === question) {
        rlAny.output.write(s);
        promptShown = true;
        return;
      }
      // Allow newlines through so the cursor moves to the next line when Enter
      // is pressed. Suppress every other write (the per-character echo).
      if (s.includes('\n') || s.includes('\r')) {
        rlAny.output.write('\n');
      }
    };

    rl.question(question, (answer) => {
      rlAny._writeToOutput = originalWrite;
      resolve(answer);
    });
  });
}

/**
 * Fills in any missing fields by prompting the user interactively.
 * Loops until each required field is non-empty.
 */
async function gatherInput(provided: Partial<AdminInput>): Promise<AdminInput> {
  // One readline interface used for ALL prompts. Don't create per-prompt
  // interfaces — that was the source of the password-prompt-doesn't-respond bug.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const ask = async (
      field: keyof AdminInput,
      label: string,
      masked = false
    ): Promise<string> => {
      if (provided[field]) return provided[field]!;
      let value = '';
      while (!value) {
        value = masked
          ? await promptPassword(rl, `${label}: `)
          : await promptLine(rl, `${label}: `);
        if (!value) {
          process.stdout.write(`  ${label} cannot be empty.\n`);
        }
      }
      return value;
    };

    const name = await ask('name', 'Name');
    const email = await ask('email', 'Email');
    const mobile = await ask('mobile', 'Mobile (10 digits)');
    const password = await ask('password', 'Password (min 12 chars)', true);

    return { name, email, mobile, password };
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const provided = parseArgs();
  const input = await gatherInput(provided);

  await dbConnect();

  try {
    const admin = await Admin.create(input);
    // Avoid logging anything that could include the hash; just confirm by id+email.
    process.stdout.write(
      `\nAdmin created.\n  _id:   ${admin._id}\n  email: ${admin.email}\n  role:  ${admin.role}\n`
    );
  } catch (err) {
    // Mongoose validation errors carry a useful `message`; print and exit non-zero.
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nFailed to create admin: ${message}\n`);
    process.exitCode = 1;
  } finally {
    // dbConnect caches the connection on a global; close it so the script
    // can exit instead of hanging on an open mongoose pool.
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n${message}\n`);
  process.exitCode = 1;
});