import 'dotenv/config';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler() {
  try {
    const products = await stripe.products.list({
      expand: ["data.default_price"],
      limit: 10,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(products, null, 2), // full raw data
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
