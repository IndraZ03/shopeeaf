// ============================================
// Database Setup Script
// Run: node scripts/setup-db.js
// Creates the 'products' table in Netlify DB (Neon)
// ============================================

const { neon } = require('@neondatabase/serverless');

async function setupDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('');
    console.log('Set it with:');
    console.log('  export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"');
    console.log('');
    console.log('Or get it from Netlify Dashboard → Site → Netlify DB');
    process.exit(1);
  }

  console.log('🌸 Spill by Lily - Database Setup');
  console.log('================================');
  console.log('');

  try {
    const sql = neon(DATABASE_URL);

    // Create products table
    console.log('📦 Creating products table...');
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        number VARCHAR(10) NOT NULL UNIQUE,
        title TEXT NOT NULL,
        image_url TEXT DEFAULT '',
        shopee_link TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ Products table created successfully!');

    // Create index on number for fast lookups
    console.log('🔍 Creating indexes...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_products_number ON products (number)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_products_title ON products USING gin (to_tsvector('simple', title))
    `;
    console.log('✅ Indexes created successfully!');

    // Verify table
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `;
    
    console.log('');
    console.log('📋 Table structure:');
    (result.rows || result).forEach(col => {
      console.log(`   ${col.column_name} → ${col.data_type}`);
    });

    console.log('');
    console.log('🎉 Database setup complete! 💕');
    console.log('');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
