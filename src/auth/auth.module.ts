import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

/**
 * Centralises JWT configuration so JwtService (and the global auth guards) are
 * available everywhere. The signing secret is required — the app refuses to
 * start without JWT_SECRET so we never silently fall back to an insecure key.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 16) {
          new Logger('AuthModule').error(
            'JWT_SECRET is missing or too short (min 16 chars). Set a strong secret in the environment.',
          );
          throw new Error('JWT_SECRET not configured');
        }
        return {
          secret,
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d' } as any,
        };
      },
    }),
  ],
  exports: [JwtModule],
})
export class AuthModule {}
