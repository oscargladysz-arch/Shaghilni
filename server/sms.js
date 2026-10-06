/* SMS providers. "console" logs messages (development); "textbee" sends from an Android phone with a local SIM;
   "twilio" uses Twilio's API. All take E.164 numbers such as +963944123456. */
import { mask } from "./guard.js";
const said = async r => (await r.text()).slice(0, 200).replace(/\+?\(?\d(?:[\s().-]{0,2}\d){6,}/g, m => { const d = m.replace(/[^\d+]/g, ""); return d.startsWith("+") ? mask(d) : "•••" + d.slice(-3); });   // the provider's answer can quote the number: it reaches the log and the texts table masked (a number without its country code keeps only its last three digits)
export function makeSms(cfg, log = console.log) {
  const s = cfg.sms;
  if (s.provider === "textbee") {
    if (!s.textbeeKey) throw new Error("TEXTBEE_API_KEY is required when SMS_PROVIDER=textbee");
    return async (to, body) => {
      const r = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
        method: "POST", headers: { "x-api-key": s.textbeeKey, "content-type": "application/json" },
        body: JSON.stringify({ recipients: [to], message: body }), signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) throw new Error(`textbee ${r.status}: ${await said(r)}`);
    };
  }
  if (s.provider === "twilio") {
    if (!s.twilioSid || !s.twilioToken || !s.twilioFrom) throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are required when SMS_PROVIDER=twilio");
    return async (to, body) => {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.twilioSid}/Messages.json`, {
        method: "POST",
        headers: { authorization: "Basic " + Buffer.from(`${s.twilioSid}:${s.twilioToken}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: s.twilioFrom, Body: body }), signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) throw new Error(`twilio ${r.status}: ${await said(r)}`);
    };
  }
  return async (to, body) => { log(`[sms] to ${to}: ${body}`); };
}
