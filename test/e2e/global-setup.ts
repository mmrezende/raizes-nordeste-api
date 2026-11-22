import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export default function globalSetup(): void {
  const prismaBin = join(process.cwd(), 'node_modules', '.bin', 'prisma');
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test-e2e.db',
    },
    stdio: 'pipe',
  });
}
