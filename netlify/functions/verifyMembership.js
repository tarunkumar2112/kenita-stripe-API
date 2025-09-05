import 'dotenv/config';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Hardcoded Stripe product+price whitelist
const MEMBERSHIP_PRODUCTS = [
  { productId: "prod_SuRAk7TCPQ8vcL", priceId: "price_1RycHqEDE4JLcHx3GZGWw4cH" },
  { productId: "prod_SuR95V0Lq7jbTs", priceId: "price_1RycHcEDE4JLcHx3knyZx3Mi" },
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
        body: JSON.stringify({ result: "no", purchases: [] }),
      };
    }

    const customerId = customers.data[0].id;

    // ✅ 2. Get invoices (expand only price)
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 20,
      expand: ["data.lines.data.price"],
    });

    let isWhitelisted = false;
    let purchases = [];

    // ✅ 3. Collect all purchased product+price
    for (const invoice of invoices.data) {
      if (invoice.status === "paid") {
        for (const line of invoice.lines.data) {
          if (!line.price) continue;

          const priceId = line.price.id;
          const productId =
            typeof line.price.product === "string"
              ? line.price.product
              : line.price.product?.id;

          if (!productId) continue;

          purchases.push({ productId, priceId });

          if (
            MEMBERSHIP_PRODUCTS.some(
              (p) => p.productId === productId && p.priceId === priceId
            )
          ) {
            isWhitelisted = true;
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        email,
        result: isWhitelisted ? "yes" : "no",
        purchases, // ✅ debug: all product+price found for this email
      }),
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
