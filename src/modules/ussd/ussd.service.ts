import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UssdRepository } from './ussd.repository';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { hashPin } from '../../common/utils/hash.util';
import {
  UssdOfficerFilterDto,
  UssdOfficerListItemDto,
  UssdOfficerDetailDto,
  PaginatedUssdOfficersDto,
} from './dto/ussd-officer.dto';
import {
  UpdateUssdAccessDto,
  UpdateUssdAccessResponseDto,
} from './dto/update-ussd-access.dto';
import {
  ResetQuickPinDto,
  ResetQuickPinResponseDto,
} from './dto/reset-quick-pin.dto';

enum UssdState {
  MAIN_MENU = 'MAIN_MENU',
  AUTH_PIN = 'AUTH_PIN',
  QUERY_TYPE = 'QUERY_TYPE',
  SEARCH_TERM = 'SEARCH_TERM',
  RESULTS = 'RESULTS',
}

interface UssdSession {
  state: UssdState;
  officerId?: string;
  queryType?: string;
  searchTerm?: string;
}

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);
  private readonly sessions = new Map<string, UssdSession>();
  private readonly DAILY_QUERY_LIMIT = 50;

  constructor(
    private readonly ussdRepository: UssdRepository,
    private readonly prisma: PrismaService,
  ) {}

  async handleCallback(sessionId: string, phoneNumber: string, text?: string) {
    const input = text || '';
    const inputs = input.split('*');
    const currentInput = inputs[inputs.length - 1];

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { state: UssdState.MAIN_MENU };
      this.sessions.set(sessionId, session);
    }

    try {
      switch (session.state) {
        case UssdState.MAIN_MENU:
          return this.handleMainMenu(sessionId, phoneNumber, session);

        case UssdState.AUTH_PIN:
          return this.handleAuthPin(sessionId, phoneNumber, currentInput, session);

        case UssdState.QUERY_TYPE:
          return this.handleQueryType(sessionId, currentInput, session);

        case UssdState.SEARCH_TERM:
          return this.handleSearchTerm(sessionId, currentInput, session);

        default:
          this.sessions.delete(sessionId);
          return this.endResponse('Session expired. Please dial again.');
      }
    } catch (err: any) {
      this.logger.error(`USSD error for ${phoneNumber}: ${err.message}`);
      this.sessions.delete(sessionId);
      return this.endResponse('An error occurred. Please try again.');
    }
  }

  private handleMainMenu(sessionId: string, phoneNumber: string, session: UssdSession) {
    // Check if phone is registered
    session.state = UssdState.AUTH_PIN;
    return this.continueResponse(
      'OpenJustice Field Query Tool\n\nEnter your Quick PIN to authenticate:',
    );
  }

  private async handleAuthPin(
    sessionId: string,
    phoneNumber: string,
    pin: string,
    session: UssdSession,
  ) {
    // Find officer by USSD phone number
    const officer = await this.prisma.officer.findFirst({
      where: { ussdPhoneNumber: phoneNumber, ussdEnabled: true, active: true },
    });

    if (!officer) {
      this.sessions.delete(sessionId);
      return this.endResponse(
        'Phone number not registered for USSD access. Contact your admin.',
      );
    }

    // Verify quick PIN
    if (!officer.ussdQuickPinHash) {
      this.sessions.delete(sessionId);
      return this.endResponse('No Quick PIN set. Register via the web portal.');
    }

    // Simple verification (in production, use argon2 verify)
    const { verify } = await import('argon2');
    const isValid = await verify(officer.ussdQuickPinHash, pin);

    if (!isValid) {
      this.sessions.delete(sessionId);
      return this.endResponse('Invalid PIN. Please try again.');
    }

    // Check daily limit
    const dailyCount = await this.ussdRepository.getDailyCount(officer.id, new Date());
    if (dailyCount >= (officer.ussdDailyLimit || this.DAILY_QUERY_LIMIT)) {
      this.sessions.delete(sessionId);
      return this.endResponse(
        `Daily query limit reached (${officer.ussdDailyLimit || this.DAILY_QUERY_LIMIT}). Try again tomorrow.`,
      );
    }

    session.officerId = officer.id;
    session.state = UssdState.QUERY_TYPE;

    // Update last used
    await this.prisma.officer.update({
      where: { id: officer.id },
      data: { ussdLastUsed: new Date() },
    });

    return this.continueResponse(
      `Welcome ${officer.name}\n\nSelect query type:\n1. Wanted Person Check\n2. Missing Person Check\n3. Background Check\n4. Vehicle Check`,
    );
  }

  private handleQueryType(sessionId: string, input: string, session: UssdSession) {
    const queryTypes: Record<string, string> = {
      '1': 'wanted',
      '2': 'missing',
      '3': 'background',
      '4': 'vehicle',
    };

    const queryType = queryTypes[input];
    if (!queryType) {
      return this.continueResponse(
        'Invalid selection.\n\n1. Wanted Person Check\n2. Missing Person Check\n3. Background Check\n4. Vehicle Check',
      );
    }

    session.queryType = queryType;
    session.state = UssdState.SEARCH_TERM;

    const prompts: Record<string, string> = {
      wanted: 'Enter person name or NIN:',
      missing: 'Enter person name or NIN:',
      background: 'Enter NIN for background check:',
      vehicle: 'Enter license plate number:',
    };

    return this.continueResponse(prompts[queryType]);
  }

  private async handleSearchTerm(sessionId: string, searchTerm: string, session: UssdSession) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return this.continueResponse('Search term too short. Enter at least 2 characters:');
    }

    session.searchTerm = searchTerm.trim();
    let resultSummary: string;
    let success = true;

    try {
      switch (session.queryType) {
        case 'wanted':
          resultSummary = await this.searchWanted(searchTerm);
          break;
        case 'missing':
          resultSummary = await this.searchMissing(searchTerm);
          break;
        case 'background':
          resultSummary = await this.searchBackground(searchTerm);
          break;
        case 'vehicle':
          resultSummary = await this.searchVehicle(searchTerm);
          break;
        default:
          resultSummary = 'Unknown query type';
          success = false;
      }
    } catch (err: any) {
      resultSummary = 'Search failed';
      success = false;
    }

    // Log the query
    if (session.officerId) {
      await this.ussdRepository.create({
        officerId: session.officerId,
        phoneNumber: '',
        queryType: session.queryType || 'unknown',
        searchTerm,
        resultSummary,
        success,
        sessionId,
      });
    }

    this.sessions.delete(sessionId);
    return this.endResponse(resultSummary);
  }

  private async searchWanted(term: string): Promise<string> {
    const results = await this.prisma.wantedPerson.findMany({
      where: {
        status: 'active',
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { person: { nationalId: term } },
        ],
      },
      take: 3,
      select: { name: true, charges: true, dangerLevel: true },
    });

    if (results.length === 0) {
      return 'No active wanted person records found.';
    }

    return results
      .map(
        (r, i) =>
          `${i + 1}. ${r.name}\nCharges: ${r.charges.join(', ')}\nDanger: ${r.dangerLevel}`,
      )
      .join('\n\n');
  }

  private async searchMissing(term: string): Promise<string> {
    const results = await this.prisma.amberAlert.findMany({
      where: {
        status: 'active',
        personName: { contains: term, mode: 'insensitive' },
      },
      take: 3,
      select: { personName: true, age: true, lastSeenLocation: true, contactPhone: true },
    });

    if (results.length === 0) {
      return 'No active missing person alerts found.';
    }

    return results
      .map(
        (r, i) =>
          `${i + 1}. ${r.personName}${r.age ? `, Age: ${r.age}` : ''}\nLast seen: ${r.lastSeenLocation || 'Unknown'}\nContact: ${r.contactPhone}`,
      )
      .join('\n\n');
  }

  private async searchBackground(nin: string): Promise<string> {
    const person = await this.prisma.person.findUnique({
      where: { nationalId: nin },
      select: {
        firstName: true,
        lastName: true,
        isWanted: true,
        cases: { select: { role: true } },
      },
    });

    if (!person) {
      return `NIN: ${nin}\nStatus: CLEAR\nNo records found.`;
    }

    const caseCount = person.cases.length;
    if (person.isWanted) {
      return `NIN: ${nin}\nName: ${person.firstName} ${person.lastName}\nStatus: WANTED\nCases: ${caseCount}\n\nIMPORTANT: This person is WANTED.`;
    }

    if (caseCount > 0) {
      return `NIN: ${nin}\nName: ${person.firstName} ${person.lastName}\nStatus: RECORD EXISTS\nCases: ${caseCount}\n\nVisit station for details.`;
    }

    return `NIN: ${nin}\nName: ${person.firstName} ${person.lastName}\nStatus: CLEAR`;
  }

  private async searchVehicle(plate: string): Promise<string> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { licensePlate: plate.toUpperCase() },
      select: {
        licensePlate: true,
        vehicleType: true,
        make: true,
        model: true,
        color: true,
        status: true,
        ownerName: true,
      },
    });

    if (!vehicle) {
      return `Plate: ${plate.toUpperCase()}\nNo records found.`;
    }

    const desc = [vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' ');
    let result = `Plate: ${vehicle.licensePlate}\nType: ${vehicle.vehicleType}\n${desc ? `Desc: ${desc}\n` : ''}Status: ${vehicle.status.toUpperCase()}`;

    if (vehicle.status === 'stolen') {
      result += '\n\nALERT: This vehicle is reported STOLEN!';
    }

    return result;
  }

  async registerOfficer(officerId: string, phoneNumber: string, quickPin: string) {
    const hashedPin = await hashPin(quickPin);

    await this.prisma.officer.update({
      where: { id: officerId },
      data: {
        ussdPhoneNumber: phoneNumber,
        ussdQuickPinHash: hashedPin,
        ussdEnabled: true,
        ussdRegisteredAt: new Date(),
      },
    });

    return { registered: true, phoneNumber };
  }

  async getLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.ussdRepository.findAll(skip, limit),
      this.ussdRepository.countAll(),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getOfficerLogs(officerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.ussdRepository.findByOfficer(officerId, skip, limit),
      this.ussdRepository.countByOfficer(officerId),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Get paginated list of officers with USSD status
   */
  async getOfficersWithUssdStatus(
    filters: UssdOfficerFilterDto,
  ): Promise<PaginatedUssdOfficersDto> {
    const { page = 1, limit = 20, stationId, ussdEnabled } = filters;
    const skip = (page - 1) * limit;

    const where: any = { active: true };
    if (stationId) {
      where.stationId = stationId;
    }
    if (ussdEnabled !== undefined) {
      where.ussdEnabled = ussdEnabled;
    }

    const [officers, total] = await Promise.all([
      this.prisma.officer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          badge: true,
          name: true,
          stationId: true,
          station: { select: { name: true } },
          role: { select: { name: true, level: true } },
          ussdEnabled: true,
          ussdQuickPinHash: true,
          ussdPhoneNumber: true,
          ussdLastUsed: true,
        },
      }),
      this.prisma.officer.count({ where }),
    ]);

    // Get query counts for each officer
    const officerIds = officers.map((o) => o.id);
    const queryCounts = await this.prisma.uSSDQueryLog.groupBy({
      by: ['officerId'],
      where: { officerId: { in: officerIds } },
      _count: { id: true },
    });

    const queryCountMap = new Map(
      queryCounts.map((qc) => [qc.officerId, qc._count.id]),
    );

    const data: UssdOfficerListItemDto[] = officers.map((officer) => ({
      id: officer.id,
      badge: officer.badge,
      name: officer.name,
      rank: officer.role.name,
      stationId: officer.stationId,
      stationName: officer.station.name,
      ussdEnabled: officer.ussdEnabled,
      quickPinSet: !!officer.ussdQuickPinHash,
      phoneNumber: officer.ussdPhoneNumber,
      lastUssdQuery: officer.ussdLastUsed,
      queryCount: queryCountMap.get(officer.id) || 0,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed USSD info for a specific officer
   */
  async getOfficerUssdDetails(officerId: string): Promise<UssdOfficerDetailDto> {
    const officer = await this.prisma.officer.findUnique({
      where: { id: officerId },
      select: {
        id: true,
        badge: true,
        name: true,
        role: { select: { name: true } },
        ussdEnabled: true,
        ussdQuickPinHash: true,
        ussdPhoneNumber: true,
        ussdRegisteredAt: true,
        ussdLastUsed: true,
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!officer) {
      throw new NotFoundException(`Officer with ID ${officerId} not found`);
    }

    // Get query count
    const queryCount = await this.prisma.uSSDQueryLog.count({
      where: { officerId },
    });

    // Get recent queries
    const recentQueries = await this.prisma.uSSDQueryLog.findMany({
      where: { officerId },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        queryType: true,
        searchTerm: true,
        resultSummary: true,
        success: true,
        timestamp: true,
      },
    });

    return {
      id: officer.id,
      badge: officer.badge,
      name: officer.name,
      rank: officer.role.name,
      station: officer.station,
      ussdEnabled: officer.ussdEnabled,
      quickPinSet: !!officer.ussdQuickPinHash,
      phoneNumber: officer.ussdPhoneNumber,
      registeredAt: officer.ussdRegisteredAt,
      lastUssdQuery: officer.ussdLastUsed,
      queryCount,
      recentQueries: recentQueries.map((q) => ({
        id: q.id,
        queryType: q.queryType,
        queryData: {
          searchTerm: q.searchTerm,
          resultSummary: q.resultSummary,
          success: q.success,
        },
        createdAt: q.timestamp,
      })),
    };
  }

  /**
   * Enable or disable USSD access for an officer
   */
  async updateUssdAccess(
    officerId: string,
    dto: UpdateUssdAccessDto,
  ): Promise<UpdateUssdAccessResponseDto> {
    const officer = await this.prisma.officer.findUnique({
      where: { id: officerId },
      select: { id: true, badge: true, name: true },
    });

    if (!officer) {
      throw new NotFoundException(`Officer with ID ${officerId} not found`);
    }

    await this.prisma.officer.update({
      where: { id: officerId },
      data: { ussdEnabled: dto.ussdEnabled },
    });

    this.logger.log(
      `USSD access ${dto.ussdEnabled ? 'enabled' : 'disabled'} for officer ${officer.badge} (${officer.name})`,
    );

    return {
      id: officerId,
      ussdEnabled: dto.ussdEnabled,
      message: `USSD access ${dto.ussdEnabled ? 'enabled' : 'disabled'} successfully`,
    };
  }

  /**
   * Reset an officer's Quick PIN for USSD
   */
  async resetOfficerQuickPin(
    officerId: string,
    dto: ResetQuickPinDto,
  ): Promise<ResetQuickPinResponseDto> {
    const officer = await this.prisma.officer.findUnique({
      where: { id: officerId },
      select: { id: true, badge: true, name: true },
    });

    if (!officer) {
      throw new NotFoundException(`Officer with ID ${officerId} not found`);
    }

    const hashedPin = await hashPin(dto.newQuickPin);

    await this.prisma.officer.update({
      where: { id: officerId },
      data: { ussdQuickPinHash: hashedPin },
    });

    this.logger.log(
      `Quick PIN reset for officer ${officer.badge} (${officer.name})`,
    );

    return {
      success: true,
      message: 'Quick PIN reset successfully',
      officerId,
    };
  }

  /**
   * Export USSD logs for an officer as CSV
   */
  async exportOfficerLogsAsCsv(officerId: string): Promise<string> {
    const officer = await this.prisma.officer.findUnique({
      where: { id: officerId },
      select: { badge: true, name: true },
    });

    if (!officer) {
      throw new NotFoundException(`Officer with ID ${officerId} not found`);
    }

    const logs = await this.prisma.uSSDQueryLog.findMany({
      where: { officerId },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        queryType: true,
        searchTerm: true,
        resultSummary: true,
        success: true,
        timestamp: true,
        sessionId: true,
      },
    });

    // Generate CSV
    const header = 'ID,Query Type,Search Term,Result Summary,Success,Timestamp,Session ID\n';
    const rows = logs.map((log) => {
      const escapeCsv = (str: string | null) =>
        str ? `"${str.replace(/"/g, '""')}"` : '""';
      return [
        log.id,
        log.queryType,
        escapeCsv(log.searchTerm),
        escapeCsv(log.resultSummary),
        log.success ? 'Yes' : 'No',
        log.timestamp.toISOString(),
        log.sessionId || '',
      ].join(',');
    });

    return header + rows.join('\n');
  }

  private continueResponse(message: string) {
    return { response: `CON ${message}` };
  }

  private endResponse(message: string) {
    return { response: `END ${message}` };
  }
}
