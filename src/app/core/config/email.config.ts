/**
 * Real email delivery through EmailJS (https://www.emailjs.com).
 * Every email recorded in the outbox is also delivered to `redirectTo`, whoever it was addressed to.
 * Delivery stays off until serviceId, templateId and publicKey are filled in.
 * The EmailJS template must use {{to_email}} as "To Email" and {{subject}} as subject. Content can use
 * {{body}}, {{original_to}}, {{original_cc}} and {{link}}, or {{message}} for all of them as plain text.
 */
export const EMAIL_DELIVERY = {
  redirectTo: 'dhyeygorasiya@gmail.com',
  serviceId: 'service_ma8h1nl',
  templateId: 'template_9g221jf',
  publicKey: 'pzLyQrGRLccUQK4Ti',
} as const;

export const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';
