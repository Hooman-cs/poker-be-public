/**
 * @fileoverview Admin password reset — replaces the password on an existing
 * admin record. Separate from createAdmin.ts by deliberate scope:
 * createAdmin creates, this one updates. Neither does the other's job.
 *
 * USAGE:
 *
 *   Interactive:
 *     npx tsx --env-file=.env.local scripts/changeAdminPassword.ts
 *
 *   Non-interactive:
 *     npx tsx --env-file=.env.local scripts/changeAdminPassword.ts \
 *       --email=admin@gmail.com \
 *       --password=new-at-least-12-chars
 *
 *   Mixed: anything passed as a flag is used; missing values are prompted for.
 *
 * SAFETY:
 *   - The script looks up the admin by email and prints their name+email
 *     before doing anything. You confirm "yes" to proceed.
 *   - Only the password field is modified. Name, email, mobile, role,
 *     lastLogin — all untouched. Bcrypt hashing happens in the model's
 *     pre-save hook; this script never sees the hashed value.
 *   - If the email doesn't match any admin, the script exits with a clear
 *     error (does NOT create a new admin — that's createAdmin's job).
 */

import readline from 'node:readline';
import mongoose from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Admin from '@/models/admin';

interface ChangePasswordArgs {
  email?: string;
  password?: string;
}

function parseArgs(): ChangePasswordArgs {
  const out: ChangePasswordArgs = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(email|password)=(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    out[key as keyof ChangePasswordArgs] = value;
  }
  return out;
}

/**
 * Reads one line from a shared readline interface. Echoes normally — used
 * for email and the yes/no confirmation.
 */
function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Reads from the same readline but suppresses terminal echo. No per-character
 * feedback — same UX as `sudo` and `ssh`. The user types blindly and hits
 * Enter. The label tells them input is hidden so the behavior is expected.
 *
 * Implementation note: reaches into readline's `_writeToOutput`, an undocumented
 * but longstanding convention. If a future Node breaks it, this script breaks
 * loudly and is fixed in minutes. See createAdmin.ts for the same pattern.
 */
function promptPassword(rl: readline.Interface, question: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const rlAny = rl as unknown as {
      _writeToOutput: (s: string) => void;
      output: NodeJS.WritableStream;
    };
    const originalWrite = rlAny._writeToOutput;

    let promptShown = false;
    rlAny._writeToOutput = (s: string) => {
      if (!promptShown && s === question) {
        rlAny.output.write(s);
        promptShown = true;
        return;
      }
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

async function main(): Promise<void> {
  const provided = parseArgs();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Email — needed before any DB work so we know which admin to look up.
    let email = provided.email ?? '';
    while (!email) {
      email = await promptLine(rl, 'Email of admin to update: ');
      if (!email) {
        process.stdout.write('  Email cannot be empty.\n');
      }
    }

    await dbConnect();

    // Lookup happens BEFORE we ask for the new password — if the email doesn't
    // resolve to anyone, we exit cleanly without bothering the user for a
    // password they'd have typed for nothing.
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      process.stderr.write(
        `\nNo admin found with email "${email}".\n` +
          `(Use scripts/createAdmin.ts to create a new admin.)\n`
      );
      process.exitCode = 1;
      return;
    }

    // Confirm identity. The user must explicitly type "yes" before we proceed.
    // Anything else (including just hitting Enter, "y", "YES " with trailing
    // space, etc.) is treated as cancellation, to make accidental confirmation
    // hard.
    process.stdout.write(
      `\nFound admin:\n  name:  ${admin.name}\n  email: ${admin.email}\n  role:  ${admin.role}\n\n`
    );
    const confirm = await promptLine(rl, 'Update this admin\'s password? Type "yes" to proceed: ');
    if (confirm !== 'yes') {
      process.stdout.write('Cancelled. No changes made.\n');
      return;
    }

    // New password — interactive prompt if not provided as flag. Loops until
    // non-empty so we never accidentally set an empty password (the model
    // would reject it anyway, but a friendlier loop saves a confusing error).
    let password = provided.password ?? '';
    while (!password) {
      password = await promptPassword(rl, 'New password (min 12 chars, input hidden): ');
      if (!password) {
        process.stdout.write('  Password cannot be empty.\n');
      }
    }

    // The model's pre-save hook hashes the password whenever the field is
    // modified. Assigning + saving is therefore the correct way to update —
    // findOneAndUpdate would skip the hook and store plaintext, which would
    // be a real security bug.
    admin.password = password;
    await admin.save();

    process.stdout.write(
      `\nPassword updated.\n  _id:   ${admin._id}\n  email: ${admin.email}\n`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nFailed to update password: ${message}\n`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n${message}\n`);
  process.exitCode = 1;
});