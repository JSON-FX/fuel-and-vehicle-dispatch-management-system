export interface FuelSequenceRepository {
  next(input: {
    readonly year: number;
    readonly month: number;
    readonly at: Date;
  }): Promise<number>;
}
