/* SMS providers. "console" logs messages (development); "textbee" sends from an Android phone with a local SIM;
   "twilio" uses Twilio's API. All take E.164 numbers such as +963944123456. */
export function makeSms(cfg, log = console.log) {
  const s = cfg.sms;
  if (s.provider === "textbee") {
    if (!s.textbeeKey) throw new Error("TEXTBEE_API_KEY is required when SMS_PROVIDER=textbee");
    return async (to, body) => {
      const r = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
        method: "POST", headers: { "x-api-key": s.textbeeKey, "content-type": "application/json" },
        body: JSON.stringify({ recipients: [to], message: body }), signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) throw new Error(`textbee ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
      if (!r.ok) throw new Error(`twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
    };
  }
  return async (to, body) => { log(`[sms] to ${to}: ${body}`); };
}
