// ============================================
// Netlify Function: search-products
// Search products by number or title
// Returns matching suggestions for typeahead
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
    const params = event.queryStringParameters || {};
    const query = (params.q || '').trim();
    const limit = Math.min(parseInt(params.limit) || 10, 20);

    if (!query) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Query parameter "q" is required' }),
      };
    }

    const sql = createClient(process.env.DATABASE_URL);

    // Clean query - remove # prefix for number search
    const cleanQuery = query.replace('#', '');

    // Search by number or title (case-insensitive)
    const result = await sql`
      SELECT id, number, title, image_url, shopee_link, created_at
      FROM products
      WHERE 
        number ILIKE ${'%' + cleanQuery + '%'}
        OR title ILIKE ${'%' + cleanQuery + '%'}
      ORDER BY 
        CASE 
          WHEN number = ${cleanQuery} THEN 0
          WHEN number LIKE ${cleanQuery + '%'} THEN 1
          WHEN title ILIKE ${cleanQuery + '%'} THEN 2
          ELSE 3
        END,
        number::int ASC
      LIMIT ${limit}
    `;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'public, max-age=10',
      },
      body: JSON.stringify({
        products: result.rows || result,
        count: (result.rows || result).length,
        query: query,
      }),
    };

  } catch (error) {
    console.error('Error searching products:', error);

    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: 'Failed to search products',
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
