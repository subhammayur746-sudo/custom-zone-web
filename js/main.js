let liveProducts = [];
let selectedMainCategory = "all";
let selectedSubCategory = "all";
let categoryMap = {};
let pendingAction = null;
let currentAuthMode = "login"; // 'login' or 'signup'
let activeSessionOtp = null;

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

        renderCategorySubnav();
        renderHomeProducts(liveProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

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

        container.innerHTML += `
            <div class="product-card" onclick="openProductDetailsModal('${prod.id}')">
                <button class="wishlist-btn-heart ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlistCloud('${prod.id}')">
                    <i class="fas fa-heart"></i>
                </button>
                <img src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                <h3>${prod.name}</h3>
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

// Flipkart / Amazon স্টাইল সিঙ্গেল প্রোডাক্ট ভিউ মডাল
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

    modal.classList.add('show-modal');
}

function closeProductDetailsModal() {
    document.getElementById('product-details-modal').classList.remove('show-modal');
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

// প্রফেশনাল Login vs Sign Up সুইচিং
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

// ওটিপি জেনারেট ও রিকুয়েস্ট
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

// ওটিপি যাচাই ও অ্যাকাউন্ট লগইন/রেজিস্ট্রেশন
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
    const slot = document.getElementById('nav-user-slot');
    if (!slot) return;
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (customer) {
        slot.innerHTML = `<a href="profile.html"><i class="fas fa-user-circle"></i> ${customer.name.split(" ")[0]}</a>`;
    } else {
        slot.innerHTML = `<a href="javascript:void(0)" onclick="openAuthModal()"><i class="fas fa-user"></i> Login / Sign Up</a>`;
    }
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