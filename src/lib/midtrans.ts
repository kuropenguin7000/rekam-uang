import "server-only";

/**
 * Midtrans payment gateway — MOCKED for now.
 *
 * In mock mode (MIDTRANS_MOCK=true or no server key) we skip the real Snap API
 * and return a redirect to our own simulated payment page. To go live, set
 * MIDTRANS_MOCK=false + MIDTRANS_SERVER_KEY and replace the body of
 * {@link createTransaction} with a call to Midtrans Snap
 * (`https://app.sandbox.midtrans.com/snap/v1/transactions`). The return shape
 * and the webhook contract already match Midtrans, so the rest of the app is
 * unchanged.
 */

export interface CreateTxInput {
  orderId: string;
  grossAmount: number;
  customerEmail: string;
  itemName: string;
  /** optional billing cycle, surfaced on the mock pay page */
  cycle?: string;
}

export interface CreateTxResult {
  token: string;
  redirectUrl: string;
}

export function isMock(): boolean {
  return (
    (process.env.MIDTRANS_MOCK ?? "true") === "true" ||
    !process.env.MIDTRANS_SERVER_KEY
  );
}

export async function createTransaction(
  input: CreateTxInput
): Promise<CreateTxResult> {
  if (isMock()) {
    const params = new URLSearchParams({
      order_id: input.orderId,
      amount: String(input.grossAmount),
      cycle: input.cycle ?? "monthly",
    });
    return {
      token: `mock-${input.orderId}`,
      redirectUrl: `/billing/pay?${params.toString()}`,
    };
  }

  // --- Real Midtrans Snap integration (left here as the swap point) ---
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(
    "https://app.sandbox.midtrans.com/snap/v1/transactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: input.orderId,
          gross_amount: input.grossAmount,
        },
        customer_details: { email: input.customerEmail },
        item_details: [
          {
            id: input.itemName,
            price: input.grossAmount,
            quantity: 1,
            name: input.itemName,
          },
        ],
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Midtrans error ${res.status}`);
  }
  const data = (await res.json()) as { token: string; redirect_url: string };
  return { token: data.token, redirectUrl: data.redirect_url };
}

/**
 * Verify a webhook notification. Real Midtrans sends a SHA-512 `signature_key`
 * of `order_id + status_code + gross_amount + server_key`. In mock mode we
 * accept the payload as-is.
 */
export function verifyNotification(payload: {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
}): boolean {
  if (isMock()) return !!payload.order_id;
  // Real verification would hash and compare signature_key here.
  return !!payload.order_id && !!payload.signature_key;
}
