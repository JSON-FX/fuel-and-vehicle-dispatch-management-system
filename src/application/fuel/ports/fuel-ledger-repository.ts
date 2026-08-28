import type { FuelBalanceDto, FuelBalanceQuery } from '@/application/fuel/dto/fuel-dtos';
import type { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';

export interface FuelLedgerRepository {
  append(entry: FuelLedgerEntry): Promise<void>;
  listForIssuance(fuelIssuancePublicId: string): Promise<readonly FuelLedgerEntry[]>;
  summarize(query: FuelBalanceQuery): Promise<readonly FuelBalanceDto[]>;
}
