import 'dotenv/config';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const USERS_TABLE_ID = process.env.USERS_TABLE_ID;
const RSVP_TABLE_ID = process.env.RSVP_TABLE_ID;

export async function handler(event) {
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
    const memberId = event.queryStringParameters.memberid;

    if (!memberId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "memberid is required" }),
      };
    }

    // --- 1. Get User Info ---
    const userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USERS_TABLE_ID}?filterByFormula=${encodeURIComponent(
      `{Member ID}="${memberId}"`
    )}`;

    const userRes = await fetch(userUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });
    const userData = await userRes.json();

    if (!userData.records || userData.records.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const user = userData.records[0].fields;

    // --- 2. Get RSVP Records ---
    const rsvpUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${RSVP_TABLE_ID}?filterByFormula=${encodeURIComponent(
      `{Member ID}="${memberId}"`
    )}`;

    const rsvpRes = await fetch(rsvpUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });
    const rsvpData = await rsvpRes.json();

    const rsvps = rsvpData.records.map((r) => r.fields);

    // --- 3. Calculations ---
    let totalPoints = 0;
    let totalPrice = 0;
    let eventSlugs = [];

    rsvps.forEach((row) => {
      totalPoints += parseInt(row["Points Earned"] || 0, 10);
      totalPrice += parseInt(row["Price Paid"] || 0, 10);
      if (row["Event Slug Webflow"]) {
        eventSlugs.push(row["Event Slug Webflow"]);
      }
    });

    // Stripe prices are in cents → convert to real currency
    const totalPriceFormatted = totalPrice / 100;

    // --- 4. Response ---
    const result = {
      memberId,
      email: user.email || null,
      name: `${user["First Name"] || ""} ${user["Last Name"] || ""}`.trim(),
      totalPoints,
      totalPrice: totalPriceFormatted,
      eventSlugs,
    };

    console.log("Member Data:", result);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("findmemberdata error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
