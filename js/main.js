let liveProducts = [];

// ফায়ারবেস থেকে প্রোডাক্ট লোড
async function fetchLiveProducts() {
    const container = document.getElementById('product-list'); 
    if (!container) return;
    
    container.innerHTML = "<p style='text-align:center; width:100%; color:#7f8c8d; grid-column: 1/-1;'><i class='fas fa-spinner fa-spin'></i> Loading awesome products...</p>";
    
    try {
        const snapshot = await db.collection("products").where("isActive", "==", true).get();
        liveProducts = [];
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1/-1;'>No products available right now.</p>";
            return;
        }

        snapshot.forEach(doc => {
            let prod = doc.data();
            prod.id = doc.id;
            liveProducts.push(prod);
            
            let imgSrc = prod.images && prod.images.length > 0 ? prod.images[0] : 'https://via.placeholder.com/300';
            
            container.innerHTML += `
                <div class="product-card">
                    <img src="${imgSrc}" alt="${prod.name}">
                    <h3>${prod.name}</h3>
                    <p>₹${prod.price}</p>
                    <button onclick="addToCart('${prod.id}')">
                        <i class="fas fa-shopping-cart"></i> Add to Cart
                    </button>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        container.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Failed to load products. Check your internet connection.</p>";
    }
}

// কার্ট হ্যান্ডলার
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

// হোমপেজে পপ-আপ দেখানোর লজিক
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
        if (data.imageUrl) {
            imgEl.src = data.imageUrl;
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
    // ১. লোকাল স্টোরেজ থেকে পড়া (ইনস্ট্যান্ট ব্যাকআপ)
    const local = JSON.parse(localStorage.getItem('cz_promo_settings'));
    if (local && local.enabled) {
        displayPopup(local);
        return;
    }

    // ২. ফায়ারবেস ক্লাউড থেকে পড়া
    try {
        if (typeof db !== 'undefined') {
            db.collection("settings").doc("promo").get().then(doc => {
                if (doc.exists) {
                    displayPopup(doc.data());
                }
            });
        }
    } catch (e) {
        console.log("Promo cloud fetch error", e);
    }
}

function closePopup() {
    const popup = document.getElementById('promo-popup');
    if (popup) {
        popup.classList.remove('show-popup');
    }
}

// উইন্ডো লোড
window.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    fetchLiveProducts();
    checkPromoPopup();
});