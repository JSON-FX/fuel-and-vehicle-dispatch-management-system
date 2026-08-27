export interface HealthStatusResponse {
  readonly status: 'ok';
  readonly database: 'available';
  readonly timestamp: string;
}
