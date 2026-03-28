import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AgencyRepository } from '../agency.repository';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly agencyRepo: AgencyRepository) {}

  async fireEvent(event: string, payload: Record<string, any>) {
    const webhooks = await this.agencyRepo.findWebhooksByEvent(event);
    if (webhooks.length === 0) return;

    const results = await Promise.allSettled(
      webhooks.map((webhook) => this.deliverWebhook(webhook, event, payload)),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(
        `${failed.length}/${webhooks.length} webhook deliveries failed for event: ${event}`,
      );
    }
  }

  private async deliverWebhook(
    webhook: any,
    event: string,
    payload: Record<string, any>,
  ) {
    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    const delays = [1000, 2000, 4000];
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-OpenJustice-Signature': signature,
            'X-OpenJustice-Event': event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          await this.agencyRepo.resetWebhookFailCount(webhook.id);
          return;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Wait before retry (except on last attempt)
      if (attempt < 2) {
        await this.delay(delays[attempt]);
      }
    }

    // All attempts failed
    this.logger.error(
      `Webhook delivery failed for ${webhook.url} (event: ${event}): ${lastError?.message}`,
    );

    const updated = await this.agencyRepo.incrementWebhookFailCount(webhook.id);

    // Disable webhook if too many failures
    if (updated.failCount >= 10) {
      await this.agencyRepo.disableWebhook(webhook.id);
      this.logger.warn(
        `Webhook ${webhook.id} disabled after ${updated.failCount} consecutive failures`,
      );
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
