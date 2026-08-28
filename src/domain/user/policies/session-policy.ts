export interface SessionPolicyOptions {
  readonly standardIdleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly privilegedSessionLimit: number;
}

export class SessionPolicy {
  constructor(private readonly options: SessionPolicyOptions) {}

  idleTimeoutSeconds(isPrivileged: boolean): number {
    return isPrivileged
      ? this.options.privilegedIdleTimeoutSeconds
      : this.options.standardIdleTimeoutSeconds;
  }

  canCreatePrivilegedSession(activePrivilegedSessionCount: number): boolean {
    return activePrivilegedSessionCount < this.options.privilegedSessionLimit;
  }
}
