let liveProducts = [];
let selectedCategory = "all";
let globalSubcats = new Set();
let globalMainCats = new Set();

async function fetchLiveProducts() {
    const container = document.getElementById('product-list'); 
    if (!container) return;
    
    container.innerHTML = "<p style='text-align:center; width:100%; color:#7f8c8d; grid-column: 1/-1;'><i class='fas fa-spinner fa-spin'></i> Loading awesome products...</p>";
    
    try {
        const snapshot = await db.collection("products").where("isActive", "==", true).get();
        liveProducts = [];
        globalSubcats.clear();
        globalMainCats.clear();
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>No products available right now.</p>";
            document.getElementById('dynamic-cat-container').innerHTML = `<button class="cat-btn active">All</button>`;
            return;
        }

        snapshot.forEach(doc => {
            let prod = doc.data();
            prod.id = doc.id;
            
            if (!prod.mainCategory) {
                prod.mainCategory = prod.customType === "none" ? "handmade" : "customized";
            }
            
            globalMainCats.add(prod.mainCategory.trim());
            if(prod.subCategory && prod.subCategory.trim() !== "") {
                globalSubcats.add(prod.subCategory.trim());
            }

            liveProducts.push(prod);
        });

        renderCategoryTabs();
        renderHomeProducts(liveProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        container.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Failed to load products.</p>";
    }
}

// হোমপেজে ডাইনামিক ক্যাটাগরি ও বাজেট বাটন রেন্ডার
function renderCategoryTabs() {
    const container = document.getElementById('dynamic-cat-container');
    if(!container) return;

    let html = `<button type="button" class="cat-btn ${selectedCategory === 'all' ? 'active' : ''}" onclick="setMainCategory('all', this)">All</button>`;
    
    // Main Fixed Categories
    html += `<button type="button" class="cat-btn ${selectedCategory === 'handmade' ? 'active' : ''}" onclick="setMainCategory('handmade', this)">Handmade</button>`;
    html += `<button type="button" class="cat-btn ${selectedCategory === 'customized' ? 'active' : ''}" onclick="setMainCategory('customized', this)">Customized</button>`;

    // Custom Categories (e.g., Gift Cards)
    globalMainCats.forEach(cat => {
        let lower = cat.toLowerCase();
        if(lower !== 'handmade' && lower !== 'customized') {
            html += `<button type="button" class="cat-btn ${selectedCategory === cat ? 'active' : ''}" onclick="setMainCategory('${cat}', this)">${cat}</button>`;
        }
    });

    // Subcategory Filter Dropdown
    html += `<select id="subcat-filter" class="custom-select-filter" onchange="filterHomeProducts()">
                <option value="all">All Varieties</option>`;
    globalSubcats.forEach(sub => {
        html += `<option value="${sub}">${sub}</option>`;
    });
    html += `</select>`;

    // Budget Price Filter Dropdown (New Feature 🔍)
    html += `<select id="budget-filter" class="custom-select-filter" onchange="filterHomeProducts()" style="border-color:#e67e22; color:#d35400;">
                <option value="all">💰 All Budgets</option>
                <option value="199">Under ₹199</option>
                <option value="299">Under ₹299</option>
                <option value="499">Under ₹499</option>
                <option value="500plus">₹500+ Luxury Gifts</option>
             </select>`;

    container.innerHTML = html;
}

function renderHomeProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1; color:#7f8c8d; padding:20px;'>No matching products found in this budget/category.</p>";
        return;
    }

    const fallbackImg = "assets/images/logo.png";

    products.forEach(prod => {
        let images = prod.images && prod.images.length > 0 ? prod.images : [fallbackImg];
        let mainImg = images[0];

        let thumbnailsHTML = "";
        if (images.length > 1) {
            thumbnailsHTML = `<div class="product-thumb-gallery" style="display:flex; gap:6px; justify-content:center; margin-bottom:10px; overflow-x:auto; padding:2px;">`;
            images.forEach((img) => {
                thumbnailsHTML += `<img src="${img}" onerror="this.src='${fallbackImg}'" onclick="changeCardMainImg('${prod.id}', '${img}')" style="width:38px; height:38px; object-fit:cover; border-radius:4px; border:1px solid #ddd; cursor:pointer;">`;
            });
            thumbnailsHTML += `</div>`;
        }

        let catTag = prod.mainCategory.charAt(0).toUpperCase() + prod.mainCategory.slice(1);
        let subTag = prod.subCategory ? ` • ${prod.subCategory}` : "";
        
        container.innerHTML += `
            <div class="product-card">
                <div style="position:relative; cursor:zoom-in;" onclick="openImageZoom('${mainImg}')">
                    <img id="main-img-${prod.id}" src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                    <span style="position:absolute; top:8px; left:8px; background:rgba(44,62,80,0.85); color:#fff; font-size:10px; padding:3px 7px; border-radius:12px; font-weight:600;">${catTag}${subTag}</span>
                </div>
                ${thumbnailsHTML}
                <h3>${prod.name}</h3>
                <p>₹${prod.price}</p>
                <button onclick="addToCart('${prod.id}')">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
        `;
    });
}

function setMainCategory(cat, btn) {
    selectedCategory = cat;
    renderCategoryTabs();
    filterHomeProducts();
}

function filterHomeProducts() {
    const searchInput = document.getElementById('home-search-input');
    const subcatSelect = document.getElementById('subcat-filter');
    const budgetSelect = document.getElementById('budget-filter');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const subcatVal = subcatSelect ? subcatSelect.value : "all";
    const budgetVal = budgetSelect ? budgetSelect.value : "all";

    let filtered = liveProducts.filter(prod => {
        let matchName = prod.name.toLowerCase().includes(searchVal);
        let matchSubCat = (subcatVal === "all") || (prod.subCategory === subcatVal);
        
        let matchMainCat = false;
        if(selectedCategory === "all") {
            matchMainCat = true;
        } else if(selectedCategory === "handmade") {
            matchMainCat = prod.mainCategory.toLowerCase() === 'handmade';
        } else if(selectedCategory === "customized") {
            matchMainCat = prod.mainCategory.toLowerCase() === 'customized';
        } else {
            matchMainCat = prod.mainCategory === selectedCategory;
        }

        // Budget Filter Check
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

function changeCardMainImg(prodId, imgSrc) {
    const mainImgEl = document.getElementById(`main-img-${prodId}`);
    if(mainImgEl) {
        mainImgEl.src = imgSrc;
        mainImgEl.parentElement.setAttribute('onclick', `openImageZoom('${imgSrc}')`);
    }
}

function openImageZoom(imgSrc) {
    let modal = document.getElementById('cz-zoom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cz-zoom-modal';
        modal.style.cssText = "display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.88); z-index:999999; justify-content:center; align-items:center; cursor:zoom-out;";
        modal.innerHTML = `
            <span style="position:absolute; top:15px; right:25px; color:#fff; font-size:35px; font-weight:bold; cursor:pointer;">&times;</span>
            <img id="cz-zoom-img" src="" style="max-width:92%; max-height:85vh; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5); object-fit:contain;">
        `;
        modal.onclick = () => modal.style.display = "none";
        document.body.appendChild(modal);
    }
    document.getElementById('cz-zoom-img').src = imgSrc;
    modal.style.display = "flex";
}

function addToCart(productId) {
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;
    
    let cart = JSON.parse(localStorage.getItem('cz_cart')) || [];
    cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        customType: product.customType,
        userText: "" 
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