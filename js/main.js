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
            
            let images = prod.images && prod.images.length > 0 ? prod.images : ['https://via.placeholder.com/300'];
            let mainImg = images[0];

            let thumbnailsHTML = "";
            if (images.length > 1) {
                thumbnailsHTML = `<div class="product-thumb-gallery" style="display:flex; gap:6px; justify-content:center; margin-bottom:10px; overflow-x:auto;">`;
                images.forEach((img) => {
                    thumbnailsHTML += `<img src="${img}" onclick="changeCardMainImg('${prod.id}', '${img}')" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #ddd; cursor:pointer;">`;
                });
                thumbnailsHTML += `</div>`;
            }
            
            container.innerHTML += `
                <div class="product-card">
                    <div style="position:relative; cursor:zoom-in;" onclick="openImageZoom('${mainImg}')">
                        <img id="main-img-${prod.id}" src="${mainImg}" alt="${prod.name}">
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
    } catch (error) {
        console.error("Error fetching products:", error);
        container.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Failed to load products.</p>";
    }
}

// থাম্বনেইল ক্লিক করে কার্ডের মেইন ছবি পরিবর্তন
function changeCardMainImg(prodId, imgSrc) {
    const mainImgEl = document.getElementById(`main-img-${prodId}`);
    if(mainImgEl) {
        mainImgEl.src = imgSrc;
        mainImgEl.parentElement.setAttribute('onclick', `openImageZoom('${imgSrc}')`);
    }
}

// জুম লাইটবক্স ওপেন
function openImageZoom(imgSrc) {
    let modal = document.getElementById('cz-zoom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cz-zoom-modal';
        modal.style.cssText = "display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:999999; justify-content:center; align-items:center; cursor:zoom-out;";
        modal.innerHTML = `
            <span style="position:absolute; top:15px; right:25px; color:#fff; font-size:35px; font-weight:bold; cursor:pointer;">&times;</span>
            <img id="cz-zoom-img" src="" style="max-width:90%; max-height:85vh; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5); object-fit:contain;">
        `;
        modal.onclick = () => modal.style.display = "none";
        document.body.appendChild(modal);
    }
    document.getElementById('cz-zoom-img').src = imgSrc;
    modal.style.display = "flex";
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

// হোমপেজে প্রমো পপ-আপ
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
    const local = JSON.parse(localStorage.getItem('cz_promo_settings'));
    if (local && local.enabled) {
        displayPopup(local);
        return;
    }

    try {
        if (typeof db !== 'undefined') {
            db.collection("settings").doc("promo").get().then(doc => {
                if (doc.exists) {
                    displayPopup(doc.data());
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