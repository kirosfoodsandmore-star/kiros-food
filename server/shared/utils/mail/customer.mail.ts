// Storefront customer emails: the sign-in code.
import { emailLayout, esc, footnote, heading, otpBox, paragraph, type ComposedMail, type LayoutBrand } from "../mailer";

export function customerSignInCodeEmail(p: { brand: LayoutBrand; code: string; minutes: number }): ComposedMail {
  const body = [
    heading("Your sign-in code"),
    paragraph(`Enter this code to sign in to <strong>${esc(p.brand.businessName)}</strong>. It expires in ${p.minutes} minutes.`),
    otpBox(p.code),
    footnote("If you didn't ask for this, you can ignore this email. Nothing happens until the code is entered."),
  ].join("");
  return {
    subject: `${p.code} is your ${p.brand.businessName} sign-in code`,
    html: emailLayout(body, p.brand),
    text: `Your ${p.brand.businessName} sign-in code is ${p.code}. It expires in ${p.minutes} minutes. If you didn't ask for this, ignore this email.`,
  };
}
