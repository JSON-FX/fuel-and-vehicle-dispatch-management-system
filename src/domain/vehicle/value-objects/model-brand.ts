import { DomainError } from '@/domain/shared/errors/domain-error';

export class ModelBrand {
  private constructor(private readonly value: string) {}

  static from(value: string): ModelBrand {
    const normalized = value.trim().replaceAll(/\s+/g, ' ');
    if (normalized.length < 1 || normalized.length > 150) {
      throw new DomainError(
        'INVALID_MODEL_BRAND',
        'Model or brand must contain 1 to 150 characters.',
      );
    }
    return new ModelBrand(normalized);
  }

  toString(): string {
    return this.value;
  }
}
