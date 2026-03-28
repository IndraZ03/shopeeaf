// ============================================
// Netlify Function: add-products
// Handles batch product upload:
//   1. Uploads images to Cloudinary
//   2. Auto-generates sequential numbers
//   3. Inserts all products into Netlify DB
// ============================================

const { createClient } = require('@neondatabase/serverless');
const busboy = require('busboy');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse multipart form data
    const { files, fields } = await parseMultipart(event);

    const titles = Array.isArray(fields.titles) ? fields.titles : [fields.titles];
    const shopeeLinks = Array.isArray(fields.shopee_links) ? fields.shopee_links : [fields.shopee_links];
    const images = Array.isArray(files.images) ? files.images : [files.images];

    // Validate data
    if (titles.length === 0 || images.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'At least one product with image and title is required' }),
      };
    }

    if (titles.length !== images.length || titles.length !== shopeeLinks.length) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Mismatch between number of titles, images, and links' }),
      };
    }

    // Connect to database
    const sql = createClient(process.env.DATABASE_URL);

    // Get the current max number
    const maxResult = await sql`
      SELECT COALESCE(MAX(number::int), 0) as max_number FROM products
    `;
    let currentMax = (maxResult.rows || maxResult)[0]?.max_number || 0;

    // Upload images to Cloudinary and insert products
    const insertedProducts = [];

    for (let i = 0; i < titles.length; i++) {
      currentMax++;
      const productNumber = String(currentMax).padStart(3, '0');

      // Upload image to Cloudinary
      let imageUrl = '';
      try {
        const uploadResult = await uploadToCloudinary(images[i].data, {
          folder: 'spill-by-lily',
          public_id: `product-${productNumber}`,
          transformation: [
            { width: 800, height: 1000, crop: 'fill', quality: 'auto:good' },
          ],
        });
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error(`Failed to upload image for product ${productNumber}:`, uploadError);
        // Use a placeholder if upload fails
        imageUrl = '';
      }

      // Insert into database
      await sql`
        INSERT INTO products (id, number, title, image_url, shopee_link, created_at)
        VALUES (
          gen_random_uuid(),
          ${productNumber},
          ${titles[i]},
          ${imageUrl},
          ${shopeeLinks[i]},
          NOW()
        )
      `;

      insertedProducts.push({
        number: productNumber,
        title: titles[i],
        image_url: imageUrl,
        shopee_link: shopeeLinks[i],
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        count: insertedProducts.length,
        products: insertedProducts,
        message: `${insertedProducts.length} produk berhasil ditambahkan! 💕`,
      }),
    };

  } catch (error) {
    console.error('Error adding products:', error);

    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: 'Failed to add products',
        message: error.message,
      }),
    };
  }
};

// ---- Upload to Cloudinary ----
function uploadToCloudinary(bufferData, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'spill-by-lily',
        public_id: options.public_id,
        resource_type: 'image',
        overwrite: true,
        transformation: options.transformation,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    // Write buffer to stream
    const buffer = Buffer.isBuffer(bufferData) ? bufferData : Buffer.from(bufferData);
    uploadStream.end(buffer);
  });
}

// ---- Parse Multipart Form Data ----
function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = {};

    const bb = busboy({
      headers: {
        'content-type': event.headers['content-type'] || event.headers['Content-Type'],
      },
    });

    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        const fileData = {
          filename: info.filename,
          mimeType: info.mimeType,
          data: Buffer.concat(chunks),
        };

        if (files[name]) {
          if (Array.isArray(files[name])) {
            files[name].push(fileData);
          } else {
            files[name] = [files[name], fileData];
          }
        } else {
          files[name] = fileData;
        }
      });
    });

    bb.on('field', (name, value) => {
      if (fields[name]) {
        if (Array.isArray(fields[name])) {
          fields[name].push(value);
        } else {
          fields[name] = [fields[name], value];
        }
      } else {
        fields[name] = value;
      }
    });

    bb.on('finish', () => resolve({ files, fields }));
    bb.on('error', (err) => reject(err));

    // Handle base64 encoded body from API Gateway
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    bb.end(body);
  });
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
