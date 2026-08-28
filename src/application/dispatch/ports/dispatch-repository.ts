import type {
  DispatchListQuery,
  DispatchRecordPage,
  DispatchReferenceRecord,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';

export interface DispatchRepository {
  findByPublicId(publicId: string): Promise<DispatchReferenceRecord | null>;
  findByPublicIdForUpdate(publicId: string): Promise<VehicleDispatch | null>;
  insert(dispatch: VehicleDispatch): Promise<void>;
  updateDetails(dispatch: VehicleDispatch): Promise<void>;
  updateLifecycle(dispatch: VehicleDispatch): Promise<void>;
  list(query: DispatchListQuery): Promise<DispatchRecordPage>;
}
