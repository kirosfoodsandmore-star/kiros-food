// Customer-facing order emails: placed, bank-transfer instructions, status updates, payment
// confirmed / rejected, refund. All transactional tone; the subject carries the order number.
import type { OrderStatus } from "../../../config/constants";
import { ctaButton, divider, emailLayout, esc, figuresTable, footnote, heading, infoBox, list, paragraph, warningBox, type ComposedMail, type LayoutBrand } from "../mailer";

export interface OrderMailLine {
  name: string;
  quantity: number;
  options: string;
  lineTotal: string;
}

export interface OrderMailSummary {
  number: string;
  branchName: string;
  fulfilment: "delivery" | "pickup";
  when: string;
  address: string | null;
  lines: OrderMailLine[];
  subtotal: string;
  deliveryFee: string;
  discount: string | null;
  total: string;
  trackUrl: string;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  awaiting_confirmation: "Awaiting confirmation",
  paid: "Paid",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function orderTable(o: OrderMailSummary): string {
  const rows: Array<[string, string]> = [["Subtotal", o.subtotal]];
  if (o.fulfilment === "delivery") rows.push(["Delivery fee", o.deliveryFee]);
  if (o.discount) rows.push(["Discount", `-${o.discount}`]);
  rows.push(["Total", o.total]);
  return [
    list(o.lines.map((l) => `${l.quantity} × ${l.name}${l.options ? ` (${l.options})` : ""} — ${l.lineTotal}`)),
    figuresTable(rows, true),
  ].join("");
}

function fulfilmentBox(o: OrderMailSummary): string {
  return o.fulfilment === "delivery"
    ? infoBox("Delivery", `${esc(o.address ?? "")}<br>${esc(o.when)} · from ${esc(o.branchName)}`)
    : infoBox("Pickup", `${esc(o.branchName)}<br>${esc(o.when)}`);
}

export function orderPlacedEmail(p: { brand: LayoutBrand; customerName: string; order: OrderMailSummary }): ComposedMail {
  const body = [
    heading(`Order ${p.order.number} received`),
    paragraph(`Thanks ${esc(p.customerName)}, we've got your order and the payment went through. We'll let you know as it moves along.`),
    fulfilmentBox(p.order),
    orderTable(p.order),
    ctaButton(p.order.trackUrl, "Track your order"),
  ].join("");
  return {
    subject: `[${p.order.number}] Order received — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Order ${p.order.number} received. Total ${p.order.total}. Track it at ${p.order.trackUrl}`,
  };
}

export function transferInstructionsEmail(p: {
  brand: LayoutBrand;
  customerName: string;
  order: OrderMailSummary;
  bank: { bankName: string; accountName: string; accountNumber: string };
  deadline: string;
  instructions: string | null;
}): ComposedMail {
  const body = [
    heading(`Complete payment for ${p.order.number}`),
    paragraph(`Hi ${esc(p.customerName)}, transfer <strong>${esc(p.order.total)}</strong> to the account below and use the order number as the transfer reference. Your order is held until ${esc(p.deadline)}.`),
    infoBox("Bank details", `${esc(p.bank.bankName)}<br>${esc(p.bank.accountName)}<br><strong>${esc(p.bank.accountNumber)}</strong><br>Reference: <strong>${esc(p.order.number)}</strong>`),
    p.instructions ? paragraph(esc(p.instructions)) : "",
    paragraph(`Once you've sent it, tap "I have paid" on the order page. We'll confirm and start on your order.`),
    ctaButton(p.order.trackUrl, "Open the order"),
    divider(),
    orderTable(p.order),
  ].join("");
  return {
    subject: `[${p.order.number}] Complete your payment — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Transfer ${p.order.total} to ${p.bank.bankName} ${p.bank.accountNumber} (${p.bank.accountName}) with reference ${p.order.number} before ${p.deadline}. Then mark it paid at ${p.order.trackUrl}`,
  };
}

export function orderStatusEmail(p: { brand: LayoutBrand; customerName: string; order: OrderMailSummary; status: OrderStatus; note: string | null; deliveryCode?: string | null }): ComposedMail {
  const label = STATUS_LABELS[p.status];
  const alerting = p.status === "cancelled" || p.status === "refunded";
  const lead: Record<string, string> = {
    paid: "Your payment is confirmed and the kitchen has your order.",
    accepted: "The kitchen accepted your order.",
    preparing: "Your order is being prepared.",
    ready: p.order.fulfilment === "pickup" ? "Your order is ready for pickup." : "Your order is packed and about to leave.",
    out_for_delivery: "Your order is on its way.",
    completed: "Your order is complete. Enjoy!",
    cancelled: "Your order was cancelled.",
    refunded: "Your order was refunded.",
  };
  const body = [
    heading(`${p.order.number}: ${label}`),
    paragraph(`Hi ${esc(p.customerName)}, ${esc(lead[p.status] ?? `your order is now ${label.toLowerCase()}.`)}`),
    p.note ? (alerting ? warningBox(`<strong>Reason:</strong> ${esc(p.note)}`) : infoBox("Note", esc(p.note))) : "",
    alerting && p.status === "cancelled" ? paragraph("If you already paid, the amount will be refunded to you. Reply to this email or chat with the branch from your order page if you have questions.") : "",
    p.deliveryCode ? infoBox("Your delivery code", `<span style="font-size:28px;font-weight:700;letter-spacing:6px">${esc(p.deliveryCode)}</span><br>Give this code to the rider when your order arrives. It proves you received it. Please don’t share it with anyone else.`) : "",
    ctaButton(p.order.trackUrl, "View the order"),
  ].join("");
  return {
    subject: `[${p.order.number}] ${label} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `${p.order.number}: ${label}. ${lead[p.status] ?? ""}${p.note ? ` Reason: ${p.note}` : ""}${p.deliveryCode ? ` Your delivery code is ${p.deliveryCode}: give it to the rider when your order arrives.` : ""} ${p.order.trackUrl}`,
  };
}

export function paymentRejectedEmail(p: { brand: LayoutBrand; customerName: string; order: OrderMailSummary; reason: string }): ComposedMail {
  const body = [
    heading(`${p.order.number}: payment not confirmed`),
    paragraph(`Hi ${esc(p.customerName)}, we could not match your bank transfer for order ${esc(p.order.number)}, so the order was cancelled.`),
    warningBox(`<strong>Reason:</strong> ${esc(p.reason)}`),
    paragraph("If you did send the money, reply to this email with your transfer receipt and we'll sort it out."),
    footnote("You can place the order again at any time from the menu."),
  ].join("");
  return {
    subject: `[${p.order.number}] Payment not confirmed — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `We could not confirm your transfer for ${p.order.number}: ${p.reason}. Reply with your receipt if you did pay.`,
  };
}

export function newOrderStaffEmail(p: { brand: LayoutBrand; staffName: string; order: OrderMailSummary; customerPhone: string; adminUrl: string }): ComposedMail {
  const body = [
    heading(`New order ${p.order.number}`),
    paragraph(`Hi ${esc(p.staffName)}, a new ${p.order.fulfilment} order is paid and waiting at ${esc(p.order.branchName)}.`),
    infoBox("Customer", `${esc(p.customerPhone)}<br>${esc(p.order.when)}${p.order.address ? `<br>${esc(p.order.address)}` : ""}`),
    orderTable(p.order),
    ctaButton(p.adminUrl, "Open the live board"),
  ].join("");
  return {
    subject: `[${p.order.number}] New order at ${p.order.branchName} — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `New ${p.order.fulfilment} order ${p.order.number} at ${p.order.branchName}, total ${p.order.total}. ${p.adminUrl}`,
  };
}
