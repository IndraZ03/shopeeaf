/* ============================================
   Spill by Lily - Main App JavaScript
   Handles: Product loading, search, UI interactions
   ============================================ */

// ---- Configuration ----
const API_BASE = '/api'; // Netlify Functions via redirect
const PRODUCTS_PER_PAGE = 20;

// ---- State ----
let allProducts = [];
let filteredProducts = [];
let isLoading = true;
let searchTimeout = null;

// ---- DOM Elements ----
const productGrid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-dropdown');
const loadingContainer = document.getElementById('loading-container');
const emptyState = document.getElementById('empty-state');
const productCount = document.getElementById('product-count');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  setupSearch();
  setupNavbar();
  setupScrollAnimations();
});

// ---- Load Products from API ----
async function loadProducts() {
  showLoading(true);
  
  try {
    const response = await fetch(`${API_BASE}/get-products`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    allProducts = data.products || [];
    filteredProducts = [...allProducts];
    
    renderProducts(filteredProducts);
    updateProductCount(filteredProducts.length);
    
  } catch (error) {
    console.error('Failed to load products:', error);
    
    // Fallback: try loading from localStorage (offline mode)
    const cached = localStorage.getItem('spill_products');
    if (cached) {
      allProducts = JSON.parse(cached);
      filteredProducts = [...allProducts];
      renderProducts(filteredProducts);
      updateProductCount(filteredProducts.length);
      showToast('📡 Tampil dari cache lokal', 'info');
    } else {
      showEmpty(true);
    }
  } finally {
    showLoading(false);
  }
}

// ---- Render Products ----
function renderProducts(products) {
  if (!productGrid) return;
  
  if (products.length === 0) {
    productGrid.innerHTML = '';
    showEmpty(true);
    return;
  }
  
  showEmpty(false);
  
  productGrid.innerHTML = products.map((product, index) => `
    <div class="product-card fade-in" style="animation-delay: ${index * 0.05}s; opacity: 0;">
      <div class="product-image-wrapper">
        <img 
          class="product-image" 
          src="${product.image_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 500%22%3E%3Crect fill=%22%23FFE4E1%22 width=%22400%22 height=%22500%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23FFB6C1%22 font-size=%2248%22 font-family=%22sans-serif%22%3E🌸%3C/text%3E%3C/svg%3E'}"
          alt="${product.title}"
          loading="lazy"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 500%22%3E%3Crect fill=%22%23FFE4E1%22 width=%22400%22 height=%22500%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23FFB6C1%22 font-size=%2248%22 font-family=%22sans-serif%22%3E🌸%3C/text%3E%3C/svg%3E'"
        />
        <div class="product-number-badge">
          #${product.number} <span class="badge-heart">♥</span>
        </div>
      </div>
      <div class="product-info">
        <h3 class="product-title">#${product.number} - ${escapeHTML(product.title)}</h3>
        <a 
          href="${product.shopee_link}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="btn-shopee"
          id="shopee-btn-${product.number}"
        >
          🛒 Shop on Shopee
        </a>
      </div>
    </div>
  `).join('');
  
  // Cache for offline use
  try {
    localStorage.setItem('spill_products', JSON.stringify(allProducts));
  } catch (e) {
    // localStorage full, ignore
  }
}

// ---- Search Functionality ----
function setupSearch() {
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    // Debounce search
    searchTimeout = setTimeout(() => {
      if (query.length === 0) {
        filteredProducts = [...allProducts];
        renderProducts(filteredProducts);
        updateProductCount(filteredProducts.length);
        hideSearchDropdown();
        return;
      }
      
      // Search logic
      const results = searchProducts(query);
      filteredProducts = results;
      renderProducts(filteredProducts);
      updateProductCount(filteredProducts.length);
      showSearchSuggestions(results, query);
      
    }, 200);
  });
  
  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSearchDropdown();
    }
  });
  
  // Handle Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      hideSearchDropdown();
    }
  });
}

function searchProducts(query) {
  const q = query.toLowerCase().replace('#', '');
  
  return allProducts.filter(product => {
    const matchNumber = product.number.toLowerCase().includes(q);
    const matchTitle = product.title.toLowerCase().includes(q);
    const matchHash = query.startsWith('#') && product.number.toLowerCase() === q;
    
    return matchNumber || matchTitle || matchHash;
  });
}

function showSearchSuggestions(results, query) {
  if (!searchDropdown || results.length === 0) {
    hideSearchDropdown();
    return;
  }
  
  const suggestions = results.slice(0, 6);
  
  searchDropdown.innerHTML = suggestions.map(product => `
    <div class="search-item" onclick="selectSearchItem('${product.number}')">
      <span class="search-item-number">#${product.number}</span>
      <span class="search-item-title">${escapeHTML(product.title)}</span>
    </div>
  `).join('');
  
  searchDropdown.classList.add('active');
}

function hideSearchDropdown() {
  if (searchDropdown) {
    searchDropdown.classList.remove('active');
  }
}

function selectSearchItem(number) {
  if (searchInput) {
    searchInput.value = `#${number}`;
  }
  
  const results = allProducts.filter(p => p.number === number);
  filteredProducts = results;
  renderProducts(filteredProducts);
  updateProductCount(filteredProducts.length);
  hideSearchDropdown();
  
  // Scroll to product grid
  const gridSection = document.getElementById('products-section');
  if (gridSection) {
    gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---- UI Helpers ----
function showLoading(show) {
  if (loadingContainer) {
    loadingContainer.style.display = show ? 'grid' : 'none';
  }
  if (productGrid) {
    productGrid.style.display = show ? 'none' : 'grid';
  }
}

function showEmpty(show) {
  if (emptyState) {
    emptyState.style.display = show ? 'block' : 'none';
  }
}

function updateProductCount(count) {
  if (productCount) {
    productCount.textContent = `${count} produk ditemukan`;
  }
}

// ---- Navbar Scroll Effect ----
function setupNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// ---- Scroll Animations (Intersection Observer) ----
function setupScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );
  
  // Observe elements that should animate on scroll
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
  });
}

// ---- Toast Notification ----
function showToast(message, type = 'info') {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- Utility Functions ----
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Make functions globally available ----
window.selectSearchItem = selectSearchItem;
window.showToast = showToast;
