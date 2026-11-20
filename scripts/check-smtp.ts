import nodemailer from "nodemailer";

/** Opt-in deployment diagnostic; never prints credentials or sends messages. */
async function main() {
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transport.verify();
    console.log("SMTP diagnostic: TLS connection and mailbox authentication successful");
  } catch (error) {
    const e = error as { code?: string; command?: string; responseCode?: number };
    console.log(`SMTP diagnostic failed: code=${e.code || "unknown"} command=${e.command || "unknown"} responseCode=${e.responseCode || "none"}`);
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}
void main();
