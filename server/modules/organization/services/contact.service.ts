// Storefront contact form. Unlike the event-driven emails, the visitor must be told when delivery fails, so
// this waits for the send instead of firing and forgetting.
import { AppError } from "../../../shared/errors/AppError";
import { EmailNotifierService } from "../../notification/services/emailNotifier.service";
import { OrganizationRepository } from "../repositories/organization.repository";
import type { ContactMessageBody } from "../validators/contact.schema";

export class ContactService {
  static Instance = new ContactService();
  private constructor(
    private readonly organizations = OrganizationRepository.Instance,
    private readonly notifier = EmailNotifierService.Instance
  ) {}

  async send(slug: string, body: ContactMessageBody): Promise<{ sent: true }> {
    const org = await this.organizations.findBySlug(slug);
    if (!org || org.isSuspended) throw AppError.notFound("Restaurant not found");
    if (body.website) return { sent: true }; // honeypot tripped: look successful, deliver nothing
    const delivered = await this.notifier.contactMessage(org.id, { name: body.name, email: body.email, phone: body.phone || null, message: body.message });
    if (!delivered) throw AppError.unavailable("We couldn't send your message just now. Please call or WhatsApp us instead.");
    return { sent: true };
  }
}
