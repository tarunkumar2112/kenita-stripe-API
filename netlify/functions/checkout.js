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
    const slug = params.slug || "";

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

    const price =
      typeof product.default_price === "string"
        ? await stripe.prices.retrieve(product.default_price)
        : product.default_price;

    const priceId = price.id;

    // 2. Extract points + event data
    const pointsAwarded = product.metadata?.points_awarded || "0";
    const eventName = product.metadata?.event_name || product.name || "";
    const productImage = product.images?.length ? product.images[0] : "";

    // 3. Decide checkout mode based on price type
    const isRecurring = price.recurring !== null;

    // ✅ Base config
    let sessionConfig = {
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        "https://members.minervaartsclub.com/the-ledger?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://members.minervaartsclub.com/",
    };

    if (isRecurring) {
      // ✅ Subscription mode
      sessionConfig.mode = "subscription";
      sessionConfig.subscription_data = {
        metadata: {
          memberId,
          productId,
          slug,
          points_awarded: pointsAwarded,
          event_id: product.metadata?.event_id || "",
          event_name: eventName,
          product_image: productImage,
        },
      };
    } else {
      // ✅ One-time payment mode
      sessionConfig.mode = "payment";
      sessionConfig.payment_intent_data = {
        metadata: {
          memberId,
          productId,
          slug,
          points_awarded: pointsAwarded,
          event_id: product.metadata?.event_id || "",
          event_name: eventName,
          product_image: productImage,
        },
      };
    }

    // 4. Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        url: session.url,
        isRecurring,
        sessionId: session.id,
        message: isRecurring
          ? "Subscription checkout session created."
          : "One-time payment checkout session created.",
      }),
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
