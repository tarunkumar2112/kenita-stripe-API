import 'dotenv/config';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  // ✅ Handle preflight request
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
    const products = await stripe.products.list({
      expand: ["data.default_price"],
      limit: 10,
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // ✅ CORS allow all
      },
      body: JSON.stringify(products, null, 2),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*", // ✅ CORS even on error
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
