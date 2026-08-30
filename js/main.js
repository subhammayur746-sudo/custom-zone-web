let liveProducts = [];
let selectedMainCategory = "all";
let selectedSubCategory = "all";
let categoryMap = {};
let pendingAction = null;
let currentGeneratedOtp = null;

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
            <div class="product-card">
                <button class="wishlist-btn-heart ${isWishlisted ? 'active' : ''}" onclick="toggleWishlistCloud('${prod.id}')">
                    <i class="fas fa-heart"></i>
                </button>
                <img src="${mainImg}" onerror="this.src='${fallbackImg}'" alt="${prod.name}">
                <h3>${prod.name}</h3>
                <p>₹${prod.price}</p>
                <button class="btn-cart-action" onclick="handleAddToCart('${prod.id}')">
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

function handleAddToCart(productId) {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) {
        pendingAction = { type: 'cart', id: productId };
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
        userText: "" 
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

function openAuthModal() {
    resetOtpSteps();
    document.getElementById('auth-modal').classList.add('show-modal');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('show-modal');
}

function resetOtpSteps() {
    document.getElementById('otp-step-1').style.display = "block";
    document.getElementById('otp-step-2').style.display = "none";
    document.getElementById('auth-msg-display').style.display = "none";
    document.getElementById('auth-entered-otp').value = "";
}

// Step 1: Generate & Send OTP
function sendOtpStep() {
    const name = document.getElementById('auth-user-name').value.trim();
    const phone = document.getElementById('auth-user-phone').value.replace(/[^0-9]/g, '');
    const msg = document.getElementById('auth-msg-display');

    if (phone.length !== 10) {
        msg.style.display = "block";
        msg.style.color = "red";
        msg.innerText = "Please enter a valid 10-digit phone number.";
        return;
    }

    currentGeneratedOtp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP

    document.getElementById('hint-phone-number').innerText = "+91 " + phone;
    document.getElementById('generated-otp-code').innerText = currentGeneratedOtp;

    document.getElementById('otp-step-1').style.display = "none";
    document.getElementById('otp-step-2').style.display = "block";
    msg.style.display = "none";
}

// Step 2: Verify OTP & Sync Cloud
async function verifyOtpAndLogin() {
    const enteredOtp = document.getElementById('auth-entered-otp').value.trim();
    const name = document.getElementById('auth-user-name').value.trim() || "Customer";
    const phone = document.getElementById('auth-user-phone').value.replace(/[^0-9]/g, '');
    const msg = document.getElementById('auth-msg-display');
    const btn = document.getElementById('btn-verify-otp');

    if (enteredOtp !== currentGeneratedOtp) {
        msg.style.display = "block";
        msg.style.color = "red";
        msg.innerText = "❌ Incorrect verification code.";
        return;
    }

    btn.disabled = true;
    btn.innerText = "Signing in...";

    try {
        const userDoc = await db.collection("customers").doc(phone).get();
        let customerData;

        if (userDoc.exists) {
            customerData = userDoc.data();
            // নাম আপডেট হলে তা ক্লাউডে সেভ করা
            if (name !== "Customer" && customerData.name !== name) {
                customerData.name = name;
                await db.collection("customers").doc(phone).update({ name: name });
            }
            await db.collection("customers").doc(phone).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // নতুন কাস্টমার অ্যাকাউন্ট তৈরি
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
            if (pendingAction.type === 'cart') handleAddToCart(pendingAction.id);
            if (pendingAction.type === 'wishlist') toggleWishlistCloud(pendingAction.id);
            pendingAction = null;
        }
    } catch (e) {
        console.error(e);
        msg.style.display = "block";
        msg.style.color = "red";
        msg.innerText = "Error syncing with cloud.";
    } finally {
        btn.disabled = false;
        btn.innerText = "Verify & Access Account";
    }
}

function updateNavUserSlot() {
    const slot = document.getElementById('nav-user-slot');
    if (!slot) return;
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (customer) {
        slot.innerHTML = `<a href="profile.html"><i class="fas fa-user-circle"></i> ${customer.name.split(" ")[0]}</a>`;
    } else {
        slot.innerHTML = `<a href="javascript:void(0)" onclick="openAuthModal()"><i class="fas fa-user"></i> Login / Profile</a>`;
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