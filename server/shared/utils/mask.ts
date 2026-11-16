// Contact masking for staff without `customers.view_contact`.
export function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  return phone.length <= 4 ? "****" : `${phone.slice(0, 4)}${"*".repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`;
}

export function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
