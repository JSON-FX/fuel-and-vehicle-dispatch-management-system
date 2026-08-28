import { pathToFileURL } from 'node:url';

import type { VerifyAuditChain } from '@/application/audit/services/verify-audit-chain';
import { createAuditVerifierComposition } from '@/infrastructure/composition/audit';

export async function runAuditVerification(
  verifier: Pick<VerifyAuditChain, 'execute'>,
  write: (line: string) => void,
): Promise<0 | 1> {
  const result = await verifier.execute();
  if (result.status === 'PASS') {
    write(
      `Audit verification PASS: checked ${result.verifiedCount} records through sequence ${result.highWaterSequence}.`,
    );
    return 0;
  }
  write(
    `Audit verification FAIL: ${result.firstMismatchType ?? 'UNKNOWN_MISMATCH'} at sequence ${result.firstMismatchSequence ?? 'unknown'}.`,
  );
  return 1;
}

async function main(): Promise<number> {
  const composition = createAuditVerifierComposition();
  try {
    return await runAuditVerification(composition.verifyAuditChain, (line) => console.info(line));
  } catch {
    console.error('Audit verification could not complete.');
    return 2;
  } finally {
    await composition.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
