let liveProducts = [];
let selectedMainCategory = "all";
let selectedSubCategory = "all";
let categoryMap = {}; // Main Category -> Set of Subcategories

async function fetchLiveProducts() {
    const container = document.getElementById('product-list'); 
    if (!container) return;
    
    container.innerHTML = "<p style='text-align:center; width:100%; color:#7f8c8d; grid-column: 1/-1;'><i class='fas fa-spinner fa-spin'></i> Loading awesome products...</p>";
    
    try {
        const snapshot = await db.collection("products").where("isActive", "==", true).get();
        liveProducts = [];
        categoryMap = {
            "Handmade": new Set(),
            "Customized": new Set()
        };
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>No products available right now.</p>";
            return;
        }

        snapshot.forEach(doc => {
            let prod = doc.data();
            prod.id = doc.id;
            
            if (!prod.mainCategory) {
                prod.mainCategory = prod.customType === "none" ? "Handmade" : "Customized";
            }
            
            // Format Main Category
            let mainCatFormatted = prod.mainCategory.trim();
            mainCatFormatted = mainCatFormatted.charAt(0).toUpperCase() + mainCatFormatted.slice(1);

            if (!categoryMap[mainCatFormatted]) {
                categoryMap[mainCatFormatted] = new Set();
            }

            if (prod.subCategory && prod.subCategory.trim() !== "") {
                categoryMap[mainCatFormatted].add(prod.subCategory.trim());
            }

            liveProducts.push(prod);
        });

        renderCategorySubnav();
        renderHomeProducts(liveProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        container.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Failed to load products.</p>";
    }
}

// ন্যাভবারে ড্রপডাউন সহ মেইন ও সাব-ক্যাটাগরি সাজানো
function renderCategorySubnav() {
    const nav = document.getElementById('dynamic-cat-nav');
    if (!nav) return;

    let html = `<button class="cat-dropdown-btn ${selectedMainCategory === 'all' ? 'active' : ''}" onclick="setMainCategoryFilter('all', this)">All</button>`;

    for (let mainCat in categoryMap) {
        let subCats = Array.from(categoryMap[mainCat]);
        let isActive = selectedMainCategory.toLowerCase() === mainCat.toLowerCase();

        if (subCats.length > 0) {
            html += `
                <div class="cat-dropdown">
                    <button class="cat-dropdown-btn ${isActive ? 'active' : ''}" onclick="setMainCategoryFilter('${mainCat}', this)">
                        ${mainCat} <i class="fas fa-chevron-down" style="font-size:10px;"></i>
                    </button>
                    <div class="cat-dropdown-content">
                        <a href="javascript:void(0)" onclick="setSubCategoryFilter('${mainCat}', 'all')">All ${mainCat}</a>
                        ${subCats.map(sub => `<a href="javascript:void(0)" onclick="setSubCategoryFilter('${mainCat}', '${sub}')">${sub}</a>`).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `<button class="cat-dropdown-btn ${isActive ? 'active' : ''}" onclick="setMainCategoryFilter('${mainCat}', this)">${mainCat}</button>`;
        }
    }

    nav.innerHTML = html;
}

function setMainCategoryFilter(cat, btn) {
    selectedMainCategory = cat;
    selectedSubCategory = "all";
    renderCategorySubnav();
    filterHomeProducts();
}

function setSubCategoryFilter(mainCat, subCat) {
    selectedMainCategory = mainCat;
    selectedSubCategory = subCat;
    renderCategorySubnav();
    filterHomeProducts();
}

function renderHomeProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1; color:#7f8c8d; padding:25px;'>No products found matching your search or price criteria.</p>";
        return;
    }

    const fallbackImg = "assets/images/logo.png";

    products.forEach(prod => {
        let images = prod.images && prod.images.length > 0 ? prod.images : [fallbackImg];
        let mainImg = images[0];

        let catTag = prod.mainCategory.charAt(0).toUpperCase() + prod.mainCategory.slice(1);
        let subTag = prod.subCategory ? ` • ${prod.subCategory}` : "";
        
        container.innerHTML += `
            <div class="product-card" onclick="openProductDetailsModal('${prod.id}')" style="cursor:pointer;">
                <div style="position:relative;">
                    <img id="main-img-${prod.id}" src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                    <span style="position:absolute; top:8px; left:8px; background:rgba(44,62,80,0.88); color:#fff; font-size:10px; padding:3px 7px; border-radius:12px; font-weight:600;">${catTag}${subTag}</span>
                </div>
                <h3>${prod.name}</h3>
                <p>₹${prod.price}</p>
                <button onclick="event.stopPropagation(); addToCart('${prod.id}')">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
        `;
    });
}

function filterHomeProducts() {
    const searchInput = document.getElementById('home-search-input');
    const budgetSelect = document.getElementById('budget-filter');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const budgetVal = budgetSelect ? budgetSelect.value : "all";

    let filtered = liveProducts.filter(prod => {
        let matchName = prod.name.toLowerCase().includes(searchVal);
        
        // Category Matching
        let matchMainCat = (selectedMainCategory === "all") || (prod.mainCategory.toLowerCase() === selectedMainCategory.toLowerCase());
        let matchSubCat = (selectedSubCategory === "all") || (prod.subCategory === selectedSubCategory);

        // Price Filter Matching
        let matchBudget = true;
        let price = parseInt(prod.price) || 0;
        if (budgetVal === "199") matchBudget = price <= 199;
        else if (budgetVal === "299") matchBudget = price <= 299;
        else if (budgetVal === "499") matchBudget = price <= 499;
        else if (budgetVal === "500plus") matchBudget = price >= 500;

        return matchName && matchMainCat && matchSubCat && matchBudget;
    });

    renderHomeProducts(filtered);
}

// Flipkart/Amazon স্টাইল প্রোডাক্ট ডিটেইলস পপআপ ভিউ
function openProductDetailsModal(productId) {
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('product-details-modal');
    const fallbackImg = "assets/images/logo.png";
    const images = product.images && product.images.length > 0 ? product.images : [fallbackImg];

    document.getElementById('pdm-main-img').src = images[0];
    document.getElementById('pdm-badge').innerText = `${product.mainCategory} • ${product.subCategory || 'Handmade'}`;
    document.getElementById('pdm-title').innerText = product.name;
    document.getElementById('pdm-price').innerText = product.price;

    // Thumbnails
    const thumbsContainer = document.getElementById('pdm-thumbs');
    thumbsContainer.innerHTML = "";
    if (images.length > 1) {
        images.forEach(img => {
            thumbsContainer.innerHTML += `<img src="${img}" onerror="this.src='${fallbackImg}'" onclick="document.getElementById('pdm-main-img').src='${img}'">`;
        });
    }

    // Customization Input in Details View
    const customContainer = document.getElementById('pdm-custom-field-container');
    customContainer.innerHTML = "";
    if (product.customType === "name") {
        customContainer.innerHTML = `
            <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:5px; color:#2c3e50;">Customize Text / Name to Print:</label>
            <input type="text" id="pdm-custom-input" placeholder="Enter name or date to engrave" style="width:100%; padding:9px; border:1px solid #fab1a0; border-radius:4px; box-sizing:border-box;">
        `;
    } else if (product.customType === "pic") {
        customContainer.innerHTML = `
            <p style="font-size:12px; color:#e74c3c; background:#fff5f5; padding:8px; border-radius:4px; border:1px dashed #e74c3c;">
                📷 Photo Customization: You can share your photos directly on WhatsApp after clicking checkout!
            </p>
        `;
    }

    // Button Handlers
    document.getElementById('pdm-btn-add').onclick = () => {
        let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
        addToCart(product.id, customVal);
        closeProductDetailsModal();
    };

    document.getElementById('pdm-btn-buy').onclick = () => {
        let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
        addToCart(product.id, customVal);
        window.location.href = "cart.html";
    };

    modal.style.display = "flex";
}

function closeProductDetailsModal() {
    document.getElementById('product-details-modal').style.display = "none";
}

function addToCart(productId, customText = "") {
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;
    
    let cart = JSON.parse(localStorage.getItem('cz_cart')) || [];
    cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        customType: product.customType,
        userText: customText 
    });
    
    localStorage.setItem('cz_cart', JSON.stringify(cart));
    updateCartCount();
    alert(`✅ ${product.name} has been added to your cart!`);
}

function updateCartCount() {
    let cart = JSON.parse(localStorage.getItem('cz_cart')) || [];
    let countEls = document.querySelectorAll('.cart-count');
    countEls.forEach(el => el.innerText = cart.length);
}

function displayPopup(data) {
    if (!data || !data.enabled) return;
    const popup = document.getElementById('promo-popup');
    if (!popup) return;

    const titleEl = document.getElementById('promo-title-text');
    const descEl = document.getElementById('promo-desc-text');
    const imgEl = document.getElementById('promo-img-display');

    if (titleEl) titleEl.innerText = data.title || "Special Offer!";
    if (descEl) descEl.innerText = data.description || "";
    
    if (imgEl) {
        if (data.imageUrl && data.imageUrl.trim() !== "") {
            imgEl.src = data.imageUrl;
            imgEl.onerror = function() { this.style.display = 'none'; };
            imgEl.style.display = "block";
        } else {
            imgEl.style.display = "none";
        }
    }

    setTimeout(() => {
        popup.classList.add('show-popup');
    }, 1000);
}

function checkPromoPopup() {
    try {
        if (typeof db !== 'undefined') {
            db.collection("settings").doc("promo").get().then(doc => {
                if (doc.exists) {
                    displayPopup(doc.data());
                } else {
                    const local = JSON.parse(localStorage.getItem('cz_promo_settings'));
                    if (local && local.enabled) displayPopup(local);
                }
            });
        }
    } catch (e) {
        console.log("Promo cloud error", e);
    }
}

function closePopup() {
    const popup = document.getElementById('promo-popup');
    if (popup) {
        popup.classList.remove('show-popup');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    fetchLiveProducts();
    checkPromoPopup();
});