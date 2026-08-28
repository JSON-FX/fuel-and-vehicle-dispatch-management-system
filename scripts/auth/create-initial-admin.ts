import { pathToFileURL } from 'node:url';

import type { CreateInitialSuperAdmin } from '@/application/auth/use-cases/create-initial-super-admin';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { createApplicationComposition } from '@/infrastructure/composition/root';

export interface InitialAdminArguments {
  readonly fullName: string;
  readonly username: string;
  readonly email: string;
}

export function parseInitialAdminArguments(arguments_: readonly string[]): InitialAdminArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!['--full-name', '--username', '--email'].includes(key ?? '') || value === undefined) {
      throw new Error('Usage: create-initial-admin --full-name NAME --username USER --email EMAIL');
    }
    values.set(key!, value);
  }
  const fullName = values.get('--full-name');
  const username = values.get('--username');
  const email = values.get('--email');
  if (
    fullName === undefined ||
    username === undefined ||
    email === undefined ||
    values.size !== 3
  ) {
    throw new Error('Usage: create-initial-admin --full-name NAME --username USER --email EMAIL');
  }
  return { fullName, username, email };
}

export async function runCreateInitialAdmin(
  arguments_: readonly string[],
  dependencies: {
    readonly useCase: Pick<CreateInitialSuperAdmin, 'execute'>;
    readonly publicIds: PublicIdGenerator;
    readonly write: (line: string) => void;
  },
): Promise<void> {
  const input = parseInitialAdminArguments(arguments_);
  const result = await dependencies.useCase.execute({
    ...input,
    requestId: dependencies.publicIds.generate().toString(),
  });
  dependencies.write('Initial super administrator created.');
  dependencies.write(`Username: ${result.username}`);
  dependencies.write(`Temporary password: ${result.temporaryPassword}`);
  dependencies.write('This credential will not be shown again.');
}

async function main(): Promise<void> {
  const composition = createApplicationComposition();
  await runCreateInitialAdmin(process.argv.slice(2), {
    useCase: composition.createInitialSuperAdmin,
    publicIds: composition.publicIdGenerator,
    write: (line) => console.info(line),
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
