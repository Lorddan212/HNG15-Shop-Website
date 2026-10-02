import type { Order } from "./types";
import { formatMoney } from "./commerce";

export function emailConfigured() {
  return Boolean(
    process.env.MAILGUN_API_KEY &&
    process.env.MAILGUN_DOMAIN &&
    process.env.MAILGUN_FROM,
  );
}

export function confirmationText(order: Order) {
  return [
    "FolioVale — order confirmation",
    "",
    "Thank you, " + order.full_name + ".",
    "Your order " + order.reference + " has been recorded.",
    "",
    ...order.items.map(
      (item: Order["items"][number]) =>
        item.quantity +
        " × " +
        item.product_name +
        " — " +
        formatMoney(item.quantity * item.unit_price_kobo),
    ),
    "",
    "Delivery: " + formatMoney(order.shipping_kobo),
    "Total: " + formatMoney(order.total_kobo),
    "Payment method: Pay on delivery. No online payment was taken.",
    "",
    "Delivery address:",
    order.address,
    order.city + ", " + order.state,
    "",
    "This order was placed during checkout testing. No payment will be collected and no shipment is arranged.",
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function confirmationHtml(order: Order) {
  const items = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e7e1d8;">
            <div style="font-weight:600;color:#0b2b4c;">
              ${escapeHtml(item.product_name)}
            </div>
            <div style="font-size:13px;color:#667085;margin-top:4px;">
              Qty ${item.quantity} · ${formatMoney(item.unit_price_kobo)} each
            </div>
          </td>
          <td
            align="right"
            style="padding:14px 0;border-bottom:1px solid #e7e1d8;font-weight:600;color:#0b2b4c;"
          >
            ${formatMoney(item.quantity * item.unit_price_kobo)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>FolioVale Order Confirmation</title>
  </head>

  <body style="margin:0;padding:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#24364b;">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#f7f5f0;padding:32px 12px;"
    >
      <tr>
        <td align="center">

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="max-width:640px;background:#ffffff;border:1px solid #e8e3da;border-radius:14px;overflow:hidden;"
          >

            <tr>
              <td style="padding:30px 34px 18px;text-align:center;">
                <div
                  style="font-family:Georgia,'Times New Roman',serif;font-size:32px;color:#0b2b4c;font-weight:700;"
                >
                  FolioVale
                </div>

                <div
                  style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a37b45;margin-top:8px;"
                >
                  Order confirmation
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 34px 26px;">
                <div
                  style="font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.25;color:#0b2b4c;margin-bottom:14px;"
                >
                  Good things are on the page.
                </div>

                <p style="margin:0 0 8px;font-size:15px;line-height:1.7;">
                  Thank you, <strong>${escapeHtml(order.full_name)}</strong>.
                </p>

                <p style="margin:0;font-size:15px;line-height:1.7;">
                  Your order has been recorded successfully.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 34px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="background:#eef4f6;border-radius:10px;"
                >
                  <tr>
                    <td style="padding:20px;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#667085;">
                        Order reference
                      </div>

                      <div style="margin-top:6px;font-size:20px;font-weight:700;color:#0b2b4c;">
                        ${escapeHtml(order.reference)}
                      </div>

                      <div style="margin-top:8px;font-size:13px;color:#52746a;">
                        Order placed · Pay on delivery
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 34px;">
                <div
                  style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0b2b4c;margin-bottom:8px;"
                >
                  Your order
                </div>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  ${items}

                  <tr>
                    <td style="padding:18px 0 8px;color:#667085;">
                      Delivery
                    </td>

                    <td align="right" style="padding:18px 0 8px;color:#0b2b4c;">
                      ${formatMoney(order.shipping_kobo)}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="padding:12px 0 20px;font-size:18px;font-weight:700;color:#0b2b4c;border-top:1px solid #e7e1d8;"
                    >
                      Total
                    </td>

                    <td
                      align="right"
                      style="padding:12px 0 20px;font-size:18px;font-weight:700;color:#0b2b4c;border-top:1px solid #e7e1d8;"
                    >
                      ${formatMoney(order.total_kobo)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 34px 26px;">
                <div
                  style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0b2b4c;margin-bottom:10px;"
                >
                  Delivery details
                </div>

                <div style="font-size:14px;line-height:1.75;color:#4c5b6a;">
                  ${escapeHtml(order.full_name)}<br />
                  ${escapeHtml(order.address)}<br />
                  ${escapeHtml(order.city)}, ${escapeHtml(order.state)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 34px 26px;">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="background:#faf8f4;border-radius:10px;"
                >
                  <tr>
                    <td style="padding:18px 20px;font-size:13px;line-height:1.7;color:#667085;">
                      <strong style="color:#0b2b4c;">Payment method:</strong>
                      Pay on delivery. No online payment was taken.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 34px 30px;border-top:1px solid #eee8df;">
                <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#8a8175;">
                  This order was placed during checkout testing. No payment will be collected and no shipment is arranged.
                </p>

                <p style="margin:0;font-size:12px;color:#8a8175;">
                  FolioVale · Thoughtful pages for everyday life.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export async function sendOrderEmail(
  order: Order,
  fetcher: typeof fetch = fetch,
) {
  if (!emailConfigured()) {
    throw new Error("Email is not configured");
  }

  const base = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

  if (
    !["https://api.mailgun.net", "https://api.eu.mailgun.net"].includes(base)
  ) {
    throw new Error("Invalid Mailgun region");
  }

  const form = new FormData();

  form.set("from", process.env.MAILGUN_FROM!);
  form.set("to", order.email);
  form.set("subject", `FolioVale order ${order.reference}`);
  form.set("text", confirmationText(order));
  form.set("html", confirmationHtml(order));

  const response = await fetcher(
    base +
      "/v3/" +
      encodeURIComponent(process.env.MAILGUN_DOMAIN!) +
      "/messages",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from("api:" + process.env.MAILGUN_API_KEY).toString("base64"),
      },
      body: form,
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error("Mailgun did not accept the message");
  }

  const result: unknown = await response.json();

  if (
    typeof result !== "object" ||
    result === null ||
    !("id" in result) ||
    typeof result.id !== "string"
  ) {
    throw new Error("Invalid Mailgun response");
  }

  return result.id;
}
