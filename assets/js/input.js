/* ============================================
   Spill by Lily - Input Page JavaScript
   Handles: Dynamic form, image upload, batch submit
   ============================================ */

// ---- Configuration ----
const API_BASE = '/api';
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_WIDTH = 1200;

// ---- State ----
let productBlocks = [];
let nextLocalId = 1;
let isSubmitting = false;

// ---- DOM Elements ----
const productsContainer = document.getElementById('products-container');
const addProductBtn = document.getElementById('add-product-btn');
const submitAllBtn = document.getElementById('submit-all-btn');
const productCountDisplay = document.getElementById('product-count-display');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  // Add first product block
  addProductBlock();
  
  // Setup event listeners
  addProductBtn.addEventListener('click', addProductBlock);
  submitAllBtn.addEventListener('click', submitAllProducts);
});

// ---- Add Product Block ----
function addProductBlock() {
  const id = nextLocalId++;
  
  const block = {
    id: id,
    title: '',
    shopeeLink: '',
    imageFile: null,
    imagePreview: null,
  };
  
  productBlocks.push(block);
  
  const blockEl = document.createElement('div');
  blockEl.className = 'form-card fade-in';
  blockEl.id = `product-block-${id}`;
  blockEl.style.marginBottom = '24px';
  blockEl.innerHTML = `
    <div class="form-card-number">Product #${id}</div>
    ${productBlocks.length > 1 ? `
      <button class="btn-remove" onclick="removeProductBlock(${id})" title="Hapus product ini">✕</button>
    ` : ''}
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px;">
      <!-- Image Upload -->
      <div>
        <label class="form-label">📸 Gambar Produk</label>
        <div class="image-upload-area" id="upload-area-${id}" onclick="triggerFileInput(${id})">
          <input 
            type="file" 
            id="file-input-${id}" 
            accept="image/*" 
            style="display: none;" 
            onchange="handleImageUpload(${id}, event)"
          />
          <div class="upload-placeholder" id="upload-placeholder-${id}">
            <div class="image-upload-icon">📷</div>
            <div class="image-upload-text">
              Klik untuk upload gambar<br/>
              <small style="color: var(--text-light); font-size: 0.75rem;">Max ${MAX_IMAGE_SIZE_MB}MB • JPG, PNG, WebP</small>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Text Inputs -->
      <div style="display: flex; flex-direction: column; gap: 16px; justify-content: center;">
        <div>
          <label class="form-label" for="title-${id}">✨ Judul Produk</label>
          <input 
            type="text" 
            id="title-${id}" 
            class="form-input" 
            placeholder="Contoh: Lip Tint Dewi Rose Gold"
            oninput="updateBlockData(${id}, 'title', this.value)"
          />
        </div>
        
        <div>
          <label class="form-label" for="link-${id}">🛒 Link Shopee</label>
          <input 
            type="url" 
            id="link-${id}" 
            class="form-input" 
            placeholder="https://shopee.co.id/..."
            oninput="updateBlockData(${id}, 'shopeeLink', this.value)"
          />
        </div>
        
        <div style="padding: 12px; background: var(--cream); border-radius: 12px; font-size: 0.8rem; color: var(--text-light);">
          💡 Nomor produk akan digenerate otomatis secara berurutan setelah submit
        </div>
      </div>
    </div>
  `;
  
  productsContainer.appendChild(blockEl);
  updateProductCountDisplay();
  
  // Smooth scroll to new block
  setTimeout(() => {
    blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ---- Remove Product Block ----
function removeProductBlock(id) {
  const index = productBlocks.findIndex(b => b.id === id);
  if (index !== -1) {
    productBlocks.splice(index, 1);
  }
  
  const blockEl = document.getElementById(`product-block-${id}`);
  if (blockEl) {
    blockEl.style.animation = 'fadeIn 0.3s ease reverse forwards';
    setTimeout(() => {
      blockEl.remove();
      updateProductCountDisplay();
    }, 300);
  }
}

// ---- Trigger File Input ----
function triggerFileInput(id) {
  document.getElementById(`file-input-${id}`).click();
}

// ---- Handle Image Upload ----
async function handleImageUpload(id, event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file size
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    showToast(`❌ Gambar terlalu besar! Max ${MAX_IMAGE_SIZE_MB}MB`, 'error');
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('❌ File harus berupa gambar!', 'error');
    return;
  }
  
  try {
    // Compress image if needed
    const compressedFile = await compressImage(file);
    
    // Update block data
    const block = productBlocks.find(b => b.id === id);
    if (block) {
      block.imageFile = compressedFile;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const uploadArea = document.getElementById(`upload-area-${id}`);
      const placeholder = document.getElementById(`upload-placeholder-${id}`);
      
      // Hide placeholder
      if (placeholder) placeholder.style.display = 'none';
      
      // Remove existing preview
      const existingPreview = uploadArea.querySelector('.preview-img');
      if (existingPreview) existingPreview.remove();
      
      // Add preview image
      const img = document.createElement('img');
      img.className = 'preview-img';
      img.src = e.target.result;
      img.alt = 'Preview';
      uploadArea.appendChild(img);
      uploadArea.classList.add('has-image');
      
      if (block) block.imagePreview = e.target.result;
    };
    reader.readAsDataURL(compressedFile);
    
  } catch (error) {
    console.error('Image upload error:', error);
    showToast('❌ Gagal memproses gambar', 'error');
  }
}

// ---- Compress Image ----
function compressImage(file) {
  return new Promise((resolve, reject) => {
    // If small enough, return as-is
    if (file.size <= 500 * 1024) {
      resolve(file);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize if too large
        if (width > MAX_IMAGE_WIDTH) {
          height = (height * MAX_IMAGE_WIDTH) / width;
          width = MAX_IMAGE_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ---- Update Block Data ----
function updateBlockData(id, field, value) {
  const block = productBlocks.find(b => b.id === id);
  if (block) {
    block[field] = value;
  }
}

// ---- Submit All Products ----
async function submitAllProducts() {
  if (isSubmitting) return;
  
  // Validate all blocks
  const errors = [];
  productBlocks.forEach((block, index) => {
    if (!block.imageFile) {
      errors.push(`Product #${block.id}: Gambar belum diupload`);
    }
    if (!block.title.trim()) {
      errors.push(`Product #${block.id}: Judul belum diisi`);
    }
    if (!block.shopeeLink.trim()) {
      errors.push(`Product #${block.id}: Link Shopee belum diisi`);
    }
    // Basic URL validation
    if (block.shopeeLink.trim() && !isValidURL(block.shopeeLink.trim())) {
      errors.push(`Product #${block.id}: Link Shopee tidak valid`);
    }
  });
  
  if (errors.length > 0) {
    showToast(`⚠️ ${errors[0]}`, 'error');
    return;
  }
  
  // Confirm
  if (!confirm(`Kirim ${productBlocks.length} produk? Nomor akan digenerate otomatis.`)) {
    return;
  }
  
  isSubmitting = true;
  submitAllBtn.disabled = true;
  submitAllBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Mengirim...';
  
  try {
    // Build FormData
    const formData = new FormData();
    
    productBlocks.forEach((block, index) => {
      formData.append(`images`, block.imageFile);
      formData.append(`titles`, block.title.trim());
      formData.append(`shopee_links`, block.shopeeLink.trim());
    });
    
    const response = await fetch(`${API_BASE}/add-products`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    showToast(`✅ ${result.count || productBlocks.length} produk berhasil ditambahkan! 💕`, 'success');
    
    // Reset form
    resetForm();
    
  } catch (error) {
    console.error('Submit error:', error);
    showToast(`❌ Gagal mengirim: ${error.message}`, 'error');
  } finally {
    isSubmitting = false;
    submitAllBtn.disabled = false;
    submitAllBtn.innerHTML = '💕 Kirim Semua Products';
  }
}

// ---- Reset Form ----
function resetForm() {
  productBlocks = [];
  nextLocalId = 1;
  productsContainer.innerHTML = '';
  addProductBlock();
}

// ---- Update Product Count Display ----
function updateProductCountDisplay() {
  if (productCountDisplay) {
    productCountDisplay.textContent = `${productBlocks.length} produk siap dikirim`;
  }
}

// ---- URL Validation ----
function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// ---- Toast (shared utility) ----
function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- Make functions globally available ----
window.addProductBlock = addProductBlock;
window.removeProductBlock = removeProductBlock;
window.triggerFileInput = triggerFileInput;
window.handleImageUpload = handleImageUpload;
window.updateBlockData = updateBlockData;
window.submitAllProducts = submitAllProducts;
window.showToast = showToast;
