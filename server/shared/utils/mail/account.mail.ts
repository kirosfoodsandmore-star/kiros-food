// Staff account emails: restaurant welcome, staff invite, password reset code, password changed.
import { ctaButton, emailLayout, esc, footnote, heading, infoBox, otpBox, paragraph, warningBox, type ComposedMail, type LayoutBrand } from "../mailer";

export function restaurantWelcomeEmail(p: { brand: LayoutBrand; ownerName: string; adminUrl: string; storefrontUrl: string }): ComposedMail {
  const body = [
    heading(`Welcome to Kiros, ${p.ownerName}`),
    paragraph(`<strong>${esc(p.brand.businessName)}</strong> is set up. Add your branches, opening hours and menu, enable a payment method, and your storefront is ready to take orders.`),
    infoBox("Your links", `Admin portal: <a href="${esc(p.adminUrl)}">${esc(p.adminUrl)}</a><br>Storefront: <a href="${esc(p.storefrontUrl)}">${esc(p.storefrontUrl)}</a>`),
    ctaButton(p.adminUrl, "Open the admin portal"),
    footnote("You are the Owner: only you can invite staff, change payment settings or transfer ownership."),
  ].join("");
  return {
    subject: `Welcome to Kiros — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Welcome to Kiros, ${p.ownerName}. ${p.brand.businessName} is set up. Admin: ${p.adminUrl} · Storefront: ${p.storefrontUrl}`,
  };
}

export function staffInviteEmail(p: { brand: LayoutBrand; name: string; inviterName: string; roleName: string; branches: string; acceptUrl: string; hours: number }): ComposedMail {
  const body = [
    heading(`You're invited to ${p.brand.businessName}`),
    paragraph(`Hi ${esc(p.name)}, ${esc(p.inviterName)} invited you to help run <strong>${esc(p.brand.businessName)}</strong> on Kiros as <strong>${esc(p.roleName)}</strong>.`),
    infoBox("Branches", esc(p.branches)),
    paragraph(`Choose your password to accept. The link is valid for ${p.hours} hours.`),
    ctaButton(p.acceptUrl, "Accept invitation"),
    footnote("If you weren't expecting this, you can ignore this email."),
  ].join("");
  return {
    subject: `Join ${p.brand.businessName} on Kiros`,
    html: emailLayout(body, p.brand),
    text: `Hi ${p.name}, ${p.inviterName} invited you to ${p.brand.businessName} as ${p.roleName} (${p.branches}). Accept within ${p.hours} hours: ${p.acceptUrl}`,
  };
}

export function passwordResetCodeEmail(p: { brand: LayoutBrand; name: string; code: string; minutes: number }): ComposedMail {
  const body = [
    heading("Reset your password"),
    paragraph(`Hi ${esc(p.name)}, use this code to set a new password. It expires in ${p.minutes} minutes.`),
    otpBox(p.code),
    footnote("If you didn't ask to reset your password, ignore this email — your password stays the same."),
  ].join("");
  return {
    subject: `Reset your password — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Your Kiros password reset code is ${p.code}. It expires in ${p.minutes} minutes. If you didn't ask for this, ignore this email.`,
  };
}

export function passwordChangedEmail(p: { brand: LayoutBrand; name: string; when: string }): ComposedMail {
  const body = [
    heading("Your password was changed"),
    paragraph(`Hi ${esc(p.name)}, the password for your Kiros account at ${esc(p.brand.businessName)} was changed on ${esc(p.when)}. You've been signed out of other devices.`),
    warningBox("If this wasn't you, contact the restaurant owner straight away so they can secure your account."),
  ].join("");
  return {
    subject: `Your password was changed — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `The password for your Kiros account was changed on ${p.when}. If this wasn't you, contact the restaurant owner straight away.`,
  };
}

export function accountDeactivatedEmail(p: { brand: LayoutBrand; name: string }): ComposedMail {
  const body = [
    heading("Your access was turned off"),
    paragraph(`Hi ${esc(p.name)}, your staff account at ${esc(p.brand.businessName)} has been deactivated and your sessions were ended.`),
    footnote("If you think this is a mistake, speak to the restaurant owner."),
  ].join("");
  return {
    subject: `Your access was turned off — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Your staff account at ${p.brand.businessName} has been deactivated.`,
  };
}
