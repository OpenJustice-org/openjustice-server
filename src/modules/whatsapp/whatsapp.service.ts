import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { WhatsappRepository } from './whatsapp.repository';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  NewsletterDetailDto,
  SubscriberFilterDto,
  PaginatedSubscribersDto,
  SubscriberDto,
  PaginatedBroadcastsDto,
  BroadcastDto,
} from './dto/newsletter-detail.dto';
import * as templates from './whatsapp.templates';
import { WhapiListMessage } from './whatsapp.interfaces';

enum WaState {
  MAIN_MENU = 'MAIN_MENU',
  AUTH_PIN = 'AUTH_PIN',
  QUERY_TYPE = 'QUERY_TYPE',
  SEARCH_TERM = 'SEARCH_TERM',
  RESULTS = 'RESULTS',
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly whapiUrl: string;
  private readonly whapiToken: string;
  private readonly SESSION_TTL_HOURS = 4;

  constructor(
    private readonly whatsappRepository: WhatsappRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.whapiUrl = this.configService.get<string>('WHAPI_URL', 'https://gate.whapi.cloud');
    this.whapiToken = this.configService.get<string>('WHAPI_TOKEN', '');
  }

  async handleWebhook(payload: any) {
    if (!payload?.messages?.length) {
      return { status: 'no_messages' };
    }

    for (const message of payload.messages) {
      if (message.from_me) continue;

      const phoneNumber = message.chat_id?.replace('@s.whatsapp.net', '') || message.from;

      // Extract list reply ID from interactive list selections, falling back to text
      let text = message.text?.body || message.body || '';
      const listReplyId = message.reply?.list_reply?.id;
      if (listReplyId) {
        text = listReplyId.replace(/^ListV3:/, '');
      }

      await this.processMessage(phoneNumber, text);
    }

    return { status: 'processed' };
  }

  private async processMessage(phoneNumber: string, text: string) {
    // Clean expired sessions
    await this.whatsappRepository.deleteExpiredSessions();

    // Get or create session
    let session: any = await this.whatsappRepository.findSession(phoneNumber);

    if (!session) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_TTL_HOURS);

      session = await this.whatsappRepository.createSession({
        phoneNumber,
        expiresAt,
      });
    }

    const normalizedText = text.trim().toLowerCase();

    // Handle /help command
    if (normalizedText === '/help') {
      await this.sendMessage(phoneNumber, templates.helpTemplate());
      return;
    }

    // Handle /start or greeting
    if (normalizedText === '/start' || normalizedText === 'hi') {
      await this.whatsappRepository.updateSession(session.id, {
        state: 'MAIN_MENU',
      });
      await this.handleMainMenu(session, phoneNumber, normalizedText);
      return;
    }

    // Handle /cancel
    if (normalizedText === '/cancel') {
      await this.whatsappRepository.updateSession(session.id, {
        state: 'MAIN_MENU',
        selectedQueryType: null,
        searchTerm: null,
      });
      await this.sendMessage(phoneNumber, templates.cancelTemplate());
      return;
    }

    try {
      switch (session.state) {
        case 'MAIN_MENU':
          await this.handleMainMenu(session, phoneNumber, normalizedText);
          break;
        case 'AUTH_PIN':
          await this.handleAuthPin(session, phoneNumber, text);
          break;
        case 'QUERY_TYPE':
          await this.handleQueryType(session, phoneNumber, normalizedText);
          break;
        case 'SEARCH_TERM':
          await this.handleSearchTerm(session, phoneNumber, text);
          break;
        default:
          await this.whatsappRepository.updateSession(session.id, { state: 'MAIN_MENU' });
          await this.handleMainMenu(session, phoneNumber, '');
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp error for ${phoneNumber}: ${err.message}`);
      await this.sendMessage(phoneNumber, templates.errorTemplate());
    }
  }

  private async handleMainMenu(session: any, phoneNumber: string, text: string) {
    // Check if phone is registered (DB stores numbers with '+' prefix)
    const dbPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const officer = await this.prisma.officer.findFirst({
      where: {
        OR: [
          { ussdPhoneNumber: dbPhone },
          { phone: { contains: dbPhone } },
        ],
        active: true,
      },
    });

    if (officer) {
      await this.whatsappRepository.updateSession(session.id, {
        officerId: officer.id,
        state: 'QUERY_TYPE',
      });
      await this.sendMessage(phoneNumber, templates.authSuccessTemplate(officer.name));
      await this.sendListMessage(templates.mainMenuTemplate(officer.name, phoneNumber));
    } else {
      await this.whatsappRepository.updateSession(session.id, { state: 'AUTH_PIN' });
      await this.sendMessage(phoneNumber, templates.authBadgePromptTemplate());
    }
  }

  private async handleAuthPin(session: any, phoneNumber: string, badge: string) {
    const officer = await this.prisma.officer.findFirst({
      where: { badge: badge.trim().toUpperCase(), active: true },
    });

    if (!officer) {
      const attempts = (session.pinAttempts || 0) + 1;
      if (attempts >= 3) {
        await this.whatsappRepository.deleteSession(session.id);
        await this.sendMessage(phoneNumber, templates.authLockedTemplate());
        return;
      }
      await this.whatsappRepository.updateSession(session.id, { pinAttempts: attempts });
      await this.sendMessage(phoneNumber, templates.authFailTemplate(3 - attempts));
      return;
    }

    await this.whatsappRepository.updateSession(session.id, {
      officerId: officer.id,
      state: 'QUERY_TYPE',
      pinAttempts: 0,
    });

    await this.sendMessage(phoneNumber, templates.authSuccessTemplate(officer.name));
    await this.sendListMessage(templates.mainMenuTemplate(officer.name, phoneNumber));
  }

  private async handleQueryType(session: any, phoneNumber: string, text: string) {
    // Handle help selection from interactive list
    if (text === 'help') {
      await this.sendMessage(phoneNumber, templates.helpTemplate());
      return;
    }

    const types: Record<string, string> = {
      '1': 'wanted',
      '2': 'missing',
      '3': 'background',
      '4': 'vehicle',
      '5': 'stolen-property',
      'wanted': 'wanted',
      'missing': 'missing',
      'background': 'background',
      'vehicle': 'vehicle',
      'stolen-property': 'stolen-property',
    };

    const queryType = types[text];
    if (!queryType) {
      await this.sendMessage(phoneNumber, templates.invalidSelectionTemplate());
      return;
    }

    await this.whatsappRepository.updateSession(session.id, {
      selectedQueryType: queryType,
      state: 'SEARCH_TERM',
    });

    await this.sendMessage(phoneNumber, templates.searchPromptTemplate(queryType));
  }

  private async handleSearchTerm(session: any, phoneNumber: string, term: string) {
    const queryType = session.selectedQueryType;
    let result: string;

    switch (queryType) {
      case 'wanted':
        result = await this.queryWanted(term);
        break;
      case 'missing':
        result = await this.queryMissing(term);
        break;
      case 'background':
        result = await this.queryBackground(term);
        break;
      case 'vehicle':
        result = await this.queryVehicle(term);
        break;
      case 'stolen-property':
        result = await this.queryStolenProperty(term);
        break;
      default:
        result = 'Unknown query type.';
    }

    await this.sendMessage(phoneNumber, result);

    // Reset to main menu
    await this.whatsappRepository.updateSession(session.id, {
      state: 'MAIN_MENU',
      selectedQueryType: null,
      searchTerm: null,
    });
  }

  private async queryWanted(term: string): Promise<string> {
    const results = await this.prisma.wantedPerson.findMany({
      where: {
        status: 'active',
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { person: { nationalId: term } },
        ],
      },
      take: 5,
      select: { name: true, charges: true, dangerLevel: true, lastSeenLocation: true },
    });

    if (results.length === 0) return templates.wantedPersonNotFoundTemplate();

    return templates.wantedPersonResultsTemplate(results);
  }

  private async queryMissing(term: string): Promise<string> {
    const results = await this.prisma.amberAlert.findMany({
      where: {
        status: 'active',
        personName: { contains: term, mode: 'insensitive' },
      },
      take: 5,
      select: { personName: true, age: true, lastSeenLocation: true, contactPhone: true },
    });

    if (results.length === 0) return templates.missingPersonNotFoundTemplate();

    return templates.missingPersonResultsTemplate(results);
  }

  private async queryBackground(nin: string): Promise<string> {
    const person = await this.prisma.person.findUnique({
      where: { nationalId: nin.trim() },
      select: {
        firstName: true,
        lastName: true,
        isWanted: true,
        cases: { select: { role: true } },
      },
    });

    return templates.backgroundCheckResultTemplate(nin, person);
  }

  private async queryVehicle(plate: string): Promise<string> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { licensePlate: plate.trim().toUpperCase() },
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

    if (!vehicle) return templates.vehicleNotFoundTemplate(plate);

    return templates.vehicleResultTemplate(plate, vehicle);
  }

  private async queryStolenProperty(term: string): Promise<string> {
    const results = await this.prisma.propertyIdentifier.findMany({
      where: {
        valueLower: { contains: term.toLowerCase().trim() },
      },
      include: {
        stolenProperty: {
          include: {
            propertyType: true,
            station: { select: { name: true } },
          },
        },
      },
      take: 5,
    });

    if (results.length === 0) return templates.stolenPropertyNotFoundTemplate(term);

    // Log lookup hit for stolen items
    const stolenMatches = results.filter(
      (r) => r.stolenProperty.status === 'stolen',
    );
    if (stolenMatches.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'stolen_property',
          entityId: stolenMatches[0].stolenProperty.id,
          officerId: 'system',
          action: 'stolen_property_lookup_hit',
          details: {
            searchTerm: term,
            source: 'whatsapp',
            matchedPropertyIds: stolenMatches.map((r) => r.stolenProperty.id),
          },
          success: true,
        },
      });
    }

    return templates.stolenPropertyResultsTemplate(term, results);
  }

  private async sendMessage(to: string, body: string) {
    if (!this.whapiToken) {
      this.logger.warn('WHAPI_TOKEN not configured — message not sent');
      return;
    }

    try {
      const chatId = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await fetch(`${this.whapiUrl}/messages/text`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whapiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: chatId, body }),
      });
    } catch (err: any) {
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${err.message}`);
    }
  }

  private async sendListMessage(payload: WhapiListMessage) {
    if (!this.whapiToken) {
      this.logger.warn('WHAPI_TOKEN not configured — list message not sent');
      return;
    }

    try {
      await fetch(`${this.whapiUrl}/messages/interactive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whapiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      this.logger.error(`Failed to send WhatsApp list message: ${err.message}`);
    }
  }

  // ==================== Newsletter Management ====================

  async findAllNewsletters(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.whatsappRepository.findAllNewsletters(skip, limit),
      this.whatsappRepository.countNewsletters(),
    ]);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async createNewsletter(
    data: {
      channelId: string;
      name: string;
      description?: string;
      pictureUrl?: string;
    },
    officerId: string,
  ) {
    return this.whatsappRepository.createNewsletter({
      ...data,
      createdById: officerId,
    });
  }

  async updateNewsletter(id: string, data: Record<string, any>) {
    const existing = await this.whatsappRepository.findNewsletterById(id);
    if (!existing) {
      throw new NotFoundException(`Newsletter not found: ${id}`);
    }
    return this.whatsappRepository.updateNewsletter(id, data);
  }

  async broadcastNewsletter(id: string, message: string) {
    const newsletter = await this.whatsappRepository.findNewsletterById(id);
    if (!newsletter) {
      throw new NotFoundException(`Newsletter not found: ${id}`);
    }

    if (!this.whapiToken) {
      this.logger.warn('WHAPI_TOKEN not configured — broadcast not sent');
      return { sent: false, reason: 'WHAPI_TOKEN not configured' };
    }

    try {
      await fetch(`${this.whapiUrl}/newsletters/${newsletter.channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whapiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: message }),
      });

      return { sent: true, channelId: newsletter.channelId };
    } catch (err: any) {
      this.logger.error(`Broadcast failed: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }

  /**
   * Get newsletter details with basic info
   * Note: Subscribers and broadcasts not implemented in schema yet
   */
  async getNewsletterDetails(id: string): Promise<NewsletterDetailDto> {
    const newsletter = await this.prisma.whatsAppNewsletter.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            badge: true,
            name: true,
          },
        },
      },
    });

    if (!newsletter) {
      throw new NotFoundException(`Newsletter not found: ${id}`);
    }

    return {
      id: newsletter.id,
      name: newsletter.name,
      description: newsletter.description,
      channelId: newsletter.channelId,
      isActive: newsletter.status === 'active',
      subscriberCount: newsletter.subscriberCount || 0,
      broadcastCount: 0, // Not implemented yet
      createdBy: newsletter.createdBy,
      createdAt: newsletter.createdAt,
      updatedAt: newsletter.updatedAt,
      subscribers: [], // Not implemented yet
      recentBroadcasts: [], // Not implemented yet
    };
  }

  /**
   * Archive/delete a newsletter (soft delete)
   */
  async archiveNewsletter(id: string): Promise<{ success: boolean; message: string }> {
    const newsletter = await this.prisma.whatsAppNewsletter.findUnique({
      where: { id },
    });

    if (!newsletter) {
      throw new NotFoundException(`Newsletter not found: ${id}`);
    }

    await this.prisma.whatsAppNewsletter.update({
      where: { id },
      data: { status: 'archived' },
    });

    this.logger.log(`Newsletter ${newsletter.name} (${id}) archived`);

    return {
      success: true,
      message: 'Newsletter archived successfully',
    };
  }

  /**
   * Get paginated list of newsletter subscribers
   * Note: Subscriber model not implemented in schema yet
   */
  async getNewsletterSubscribers(
    newsletterId: string,
    filters: SubscriberFilterDto,
  ): Promise<PaginatedSubscribersDto> {
    const { page = 1, limit = 20 } = filters;

    // Verify newsletter exists
    const newsletter = await this.prisma.whatsAppNewsletter.findUnique({
      where: { id: newsletterId },
    });

    if (!newsletter) {
      throw new NotFoundException(`Newsletter not found: ${newsletterId}`);
    }

    // Return empty list - subscriber tracking not yet implemented
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  /**
   * Get paginated broadcast history for a newsletter
   * Note: Broadcast model not implemented in schema yet
   */
  async getNewsletterBroadcasts(
    newsletterId: string,
    filters: SubscriberFilterDto,
  ): Promise<PaginatedBroadcastsDto> {
    const { page = 1, limit = 20 } = filters;

    // Verify newsletter exists
    const newsletter = await this.prisma.whatsAppNewsletter.findUnique({
      where: { id: newsletterId },
    });

    if (!newsletter) {
      throw new NotFoundException(`Newsletter not found: ${newsletterId}`);
    }

    // Return empty list - broadcast history not yet implemented
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }
}
