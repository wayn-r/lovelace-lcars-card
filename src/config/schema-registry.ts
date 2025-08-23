import { z } from 'zod';

export interface RegisteredElementSchema {
  type: string;
  schema: z.ZodTypeAny;
  normalize?: (value: unknown) => unknown;
}

export class ConfigSchemaRegistry {
  private readonly typeToSchema = new Map<string, RegisteredElementSchema>();

  registerElementSchema(entry: RegisteredElementSchema): void {
    this.typeToSchema.set(entry.type, entry);
  }

  has(type: string): boolean {
    return this.typeToSchema.has(type);
  }

  validateAndNormalizeElement(type: string, value: unknown): unknown {
    const entry = this.typeToSchema.get(type);
    if (!entry) return value;
    const parsed = entry.schema.parse(value);
    return entry.normalize ? entry.normalize(parsed) : parsed;
  }

  listTypes(): string[] {
    return Array.from(this.typeToSchema.keys()).sort();
  }
}


