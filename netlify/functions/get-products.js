// ============================================
// Netlify Function: get-products
// Fetches all products from Netlify DB (Neon PostgreSQL)
// Sorted by number (ascending)
// ============================================

const { createClient } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const sql = createClient(process.env.DATABASE_URL);

    const result = await sql`
      SELECT id, number, title, image_url, shopee_link, created_at
      FROM products
      ORDER BY number::int ASC
    `;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'public, max-age=30, s-maxage=60',
      },
      body: JSON.stringify({
        products: result.rows || result,
        count: (result.rows || result).length,
      }),
    };

  } catch (error) {
    console.error('Error fetching products:', error);

    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: 'Failed to fetch products',
        message: error.message,
      }),
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
