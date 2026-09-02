/**
 * Secure, interactive first-admin bootstrap.
 *
 * Run locally / on the server (never over HTTP):
 *
 *   npm run admin:create
 *
 * This is the ONLY supported way to create an ADMIN account. It:
 *  - prompts for email, username, and password interactively (password
 *    input is not echoed to the terminal)
 *  - refuses weak passwords
 *  - refuses if an account with that email/username already exists
 *  - hashes the password before storing it (never stores plaintext)
 *  - never prints the password back out
 *  - is not reachable as a public API endpoint
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { users } from '@/src/db/schema';
import { hashPassword } from '@/src/lib/password';

function readHidden(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const anyStdin = stdin as unknown as { isTTY?: boolean };
    if (!anyStdin.isTTY) {
      // Fallback for non-interactive shells: still reads the value, just visibly.
      rl.question(prompt).then(resolve);
      return;
    }
    stdout.write(prompt);
    const onData = (char: Buffer) => {
      const c = char.toString('utf8');
      if (c === '\n' || c === '\r' || c === '\u0004') {
        stdin.setRawMode?.(false);
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(buffer);
        return;
      }
      if (c === '\u0003') {
        process.exit(1);
      }
      if (c === '\u007f') {
        buffer = buffer.slice(0, -1);
        return;
      }
      buffer += c;
    };
    let buffer = '';
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log('QazvuCart — First Admin Bootstrap');
  console.log('This creates a single ADMIN account. It is not exposed via any API.\n');

  const email = (await rl.question('Admin email: ')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Invalid email address.');
    rl.close();
    process.exit(1);
  }

  const username = (await rl.question('Admin username: ')).trim();
  if (username.length < 3) {
    console.error('Username must be at least 3 characters.');
    rl.close();
    process.exit(1);
  }

  const password = await readHidden(rl, 'Admin password (input hidden): ');
  if (!isStrongPassword(password)) {
    console.error(
      'Password too weak. Require at least 12 characters, including upper case, lower case, and a digit.'
    );
    rl.close();
    process.exit(1);
  }
  const confirm = await readHidden(rl, 'Confirm password: ');
  if (password !== confirm) {
    console.error('Passwords do not match.');
    rl.close();
    process.exit(1);
  }

  const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail) {
    console.error('An account with this email already exists.');
    rl.close();
    process.exit(1);
  }
  const [existingUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existingUsername) {
    console.error('This username is already taken.');
    rl.close();
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    username,
    email,
    phone: '',
    passwordHash,
    role: 'ADMIN',
    isVerified: true,
    avatarUrl: null,
  });

  console.log(`\nAdmin account created for ${email}. Password was not stored or logged in plaintext.`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin:', err instanceof Error ? err.message : err);
  process.exit(1);
});
