import type { Env, WhatsAppQueueMessage } from "./types/env";

export async function handleWhatsAppQueue(
  batch: MessageBatch<WhatsAppQueueMessage>,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const data = msg.body;
      if (env.WHATSAPP_GATEWAY_URL) {
        const res = await fetch(`${env.WHATSAPP_GATEWAY_URL}/api/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: data.recipient,
            message: data.message
          })
        });

        if (!res.ok) {
          msg.retry();
          continue;
        }
      }
      msg.ack();
    } catch {
      msg.retry();
    }
  }
}
