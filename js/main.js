let liveProducts = [];
let allReviewsMap = {};
let selectedMainCategory = "all";
let selectedSubCategory = "all";
let categoryMap = {};
let pendingAction = null;
let currentAuthMode = "login";
let currentOpenProductId = null;
let currentSelectedVariant = null;
let currentSelectedSize = null;
let currentSelectedQty = 1;
let currentApplicablePrice = 0;
let selectedReviewStar = 5;
let uploadedReviewBase64 = "";

// HOME CLIENT-SIDE PAGINATION (12 products per page for fast loading)
const HOME_PRODUCTS_PER_PAGE = 12;
let currentHomePage = 1;
let currentHomeFilteredProducts = [];

// Mobile Drawer Controls
function openMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.style.display = 'block';
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
}

// Fetch Live Products & Reviews
async function fetchLiveProducts() {
    const container = document.getElementById('product-list'); 
    if (!container) return;
    
    container.innerHTML = "<p style='text-align:center; width:100%; color:#595959; grid-column: 1/-1;'><i class='fas fa-spinner fa-spin'></i> Loading products...</p>";
    
    try {
        const revSnapshot = await db.collection("reviews").get();
        allReviewsMap = {};
        revSnapshot.forEach(doc => {
            let rev = doc.data();
            rev.id = doc.id;
            if (rev.productId) {
                if (!allReviewsMap[rev.productId]) {
                    allReviewsMap[rev.productId] = [];
                }
                allReviewsMap[rev.productId].push(rev);
            }
        });

        const snapshot = await db.collection("products").where("isActive", "==", true).get();
        liveProducts = [];
        categoryMap = { "Handmade": new Set(), "Customized": new Set() };
        
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
            
            let mainCatFormatted = prod.mainCategory.trim();
            mainCatFormatted = mainCatFormatted.charAt(0).toUpperCase() + mainCatFormatted.slice(1);

            if (!categoryMap[mainCatFormatted]) {
                categoryMap[mainCatFormatted] = new Set();
            }

            if (prod.subCategory && prod.subCategory.trim() !== "") {
                categoryMap[mainCatFormatted].add(prod.subCategory.trim());
            }

            let prodReviews = allReviewsMap[prod.id] || [];
            if (prodReviews.length > 0) {
                let totalScore = prodReviews.reduce((sum, r) => sum + (parseInt(r.rating) || 5), 0);
                prod.avgRating = (totalScore / prodReviews.length);
                prod.reviewCount = prodReviews.length;
            } else {
                prod.avgRating = 5.0;
                prod.reviewCount = 0;
            }

            liveProducts.push(prod);
        });

        renderCategoryPills();
        currentHomeFilteredProducts = [...liveProducts];
        currentHomePage = 1;
        renderHomeProducts(currentHomeFilteredProducts);
        checkUrlProductParam();

    } catch (error) {
        console.error("Error fetching products & reviews:", error);
        container.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Failed to load products.</p>";
    }
}

function renderCategoryPills() {
    const nav = document.getElementById('dynamic-cat-nav');
    if (!nav) return;

    let html = `<button class="cat-pill-btn ${selectedMainCategory === 'all' ? 'active' : ''}" onclick="setMainCategoryFilter('all', this)">All</button>`;

    for (let mainCat in categoryMap) {
        let isActive = selectedMainCategory.toLowerCase() === mainCat.toLowerCase();
        html += `<button class="cat-pill-btn ${isActive ? 'active' : ''}" onclick="setMainCategoryFilter('${mainCat}', this)">${mainCat}</button>`;
    }

    nav.innerHTML = html;
    renderSubCategoryRow();
}

function renderSubCategoryRow() {
    const subRow = document.getElementById('dynamic-subcat-row');
    if (!subRow) return;

    if (selectedMainCategory === "all" || !categoryMap[selectedMainCategory]) {
        subRow.style.display = "none";
        subRow.innerHTML = "";
        return;
    }

    let subCats = Array.from(categoryMap[selectedMainCategory]);
    if (subCats.length === 0) {
        subRow.style.display = "none";
        return;
    }

    let html = `<span class="subcat-pill ${selectedSubCategory === 'all' ? 'active' : ''}" onclick="setSubCategoryFilter('all')">All ${selectedMainCategory}</span>`;
    subCats.forEach(sub => {
        html += `<span class="subcat-pill ${selectedSubCategory === sub ? 'active' : ''}" onclick="setSubCategoryFilter('${sub}')">${sub}</span>`;
    });

    subRow.innerHTML = html;
    subRow.style.display = "flex";
}

function setMainCategoryFilter(cat, btn) {
    selectedMainCategory = cat;
    selectedSubCategory = "all";
    renderCategoryPills();
    filterHomeProducts();
}

function setSubCategoryFilter(subCat) {
    selectedSubCategory = subCat;
    renderSubCategoryRow();
    filterHomeProducts();
}

// HOME PRODUCTS (SLICED 12 PER PAGE + DIRECT IMAGE ZOOM)
function renderHomeProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = "";

    currentHomeFilteredProducts = products;
    let totalItems = products.length;

    if (totalItems === 0) {
        container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1; color:#595959; padding:25px;'>No products found matching your search.</p>";
        renderHomePaginationBar(0);
        return;
    }

    // 12 Items Pagination Slice
    let startIndex = (currentHomePage - 1) * HOME_PRODUCTS_PER_PAGE;
    let endIndex = Math.min(startIndex + HOME_PRODUCTS_PER_PAGE, totalItems);
    let pageItems = products.slice(startIndex, endIndex);

    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    let wishlist = customer && customer.wishlist ? customer.wishlist : [];
    const fallbackImg = "assets/images/logo.png";

    pageItems.forEach(prod => {
        let images = prod.images && prod.images.length > 0 ? prod.images : [fallbackImg];
        let mainImg = images[0];
        let isWishlisted = wishlist.some(w => w.id === prod.id);

        let ratingVal = prod.avgRating ? prod.avgRating.toFixed(1) : "5.0";
        let reviewNum = prod.reviewCount || 0;
        
        let hasVariants = prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0;
        let actualPrice = parseInt(prod.actualPrice) || 0;
        let sellingPrice = parseInt(prod.discountPrice || prod.price) || 0;

        let displayPriceText = "";
        let effectiveSellingPrice = sellingPrice;

        if (hasVariants) {
            let variantPrices = prod.variants.map(v => parseInt(v.price) || sellingPrice).filter(p => p > 0);
            effectiveSellingPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : sellingPrice;
            displayPriceText = `₹${effectiveSellingPrice}+`;

            let variantActuals = prod.variants.map(v => parseInt(v.actualPrice) || actualPrice).filter(p => p > 0);
            if (variantActuals.length > 0) actualPrice = Math.max(...variantActuals);
        } else {
            displayPriceText = `₹${sellingPrice}`;
        }

        let hasDiscount = actualPrice > 0 && effectiveSellingPrice > 0 && effectiveSellingPrice < actualPrice;
        let discountPct = hasDiscount ? Math.round(((actualPrice - effectiveSellingPrice) / actualPrice) * 100) : 0;

        let priceHtml = "";
        if (hasDiscount) {
            priceHtml = `
                <div class="price-display-wrapper">
                    <span class="original-price-strike">₹${actualPrice}</span>
                    <span class="sale-price-highlight">${displayPriceText}</span>
                </div>
                <div><span class="discount-badge-pill">🔥 ${discountPct}% OFF</span></div>
            `;
        } else {
            priceHtml = `<p class="sale-price-highlight" style="margin-bottom:8px;">${displayPriceText}</p>`;
        }

        container.innerHTML += `
            <div class="product-card" onclick="openProductDetailsModal('${prod.id}')">
                <div class="card-top-actions">
                    <button class="action-btn-circle" onclick="event.stopPropagation(); shareDirectProduct('${prod.id}', event)" title="Share Product">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="action-btn-circle wishlist-btn-heart ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlistCloud('${prod.id}')" title="Wishlist">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
                
                <!-- Direct Image Click Triggers Full Zoom Screen -->
                <div class="product-card-img-wrap" onclick="event.stopPropagation(); directImageZoom('${mainImg}')" title="Click to Zoom Image">
                    <img src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                </div>

                <h3 style="cursor:pointer;" onclick="openProductDetailsModal('${prod.id}')">${prod.name}</h3>
                
                <div class="card-rating-row">
                    <span>★ ${ratingVal}</span>
                    <span style="color:#595959; font-size:11px;">(${reviewNum} ${reviewNum === 1 ? 'review' : 'reviews'})</span>
                </div>

                ${priceHtml}

                <button class="btn-cart-action" onclick="event.stopPropagation(); handleAddToCart('${prod.id}')">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
        `;
    });

    renderHomePaginationBar(totalItems);
}

// HOME DYNAMIC PAGINATION TOOLBAR
function renderHomePaginationBar(totalItems) {
    let bar = document.getElementById('home-pagination-container');
    const container = document.getElementById('product-list');

    if (!bar && container) {
        bar = document.createElement('div');
        bar.id = 'home-pagination-container';
        bar.style.cssText = "grid-column: 1/-1; display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 25px; padding: 15px 0;";
        container.parentNode.insertBefore(bar, container.nextSibling);
    }

    if (!bar) return;

    if (totalItems <= HOME_PRODUCTS_PER_PAGE) {
        bar.innerHTML = "";
        return;
    }

    let totalPages = Math.ceil(totalItems / HOME_PRODUCTS_PER_PAGE);
    let html = "";

    // Prev Button
    html += `
        <button onclick="goToHomePage(${currentHomePage - 1})" ${currentHomePage === 1 ? 'disabled' : ''} 
                style="background:#fff; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:${currentHomePage === 1 ? 'not-allowed' : 'pointer'}; opacity:${currentHomePage === 1 ? '0.5' : '1'};">
            &laquo; Prev
        </button>
    `;

    // Page Buttons
    let startPage = Math.max(1, currentHomePage - 2);
    let endPage = Math.min(totalPages, currentHomePage + 2);

    for (let i = startPage; i <= endPage; i++) {
        let isAct = i === currentHomePage;
        html += `
            <button onclick="goToHomePage(${i})" 
                    style="background:${isAct ? '#28469E' : '#fff'}; color:${isAct ? '#fff' : '#1e293b'}; border:1px solid ${isAct ? '#28469E' : '#cbd5e1'}; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                ${i}
            </button>
        `;
    }

    // Next Button
    html += `
        <button onclick="goToHomePage(${currentHomePage + 1})" ${currentHomePage === totalPages ? 'disabled' : ''} 
                style="background:#fff; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:${currentHomePage === totalPages ? 'not-allowed' : 'pointer'}; opacity:${currentHomePage === totalPages ? '0.5' : '1'};">
            Next &raquo;
        </button>
    `;

    bar.innerHTML = html;
}

function goToHomePage(page) {
    let totalPages = Math.ceil(currentHomeFilteredProducts.length / HOME_PRODUCTS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentHomePage = page;
    renderHomeProducts(currentHomeFilteredProducts);
    
    // Smooth scroll to top of product list
    const pList = document.getElementById('product-list');
    if (pList) pList.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function directImageZoom(imgUrl) {
    const modalZoomImg = document.getElementById('modal-zoomed-img');
    const zoomModal = document.getElementById('image-zoom-modal');
    if (modalZoomImg && zoomModal) {
        modalZoomImg.src = imgUrl;
        zoomModal.classList.add('show-modal');
    }
}

function filterHomeProducts() {
    const searchInput = document.getElementById('home-search-input');
    const budgetSelect = document.getElementById('budget-filter');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const budgetVal = budgetSelect ? budgetSelect.value : "all";

    let filtered = liveProducts.filter(prod => {
        let matchName = prod.name.toLowerCase().includes(searchVal);
        let matchMainCat = (selectedMainCategory === "all") || (prod.mainCategory.toLowerCase() === selectedMainCategory.toLowerCase());
        let matchSubCat = (selectedSubCategory === "all") || (prod.subCategory === selectedSubCategory);

        let matchBudget = true;
        let price = parseInt(prod.discountPrice || prod.price) || 0;
        if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
            price = parseInt(prod.variants[0].price) || price;
        }

        if (budgetVal === "199") matchBudget = price <= 199;
        else if (budgetVal === "299") matchBudget = price <= 299;
        else if (budgetVal === "499") matchBudget = price <= 499;
        else if (budgetVal === "500plus") matchBudget = price >= 500;

        return matchName && matchMainCat && matchSubCat && matchBudget;
    });

    currentHomePage = 1; // Reset to page 1 on search or filter
    renderHomeProducts(filtered);
}

function shareDirectProduct(productId, event) {
    if (event) event.stopPropagation();
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    let shareUrl = `${window.location.origin}/index.html?product=${productId}`;
    let shareText = `Check out this customized "${product.name}" on Custom Zone! 🎁✨\n${shareUrl}`;

    if (navigator.share) {
        navigator.share({
            title: product.name,
            text: shareText,
            url: shareUrl
        }).catch(() => {});
    } else {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        window.open(waUrl, "_blank");
    }
}

function updateModalPriceBox(product, currentPrice, currentActualPrice = null) {
    const priceContainer = document.getElementById('pdm-price-box');
    if (!priceContainer) return;

    let actualPrice = currentActualPrice !== null ? parseInt(currentActualPrice) : (parseInt(product.actualPrice) || 0);
    let sellingPrice = parseInt(currentPrice) || 0;
    
    let hasDiscount = actualPrice > 0 && sellingPrice > 0 && sellingPrice < actualPrice;
    let discountPct = hasDiscount ? Math.round(((actualPrice - sellingPrice) / actualPrice) * 100) : 0;

    if (hasDiscount) {
        priceContainer.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="original-price-strike" style="font-size:16px;">₹${actualPrice}</span>
                <span style="font-size:24px; font-weight:800; color:var(--blue-primary);">₹<span id="pdm-price">${sellingPrice}</span></span>
                <span class="discount-badge-pill" style="margin-bottom:0;">🔥 ${discountPct}% OFF</span>
            </div>
        `;
    } else {
        priceContainer.innerHTML = `<div style="font-size:24px; font-weight:800; color:var(--blue-primary);">₹<span id="pdm-price">${sellingPrice}</span></div>`;
    }
}

// LINKED BULK PRICING FORMULA
function recalculateLinkedPrice(product) {
    let baseVariantPrice = currentSelectedVariant 
        ? parseInt(currentSelectedVariant.price) 
        : (parseInt(product.discountPrice) || parseInt(product.price) || 0);

    let sizeExtra = (currentSelectedSize && currentSelectedSize.extraPrice) ? parseInt(currentSelectedSize.extraPrice) : 0;
    let unitPrice = baseVariantPrice + sizeExtra;

    if (currentSelectedQty > 1 && product.hasQtyPricing && product.qtyTiers && product.qtyTiers.length > 0) {
        let currentVarName = currentSelectedVariant ? currentSelectedVariant.name : "all";
        let tier = product.qtyTiers.find(t => t.minQty === currentSelectedQty && (t.targetVariant === "all" || t.targetVariant === currentVarName));
        
        if (tier) {
            let defaultBase = parseInt(product.discountPrice) || 1;
            let ratio = unitPrice / defaultBase;
            currentApplicablePrice = Math.round(tier.price * ratio);
        } else {
            currentApplicablePrice = unitPrice * currentSelectedQty;
        }
    } else {
        currentApplicablePrice = unitPrice;
    }

    let actualMRP = currentSelectedVariant ? (currentSelectedVariant.actualPrice || product.actualPrice) : product.actualPrice;
    let finalMRP = actualMRP ? (parseInt(actualMRP) + sizeExtra) : null;

    updateModalPriceBox(product, currentApplicablePrice, finalMRP);
}

// PRODUCT DETAILS MODAL (WITH PERFECT AUTO-FIT IMAGES)
function openProductDetailsModal(productId) {
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    currentOpenProductId = productId;
    currentSelectedVariant = null;
    currentSelectedSize = null;
    currentSelectedQty = 1;
    const modal = document.getElementById('product-details-modal');
    if (!modal) return;

    const fallbackImg = "assets/images/logo.png";
    const defaultImages = product.images && product.images.length > 0 ? product.images : [fallbackImg];

    const mainImgEl = document.getElementById('pdm-main-img');
    const badgeEl = document.getElementById('pdm-badge');
    const titleEl = document.getElementById('pdm-title');
    const starsEl = document.getElementById('pdm-overall-stars');
    const revCountEl = document.getElementById('pdm-review-count');

    if (mainImgEl) {
        mainImgEl.src = defaultImages[0];
        mainImgEl.style.cssText = "width:100%; max-height:360px; aspect-ratio:1/1; object-fit:contain; background:#ffffff; border-radius:8px; display:block; margin:0 auto;";
        mainImgEl.onclick = () => directImageZoom(mainImgEl.src);
        mainImgEl.title = "Click to Zoom";
        mainImgEl.style.cursor = "zoom-in";
    }

    if (badgeEl) badgeEl.innerText = `${product.mainCategory} • ${product.subCategory || 'Handmade'}`;
    if (titleEl) titleEl.innerText = product.name;

    renderModalGallery(defaultImages);

    const customContainer = document.getElementById('pdm-custom-field-container');
    if (customContainer) customContainer.innerHTML = "";

    // 1. Optional Sizes
    if (product.hasSizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
        currentSelectedSize = product.sizes[0];
        let sizeHtml = `
            <div class="pdm-variant-wrapper" style="margin-bottom:12px;">
                <div style="font-size:12px; font-weight:bold; color:var(--blue-primary); margin-bottom:6px;">
                    <i class="fas fa-ruler-combined"></i> Select Size / Dimension:
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${product.sizes.map((s, idx) => `
                        <button type="button" class="pdm-variant-btn ${idx === 0 ? 'active' : ''}" onclick="onSelectProductSize('${s.name.replace(/'/g, "\\'")}', ${s.extraPrice || 0}, this)">
                            ${s.name} ${s.extraPrice > 0 ? `(+₹${s.extraPrice})` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        customContainer.innerHTML += sizeHtml;
    }

    // 2. Color/Design Variants
    if (product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
        currentSelectedVariant = product.variants[0];
        let variantHtml = `
            <div class="pdm-variant-wrapper" style="margin-bottom:12px;">
                <div style="font-size:12px; font-weight:bold; color:var(--blue-primary); margin-bottom:6px;">
                    <i class="fas fa-palette"></i> Select Color / Design:
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${product.variants.map((v, idx) => {
                        let vImages = v.images || (v.image ? [v.image] : []);
                        let imgJson = JSON.stringify(vImages).replace(/"/g, '&quot;');
                        return `
                            <button type="button" class="pdm-variant-btn ${idx === 0 ? 'active' : ''}" onclick="onSelectProductVariant('${v.name.replace(/'/g, "\\'")}', ${v.price}, '${v.actualPrice || ''}', ${imgJson}, this)">
                                ${v.name} • ₹${v.price}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        customContainer.innerHTML += variantHtml;

        let firstVarImgs = currentSelectedVariant.images || (currentSelectedVariant.image ? [currentSelectedVariant.image] : []);
        if (firstVarImgs.length > 0) {
            if (mainImgEl) mainImgEl.src = firstVarImgs[0];
            renderModalGallery(firstVarImgs);
        }
    }

    // 3. Dynamic Bulk Package Area
    customContainer.innerHTML += `<div id="pdm-bulk-qty-wrapper"></div>`;
    renderApplicableBulkPackages(product);

    // 4. Custom Inputs
    if (product.customType === "name") {
        customContainer.innerHTML += `
            <div style="margin-top:10px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:5px; color:var(--blue-primary);">Customize Text / Name to Print:</label>
                <input type="text" id="pdm-custom-input" placeholder="Enter name or text to customize" style="width:100%; padding:9px; border:1px solid var(--card-border); border-radius:4px; box-sizing:border-box; background:#fff; color:var(--text-primary);">
            </div>
        `;
    } else if (product.customType === "pic") {
        customContainer.innerHTML += `
            <div style="margin-top:10px;">
                <p style="font-size:12px; color:var(--blue-primary); background:var(--blue-light); padding:8px; border-radius:4px; border:1px dashed var(--blue-primary);">
                    📷 Photo Customization: Share your photo on WhatsApp after checkout!
                </p>
            </div>
        `;
    }

    recalculateLinkedPrice(product);

    let ratingVal = product.avgRating ? product.avgRating.toFixed(1) : "5.0";
    let reviewNum = product.reviewCount || 0;
    if (starsEl) starsEl.innerText = `${ratingVal} ★`;
    if (revCountEl) revCountEl.innerText = `(${reviewNum} ${reviewNum === 1 ? 'customer review' : 'customer reviews'})`;

    const btnAdd = document.getElementById('pdm-btn-add');
    const btnBuy = document.getElementById('pdm-btn-buy');

    if (btnAdd) {
        btnAdd.onclick = () => {
            let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
            handleAddToCart(product.id, customVal, currentSelectedVariant, currentSelectedQty, currentApplicablePrice, currentSelectedSize);
            closeProductDetailsModal();
        };
    }

    if (btnBuy) {
        btnBuy.onclick = () => {
            let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
            let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";

            if (!customer) {
                pendingAction = { 
                    type: 'buy_now', 
                    id: product.id, 
                    text: customVal, 
                    variant: currentSelectedVariant, 
                    qty: currentSelectedQty, 
                    price: currentApplicablePrice,
                    size: currentSelectedSize 
                };
                closeProductDetailsModal();
                openAuthModal(true);
                return;
            }

            handleAddToCart(product.id, customVal, currentSelectedVariant, currentSelectedQty, currentApplicablePrice, currentSelectedSize);
            window.location.href = "cart.html";
        };
    }

    loadProductSpecificReviews(productId);
    modal.classList.add('show-modal');
}

function renderApplicableBulkPackages(product) {
    const wrapper = document.getElementById('pdm-bulk-qty-wrapper');
    if (!wrapper) return;

    if (!product.hasQtyPricing || !Array.isArray(product.qtyTiers) || product.qtyTiers.length === 0) {
        wrapper.innerHTML = "";
        return;
    }

    let currentVarName = currentSelectedVariant ? currentSelectedVariant.name : "all";
    let matchedTiers = product.qtyTiers.filter(t => t.targetVariant === "all" || t.targetVariant === currentVarName);

    if (matchedTiers.length === 0) {
        wrapper.innerHTML = "";
        currentSelectedQty = 1;
        return;
    }

    let sorted = [...matchedTiers].sort((a, b) => a.minQty - b.minQty);
    wrapper.innerHTML = `
        <div class="pdm-qty-tier-wrapper" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="font-size:12px; font-weight:bold; color:var(--blue-primary);"><i class="fas fa-boxes"></i> Package Quantity:</span>
                <span style="font-size:11px; color:#16a34a; font-weight:700;">Bulk Discount Available</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="pdm-qty-pill-btn ${currentSelectedQty === 1 ? 'active' : ''}" onclick="onSelectBulkQty(1, this)">
                    1 PC (Standard)
                </button>
                ${sorted.map(t => `
                    <button type="button" class="pdm-qty-pill-btn ${currentSelectedQty === t.minQty ? 'active' : ''}" onclick="onSelectBulkQty(${t.minQty}, this)">
                        ${t.minQty} PCS Package
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderModalGallery(imgs) {
    const thumbsContainer = document.getElementById('pdm-thumbs');
    const fallbackImg = "assets/images/logo.png";
    if (!thumbsContainer) return;
    thumbsContainer.innerHTML = "";
    if (imgs && imgs.length > 1) {
        imgs.forEach(img => {
            thumbsContainer.innerHTML += `
                <img src="${img}" onerror="this.src='${fallbackImg}'" 
                     style="width:55px; height:55px; aspect-ratio:1/1; object-fit:contain; background:#fff; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;" 
                     onclick="document.getElementById('pdm-main-img').src='${img}'">
            `;
        });
    }
}

function onSelectProductSize(sizeName, extraPrice, btnEl) {
    currentSelectedSize = { name: sizeName, extraPrice: parseInt(extraPrice) || 0 };
    btnEl.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    let product = liveProducts.find(p => p.id === currentOpenProductId);
    if (product) recalculateLinkedPrice(product);
}

function onSelectProductVariant(varName, price, actualPrice, images, btnEl) {
    currentSelectedVariant = {
        name: varName,
        price: parseInt(price),
        actualPrice: actualPrice ? parseInt(actualPrice) : null,
        images: Array.isArray(images) ? images : (images ? [images] : [])
    };
    btnEl.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    if (currentSelectedVariant.images.length > 0) {
        document.getElementById('pdm-main-img').src = currentSelectedVariant.images[0];
        renderModalGallery(currentSelectedVariant.images);
    }

    let product = liveProducts.find(p => p.id === currentOpenProductId);
    if (product) {
        renderApplicableBulkPackages(product);
        recalculateLinkedPrice(product);
    }
}

function onSelectBulkQty(qty, btnEl) {
    currentSelectedQty = parseInt(qty);
    btnEl.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    let product = liveProducts.find(p => p.id === currentOpenProductId);
    if (product) recalculateLinkedPrice(product);
}

function closeProductDetailsModal() {
    const modal = document.getElementById('product-details-modal');
    if (modal) modal.classList.remove('show-modal');
    const writeBox = document.getElementById('product-write-review-box');
    if (writeBox) writeBox.style.display = "none";
}

function closeImageZoomModal() {
    const zoomModal = document.getElementById('image-zoom-modal');
    if (zoomModal) zoomModal.classList.remove('show-modal');
}

async function loadProductSpecificReviews(productId) {
    const container = document.getElementById('pdm-reviews-container');
    if (!container) return;
    container.innerHTML = "<p style='text-align:center; color:#595959; font-size:12px;'>Loading reviews...</p>";

    try {
        const snapshot = await db.collection("reviews")
            .where("productId", "==", productId)
            .get();

        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; color:#595959; font-size:12px;'>No reviews yet for this product.</p>";
            return;
        }

        let reviews = [];
        snapshot.forEach(doc => {
            let r = doc.data();
            r.id = doc.id;
            reviews.push(r);
        });

        reviews.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        container.innerHTML = "";
        reviews.forEach(r => {
            let stars = "★".repeat(r.rating || 5) + "☆".repeat(5 - (r.rating || 5));
            let photoHtml = r.photoUrl ? `<img src="${r.photoUrl}" class="review-photo" onclick="directImageZoom('${r.photoUrl}')" alt="Customer Real Pic">` : "";

            container.innerHTML += `
                <div class="review-card-item">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:var(--blue-primary); font-size:13px;">${r.customerName || 'Customer'}</strong>
                        <span style="color:#f39c12; font-size:12px;">${stars}</span>
                    </div>
                    <p style="margin:0; font-size:12px; color:var(--text-primary);">${r.comment || ''}</p>
                    ${photoHtml}
                    <div style="font-size:10px; color:#595959; margin-top:5px;">${r.date || 'Recent'}</div>
                </div>
            `;
        });

    } catch (e) {
        container.innerHTML = "<p style='color:#595959; font-size:12px;'>Verified product rating: 5.0 ★</p>";
    }
}

function toggleAddReviewForm() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) {
        openAuthModal();
        return;
    }
    const box = document.getElementById('product-write-review-box');
    if (box) {
        box.style.display = box.style.display === "none" ? "block" : "none";
        setProductStarRating(5);
    }
}

function setProductStarRating(stars) {
    selectedReviewStar = stars;
    const picker = document.getElementById('pdm-star-picker');
    if (!picker) return;
    let spans = picker.querySelectorAll('span');
    spans.forEach((s, idx) => {
        if (idx < stars) s.classList.add('active-star');
        else s.classList.remove('active-star');
    });
}

function previewReviewImage(input) {
    const file = input.files[0];
    const previewBox = document.getElementById('review-photo-preview-box');
    const previewImg = document.getElementById('review-photo-preview-img');

    if (!file) {
        uploadedReviewBase64 = "";
        if (previewBox) previewBox.style.display = "none";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDimension = 600;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            uploadedReviewBase64 = canvas.toDataURL('image/jpeg', 0.7);
            if (previewImg) previewImg.src = uploadedReviewBase64;
            if (previewBox) previewBox.style.display = "block";
        };
    };
    reader.readAsDataURL(file);
}

async function submitProductReviewCloud() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) { openAuthModal(); return; }

    const textEl = document.getElementById('pdm-review-text');
    const text = textEl ? textEl.value.trim() : "";
    const btn = document.getElementById('btn-sub-prod-rev');

    if (!text) { alert("Please write a short review before submitting."); return; }

    if (btn) {
        btn.disabled = true;
        btn.innerText = "Publishing...";
    }

    let curProd = liveProducts.find(p => p.id === currentOpenProductId);
    let prodName = curProd ? curProd.name : "Custom Product";

    try {
        await db.collection("reviews").add({
            productId: currentOpenProductId,
            productName: prodName,
            customerName: customer.name || "Valued Customer",
            customerPhone: customer.phone || "",
            rating: selectedReviewStar,
            comment: text,
            photoUrl: uploadedReviewBase64 || "",
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("🎉 Thank you! Your review & real photo have been posted.");
        if (textEl) textEl.value = "";
        const fileInput = document.getElementById('pdm-review-file');
        if (fileInput) fileInput.value = "";
        const previewBox = document.getElementById('review-photo-preview-box');
        if (previewBox) previewBox.style.display = "none";
        uploadedReviewBase64 = "";
        const writeBox = document.getElementById('product-write-review-box');
        if (writeBox) writeBox.style.display = "none";
        
        await fetchLiveProducts();
        if (currentOpenProductId) {
            openProductDetailsModal(currentOpenProductId);
        }

    } catch (e) {
        alert("Failed to submit review.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Submit Review";
        }
    }
}

function checkUrlProductParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const prodId = urlParams.get('product');
    if (prodId) {
        setTimeout(() => { openProductDetailsModal(prodId); }, 500);
    }
}

// STRICT AUTH GATE & FULL SPECIFICATION CAPTURE
function handleAddToCart(productId, customText = "", selectedVariant = null, selectedQty = 1, packagePrice = null, selectedSize = null) {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    
    if (!customer) {
        pendingAction = { 
            type: 'cart', 
            id: productId, 
            text: customText, 
            variant: selectedVariant, 
            qty: selectedQty, 
            price: packagePrice,
            size: selectedSize 
        };
        openAuthModal(true);
        return;
    }

    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    let finalPackagePrice = packagePrice !== null ? packagePrice : (parseInt(product.discountPrice) || parseInt(product.price) || 0);

    let finalImg = 'assets/images/logo.png';
    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) {
        finalImg = selectedVariant.images[0];
    } else if (selectedVariant && selectedVariant.image) {
        finalImg = selectedVariant.image;
    } else if (product.images && product.images.length > 0) {
        finalImg = product.images[0];
    }

    let specParts = [];
    if (selectedSize && selectedSize.name) specParts.push(`Size: ${selectedSize.name}`);
    if (selectedVariant && selectedVariant.name) specParts.push(`Color: ${selectedVariant.name}`);
    let fullVariantName = specParts.join(' | ');

    let cart = JSON.parse(localStorage.getItem('cz_cart')) || [];
    cart.push({
        id: product.id,
        name: product.name,
        price: finalPackagePrice,
        variantName: fullVariantName,
        image: finalImg,
        customType: product.customType,
        userText: customText,
        quantity: selectedQty
    });
    
    localStorage.setItem('cz_cart', JSON.stringify(cart));
    updateCartCount();
    alert(`✅ ${product.name} (${selectedQty} PCS - ₹${finalPackagePrice}) added to cart!`);
}

async function toggleWishlistCloud(productId) {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) {
        pendingAction = { type: 'wishlist', id: productId };
        openAuthModal(true);
        return;
    }

    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    let wishlist = customer.wishlist || [];
    let index = wishlist.findIndex(w => w.id === productId);

    if (index > -1) {
        wishlist.splice(index, 1);
        alert("Removed from Wishlist.");
    } else {
        wishlist.push({
            id: product.id,
            name: product.name,
            price: product.discountPrice || product.price,
            image: product.images ? product.images[0] : 'assets/images/logo.png',
            customType: product.customType
        });
        alert("❤️ Added to Wishlist!");
    }

    customer.wishlist = wishlist;
    localStorage.setItem('cz_customer_user', JSON.stringify(customer));

    try {
        await db.collection("customers").doc(customer.phone).update({ wishlist: wishlist });
    } catch(e) {
        console.error("Wishlist sync error", e);
    }

    renderHomeProducts(liveProducts);
}

function switchAuthForm(mode) {
    currentAuthMode = mode;
    const addressField = document.getElementById('signup-address-field');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabSignup = document.getElementById('tab-btn-signup');
    const err = document.getElementById('auth-error-msg');

    if (err) err.style.display = "none";

    if (mode === 'signup') {
        if (addressField) addressField.style.display = "block";
        if (tabSignup) tabSignup.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
    } else {
        if (addressField) addressField.style.display = "none";
        if (tabLogin) tabLogin.classList.add('active');
        if (tabSignup) tabSignup.classList.remove('active');
    }
}

function openAuthModal(isGate = false) {
    switchAuthForm('login');
    const modal = document.getElementById('auth-modal');
    const gateMsg = document.getElementById('auth-gate-alert');
    if (gateMsg) {
        gateMsg.style.display = isGate ? 'block' : 'none';
    }
    if (modal) modal.classList.add('show-modal');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('show-modal');
}

async function handleCustomerAuthSubmit() {
    const phoneInput = document.getElementById('auth-user-phone');
    const nameInput = document.getElementById('auth-user-name');
    const addressInput = document.getElementById('auth-user-address');
    const err = document.getElementById('auth-error-msg');
    const btn = document.getElementById('btn-submit-auth');

    const phone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '') : "";
    const name = nameInput ? nameInput.value.trim() : "";
    const address = addressInput ? addressInput.value.trim() : "";

    if (phone.length !== 10) {
        err.style.display = "block";
        err.innerText = "Please enter a valid 10-digit WhatsApp phone number.";
        return;
    }

    if (!name) {
        err.style.display = "block";
        err.innerText = "Please enter your Full Name.";
        return;
    }

    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
        const customerRef = db.collection("customers").doc(phone);
        const docSnap = await customerRef.get();

        if (currentAuthMode === 'login') {
            if (!docSnap.exists) {
                err.style.display = "block";
                err.innerText = "Account not found. Please click 'Sign Up' to register.";
                btn.disabled = false;
                btn.innerText = "Login / Proceed";
                return;
            }

            const customerData = docSnap.data();
            
            if (customerData.name.trim().toLowerCase() !== name.toLowerCase()) {
                err.style.display = "block";
                err.innerText = "Invalid phone number or name combination.";
                btn.disabled = false;
                btn.innerText = "Login / Proceed";
                return;
            }

            if (!customerData.customerId) {
                customerData.customerId = "CZ-CUST-" + Math.floor(10000 + Math.random() * 90000);
                await customerRef.update({ customerId: customerData.customerId });
            }

            await customerRef.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() });

            localStorage.setItem('cz_customer_user', JSON.stringify(customerData));
            closeAuthModal();
            updateNavUserSlot();
            alert(`🎉 Welcome back, ${customerData.name}! (Customer ID: ${customerData.customerId})`);

        } else {
            if (docSnap.exists) {
                err.style.display = "block";
                err.innerText = "This phone number is already registered. Please log in.";
                btn.disabled = false;
                btn.innerText = "Create Account";
                return;
            }

            if (!address) {
                err.style.display = "block";
                err.innerText = "Complete delivery address is required for registration.";
                btn.disabled = false;
                btn.innerText = "Create Account";
                return;
            }

            const autoCustomerId = "CZ-CUST-" + Math.floor(10000 + Math.random() * 90000);

            const newCustomerData = {
                customerId: autoCustomerId,
                name: name,
                phone: phone,
                savedAddress: address,
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };

            await customerRef.set(newCustomerData);

            localStorage.setItem('cz_customer_user', JSON.stringify(newCustomerData));
            closeAuthModal();
            updateNavUserSlot();
            alert(`🎉 Account created! Your unique Customer ID is: ${autoCustomerId}`);
        }

        if (pendingAction) {
            if (pendingAction.type === 'cart') {
                handleAddToCart(pendingAction.id, pendingAction.text || "", pendingAction.variant || null, pendingAction.qty || 1, pendingAction.price || null, pendingAction.size || null);
            } else if (pendingAction.type === 'buy_now') {
                handleAddToCart(pendingAction.id, pendingAction.text || "", pendingAction.variant || null, pendingAction.qty || 1, pendingAction.price || null, pendingAction.size || null);
                window.location.href = "cart.html";
            } else if (pendingAction.type === 'wishlist') {
                toggleWishlistCloud(pendingAction.id);
            }
            pendingAction = null;
        }

    } catch (e) {
        console.error(e);
        err.style.display = "block";
        err.innerText = "Server connection error. Please try again.";
    } finally {
        btn.disabled = false;
        btn.innerText = currentAuthMode === 'login' ? "Login / Proceed" : "Create Account";
    }
}

function updateNavUserSlot() {
    const desktopSlot = document.getElementById('nav-user-slot-desktop');
    const mobileSlot = document.getElementById('nav-user-slot-mobile');
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));

    let html = "";
    if (customer) {
        html = `<a href="profile.html"><i class="fas fa-user-circle"></i> ${customer.name.split(" ")[0]}</a>`;
    } else {
        html = `<a href="javascript:void(0)" onclick="openAuthModal()"><i class="fas fa-user"></i> Login</a>`;
    }

    if (desktopSlot) desktopSlot.innerHTML = html;
    if (mobileSlot) mobileSlot.innerHTML = html;
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
    
    if (imgEl && data.imageUrl && data.imageUrl.trim() !== "") {
        imgEl.src = data.imageUrl;
        imgEl.style.display = "block";
    }

    setTimeout(() => { popup.classList.add('show-popup'); }, 1000);
}

function checkPromoPopup() {
    try {
        db.collection("settings").doc("promo").get().then(doc => {
            if (doc.exists) displayPopup(doc.data());
        });
    } catch (e) {}
}

function closePopup() {
    const popup = document.getElementById('promo-popup');
    if (popup) popup.classList.remove('show-popup');
}

window.addEventListener('DOMContentLoaded', () => {
    updateNavUserSlot();
    updateCartCount();
    fetchLiveProducts();
    checkPromoPopup();
});