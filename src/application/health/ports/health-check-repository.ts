export interface HealthCheckRepository {
  check(): Promise<void>;
}
