import { Module, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './common/config/config.module';
import { createLoggerConfig } from './common/config/logger.config';
import { CacheConfigModule } from './common/cache/cache.module';
import { DatabaseModule } from './common/database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { DualAuthGuard } from './common/guards/dual-auth.guard';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { OfficersModule } from './modules/officers/officers.module';
import { RolesModule } from './modules/roles/roles.module';
import { StationsModule } from './modules/stations/stations.module';
import { CasesModule } from './modules/cases/cases.module';
import { PersonsModule } from './modules/persons/persons.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { BackgroundChecksModule } from './modules/background-checks/background-checks.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SyncModule } from './modules/sync/sync.module';
import { UploadModule } from './modules/upload/upload.module';
import { UssdModule } from './modules/ussd/ussd.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { FrameworkConfigModule } from './modules/framework-config/framework-config.module';
import { GeoCrimeModule } from './modules/geocrime/geocrime.module';
import { InteragencyModule } from './modules/interagency/interagency.module';
import { BulkImportModule } from './modules/bulk-import/bulk-import.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { IntegrityModule } from './modules/integrity/integrity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PropertyTypesModule } from './modules/property-types/property-types.module';
import { StolenPropertyModule } from './modules/stolen-property/stolen-property.module';

const redisEnabled = process.env.REDIS_ENABLED !== 'false';
if (!redisEnabled) {
  new Logger('AppModule').warn(
    'Redis is disabled (REDIS_ENABLED=false). BullMQ queues and bulk-import will be unavailable.',
  );
}

@Module({
  imports: [
    // Infrastructure
    AppConfigModule,
    DatabaseModule,
    LoggerModule.forRoot(createLoggerConfig()),
    CacheConfigModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    ScheduleModule.forRoot(),
    ...(redisEnabled
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>('REDIS_HOST', 'localhost'),
                port: config.get<number>('REDIS_PORT', 6379),
              },
            }),
          }),
        ]
      : []),

    // Health
    HealthModule,

    // Feature Modules
    AuthModule,
    OfficersModule,
    RolesModule,
    StationsModule,
    CasesModule,
    PersonsModule,
    EvidenceModule,
    VehiclesModule,
    PropertyTypesModule,
    StolenPropertyModule,
    AlertsModule,
    BackgroundChecksModule,
    AuditModule,
    AnalyticsModule,
    ReportsModule,
    SyncModule,
    UploadModule,
    UssdModule,
    WhatsappModule,
    FrameworkConfigModule,
    GeoCrimeModule,
    InteragencyModule,

    // Security Governance Modules
    ApprovalsModule,
    IntegrityModule,

    // Redis-dependent modules
    ...(redisEnabled
      ? [BulkImportModule, NotificationsModule]
      : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: DualAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
