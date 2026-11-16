// Human-readable order numbers: `{PREFIX}-{000123}`. The prefix comes from the restaurant name so
// customers and kitchen staff can read a ticket at a glance; the counter is per restaurant.
export function orderPrefix(restaurantName: string): string {
  const letters = restaurantName.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "ORD").padEnd(2, "X");
}

export function formatOrderNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

/** Paystack reference: unique per payment attempt and tied to the order. */
export function paymentReference(orderNumber: string, attempt: number): string {
  return `${orderNumber.replace(/[^A-Za-z0-9]/g, "")}-${Date.now().toString(36).toUpperCase()}-${attempt}`;
}
