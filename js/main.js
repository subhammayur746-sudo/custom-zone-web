let liveProducts = [];
let selectedMainCategory = "all";
let selectedSubCategory = "all";
let categoryMap = {};
let pendingAction = null;
let currentAuthMode = "login";
let activeSessionOtp = null;
let currentOpenProductId = null;
let selectedReviewStar = 5;

// Drawer Controls
function openMobileDrawer() {
    document.getElementById('mobile-drawer').classList.add('open');
    document.getElementById('drawer-overlay').style.display = 'block';
}

function closeMobileDrawer() {
    document.getElementById('mobile-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').style.display = 'none';
}

async function fetchLiveProducts() {
    const container = document.getElementById('product-list'); 
    if (!container) return;
    
    container.innerHTML = "<p style='text-align:center; width:100%; color:#7f8c8d; grid-column: 1/-1;'><i class='fas fa-spinner fa-spin'></i> Loading products...</p>";
    
    try {
        const snapshot = await db.collection("products").where("isActive", "==", true).get();
        liveProducts = [];
        categoryMap = { "Handmade": new Set(), "Customized": new Set() };
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>No products available.</p>";
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

            liveProducts.push(prod);
        });

        renderCategoryPills();
        renderHomeProducts(liveProducts);

        // URL চেক (যদি শেয়ারড লিঙ্ক থেকে ওপেন হয়ে থাকে)
        checkUrlProductParam();

    } catch (error) {
        console.error("Error fetching products:", error);
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

function renderHomeProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1; color:#7f8c8d; padding:25px;'>No products found.</p>";
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
                <img src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                <h3>${prod.name}</h3>
                
                <div class="card-rating-row">
                    <span>★ ${ratingVal}</span>
                    <span style="color:#7f8c8d; font-size:11px;">(${reviewNum})</span>
                </div>

                <p>₹${prod.price}</p>
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
        let price = parseInt(prod.price) || 0;
        if (budgetVal === "199") matchBudget = price <= 199;
        else if (budgetVal === "299") matchBudget = price <= 299;
        else if (budgetVal === "499") matchBudget = price <= 499;
        else if (budgetVal === "500plus") matchBudget = price >= 500;

        return matchName && matchMainCat && matchSubCat && matchBudget;
    });

    renderHomeProducts(filtered);
}

// ১-ক্লিক শেয়ার হ্যান্ডলার
function shareDirectProduct(productId, event) {
    if (event) event.stopPropagation();
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    let shareUrl = `${window.location.origin}/index.html?product=${productId}`;
    let shareText = `Check out this customized "${product.name}" on Custom Zone for just ₹${product.price}! 🎁✨\n${shareUrl}`;

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

// Flipkart / Amazon স্টাইল সিঙ্গেল প্রোডাক্ট ভিউ মডাল
function openProductDetailsModal(productId) {
    let product = liveProducts.find(p => p.id === productId);
    if (!product) return;

    currentOpenProductId = productId;
    const modal = document.getElementById('product-details-modal');
    const fallbackImg = "assets/images/logo.png";
    const images = product.images && product.images.length > 0 ? product.images : [fallbackImg];

    document.getElementById('pdm-main-img').src = images[0];
    document.getElementById('pdm-badge').innerText = `${product.mainCategory} • ${product.subCategory || 'Handmade'}`;
    document.getElementById('pdm-title').innerText = product.name;
    document.getElementById('pdm-price').innerText = product.price;

    let ratingVal = product.avgRating ? product.avgRating.toFixed(1) : "5.0";
    let reviewNum = product.reviewCount || 0;
    document.getElementById('pdm-overall-stars').innerText = `${ratingVal} ★`;
    document.getElementById('pdm-review-count').innerText = `(${reviewNum} customer reviews)`;

    const thumbsContainer = document.getElementById('pdm-thumbs');
    thumbsContainer.innerHTML = "";
    if (images.length > 1) {
        images.forEach(img => {
            thumbsContainer.innerHTML += `<img src="${img}" onerror="this.src='${fallbackImg}'" onclick="document.getElementById('pdm-main-img').src='${img}'">`;
        });
    }

    const customContainer = document.getElementById('pdm-custom-field-container');
    customContainer.innerHTML = "";
    if (product.customType === "name") {
        customContainer.innerHTML = `
            <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:5px; color:var(--midnight-plum);">Customize Text / Name to Print:</label>
            <input type="text" id="pdm-custom-input" placeholder="Enter name or date to engrave" style="width:100%; padding:9px; border:1px solid #fab1a0; border-radius:4px; box-sizing:border-box;">
        `;
    } else if (product.customType === "pic") {
        customContainer.innerHTML = `
            <p style="font-size:12px; color:#e74c3c; background:#fff5f5; padding:8px; border-radius:4px; border:1px dashed #e74c3c;">
                📷 Photo Customization: You can share your photos directly on WhatsApp after clicking checkout!
            </p>
        `;
    }

    document.getElementById('pdm-btn-add').onclick = () => {
        let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
        handleAddToCart(product.id, customVal);
        closeProductDetailsModal();
    };

    document.getElementById('pdm-btn-buy').onclick = () => {
        let customVal = document.getElementById('pdm-custom-input') ? document.getElementById('pdm-custom-input').value.trim() : "";
        handleAddToCart(product.id, customVal);
        window.location.href = "cart.html";
    };

    // নির্দিষ্ট প্রোডাক্টের কাস্টমার রিভিউ লোড করা
    loadProductSpecificReviews(productId);

    modal.classList.add('show-modal');
}

function closeProductDetailsModal() {
    document.getElementById('product-details-modal').classList.remove('show-modal');
    document.getElementById('product-write-review-box').style.display = "none";
}

// ইমেজ জুম লাইটবক্স
function zoomCurrentProductImage() {
    const currentSrc = document.getElementById('pdm-main-img').src;
    document.getElementById('modal-zoomed-img').src = currentSrc;
    document.getElementById('image-zoom-modal').classList.add('show-modal');
}

function closeImageZoomModal() {
    document.getElementById('image-zoom-modal').classList.remove('show-modal');
}

// প্রোডাক্ট স্পেসিফিক রিভিউ লোড
async function loadProductSpecificReviews(productId) {
    const container = document.getElementById('pdm-reviews-container');
    container.innerHTML = "<p style='text-align:center; color:#7f8c8d; font-size:12px;'>Loading reviews...</p>";

    try {
        const snapshot = await db.collection("reviews")
            .where("productId", "==", productId)
            .orderBy("timestamp", "desc")
            .get();

        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; color:#7f8c8d; font-size:12px;'>No reviews yet for this product. Be the first to leave one!</p>";
            return;
        }

        container.innerHTML = "";
        snapshot.forEach(doc => {
            let r = doc.data();
            let stars = "★".repeat(r.rating || 5) + "☆".repeat(5 - (r.rating || 5));
            let photoHtml = r.photoUrl ? `<img src="${r.photoUrl}" class="review-photo" onclick="zoomReviewImage('${r.photoUrl}')" alt="Customer Real Pic">` : "";

            container.innerHTML += `
                <div class="review-card-item">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:var(--midnight-plum); font-size:13px;">${r.customerName || 'Customer'}</strong>
                        <span style="color:#f39c12; font-size:12px;">${stars}</span>
                    </div>
                    <p style="margin:0; font-size:12px; color:#555;">${r.comment}</p>
                    ${photoHtml}
                    <div style="font-size:10px; color:#95a5a6; margin-top:5px;">${r.date || 'Recent'}</div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = "<p style='color:#7f8c8d; font-size:12px;'>Verified product rating: 5.0 ★</p>";
    }
}

function zoomReviewImage(url) {
    document.getElementById('modal-zoomed-img').src = url;
    document.getElementById('image-zoom-modal').classList.add('show-modal');
}

function toggleAddReviewForm() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) {
        openAuthModal();
        return;
    }
    const box = document.getElementById('product-write-review-box');
    box.style.display = box.style.display === "none" ? "block" : "none";
    setProductStarRating(5);
}

function setProductStarRating(stars) {
    selectedReviewStar = stars;
    const picker = document.getElementById('pdm-star-picker');
    let spans = picker.querySelectorAll('span');
    spans.forEach((s, idx) => {
        if (idx < stars) s.classList.add('active-star');
        else s.classList.remove('active-star');
    });
}

async function submitProductReviewCloud() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) { openAuthModal(); return; }

    const text = document.getElementById('pdm-review-text').value.trim();
    const photoUrl = document.getElementById('pdm-review-imgurl').value.trim();
    const btn = document.getElementById('btn-sub-prod-rev');

    if (!text) { alert("Please write a short review."); return; }

    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        await db.collection("reviews").add({
            productId: currentOpenProductId,
            customerName: customer.name || "Valued Customer",
            rating: selectedReviewStar,
            comment: text,
            photoUrl: photoUrl || "",
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("🎉 Thank you! Your review has been published.");
        document.getElementById('pdm-review-text').value = "";
        document.getElementById('pdm-review-imgurl').value = "";
        document.getElementById('product-write-review-box').style.display = "none";
        loadProductSpecificReviews(currentOpenProductId);
    } catch (e) {
        alert("Failed to submit review.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Review";
    }
}

function checkUrlProductParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const prodId = urlParams.get('product');
    if (prodId) {
        setTimeout(() => { openProductDetailsModal(prodId); }, 500);
    }
}

function handleAddToCart(productId, customText = "") {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) {
        pendingAction = { type: 'cart', id: productId, text: customText };
        openAuthModal();
        return;
    }

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
    alert(`✅ ${product.name} added to cart!`);
}

async function toggleWishlistCloud(productId) {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) {
        pendingAction = { type: 'wishlist', id: productId };
        openAuthModal();
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
            price: product.price,
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
    const nameField = document.getElementById('signup-name-field');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabSignup = document.getElementById('tab-btn-signup');
    const err = document.getElementById('auth-error-msg');

    err.style.display = "none";
    backToStepOne();

    if(mode === 'signup') {
        nameField.style.display = "block";
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
    } else {
        nameField.style.display = "none";
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
    }
}

function openAuthModal() {
    switchAuthForm('login');
    document.getElementById('auth-modal').classList.add('show-modal');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('show-modal');
}

function backToStepOne() {
    document.getElementById('auth-form-step-1').style.display = "block";
    document.getElementById('auth-form-step-2').style.display = "none";
    document.getElementById('auth-error-msg').style.display = "none";
    document.getElementById('entered-otp-input').value = "";
}

async function requestOtpAction() {
    const name = document.getElementById('auth-user-name').value.trim();
    const phone = document.getElementById('auth-user-phone').value.replace(/[^0-9]/g, '');
    const err = document.getElementById('auth-error-msg');
    const btn = document.getElementById('btn-request-otp');

    if(phone.length !== 10) {
        err.style.display = "block";
        err.innerText = "Please enter a valid 10-digit WhatsApp number.";
        return;
    }

    if(currentAuthMode === 'signup' && !name) {
        err.style.display = "block";
        err.innerText = "Please enter your Full Name.";
        return;
    }

    btn.disabled = true;
    btn.innerText = "Checking...";

    try {
        const userDoc = await db.collection("customers").doc(phone).get();

        if(currentAuthMode === 'login' && !userDoc.exists) {
            err.style.display = "block";
            err.innerText = "No account found! Please click 'Sign Up' tab to create one.";
            btn.disabled = false;
            btn.innerText = "Get Verification Code";
            return;
        }

        activeSessionOtp = Math.floor(1000 + Math.random() * 9000).toString();

        document.getElementById('hint-display-phone').innerText = "+91 " + phone;
        document.getElementById('hint-display-otp').innerText = activeSessionOtp;

        document.getElementById('auth-form-step-1').style.display = "none";
        document.getElementById('auth-form-step-2').style.display = "block";
        err.style.display = "none";

    } catch(e) {
        err.style.display = "block";
        err.innerText = "Connection error. Please try again.";
    } finally {
        btn.disabled = false;
        btn.innerText = "Get Verification Code";
    }
}

async function verifyAndAuthenticateUser() {
    const entered = document.getElementById('entered-otp-input').value.trim();
    const name = document.getElementById('auth-user-name').value.trim() || "Customer";
    const phone = document.getElementById('auth-user-phone').value.replace(/[^0-9]/g, '');
    const err = document.getElementById('auth-error-msg');
    const btn = document.getElementById('btn-submit-otp');

    if(entered !== activeSessionOtp) {
        err.style.display = "block";
        err.innerText = "❌ Incorrect 4-digit code.";
        return;
    }

    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
        const userDoc = await db.collection("customers").doc(phone).get();
        let customerData;

        if (userDoc.exists) {
            customerData = userDoc.data();
            await db.collection("customers").doc(phone).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            customerData = {
                name: name,
                phone: phone,
                wishlist: [],
                isActive: true,
                totalOrders: 0,
                joinedDate: new Date().toLocaleDateString('en-GB'),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection("customers").doc(phone).set(customerData);
        }

        localStorage.setItem('cz_customer_user', JSON.stringify(customerData));
        closeAuthModal();
        updateNavUserSlot();
        renderHomeProducts(liveProducts);
        alert(`🎉 Welcome ${customerData.name}! Logged in successfully.`);

        if (pendingAction) {
            if (pendingAction.type === 'cart') handleAddToCart(pendingAction.id, pendingAction.text || "");
            if (pendingAction.type === 'wishlist') toggleWishlistCloud(pendingAction.id);
            pendingAction = null;
        }
    } catch(e) {
        err.style.display = "block";
        err.innerText = "Error syncing with cloud.";
    } finally {
        btn.disabled = false;
        btn.innerText = "Verify & Proceed";
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