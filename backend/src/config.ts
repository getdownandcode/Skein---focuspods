import { z } from 'zod';

const commaSeparated = (itemSchema: z.ZodType<string, string>) =>
  z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    )
    .pipe(z.array(itemSchema).min(1));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    GOOGLE_CLIENT_IDS: commaSeparated(z.string().min(1)),
    CORS_ORIGINS: commaSeparated(z.url()),
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    googleClientIds: env.GOOGLE_CLIENT_IDS,
    corsOrigins: env.CORS_ORIGINS,
  }));

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
