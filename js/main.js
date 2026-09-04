let liveProducts = [];
let allReviewsMap = {};
let selectedMainCategory = "all";
let selectedSubCategory = "all";
let categoryMap = {};
let pendingAction = null;
let currentAuthMode = "login";
let currentOpenProductId = null;
let currentSelectedVariant = null;
let currentSelectedQty = 1;
let currentApplicablePrice = 0;
let selectedReviewStar = 5;
let uploadedReviewBase64 = "";

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
        renderHomeProducts(liveProducts);
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

// Render Products Grid with Image Fit & Discount
function renderHomeProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1; color:#595959; padding:25px;'>No products found matching your search.</p>";
        return;
    }

    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    let wishlist = customer && customer.wishlist ? customer.wishlist : [];
    const fallbackImg = "assets/images/logo.png";

    products.forEach(prod => {
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
                
                <div class="product-card-img-wrap">
                    <img src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                </div>

                <h3>${prod.name}</h3>
                
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

// Modal Price Update Helper
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

function calculateQuantityPrice(product, qty, basePrice) {
    if (product.hasQtyPricing && Array.isArray(product.qtyTiers) && product.qtyTiers.length > 0) {
        let sortedTiers = [...product.qtyTiers].sort((a, b) => b.minQty - a.minQty);
        let matchedTier = sortedTiers.find(t => qty >= t.minQty);
        if (matchedTier) {
            return parseInt(matchedTier.price);
        }
    }
    return basePrice;
}

// Product Details Modal
function openProductDetailsModal(productId) {
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    currentOpenProductId = productId;
    currentSelectedVariant = null;
    currentSelectedQty = 1;
    const modal = document.getElementById('product-details-modal');
    if (!modal) return;

    const fallbackImg = "assets/images/logo.png";
    const images = product.images && product.images.length > 0 ? product.images : [fallbackImg];

    const mainImgEl = document.getElementById('pdm-main-img');
    const badgeEl = document.getElementById('pdm-badge');
    const titleEl = document.getElementById('pdm-title');
    const starsEl = document.getElementById('pdm-overall-stars');
    const revCountEl = document.getElementById('pdm-review-count');

    if (mainImgEl) mainImgEl.src = images[0];
    if (badgeEl) badgeEl.innerText = `${product.mainCategory} • ${product.subCategory || 'Handmade'}`;
    if (titleEl) titleEl.innerText = product.name;

    const customContainer = document.getElementById('pdm-custom-field-container');
    if (customContainer) customContainer.innerHTML = "";

    let hasActiveVariants = product.hasVariants && Array.isArray(product.variants) && product.variants.filter(v => v.isActive !== false).length > 0;
    
    let basePrice = parseInt(product.discountPrice || product.price) || 0;
    let baseActualPrice = parseInt(product.actualPrice) || 0;

    if (hasActiveVariants) {
        let activeVariants = product.variants.filter(v => v.isActive !== false).slice(0, 5);
        currentSelectedVariant = activeVariants[0];
        basePrice = parseInt(currentSelectedVariant.price) || basePrice;
        baseActualPrice = parseInt(currentSelectedVariant.actualPrice) || baseActualPrice;

        let variantHtml = `
            <div class="pdm-variant-wrapper">
                <div class="pdm-variant-title">
                    <span><i class="fas fa-layer-group"></i> Select Your Option:</span>
                    <strong id="pdm-selected-var-text" style="color:var(--blue-primary);">${currentSelectedVariant.name} (₹${currentSelectedVariant.price})</strong>
                </div>
                <div class="pdm-variant-pills">
                    ${activeVariants.map((v, i) => `
                        <button type="button" class="pdm-variant-btn ${i === 0 ? 'active' : ''}" onclick="selectProductVariant('${v.name.replace(/'/g, "\\'")}', ${v.price}, '${v.actualPrice || ''}', '${v.image || ''}', this)">
                            ${v.name} • ₹${v.price}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        if (customContainer) customContainer.innerHTML += variantHtml;
    }

    if (product.hasQtyPricing && Array.isArray(product.qtyTiers) && product.qtyTiers.length > 0) {
        let sortedTiers = [...product.qtyTiers].sort((a, b) => a.minQty - b.minQty);
        
        let qtyHtml = `
            <div class="pdm-qty-tier-wrapper">
                <div class="pdm-qty-tier-title">
                    <span><i class="fas fa-boxes"></i> Package Quantity & Bulk Price:</span>
                    <span style="font-size:11px; color:#16a34a; font-weight:700;">Direct Package Price</span>
                </div>
                <div class="pdm-qty-pills">
                    ${sortedTiers.map((t, idx) => `
                        <button type="button" class="pdm-qty-pill-btn ${idx === 0 ? 'active' : ''}" onclick="selectProductQtyTier(${t.minQty}, ${t.price}, this)">
                            ${t.minQty} PC${t.minQty > 1 ? 'S' : ''} → ₹${t.price}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        if (customContainer) customContainer.innerHTML += qtyHtml;

        currentSelectedQty = sortedTiers[0].minQty;
        currentApplicablePrice = parseInt(sortedTiers[0].price);
    } else {
        currentSelectedQty = 1;
        currentApplicablePrice = basePrice;
    }

    updateModalPriceBox(product, currentApplicablePrice, baseActualPrice);

    let ratingVal = product.avgRating ? product.avgRating.toFixed(1) : "5.0";
    let reviewNum = product.reviewCount || 0;
    if (starsEl) starsEl.innerText = `${ratingVal} ★`;
    if (revCountEl) revCountEl.innerText = `(${reviewNum} ${reviewNum === 1 ? 'customer review' : 'customer reviews'})`;

    const thumbsContainer = document.getElementById('pdm-thumbs');
    if (thumbsContainer) {
        thumbsContainer.innerHTML = "";
        if (images.length > 1) {
            images.forEach(img => {
                thumbsContainer.innerHTML += `<img src="${img}" onerror="this.src='${fallbackImg}'" onclick="document.getElementById('pdm-main-img').src='${img}'">`;
            });
        }
    }

    if (customContainer) {
        if (product.customType === "name") {
            customContainer.innerHTML += `
                <div style="margin-top:10px;">
                    <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:5px; color:var(--blue-primary);">Customize Text / Name to Print:</label>
                    <input type="text" id="pdm-custom-input" placeholder="Enter name or date to engrave" style="width:100%; padding:9px; border:1px solid var(--card-border); border-radius:4px; box-sizing:border-box; background:#fff; color:var(--text-primary);">
                </div>
            `;
        } else if (product.customType === "pic") {
            customContainer.innerHTML += `
                <div style="margin-top:10px;">
                    <p style="font-size:12px; color:var(--blue-primary); background:var(--blue-light); padding:8px; border-radius:4px; border:1px dashed var(--blue-primary);">
                        📷 Photo Customization: You can share your photos directly on WhatsApp after checkout!
                    </p>
                </div>
            `;
        }
    }

    const btnAdd = document.getElementById('pdm-btn-add');
    const btnBuy = document.getElementById('pdm-btn-buy');

    if (btnAdd) {
        btnAdd.onclick = () => {
            let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
            handleAddToCart(product.id, customVal, currentSelectedVariant, currentSelectedQty, currentApplicablePrice);
            closeProductDetailsModal();
        };
    }

    if (btnBuy) {
        btnBuy.onclick = () => {
            let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
            handleAddToCart(product.id, customVal, currentSelectedVariant, currentSelectedQty, currentApplicablePrice);
            window.location.href = "cart.html";
        };
    }

    loadProductSpecificReviews(productId);
    modal.classList.add('show-modal');
}

function selectProductQtyTier(qty, tierPackagePrice, btnEl) {
    currentSelectedQty = parseInt(qty);
    currentApplicablePrice = parseInt(tierPackagePrice);

    const allQtyBtns = document.querySelectorAll('.pdm-qty-pill-btn');
    allQtyBtns.forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    let product = liveProducts.find(p => p.id === currentOpenProductId);
    if (product) {
        updateModalPriceBox(product, currentApplicablePrice);
    }
}

function selectProductVariant(varName, varPrice, varActualPrice, varImg, btnEl) {
    currentSelectedVariant = { 
        name: varName, 
        price: varPrice, 
        actualPrice: varActualPrice ? parseInt(varActualPrice) : null,
        image: varImg 
    };
    
    const allBtns = document.querySelectorAll('.pdm-variant-btn');
    allBtns.forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const varText = document.getElementById('pdm-selected-var-text');
    if (varText) varText.innerText = `${varName} (₹${varPrice})`;

    let product = liveProducts.find(p => p.id === currentOpenProductId);
    if (product) {
        currentApplicablePrice = calculateQuantityPrice(product, currentSelectedQty, varPrice);
        updateModalPriceBox(product, currentApplicablePrice, varActualPrice ? parseInt(varActualPrice) : null);
    }

    if (varImg && varImg.trim() !== "") {
        const mainImgEl = document.getElementById('pdm-main-img');
        if (mainImgEl) mainImgEl.src = varImg;
    }
}

function closeProductDetailsModal() {
    const modal = document.getElementById('product-details-modal');
    if (modal) modal.classList.remove('show-modal');
    const writeBox = document.getElementById('product-write-review-box');
    if (writeBox) writeBox.style.display = "none";
}

function zoomCurrentProductImage() {
    const mainImg = document.getElementById('pdm-main-img');
    const modalZoomImg = document.getElementById('modal-zoomed-img');
    const zoomModal = document.getElementById('image-zoom-modal');
    if (mainImg && modalZoomImg && zoomModal) {
        modalZoomImg.src = mainImg.src;
        zoomModal.classList.add('show-modal');
    }
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

        reviews.sort((a, b) => {
            let timeA = a.timestamp ? (a.timestamp.seconds || 0) : 0;
            let timeB = b.timestamp ? (b.timestamp.seconds || 0) : 0;
            return timeB - timeA;
        });

        container.innerHTML = "";
        reviews.forEach(r => {
            let stars = "★".repeat(r.rating || 5) + "☆".repeat(5 - (r.rating || 5));
            let photoHtml = r.photoUrl ? `<img src="${r.photoUrl}" class="review-photo" onclick="zoomReviewImage('${r.photoUrl}')" alt="Customer Real Pic">` : "";

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

function zoomReviewImage(url) {
    const modalZoomImg = document.getElementById('modal-zoomed-img');
    const zoomModal = document.getElementById('image-zoom-modal');
    if (modalZoomImg && zoomModal) {
        modalZoomImg.src = url;
        zoomModal.classList.add('show-modal');
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

// STRICT AUTH GATE: Guest users CANNOT add products to cart
function handleAddToCart(productId, customText = "", selectedVariant = null, selectedQty = 1, packagePrice = null) {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    
    if (!customer) {
        pendingAction = { type: 'cart', id: productId, text: customText, variant: selectedVariant, qty: selectedQty, price: packagePrice };
        openAuthModal(true);
        return;
    }

    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;
    
    if (!selectedVariant && product.hasVariants && product.variants && product.variants.length > 0) {
        selectedVariant = product.variants[0];
    }

    let baseSelling = selectedVariant 
        ? selectedVariant.price 
        : (parseInt(product.discountPrice) || parseInt(product.price) || 0);

    let finalPackagePrice = packagePrice !== null ? packagePrice : calculateQuantityPrice(product, selectedQty, baseSelling);

    let finalImg = (selectedVariant && selectedVariant.image) 
        ? selectedVariant.image 
        : (product.images ? product.images[0] : 'assets/images/logo.png');
        
    let variantName = selectedVariant ? selectedVariant.name : "";

    let cart = JSON.parse(localStorage.getItem('cz_cart')) || [];
    cart.push({
        id: product.id,
        name: product.name,
        price: finalPackagePrice,
        variantName: variantName,
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

// Customer Authentication: Phone + Name Verification System
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

// Complete Phone + Name Login & Registration
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
            
            // Server verification: Phone + Name match
            if (customerData.name.trim().toLowerCase() !== name.toLowerCase()) {
                err.style.display = "block";
                err.innerText = "Invalid phone number or name combination.";
                btn.disabled = false;
                btn.innerText = "Login / Proceed";
                return;
            }

            // Customer ID ensures permanence
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
            // Sign Up
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
                handleAddToCart(pendingAction.id, pendingAction.text || "", pendingAction.variant || null, pendingAction.qty || 1, pendingAction.price || null);
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