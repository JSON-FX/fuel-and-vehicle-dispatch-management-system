import type { Kysely } from 'kysely';

import type {
  DispatchResourceOccupancyDto,
  DispatchScheduleCandidateDto,
  DispatchScheduleConflictDto,
  DispatchScheduleEventDto,
  DispatchScheduleQuery,
} from '@/application/dispatch/dto/dispatch-dtos';
import type {
  DispatchScheduleEventPage,
  DispatchScheduleRepository,
} from '@/application/dispatch/ports/dispatch-schedule-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

const reservingStatuses = ['DRAFT', 'DISPATCHED', 'COMPLETED'] as const;

interface ScheduleRow {
  public_id: Buffer;
  travel_date: string;
  status: 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
  destination: string;
  purpose: string;
  driver_public_id: Buffer;
  driver_name: string;
  vehicle_public_id: Buffer;
  vehicle_plate_number: string;
  vehicle_model_brand: string;
  vehicle_type: string;
  office_public_id: Buffer;
  office_name: string;
  office_abbreviation: string;
}

export class KyselyDispatchScheduleRepository implements DispatchScheduleRepository {
  constructor(private readonly database: Kysely<Database>) {}

  findAdvisoryConflicts(
    candidate: DispatchScheduleCandidateDto,
  ): Promise<readonly DispatchScheduleConflictDto[]> {
    return this.findConflicts(candidate, false);
  }

  findCurrentConflictsForShare(
    candidate: DispatchScheduleCandidateDto,
  ): Promise<readonly DispatchScheduleConflictDto[]> {
    return this.findConflicts(candidate, true);
  }

  async listSchedule(query: DispatchScheduleQuery): Promise<DispatchScheduleEventPage> {
    let builder = this.baseQuery()
      .where('vd.travel_date', '>=', query.from)
      .where('vd.travel_date', '<=', query.to);
    if (query.requestingOfficePublicId !== null) {
      builder = builder.where(
        'office.public_id',
        '=',
        publicIdToBinary(PublicId.from(query.requestingOfficePublicId)),
      );
    }
    if (query.driverPublicId !== null) {
      builder = builder.where(
        'driver.public_id',
        '=',
        publicIdToBinary(PublicId.from(query.driverPublicId)),
      );
    }
    if (query.vehiclePublicId !== null) {
      builder = builder.where(
        'vehicle.public_id',
        '=',
        publicIdToBinary(PublicId.from(query.vehiclePublicId)),
      );
    }
    if (query.status !== null) builder = builder.where('vd.status', '=', query.status);

    const limit = Math.min(Math.max(query.limit, 1), 200);
    const rows = (await builder
      .orderBy('vd.travel_date', 'asc')
      .orderBy('vd.public_id', 'asc')
      .limit(limit + 1)
      .execute()) as ScheduleRow[];
    return {
      events: rows.slice(0, limit).map((row) => this.event(row)),
      truncated: rows.length > limit,
    };
  }

  async getOccupancy(
    query: DispatchScheduleQuery,
  ): Promise<readonly DispatchResourceOccupancyDto[]> {
    const occupancy: DispatchResourceOccupancyDto[] = [];
    if (query.driverPublicId !== null) {
      const driverId = await this.referenceId('drivers', query.driverPublicId);
      const rows = await this.database
        .selectFrom('vehicle_dispatches')
        .select(['travel_date'])
        .select((expression) => expression.fn.countAll<number>().as('dispatch_count'))
        .where('driver_id', '=', driverId)
        .where('travel_date', '>=', query.from)
        .where('travel_date', '<=', query.to)
        .where('status', 'in', reservingStatuses)
        .groupBy('travel_date')
        .orderBy('travel_date')
        .execute();
      occupancy.push(
        ...rows.map((row) => ({
          resourceType: 'DRIVER' as const,
          resourcePublicId: query.driverPublicId as string,
          travelDate: row.travel_date,
          dispatchCount: Number(row.dispatch_count),
          hasConflict: Number(row.dispatch_count) > 1,
        })),
      );
    }
    if (query.vehiclePublicId !== null) {
      const vehicleId = await this.referenceId('vehicles', query.vehiclePublicId);
      const rows = await this.database
        .selectFrom('vehicle_dispatches')
        .select(['travel_date'])
        .select((expression) => expression.fn.countAll<number>().as('dispatch_count'))
        .where('vehicle_id', '=', vehicleId)
        .where('travel_date', '>=', query.from)
        .where('travel_date', '<=', query.to)
        .where('status', 'in', reservingStatuses)
        .groupBy('travel_date')
        .orderBy('travel_date')
        .execute();
      occupancy.push(
        ...rows.map((row) => ({
          resourceType: 'VEHICLE' as const,
          resourcePublicId: query.vehiclePublicId as string,
          travelDate: row.travel_date,
          dispatchCount: Number(row.dispatch_count),
          hasConflict: Number(row.dispatch_count) > 1,
        })),
      );
    }

    return occupancy.sort((left, right) =>
      left.travelDate === right.travelDate
        ? left.resourceType.localeCompare(right.resourceType)
        : left.travelDate.localeCompare(right.travelDate),
    );
  }

  private async findConflicts(
    candidate: DispatchScheduleCandidateDto,
    lock: boolean,
  ): Promise<readonly DispatchScheduleConflictDto[]> {
    const driverPublicId = publicIdToBinary(PublicId.from(candidate.driverPublicId));
    const vehiclePublicId = publicIdToBinary(PublicId.from(candidate.vehiclePublicId));
    let builder = this.baseQuery()
      .where('vd.travel_date', '=', candidate.travelDate)
      .where('vd.status', 'in', reservingStatuses)
      .where((expression) =>
        expression.or([
          expression('driver.public_id', '=', driverPublicId),
          expression('vehicle.public_id', '=', vehiclePublicId),
        ]),
      );
    if (candidate.excludedDispatchPublicId !== null) {
      builder = builder.where(
        'vd.public_id',
        '!=',
        publicIdToBinary(PublicId.from(candidate.excludedDispatchPublicId)),
      );
    }
    const rows = (await (lock ? builder.forShare() : builder)
      .orderBy('vd.travel_date')
      .orderBy('vd.public_id')
      .execute()) as ScheduleRow[];

    return rows.map((row) => {
      const driverMatches = row.driver_public_id.equals(driverPublicId);
      const vehicleMatches = row.vehicle_public_id.equals(vehiclePublicId);
      return {
        ...this.event(row),
        conflictType: driverMatches
          ? vehicleMatches
            ? 'DRIVER_AND_VEHICLE'
            : 'DRIVER'
          : 'VEHICLE',
      };
    });
  }

  private baseQuery() {
    return this.database
      .selectFrom('vehicle_dispatches as vd')
      .innerJoin('drivers as driver', 'driver.id', 'vd.driver_id')
      .innerJoin('vehicles as vehicle', 'vehicle.id', 'vd.vehicle_id')
      .innerJoin('offices as office', 'office.id', 'vd.requesting_office_id')
      .select([
        'vd.public_id',
        'vd.travel_date',
        'vd.status',
        'vd.destination',
        'vd.purpose',
        'driver.public_id as driver_public_id',
        'driver.full_name as driver_name',
        'vehicle.public_id as vehicle_public_id',
        'vehicle.plate_no as vehicle_plate_number',
        'vehicle.model_brand as vehicle_model_brand',
        'vehicle.vehicle_type as vehicle_type',
        'office.public_id as office_public_id',
        'office.office_name as office_name',
        'office.abbreviation as office_abbreviation',
      ]);
  }

  private event(row: ScheduleRow): DispatchScheduleEventDto {
    return {
      dispatchPublicId: binaryToPublicId(row.public_id).toString(),
      travelDate: row.travel_date,
      status: row.status,
      destination: row.destination,
      purpose: row.purpose,
      driver: {
        publicId: binaryToPublicId(row.driver_public_id).toString(),
        name: row.driver_name,
      },
      vehicle: {
        publicId: binaryToPublicId(row.vehicle_public_id).toString(),
        plateNumber: row.vehicle_plate_number,
        modelBrand: row.vehicle_model_brand,
        vehicleType: row.vehicle_type,
      },
      requestingOffice: {
        publicId: binaryToPublicId(row.office_public_id).toString(),
        name: row.office_name,
        abbreviation: row.office_abbreviation,
      },
    };
  }

  private async referenceId(table: 'drivers' | 'vehicles', publicId: string): Promise<string> {
    const row = await this.database
      .selectFrom(table)
      .select('id')
      .where('public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirstOrThrow();
    return row.id;
  }
}
