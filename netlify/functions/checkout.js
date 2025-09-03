import 'dotenv/config';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  try {
    const headers = {
      "Access-Control-Allow-Origin": "*", // allow all origins
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers, body: "OK" };
    }

    const params = event.queryStringParameters;
    const { productId, memberId } = params;

    if (!productId || !memberId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing productId or memberId" }),
      };
    }

    // Fetch product from Stripe
    const product = await stripe.products.retrieve(productId, {
      expand: ["default_price"],
    });

    if (!product.default_price) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Product has no default_price" }),
      };
    }

    const priceId =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price.id;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode:
        product.default_price?.type === "recurring"
          ? "subscription"
          : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        "https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://yourdomain.com/cancel",
      metadata: { memberId, productId },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("Checkout error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
