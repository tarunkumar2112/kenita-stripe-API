import 'dotenv/config';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Hardcoded Stripe product+price whitelist
const MEMBERSHIP_PRODUCTS = [
  { productId: "prod_ABC123", priceId: "price_123ABC" },
  { productId: "prod_DEF456", priceId: "price_456DEF" },
  { productId: "prod_GHI789", priceId: "price_789GHI" },
];

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");

    if (!email) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    // ✅ 1. Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ result: "no" }),
      };
    }

    const customerId = customers.data[0].id;

    // ✅ 2. Get invoices (includes line items + products)
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 20,
      expand: ["data.lines.data.price.product"],
    });

    let isWhitelisted = false;

    // ✅ 3. Check purchased productId + priceId against whitelist
    for (const invoice of invoices.data) {
      if (invoice.status === "paid") {
        for (const line of invoice.lines.data) {
          const productId =
            typeof line.price.product === "string"
              ? line.price.product
              : line.price.product.id;
          const priceId = line.price.id;

          if (
            MEMBERSHIP_PRODUCTS.some(
              (p) => p.productId === productId && p.priceId === priceId
            )
          ) {
            isWhitelisted = true;
            break;
          }
        }
      }
      if (isWhitelisted) break;
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ result: isWhitelisted ? "yes" : "no" }),
    };
  } catch (err) {
    console.error("verifyMembership error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
