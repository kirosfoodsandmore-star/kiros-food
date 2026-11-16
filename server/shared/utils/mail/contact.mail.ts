// Email for the storefront contact form: goes to the restaurant's own address, Reply-To is the visitor.
import { emailLayout, escapeAndLineBreak, esc, footnote, heading, infoBox, paragraph, type ComposedMail, type LayoutBrand } from "../mailer";

export function contactMessageEmail(p: { brand: LayoutBrand; name: string; email: string; phone: string | null; message: string }): ComposedMail {
  const details = [`Name: ${esc(p.name)}`, `Email: <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`, p.phone ? `Phone: ${esc(p.phone)}` : null].filter(Boolean).join("<br>");
  const body = [
    heading(`New message from ${p.name}`),
    infoBox("From", details),
    paragraph(escapeAndLineBreak(p.message)),
    footnote(`Sent from the contact form on your storefront. Reply to this email to answer ${esc(p.name)} directly.`),
  ].join("");
  // Names come from a public form: keep them out of header-breaking territory.
  const safeName = p.name.replace(/[\r\n]+/g, " ").slice(0, 80);
  return {
    subject: `New message from ${safeName} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `New message from ${p.name} <${p.email}>${p.phone ? ` (${p.phone})` : ""}:\n\n${p.message}\n\nReply to this email to answer them directly.`,
  };
}
