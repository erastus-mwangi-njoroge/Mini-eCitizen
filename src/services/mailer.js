/**
 * Outgoing email. Every mailer has the same one method:   async send({ to, subject, html })
 * so the rest of the app never knows which provider is in use.
 */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/** Sends through Brevo's transactional email API (free plan: 300 emails/day). */
class BrevoMailer {
  /**
   * @param {{ apiKey: string, fromEmail: string, fromName: string }} settings
   * @param {typeof fetch} fetchFn  injectable so tests need no network
   */
  constructor({ apiKey, fromEmail, fromName }, fetchFn = fetch) {
    this.apiKey = apiKey;
    this.sender = { email: fromEmail, name: fromName };
    this.fetch = fetchFn;
  }

  async send({ to, subject, html }) {
    const response = await this.fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": this.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: this.sender, to: [{ email: to }], subject, htmlContent: html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Brevo rejected the email (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
}

/** Development: prints the email (including the reset link) to the server console instead of sending it. */
class ConsoleMailer {
  async send({ to, subject, html }) {
    const text = html.replace(/<a [^>]*href="([^"]+)"[^>]*>[^<]*<\/a>/g, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`\n--- EMAIL (not sent: BREVO_API_KEY is not set) ---\nTo: ${to}\nSubject: ${subject}\n${text}\n---\n`);
  }
}

/** Production with no email provider configured: do nothing, and never write reset links to the logs. */
class DisabledMailer {
  async send({ to, subject }) {
    console.warn(`Email "${subject}" to ${to} was NOT sent: set BREVO_API_KEY, MAIL_FROM_EMAIL and PUBLIC_URL to enable email.`);
  }
}

/** Pick the mailer from configuration. */
function createMailer(config) {
  const { brevoApiKey, mailFromEmail, mailFromName, publicUrlConfigured, production } = config;
  if (brevoApiKey && mailFromEmail && publicUrlConfigured) return new BrevoMailer({ apiKey: brevoApiKey, fromEmail: mailFromEmail, fromName: mailFromName });
  if (brevoApiKey && !production) return new ConsoleMailer();
  return production ? new DisabledMailer() : new ConsoleMailer();
}

module.exports = { BrevoMailer, ConsoleMailer, DisabledMailer, createMailer };
