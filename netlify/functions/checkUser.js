import 'dotenv/config';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// ✅ Use Whitelist table ID (set in Netlify env variable)
const WHITELIST_TABLE_ID = process.env.WHITELIST_TABLE_ID;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  try {
    const email = event.queryStringParameters?.id;

    if (!email) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing ?id=email@example.com" }),
      };
    }

    // ✅ Airtable filter by formula
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${WHITELIST_TABLE_ID}?filterByFormula=${encodeURIComponent(
      `LOWER({Email}) = LOWER('${email}')`
    )}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    const exists = data.records && data.records.length > 0;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        email,
        exists: exists ? "yes" : "no",
        matches: data.records.map((r) => ({
          id: r.id,
          email: r.fields.Email,
          dateWhitelisted: r.fields["Date Whitelisted"],
          source: r.fields.Source,
        })),
      }),
    };
  } catch (err) {
    console.error("Airtable Whitelist API error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
