import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { randomBytes } from 'crypto';
import { encryptPII } from '../src/common/utils/encryption.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ==================== PERMISSIONS ====================
  console.log('Creating permissions...');

  const permissions = [
    // Cases
    { resource: 'cases', action: 'create', scope: 'station' },
    { resource: 'cases', action: 'read', scope: 'station' },
    { resource: 'cases', action: 'read', scope: 'national' },
    { resource: 'cases', action: 'update', scope: 'station' },
    { resource: 'cases', action: 'delete', scope: 'national' },
    { resource: 'cases', action: 'export', scope: 'station' },

    // Persons
    { resource: 'persons', action: 'create', scope: 'station' },
    { resource: 'persons', action: 'read', scope: 'station' },
    { resource: 'persons', action: 'read', scope: 'national' },
    { resource: 'persons', action: 'update', scope: 'station' },
    { resource: 'persons', action: 'delete', scope: 'national' },

    // Evidence
    { resource: 'evidence', action: 'create', scope: 'station' },
    { resource: 'evidence', action: 'read', scope: 'station' },
    { resource: 'evidence', action: 'update', scope: 'own' },
    { resource: 'evidence', action: 'delete', scope: 'national' },

    // Officers
    { resource: 'officers', action: 'create', scope: 'national' },
    { resource: 'officers', action: 'read', scope: 'station' },
    { resource: 'officers', action: 'update', scope: 'national' },
    { resource: 'officers', action: 'delete', scope: 'national' },

    // Stations
    { resource: 'stations', action: 'create', scope: 'national' },
    { resource: 'stations', action: 'read', scope: 'national' },
    { resource: 'stations', action: 'update', scope: 'national' },

    // Alerts
    { resource: 'alerts', action: 'create', scope: 'station' },
    { resource: 'alerts', action: 'read', scope: 'national' },
    { resource: 'alerts', action: 'update', scope: 'station' },

    // Background Checks
    { resource: 'bgcheck', action: 'create', scope: 'station' },
    { resource: 'bgcheck', action: 'read', scope: 'station' },

    // Reports
    { resource: 'reports', action: 'create', scope: 'station' },
    { resource: 'reports', action: 'read', scope: 'station' },
    { resource: 'reports', action: 'export', scope: 'national' },

    // Bulk Import
    { resource: 'bulk-import', action: 'create', scope: 'station' },
    { resource: 'bulk-import', action: 'read', scope: 'station' },
    { resource: 'bulk-import', action: 'delete', scope: 'national' },

    // Vehicles
    { resource: 'vehicles', action: 'create', scope: 'station' },
    { resource: 'vehicles', action: 'read', scope: 'station' },
    { resource: 'vehicles', action: 'update', scope: 'station' },
    { resource: 'vehicles', action: 'delete', scope: 'national' },

    // Stolen Property
    { resource: 'stolen-property', action: 'create', scope: 'station' },
    { resource: 'stolen-property', action: 'read', scope: 'station' },
    { resource: 'stolen-property', action: 'read', scope: 'national' },
    { resource: 'stolen-property', action: 'update', scope: 'station' },
    { resource: 'stolen-property', action: 'delete', scope: 'national' },

    // Property Types
    { resource: 'property-types', action: 'read', scope: 'station' },

    // Analytics
    { resource: 'analytics', action: 'read', scope: 'station' },
    { resource: 'analytics', action: 'read', scope: 'national' },

    // Roles (Role Management)
    { resource: 'roles', action: 'create', scope: 'national' },
    { resource: 'roles', action: 'read', scope: 'station' },
    { resource: 'roles', action: 'update', scope: 'national' },
    { resource: 'roles', action: 'delete', scope: 'national' },

    // Audit (Audit Log Access)
    { resource: 'audit', action: 'read', scope: 'station' },
    { resource: 'audit', action: 'read', scope: 'national' },
    { resource: 'audit', action: 'export', scope: 'national' },

    // Settings (System Configuration)
    { resource: 'settings', action: 'read', scope: 'station' },
    { resource: 'settings', action: 'read', scope: 'national' },
    { resource: 'settings', action: 'update', scope: 'national' },
    { resource: 'settings', action: 'delete', scope: 'national' },

    // Agencies (Inter-Agency Management)
    { resource: 'agencies', action: 'create', scope: 'national' },
    { resource: 'agencies', action: 'read', scope: 'national' },
    { resource: 'agencies', action: 'update', scope: 'national' },
    { resource: 'agencies', action: 'delete', scope: 'national' },

    // Integrity (Whistleblower / Professional Standards)
    { resource: 'integrity', action: 'create', scope: 'own' },
    { resource: 'integrity', action: 'read', scope: 'national' },
    { resource: 'integrity', action: 'update', scope: 'national' },

    // Approvals (Dual-Auth)
    { resource: 'approvals', action: 'create', scope: 'national' },
    { resource: 'approvals', action: 'read', scope: 'national' },
    { resource: 'approvals', action: 'update', scope: 'national' },
  ];

  const createdPermissions = await Promise.all(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { resource_action_scope: p },
        update: {},
        create: p,
      }),
    ),
  );

  console.log(`Created ${createdPermissions.length} permissions`);

  // ==================== ROLES ====================
  console.log('Creating roles...');

  const superAdminPermissionIds = createdPermissions.map((p) => ({ id: p.id }));

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SuperAdmin' },
    update: { permissions: { set: superAdminPermissionIds } },
    create: {
      name: 'SuperAdmin',
      description: 'Full system access - All permissions',
      level: 1,
      permissions: { connect: superAdminPermissionIds },
    },
  });

  const adminPermissionIds = createdPermissions
    .filter(
      (p) =>
        ['national', 'station'].includes(p.scope) &&
        (
          // Core operations
          p.resource === 'cases' ||
          p.resource === 'persons' ||
          (p.resource === 'evidence' && p.action !== 'delete') ||
          (p.resource === 'officers' && p.action !== 'delete') ||
          (p.resource === 'stations' &&
            p.action !== 'create' &&
            p.action !== 'delete') ||
          p.resource === 'alerts' ||
          p.resource === 'bgcheck' ||
          p.resource === 'reports' ||
          p.resource === 'vehicles' ||
          p.resource === 'stolen-property' ||
          (p.resource === 'property-types' && p.action === 'read') ||
          p.resource === 'analytics' ||
          p.resource === 'bulk-import' ||
          // Administrative (new)
          (p.resource === 'roles' && p.action === 'read') ||
          (p.resource === 'audit' && p.action !== 'delete') ||
          (p.resource === 'settings' && p.action !== 'delete') ||
          p.resource === 'agencies' ||
          // Security governance
          p.resource === 'integrity' ||
          p.resource === 'approvals'
        ),
    )
    .map((p) => ({ id: p.id }));

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: { permissions: { set: adminPermissionIds } },
    create: {
      name: 'Admin',
      description: 'Regional/national administration',
      level: 2,
      permissions: { connect: adminPermissionIds },
    },
  });

  const commanderPermissionIds = createdPermissions
    .filter(
      (p) =>
        ['station', 'own'].includes(p.scope) &&
        (
          // Core operations (no delete except cases)
          p.resource === 'cases' ||
          (p.resource === 'persons' && p.action !== 'delete') ||
          (p.resource === 'evidence' && p.action !== 'delete') ||
          (p.resource === 'officers' && p.action !== 'delete') ||
          (p.resource === 'stations' && p.action === 'read') ||
          p.resource === 'alerts' ||
          p.resource === 'bgcheck' ||
          p.resource === 'reports' ||
          (p.resource === 'vehicles' && p.action !== 'delete') ||
          (p.resource === 'stolen-property' && p.action !== 'delete') ||
          (p.resource === 'property-types' && p.action === 'read') ||
          p.resource === 'analytics' ||
          (p.resource === 'bulk-import' && p.action !== 'delete') ||
          // Administrative read-only (new)
          (p.resource === 'roles' && p.action === 'read') ||
          (p.resource === 'audit' && p.action === 'read') ||
          (p.resource === 'settings' && p.action === 'read') ||
          // Integrity - can submit reports
          (p.resource === 'integrity' && p.action === 'create')
        ),
    )
    .map((p) => ({ id: p.id }));

  const commanderRole = await prisma.role.upsert({
    where: { name: 'StationCommander' },
    update: { permissions: { set: commanderPermissionIds } },
    create: {
      name: 'StationCommander',
      description: 'Station-level oversight and management',
      level: 3,
      permissions: { connect: commanderPermissionIds },
    },
  });

  const officerPermissionIds = createdPermissions
    .filter(
      (p) =>
        ['station', 'own'].includes(p.scope) &&
        p.action !== 'delete' &&
        (p.resource === 'cases' ||
          p.resource === 'persons' ||
          p.resource === 'evidence' ||
          p.resource === 'bgcheck' ||
          p.resource === 'vehicles' ||
          p.resource === 'stolen-property' ||
          (p.resource === 'property-types' && p.action === 'read') ||
          (p.resource === 'officers' && p.action === 'read') ||
          (p.resource === 'stations' && p.action === 'read') ||
          (p.resource === 'alerts' && p.action === 'read') ||
          (p.resource === 'reports' && p.action === 'read') ||
          (p.resource === 'analytics' && p.action === 'read') ||
          (p.resource === 'integrity' && p.action === 'create')),
    )
    .map((p) => ({ id: p.id }));

  const officerRole = await prisma.role.upsert({
    where: { name: 'Officer' },
    update: { permissions: { set: officerPermissionIds } },
    create: {
      name: 'Officer',
      description: 'Operational police officer',
      level: 4,
      permissions: { connect: officerPermissionIds },
    },
  });

  const clerkPermissionIds = createdPermissions
    .filter(
      (p) =>
        (p.scope === 'station' &&
        (p.resource === 'evidence' || // All evidence actions
          (p.resource === 'cases' && p.action === 'read') ||
          (p.resource === 'persons' && p.action === 'read') ||
          (p.resource === 'officers' && p.action === 'read') ||
          (p.resource === 'stations' && p.action === 'read') ||
          (p.resource === 'bgcheck' && p.action === 'read'))) ||
        (p.resource === 'integrity' && p.action === 'create' && p.scope === 'own'),
    )
    .map((p) => ({ id: p.id }));

  const clerkRole = await prisma.role.upsert({
    where: { name: 'EvidenceClerk' },
    update: { permissions: { set: clerkPermissionIds } },
    create: {
      name: 'EvidenceClerk',
      description: 'Evidence management specialist',
      level: 5,
      permissions: { connect: clerkPermissionIds },
    },
  });

  const viewerPermissionIds = createdPermissions
    .filter((p) =>
      (p.action === 'read' && p.scope === 'station') ||
      (p.resource === 'integrity' && p.action === 'create' && p.scope === 'own'),
    )
    .map((p) => ({ id: p.id }));

  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: { permissions: { set: viewerPermissionIds } },
    create: {
      name: 'Viewer',
      description: 'Read-only access (prosecutors, judges, etc.)',
      level: 6,
      permissions: { connect: viewerPermissionIds },
    },
  });

  // ExternalAuditor: level 0, audit.read.national only
  // Level 0 does NOT trigger SuperAdmin bypass (roleLevel === 1)
  const externalAuditorPermissionIds = createdPermissions
    .filter((p) => p.resource === 'audit' && p.action === 'read' && p.scope === 'national')
    .map((p) => ({ id: p.id }));

  const externalAuditorRole = await prisma.role.upsert({
    where: { name: 'ExternalAuditor' },
    update: { permissions: { set: externalAuditorPermissionIds } },
    create: {
      name: 'ExternalAuditor',
      description: 'External civil oversight auditor - audit read-only access with short-lived sessions',
      level: 0,
      permissions: { connect: externalAuditorPermissionIds },
    },
  });

  console.log('Created 7 roles');

  // ==================== STATIONS ====================
  console.log('Creating stations...');

  const hqStation = await prisma.station.upsert({
    where: { code: 'HQ-001' },
    update: {},
    create: {
      name: 'Police Headquarters',
      code: 'HQ-001',
      location: 'Freetown',
      district: 'Western Area',
      region: 'Western',
      countryCode: 'SLE',
      phone: '+232-XXX-XXXX',
      email: 'hq@police.gov.sl',
    },
  });

  const cidStation = await prisma.station.upsert({
    where: { code: 'FT-CID' },
    update: {},
    create: {
      name: 'CID Freetown',
      code: 'FT-CID',
      location: 'Freetown',
      district: 'Western Area',
      region: 'Western',
      countryCode: 'SLE',
      phone: '+232-XXX-XXXX',
      email: 'cid-freetown@police.gov.sl',
    },
  });

  const boStation = await prisma.station.upsert({
    where: { code: 'BO-HQ' },
    update: {},
    create: {
      name: 'Bo District HQ',
      code: 'BO-HQ',
      location: 'Bo',
      district: 'Bo',
      region: 'Southern',
      countryCode: 'SLE',
      phone: '+232-XXX-XXXX',
      email: 'bo-hq@police.gov.sl',
    },
  });

  console.log('Created 3 stations');

  // ==================== OFFICERS ====================
  console.log('Creating officers...');

  const superAdminPin = await hash('12345678');
  const superAdmin = await prisma.officer.upsert({
    where: { badge: 'SA-00001' },
    update: {},
    create: {
      badge: 'SA-00001',
      name: 'System Administrator',
      email: 'admin@police.gov.sl',
      phone: '+232-XXX-XXXX',
      pinHash: superAdminPin,
      roleId: superAdminRole.id,
      stationId: hqStation.id,
      active: true,
    },
  });

  const commanderQuickPin = await hash('1234');
  const commander = await prisma.officer.upsert({
    where: { badge: 'SC-00001' },
    update: {},
    create: {
      badge: 'SC-00001',
      name: 'Ibrahim Kamara',
      email: 'ikamara@police.gov.sl',
      phone: '+23278123456',
      pinHash: await hash('87654321'),
      roleId: commanderRole.id,
      stationId: hqStation.id,
      active: true,
      ussdPhoneNumber: '+23278123456',
      ussdQuickPinHash: commanderQuickPin,
      ussdEnabled: true,
      ussdRegisteredAt: new Date(),
      ussdDailyLimit: 100,
    },
  });

  const officer1QuickPin = await hash('5678');
  const officer1 = await prisma.officer.upsert({
    where: { badge: 'OF-00001' },
    update: {},
    create: {
      badge: 'OF-00001',
      name: 'Fatmata Sesay',
      email: 'fsesay@police.gov.sl',
      phone: '+23279234567',
      pinHash: await hash('11111111'),
      roleId: officerRole.id,
      stationId: hqStation.id,
      active: true,
      ussdPhoneNumber: '+23279234567',
      ussdQuickPinHash: officer1QuickPin,
      ussdEnabled: true,
      ussdRegisteredAt: new Date(),
      ussdDailyLimit: 50,
    },
  });

  const officer2QuickPin = await hash('9012');
  const officer2 = await prisma.officer.upsert({
    where: { badge: 'OF-00002' },
    update: {},
    create: {
      badge: 'OF-00002',
      name: 'Mohamed Bangura',
      email: 'mbangura@police.gov.sl',
      phone: '+23276345678',
      pinHash: await hash('22222222'),
      roleId: officerRole.id,
      stationId: hqStation.id,
      active: true,
      ussdPhoneNumber: '+23276345678',
      ussdQuickPinHash: officer2QuickPin,
      ussdEnabled: false,
      ussdRegisteredAt: new Date(),
      ussdDailyLimit: 50,
    },
  });

  const officer3 = await prisma.officer.upsert({
    where: { badge: 'OF-00003' },
    update: {},
    create: {
      badge: 'OF-00003',
      name: 'Aminata Koroma',
      email: 'akoroma@police.gov.sl',
      phone: '+23277456789',
      pinHash: await hash('33333333'),
      roleId: officerRole.id,
      stationId: hqStation.id,
      active: true,
    },
  });

  const clerkQuickPin = await hash('3456');
  const clerk = await prisma.officer.upsert({
    where: { badge: 'EC-00001' },
    update: {},
    create: {
      badge: 'EC-00001',
      name: 'John Conteh',
      email: 'jconteh@police.gov.sl',
      phone: '+23278567890',
      pinHash: await hash('44444444'),
      roleId: clerkRole.id,
      stationId: hqStation.id,
      active: true,
      ussdPhoneNumber: '+23278567890',
      ussdQuickPinHash: clerkQuickPin,
      ussdEnabled: true,
      ussdRegisteredAt: new Date(),
      ussdDailyLimit: 30,
    },
  });

  console.log('Created 6 officers');

  // ==================== PERSONS ====================
  console.log('Creating persons...');

  const wantedPerson = await prisma.person.upsert({
    where: { nationalId: 'W7RGGVGI' },
    update: {},
    create: {
      nationalId: 'W7RGGVGI',
      idType: 'NIN',
      countryCode: 'SLE',
      firstName: 'Abdul',
      lastName: 'Kamara',
      middleName: 'Hassan',
      fullName: 'Abdul Hassan Kamara',
      aliases: ['Abdul K', 'AHK'],
      dob: new Date('1990-05-15'),
      gender: 'Male',
      nationality: 'SLE',
      addressEncrypted: encryptPII('14 Kissy Road, Freetown'),
      phoneEncrypted: encryptPII('+23278000001'),
      emailEncrypted: encryptPII('akamara@example.com'),
      isWanted: true,
      wantedSince: new Date('2024-01-15'),
      riskLevel: 'high',
      createdById: superAdmin.id,
    },
  });

  const missingPerson = await prisma.person.upsert({
    where: { nationalId: 'A5K9M2P7' },
    update: {},
    create: {
      nationalId: 'A5K9M2P7',
      idType: 'NIN',
      countryCode: 'SLE',
      firstName: 'Mary',
      lastName: 'Koroma',
      fullName: 'Mary Koroma',
      aliases: [],
      dob: new Date('1995-08-22'),
      gender: 'Female',
      nationality: 'SLE',
      addressEncrypted: encryptPII('7 Wilkinson Road, Freetown'),
      phoneEncrypted: encryptPII('+23279000002'),
      isDeceasedOrMissing: true,
      riskLevel: 'medium',
      createdById: superAdmin.id,
    },
  });

  const cleanPerson = await prisma.person.upsert({
    where: { nationalId: 'J8S4X1N3' },
    update: {},
    create: {
      nationalId: 'J8S4X1N3',
      idType: 'NIN',
      countryCode: 'SLE',
      firstName: 'James',
      lastName: 'Sesay',
      fullName: 'James Sesay',
      aliases: [],
      dob: new Date('1988-11-10'),
      gender: 'Male',
      nationality: 'SLE',
      addressEncrypted: encryptPII('22 Siaka Stevens St, Freetown'),
      phoneEncrypted: encryptPII('+23276000003'),
      createdById: superAdmin.id,
    },
  });

  const criminalPerson = await prisma.person.upsert({
    where: { nationalId: 'H9B2M6F5' },
    update: {},
    create: {
      nationalId: 'H9B2M6F5',
      idType: 'NIN',
      countryCode: 'SLE',
      firstName: 'Hassan',
      lastName: 'Bangura',
      middleName: 'Musa',
      fullName: 'Hassan Musa Bangura',
      aliases: ['Hassan B'],
      dob: new Date('1992-03-18'),
      gender: 'Male',
      nationality: 'SLE',
      addressEncrypted: encryptPII('5 Pademba Road, Freetown'),
      phoneEncrypted: encryptPII('+23277000004'),
      emailEncrypted: encryptPII('hbangura@example.com'),
      riskLevel: 'medium',
      createdById: superAdmin.id,
    },
  });

  console.log('Created 4 persons');

  // ==================== VEHICLES ====================
  console.log('Creating vehicles...');

  await prisma.vehicle.upsert({
    where: { licensePlate: 'SL-A-1234' },
    update: {},
    create: {
      licensePlate: 'SL-A-1234',
      vehicleType: 'car',
      make: 'Toyota',
      model: 'Corolla',
      year: 2018,
      color: 'Silver',
      ownerNIN: 'K7P3N2M9',
      ownerName: 'John Doe',
      status: 'stolen',
      stolenDate: new Date('2024-11-01'),
      stolenReportedBy: superAdmin.id,
      stationId: hqStation.id,
      notes: 'Stolen from Freetown Central Parking - armed robbery',
    },
  });

  await prisma.vehicle.upsert({
    where: { licensePlate: 'SL-B-5678' },
    update: {},
    create: {
      licensePlate: 'SL-B-5678',
      vehicleType: 'car',
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      color: 'Blue',
      ownerNIN: 'R5T8W1Q4',
      ownerName: 'Jane Smith',
      status: 'active',
      stationId: hqStation.id,
      notes: 'Registered vehicle - no issues',
    },
  });

  await prisma.vehicle.upsert({
    where: { licensePlate: 'SL-C-9012' },
    update: {},
    create: {
      licensePlate: 'SL-C-9012',
      vehicleType: 'car',
      make: 'Nissan',
      model: 'Sentra',
      year: 2019,
      color: 'Black',
      ownerNIN: 'V9D6H3X2',
      ownerName: 'Bob Wilson',
      status: 'stolen',
      stolenDate: new Date('2024-10-15'),
      stolenReportedBy: superAdmin.id,
      stationId: hqStation.id,
      notes: 'Used in armed robbery - getaway vehicle',
    },
  });

  console.log('Created 3 vehicles');

  // ==================== CASES ====================
  console.log('Creating cases...');

  const theftCase = await prisma.case.upsert({
    where: { caseNumber: 'HQ-2024-000001' },
    update: {},
    create: {
      caseNumber: 'HQ-2024-000001',
      title: 'Motor Vehicle Theft - Toyota Corolla',
      description:
        'Silver Toyota Corolla stolen from Freetown Central Parking lot. Suspect seen fleeing on foot.',
      category: 'theft',
      severity: 'major',
      status: 'investigating',
      incidentDate: new Date('2024-11-01'),
      reportedDate: new Date('2024-11-01'),
      location: 'Freetown Central Parking, Aberdeen Road',
      stationId: hqStation.id,
      officerId: officer1.id,
    },
  });

  const assaultCase = await prisma.case.upsert({
    where: { caseNumber: 'HQ-2024-000002' },
    update: {},
    create: {
      caseNumber: 'HQ-2024-000002',
      title: 'Aggravated Assault at King Jimmy Market',
      description:
        'Physical assault with weapon at local market. Victim hospitalized with serious injuries.',
      category: 'assault',
      severity: 'major',
      status: 'charged',
      incidentDate: new Date('2024-10-20'),
      reportedDate: new Date('2024-10-20'),
      location: 'King Jimmy Market, Freetown',
      stationId: hqStation.id,
      officerId: commander.id,
    },
  });

  // Link persons to cases
  await prisma.casePerson.upsert({
    where: {
      caseId_personId_role: {
        caseId: assaultCase.id,
        personId: criminalPerson.id,
        role: 'suspect',
      },
    },
    update: {},
    create: {
      caseId: assaultCase.id,
      personId: criminalPerson.id,
      role: 'suspect',
      statement: 'Suspect identified by multiple witnesses at the scene',
    },
  });

  await prisma.casePerson.upsert({
    where: {
      caseId_personId_role: {
        caseId: theftCase.id,
        personId: wantedPerson.id,
        role: 'suspect',
      },
    },
    update: {},
    create: {
      caseId: theftCase.id,
      personId: wantedPerson.id,
      role: 'suspect',
      statement: 'Security footage shows suspect matching description',
    },
  });

  console.log('Created 2 cases with person links');

  // ==================== WANTED PERSON RECORD ====================
  console.log('Creating wanted person record...');

  await prisma.wantedPerson.upsert({
    where: { personId: wantedPerson.id },
    update: {},
    create: {
      personId: wantedPerson.id,
      name: 'Abdul Hassan Kamara',
      aliases: ['Abdul K', 'AHK'],
      charges: ['Armed Robbery', 'Assault with Deadly Weapon', 'Motor Vehicle Theft'],
      dangerLevel: 'extreme',
      status: 'active',
      warrantNumber: 'W-2024-001',
      reward: 5000000,
      description:
        'Male, approximately 6\'0" tall, dark complexion, visible scar on left cheek. Last seen wearing dark clothing. Considered armed and dangerous.',
      lastSeenLocation: 'Bo District, Southern Province',
      lastSeenDate: new Date('2024-10-25'),
      regionalAlert: true,
      priority: 95,
      publishedAt: new Date('2024-01-15'),
      createdById: superAdmin.id,
    },
  });

  console.log('Created wanted person record');

  // ==================== EVIDENCE ====================
  console.log('Creating evidence...');

  function generateQrCode(): string {
    return `EV-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  function buildCustodyEntry(officerId: string, officerName: string, officerBadge: string, action: string, location: string | null) {
    return {
      officerId,
      officerName,
      officerBadge,
      action,
      timestamp: new Date().toISOString(),
      location,
    };
  }

  // Evidence 1: Crime scene photo (linked to theft case)
  const evidence1 = await prisma.evidence.upsert({
    where: { qrCode: 'EV-SEED-THEFT-PHOTO' },
    update: {},
    create: {
      type: 'photo',
      description: 'Crime scene photograph showing abandoned Toyota Corolla at parking lot',
      qrCode: 'EV-SEED-THEFT-PHOTO',
      collectedDate: new Date('2024-11-01'),
      collectedById: officer1.id,
      collectedLocation: 'Freetown Central Parking, Aberdeen Road',
      stationId: hqStation.id,
      storageLocation: 'Digital Evidence Server',
      tags: ['vehicle', 'theft', 'crime_scene', 'parking_lot'],
      status: 'stored',
      chainOfCustody: [
        buildCustodyEntry(officer1.id, officer1.name, officer1.badge, 'collected', 'Freetown Central Parking, Aberdeen Road'),
      ],
    },
  });

  // Evidence 2: Surveillance footage (linked to theft case)
  const evidence2 = await prisma.evidence.upsert({
    where: { qrCode: 'EV-SEED-THEFT-VIDEO' },
    update: {},
    create: {
      type: 'video',
      description: 'Security camera footage showing suspect fleeing the scene on foot',
      qrCode: 'EV-SEED-THEFT-VIDEO',
      collectedDate: new Date('2024-11-01'),
      collectedById: officer1.id,
      collectedLocation: 'Freetown Central Parking Security Office',
      stationId: hqStation.id,
      storageLocation: 'Digital Evidence Server',
      tags: ['surveillance', 'theft', 'suspect', 'footage'],
      status: 'analyzed',
      chainOfCustody: [
        buildCustodyEntry(officer1.id, officer1.name, officer1.badge, 'collected', 'Freetown Central Parking Security Office'),
      ],
    },
  });

  // Evidence 3: Assault weapon (linked to assault case)
  const evidence3 = await prisma.evidence.upsert({
    where: { qrCode: 'EV-SEED-ASSAULT-WEAPON' },
    update: {},
    create: {
      type: 'physical',
      description: 'Blood-stained wooden stick used in assault, approximately 2 feet long',
      qrCode: 'EV-SEED-ASSAULT-WEAPON',
      collectedDate: new Date('2024-10-20'),
      collectedById: commander.id,
      collectedLocation: 'King Jimmy Market, Freetown',
      stationId: hqStation.id,
      storageLocation: 'Evidence Locker A-12',
      tags: ['weapon', 'assault', 'blood', 'wooden_stick'],
      status: 'stored',
      chainOfCustody: [
        buildCustodyEntry(commander.id, commander.name, commander.badge, 'collected', 'King Jimmy Market, Freetown'),
      ],
    },
  });

  // Evidence 4: Medical report (linked to assault case)
  const evidence4 = await prisma.evidence.upsert({
    where: { qrCode: 'EV-SEED-ASSAULT-MEDRPT' },
    update: {},
    create: {
      type: 'document',
      description: "Medical report from Connaught Hospital documenting victim's injuries",
      qrCode: 'EV-SEED-ASSAULT-MEDRPT',
      collectedDate: new Date('2024-10-21'),
      collectedById: commander.id,
      collectedLocation: 'Connaught Hospital, Freetown',
      stationId: hqStation.id,
      storageLocation: 'Case File Storage',
      tags: ['medical', 'assault', 'hospital', 'injuries'],
      status: 'analyzed',
      chainOfCustody: [
        buildCustodyEntry(commander.id, commander.name, commander.badge, 'collected', 'Connaught Hospital, Freetown'),
      ],
    },
  });

  // Evidence 5: Witness statement (unlinked)
  const evidence5 = await prisma.evidence.upsert({
    where: { qrCode: 'EV-SEED-WITNESS-STMT' },
    update: {},
    create: {
      type: 'document',
      description: 'Written witness statement from market vendor who saw the assault',
      qrCode: 'EV-SEED-WITNESS-STMT',
      collectedDate: new Date('2024-10-20'),
      collectedById: commander.id,
      collectedLocation: 'King Jimmy Market, Freetown',
      stationId: hqStation.id,
      storageLocation: 'Witness Statements Folder',
      tags: ['witness', 'statement', 'assault', 'market'],
      status: 'collected',
      chainOfCustody: [
        buildCustodyEntry(commander.id, commander.name, commander.badge, 'collected', 'King Jimmy Market, Freetown'),
      ],
    },
  });

  // Evidence 6: Digital fingerprint (unlinked)
  const evidence6 = await prisma.evidence.upsert({
    where: { qrCode: 'EV-SEED-FINGERPRINT' },
    update: {},
    create: {
      type: 'digital',
      description: 'Digital fingerprint scan taken from crime scene',
      qrCode: 'EV-SEED-FINGERPRINT',
      collectedDate: new Date('2024-11-02'),
      collectedById: officer2.id,
      collectedLocation: 'Crime Scene Investigation Lab',
      stationId: hqStation.id,
      storageLocation: 'Digital Forensics Database',
      tags: ['fingerprint', 'digital', 'forensic', 'identification'],
      status: 'analyzed',
      chainOfCustody: [
        buildCustodyEntry(officer2.id, officer2.name, officer2.badge, 'collected', 'Crime Scene Investigation Lab'),
      ],
    },
  });

  // Link evidence to cases via CaseEvidence
  const evidenceCaseLinks = [
    { evidenceId: evidence1.id, caseId: theftCase.id, addedById: officer1.id, notes: 'Primary crime scene photograph' },
    { evidenceId: evidence2.id, caseId: theftCase.id, addedById: officer1.id, notes: 'Surveillance footage from parking lot' },
    { evidenceId: evidence3.id, caseId: assaultCase.id, addedById: commander.id, notes: 'Weapon recovered from scene' },
    { evidenceId: evidence4.id, caseId: assaultCase.id, addedById: commander.id, notes: 'Victim medical documentation' },
  ];

  for (const link of evidenceCaseLinks) {
    await prisma.caseEvidence.upsert({
      where: {
        caseId_evidenceId: {
          caseId: link.caseId,
          evidenceId: link.evidenceId,
        },
      },
      update: {},
      create: link,
    });
  }

  console.log('Created 6 evidence records with 4 case links');

  // ==================== FRAMEWORK CONFIG (Security Governance) ====================
  console.log('Creating security governance config entries...');

  const securityConfigs = [
    {
      key: 'oversight.contactEmail',
      category: 'oversight',
      value: 'oversight@police.gov.sl',
      description: 'Email address for civil oversight notifications',
      isSystem: true,
    },
    {
      key: 'oversight.contactPhone',
      category: 'oversight',
      value: '+232-XXX-XXXX',
      description: 'Phone number for civil oversight SMS notifications',
      isSystem: true,
    },
    {
      key: 'approval.expiryHours',
      category: 'oversight',
      value: 24,
      description: 'Number of hours before a pending approval expires',
      isSystem: true,
    },
  ];

  for (const cfg of securityConfigs) {
    await prisma.frameworkConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }

  console.log(`Created ${securityConfigs.length} security governance config entries`);

  // ==================== PROPERTY TYPES ====================
  console.log('Creating property types...');

  const propertyTypes = [
    { name: 'Mobile Phone', slug: 'mobile-phone', identifierTypes: ['IMEI', 'Serial Number'], icon: 'smartphone', sortOrder: 1 },
    { name: 'Laptop', slug: 'laptop', identifierTypes: ['Serial Number', 'MAC Address'], icon: 'laptop', sortOrder: 2 },
    { name: 'Tablet', slug: 'tablet', identifierTypes: ['IMEI', 'Serial Number'], icon: 'tablet', sortOrder: 3 },
    { name: 'Television', slug: 'television', identifierTypes: ['Serial Number', 'Model Number'], icon: 'tv', sortOrder: 4 },
    { name: 'Generator', slug: 'generator', identifierTypes: ['Serial Number', 'Engine Number'], icon: 'zap', sortOrder: 5 },
    { name: 'Solar Panel', slug: 'solar-panel', identifierTypes: ['Serial Number', 'Model Number'], icon: 'sun', sortOrder: 6 },
    { name: 'Bicycle', slug: 'bicycle', identifierTypes: ['Frame Number', 'Serial Number'], icon: 'bike', sortOrder: 7 },
    { name: 'Motorcycle', slug: 'motorcycle', identifierTypes: ['Chassis Number', 'Engine Number', 'License Plate'], icon: 'bike', sortOrder: 8 },
    { name: 'Camera', slug: 'camera', identifierTypes: ['Serial Number'], icon: 'camera', sortOrder: 9 },
    { name: 'Other', slug: 'other', identifierTypes: ['Serial Number', 'Other'], icon: 'package', sortOrder: 99 },
  ];

  for (const pt of propertyTypes) {
    await prisma.propertyType.upsert({
      where: { slug: pt.slug },
      update: { name: pt.name, identifierTypes: pt.identifierTypes, icon: pt.icon, sortOrder: pt.sortOrder },
      create: pt,
    });
  }

  console.log(`Created ${propertyTypes.length} property types`);

  // ==================== SUMMARY ====================
  console.log('\nSeeding complete!\n');
  console.log('Database Summary:');
  console.log(`  ${createdPermissions.length} permissions | 7 roles | 3 stations | 6 officers`);
  console.log('  4 persons | 3 vehicles | 2 cases | 1 wanted record | 6 evidence');
  console.log(`  ${propertyTypes.length} property types | 3 security governance config entries`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
