import 'dotenv/config';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const USERS_TABLE_ID = process.env.USERS_TABLE_ID;

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
    const params = event.queryStringParameters || {};
    const memberId = params.memberid;

    if (!memberId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "memberid is required" }),
      };
    }

    // ✅ Use Airtable filterByFormula to fetch directly
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USERS_TABLE_ID}?filterByFormula={Member ID}="${memberId}"`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Member not found" }),
      };
    }

    const record = data.records[0].fields;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        memberId: record["Member ID"] || null,
        email: record.email || null,
        firstName: record["First Name"] || null,
        lastName: record["Last Name"] || null,
        interests: record["Curiosities/interests"]
          ? JSON.parse(record["Curiosities/interests"])
          : [],
      }),
    };
  } catch (err) {
    console.error("Airtable Users API error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
