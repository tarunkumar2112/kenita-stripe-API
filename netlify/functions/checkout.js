import 'dotenv/config';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  // ✅ Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  try {
    const params = event.queryStringParameters;
    const productId = params.productId;
    const memberId = params.memberId;

    if (!productId || !memberId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "productId and memberId are required" }),
      };
    }

    // 1. Fetch product details from Stripe
    const product = await stripe.products.retrieve(productId, {
      expand: ["default_price"],
    });

    if (!product) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Product not found" }),
      };
    }

    const priceId =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price.id;

    // 2. Extract points from metadata (fallback to 0)
    const pointsAwarded = product.metadata?.points_awarded || "0";

    // 3. Get event name (fallback to product name)
    const eventName = product.metadata?.event_name || product.name || "";

    // 4. Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        "https://yoursite.netlify.app/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://yoursite.netlify.app/cancel",
      metadata: {
        memberId: memberId,
        productId: productId,
        points_awarded: pointsAwarded,
        event_id: product.metadata?.event_id || "",
        event_name: eventName,
      },
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
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
