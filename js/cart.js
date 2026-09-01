let currentSubTotal = 0;
let currentDeliveryCharge = 0;
let appliedDiscount = 0;
let appliedCouponCode = "";
let currentTotal = 0;
let isGiftWrappingClaimed = false;
let fomoTimerInterval = null;
let flashBenefitName = "FREE Premium Gift Wrapping";
let selectedRating = 5;

// Dynamic Flash Offer / FOMO Timer
async function initDynamicFomoTimer() {
    const fomoContainer = document.getElementById('fomo-timer-container');
    const countdownEl = document.getElementById('fomo-countdown');
    const descEl = document.getElementById('fomo-desc');

    if (!fomoContainer) return;

    try {
        let flashData = { enabled: true, benefit: "FREE Premium Gift Wrapping!", duration: 5 };
        if (typeof db !== 'undefined') {
            const doc = await db.collection("settings").doc("flash_offer").get();
            if (doc.exists) {
                flashData = doc.data();
            }
        }

        if (flashData.enabled === false) {
            fomoContainer.style.display = "none";
            isGiftWrappingClaimed = false;
            return;
        }

        fomoContainer.style.display = "flex";
        flashBenefitName = flashData.benefit || "FREE Premium Gift Wrapping!";
        let durationMinutes = flashData.duration || 5;
        let durationSeconds = durationMinutes * 60;

        if (descEl) {
            descEl.innerHTML = `Order within ${durationMinutes} mins & get <strong>${flashBenefitName}!</strong> 🎁`;
        }

        isGiftWrappingClaimed = true;

        function updateTimer() {
            let minutes = parseInt(durationSeconds / 60, 10);
            let seconds = parseInt(durationSeconds % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            if (countdownEl) countdownEl.textContent = minutes + ":" + seconds;

            if (--durationSeconds < 0) {
                clearInterval(fomoTimerInterval);
                if (countdownEl) {
                    countdownEl.textContent = "EXPIRED";
                    countdownEl.style.background = "#7f8c8d";
                }
                if (descEl) descEl.innerHTML = "Flash offer ended. Standard packaging applies.";
                isGiftWrappingClaimed = false;
            }
        }

        updateTimer();
        fomoTimerInterval = setInterval(updateTimer, 1000);

    } catch (e) {
        console.log("Flash offer fallback error", e);
    }
}

// Render Cart Items with Image Thumbnails & Variants
function renderCart() {
    const container = document.getElementById('cart-items-container');
    const totalItemsEl = document.getElementById('total-items');
    const totalPriceEl = document.getElementById('total-price');
    const discountRow = document.getElementById('discount-row');
    const discountPriceEl = document.getElementById('discount-price');
    
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    let deliverySettings = JSON.parse(localStorage.getItem('cz_delivery_settings')) || { fee: 0, freeAbove: 0 };
    
    if(!container) return;
    container.innerHTML = "";
    currentSubTotal = 0;

    const fallbackImg = "assets/images/logo.png";

    if(cartItems.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:35px 20px; color:#4B5563;">
                <i class="fas fa-shopping-basket" style="font-size:45px; color:#28469E; margin-bottom:12px;"></i>
                <h3 style="color:#111827; margin-bottom:6px;">Your Cart is Empty!</h3>
                <p style="font-size:13px; margin-bottom:18px;">Explore our handcrafted & customized gifts and add your favorites.</p>
                <a href="index.html" style="background:#28469E; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:700; font-size:13px; display:inline-block;">Start Shopping</a>
            </div>
        `;
        if (totalItemsEl) totalItemsEl.innerText = "0";
        if (totalPriceEl) totalPriceEl.innerText = "0";
        if (discountRow) discountRow.style.display = "none";
        updateNavbarCartCount();
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;

    cartItems.forEach((item, index) => {
        let price = parseInt(item.price) || 0;
        currentSubTotal += price;
        let imgSrc = item.image && item.image.trim() !== "" ? item.image : fallbackImg;

        let variantBadge = item.variantName && item.variantName.trim() !== "" 
            ? `<span style="background:var(--blue-light); color:var(--blue-primary); font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--card-border); display:inline-block; margin-top:2px;">Option: ${item.variantName}</span>` 
            : "";

        let customHTML = "";
        let placeholderText = item.name.toLowerCase().includes("gift card") ? "Enter Recipient Name (কার জন্য গিফট কার্ড নিচ্ছেন)" : "Enter Name/Text to print";

        if(item.customType === "name") {
            let val = item.userText || "";
            customHTML = `<input type="text" placeholder="${placeholderText}" value="${val}" onchange="saveCustomData(${index}, 'text', this.value)" style="width: 100%; margin-top: 6px; padding: 6px 10px; border: 1px solid var(--card-border); border-radius: 4px; font-size: 12px;">`;
        } else if(item.customType === "pic") {
            customHTML = `<p style="font-size:11px; color:#d97706; margin-top:4px;">*Please send your photo on WhatsApp along with your order message.</p>`;
        }

        html += `
            <div class="cart-item-card">
                <img src="${imgSrc}" onerror="this.src='${fallbackImg}'" class="cart-item-img" alt="${item.name}">
                
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${item.name}</h4>
                    ${variantBadge}
                    ${customHTML}
                    <div class="cart-item-price">₹${price}</div>
                </div>

                <button class="cart-remove-btn" onclick="removeFromCart(${index})" title="Remove item">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Delivery Charge Calculation
    if (currentSubTotal === 0) {
        currentDeliveryCharge = 0;
    } else if (deliverySettings.freeAbove > 0 && currentSubTotal >= deliverySettings.freeAbove) {
        currentDeliveryCharge = 0; 
    } else {
        currentDeliveryCharge = deliverySettings.fee || 0;
    }

    currentTotal = Math.max(0, currentSubTotal + currentDeliveryCharge - appliedDiscount);

    if(cartItems.length > 0) {
        let deliveryText = currentDeliveryCharge === 0 ? '<span style="color:var(--success-green); font-weight:bold;">FREE</span>' : `₹${currentDeliveryCharge}`;
        container.innerHTML += `
            <div style="padding: 12px; background: var(--blue-light); border-radius: 8px; margin-top: 10px; border: 1px solid var(--card-border); text-align: right;">
                <p style="margin: 3px 0; color: var(--text-muted); font-size: 13px;">Subtotal: <strong style="color:var(--text-primary);">₹${currentSubTotal}</strong></p>
                <p style="margin: 3px 0; color: var(--text-muted); font-size: 13px;">Delivery Charge: <strong>${deliveryText}</strong></p>
            </div>
        `;
    }

    if(totalItemsEl) totalItemsEl.innerText = cartItems.length;
    if(discountRow) {
        if(appliedDiscount > 0) {
            discountRow.style.display = "flex";
            discountPriceEl.innerText = appliedDiscount;
        } else {
            discountRow.style.display = "none";
        }
    }
    if(totalPriceEl) totalPriceEl.innerText = currentTotal;

    updateNavbarCartCount();
}

function saveCustomData(index, type, value) {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    if(type === 'text') cartItems[index].userText = value;
    localStorage.setItem('cz_cart', JSON.stringify(cartItems));
}

function removeFromCart(index) {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    cartItems.splice(index, 1);
    localStorage.setItem('cz_cart', JSON.stringify(cartItems));
    renderCart();
}

function updateNavbarCartCount() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    const countEls = document.querySelectorAll('.cart-count');
    countEls.forEach(el => el.innerText = cartItems.length);
}

// Pincode Lookup
async function lookupPincode(pin) {
    const pinStr = pin.trim();
    const statusEl = document.getElementById('pin-status');
    const distInput = document.getElementById('cust-district');
    const poInput = document.getElementById('cust-postoffice');

    if (pinStr.length === 6) {
        if (statusEl) {
            statusEl.style.color = "#28469E";
            statusEl.innerText = "Finding District & Post Office...";
        }

        try {
            const res = await fetch(`https://api.postalpincode.in/pincode/${pinStr}`);
            const data = await res.json();

            if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const poList = data[0].PostOffice;
                const district = poList[0].District;
                
                if (distInput) distInput.value = district;
                if (poInput && !poInput.value) poInput.value = poList[0].Name;
                if (statusEl) {
                    statusEl.style.color = "var(--success-green)";
                    statusEl.innerText = `✓ Deliverable (${district}, ${poList[0].State})`;
                }
            } else {
                if (statusEl) {
                    statusEl.style.color = "#e67e22";
                    statusEl.innerText = "Please enter District & P.O. manually.";
                }
            }
        } catch (err) {
            console.error("PIN lookup error", err);
            if (statusEl) statusEl.innerText = "";
        }
    } else {
        if (statusEl) statusEl.innerText = "";
    }
}

// Load Store Offers
async function loadAvailableCoupons() {
    const badge = document.getElementById('available-coupons-badge');
    if(!badge) return;
    try {
        const snapshot = await db.collection("coupons").where("isActive", "==", true).get();
        if(snapshot.empty) {
            badge.style.display = "none";
            return;
        }
        let offers = [];
        snapshot.forEach(doc => {
            let c = doc.data();
            if(c.type !== 'referral' && c.type !== 'voucher' && !c.code.startsWith('GIFT-') && !c.code.startsWith('REF-')) {
                offers.push(`Use <strong>${c.code}</strong> (₹${c.discount} OFF on min ₹${c.minOrder || 0})`);
            }
        });

        if(offers.length > 0) {
            badge.innerHTML = `<i class="fas fa-gift" style="color: var(--success-green);"></i> Offers: ` + offers.join(" | ");
            badge.style.display = "block";
        } else {
            badge.style.display = "none";
        }
    } catch(e) {
        badge.style.display = "none";
    }
}

// Coupon / Referral / Gift Card Application
async function applyCoupon() {
    let rawCode = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msg = document.getElementById('coupon-msg');

    if(!rawCode) { alert("Please enter a coupon, gift card, or referral code."); return; }
    if(currentSubTotal === 0) { alert("Cart is empty."); return; }

    msg.style.display = "block";
    msg.style.color = "#28469E";
    msg.innerText = "Verifying code...";

    try {
        let doc = await db.collection("coupons").doc(rawCode).get();
        let targetCode = rawCode;

        if (!doc.exists && rawCode.startsWith("CZ")) {
            targetCode = "REF-" + rawCode;
            doc = await db.collection("coupons").doc(targetCode).get();
        }

        if (doc.exists && doc.data().isActive) {
            const coupon = doc.data();

            if(currentSubTotal < (coupon.minOrder || 0)) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ Requires a minimum order of ₹${coupon.minOrder}.`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            if(localStorage.getItem('cz_used_' + targetCode)) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ You have already used "${targetCode}" from this device.`;
                return;
            }

            appliedDiscount = parseInt(coupon.discount) || 0;
            appliedCouponCode = targetCode;
            msg.style.color = "var(--success-green)";
            
            let successLabel = coupon.type === 'voucher' ? '🎁 Gift Card' : 'Code';
            msg.innerText = `✅ ${successLabel} "${targetCode}" applied! You saved ₹${appliedDiscount}.`;
            renderCart();
            return;
        }

        let cleanOrderId = rawCode.replace("REF-", "");
        let orderDoc = await db.collection("orders").doc(cleanOrderId).get();

        if (orderDoc.exists) {
            let refCodeName = "REF-" + cleanOrderId;

            if(currentSubTotal < 199) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ Referral code requires a minimum order of ₹199.`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            if(localStorage.getItem('cz_used_' + refCodeName)) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ You have already used "${refCodeName}" from this device.`;
                return;
            }

            appliedDiscount = 50;
            appliedCouponCode = refCodeName;
            msg.style.color = "var(--success-green)";
            msg.innerText = `✅ Referral Code "${refCodeName}" applied! You saved ₹50.`;
            renderCart();
            return;
        }

        // Fallback preset
        if (rawCode === "FRIST10" || rawCode === "FIRST10") {
            appliedDiscount = 10;
            appliedCouponCode = rawCode;
            msg.style.color = "var(--success-green)";
            msg.innerText = `✅ Special offer applied! ₹10 Discount.`;
            renderCart();
            return;
        }

        msg.style.color = "var(--danger-red)";
        msg.innerText = "❌ Invalid or expired code.";
        appliedDiscount = 0;
        appliedCouponCode = "";
        renderCart();

    } catch(e) {
        console.error(e);
        msg.style.color = "var(--danger-red)";
        msg.innerText = "Error applying code.";
    }
}

// WhatsApp Order Submit with In-Page Success & Review Screen
async function submitOrderViaWhatsApp() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email') ? document.getElementById('cust-email').value.trim() : "N/A";
    const pin = document.getElementById('cust-pin').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const postOffice = document.getElementById('cust-postoffice').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    
    const greetingNote = document.getElementById('cust-greeting-note') ? document.getElementById('cust-greeting-note').value.trim() : "";
    const occasionType = document.getElementById('cust-occasion-type') ? document.getElementById('cust-occasion-type').value : "";
    const occasionDate = document.getElementById('cust-occasion-date') ? document.getElementById('cust-occasion-date').value : "";

    const myWhatsAppNumber = "916290407730"; 

    if (!name || !phone || !pin || !district || !postOffice || !address) { 
        alert("Please fill all required delivery details (*)."); 
        return; 
    }
    if (cartItems.length === 0) { alert("Your cart is empty."); return; }

    const internalOrderId = "CZ" + Math.floor(1000 + Math.random() * 9000);

    let productDetails = "";
    cartItems.forEach((item, idx) => {
        let varText = item.variantName ? ` (Option: ${item.variantName})` : "";
        let custData = item.userText ? ` [Custom: "${item.userText}"]` : (item.customType === "pic" ? " [Photo on WhatsApp]" : "");
        productDetails += `${idx + 1}. ${item.name}${varText} - ₹${item.price}${custData}\n`;
    });

    let deliveryTextMsg = currentDeliveryCharge === 0 ? "FREE" : `₹${currentDeliveryCharge}`;
    let couponTextMsg = appliedDiscount > 0 ? `\nCoupon/Gift Card Applied: ${appliedCouponCode} (-₹${appliedDiscount})` : "";
    let giftWrapTag = isGiftWrappingClaimed ? `\n🎁 Special Perk: ${flashBenefitName} (Claimed via Flash Timer)` : "";
    let greetingCardTag = greetingNote ? `\n💌 Handwritten Greeting Note: "${greetingNote}"` : "";
    let occasionMsg = (occasionType && occasionDate) ? `\n🎉 Special Occasion: ${occasionType} (${occasionDate})` : "";
    let fullDeliveryAddress = `${address}, P.O: ${postOffice}, District: ${district} - ${pin}`;

    let msg = `*#CZ_ORDER_REQUEST#*\n\n` +
              `Hello Custom Zone, I would like to place an order:\n\n` +
              `*Customer Details:*\n` +
              `Name: ${name}\n` +
              `Phone: ${phone}\n` +
              `Address: ${fullDeliveryAddress}\n\n` +
              `*Ordered Items:*\n` +
              `${productDetails}\n` +
              `Subtotal: ₹${currentSubTotal}\n` +
              `Delivery: ${deliveryTextMsg}${couponTextMsg}${giftWrapTag}${greetingCardTag}${occasionMsg}\n` +
              `*Total Payable: ₹${currentTotal}*\n\n` +
              `Please share your payment QR code to complete the order.`;

    const orderDate = new Date().toLocaleDateString('en-GB'); 
    
    const orderData = {
        status: "Payment Pending",
        customerName: name,
        phone: phone,
        email: email,
        postOffice: postOffice,
        district: district,
        pincode: pin,
        address: fullDeliveryAddress,
        subTotal: currentSubTotal,
        deliveryFee: currentDeliveryCharge,
        discountGiven: appliedDiscount,
        couponUsed: appliedCouponCode,
        freeGiftWrapping: isGiftWrappingClaimed,
        greetingNote: greetingNote || "",
        occasionType: occasionType || "",
        occasionDate: occasionDate || "",
        totalAmount: currentTotal,
        date: orderDate,
        items: productDetails + `\n[Delivery: ${deliveryTextMsg}]${couponTextMsg}${giftWrapTag}${greetingCardTag}${occasionMsg}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection("orders").doc(internalOrderId).set(orderData);
        
        if(appliedCouponCode) {
            localStorage.setItem('cz_used_' + appliedCouponCode, 'true');
            if(appliedCouponCode.startsWith('GIFT-')) {
                await db.collection("coupons").doc(appliedCouponCode).update({
                    isActive: false,
                    isUsed: true,
                    usedByOrder: internalOrderId,
                    usedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    } catch (error) {
        console.error("Order sync error", error);
    }

    // Open WhatsApp in a new tab without reloading this page
    const waUrl = `https://api.whatsapp.com/send?phone=${myWhatsAppNumber}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
    
    // Clear Cart
    localStorage.removeItem('cz_cart');
    updateNavbarCartCount();

    // Show Beautiful Order Success Screen inside the Cart Layout
    const cartLayout = document.querySelector('.cart-layout');
    if (cartLayout) {
        cartLayout.innerHTML = `
            <div style="background: var(--white); padding: 40px 25px; border-radius: 12px; width: 100%; box-shadow: var(--shadow-soft); text-align: center; border: 1px solid var(--card-border);">
                <i class="fab fa-whatsapp" style="font-size: 60px; color: var(--success-green);"></i>
                <h2 style="color: var(--blue-primary); margin-top: 15px; font-weight: 800;">Order Request Sent to WhatsApp!</h2>
                <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.6;">
                    Order Reference ID: <strong style="color:var(--blue-primary); font-size:16px;">#${internalOrderId}</strong><br>
                    We have received your order request on WhatsApp. Please complete your payment verification on WhatsApp to confirm your order dispatch.
                </p>

                <!-- Feedback Rating Box -->
                <div style="background: var(--blue-light); border: 1px solid var(--card-border); padding: 20px; border-radius: 8px; max-width: 480px; margin: 0 auto 25px auto;">
                    <h3 style="color: var(--blue-primary); margin-bottom: 5px; font-size: 16px;">Rate Your Experience ⭐</h3>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 10px;">Leave a review for Custom Zone!</p>
                    <div style="font-size: 28px; cursor: pointer; color: #f1c40f; margin-bottom: 10px;" id="star-rating-box">
                        <span onclick="setRating(1)">★</span><span onclick="setRating(2)">★</span><span onclick="setRating(3)">★</span><span onclick="setRating(4)">★</span><span onclick="setRating(5)">★</span>
                    </div>
                    <textarea id="review-comment" placeholder="Write your valuable feedback..." style="width: 100%; padding: 10px; border: 1px solid var(--card-border); border-radius: 6px; box-sizing: border-box; background:#fff; font-family:inherit; font-size:13px;"></textarea><br>
                    <button onclick="submitReviewCloud('${name}', '${cartItems[0] ? cartItems[0].id : ''}')" id="btn-review" style="background: var(--success-green); color: white; border: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; font-size:13px;">Submit Review</button>
                    <p id="review-status" style="margin-top: 8px; font-weight: bold; font-size:13px; display: none;"></p>
                </div>

                <a href="index.html" style="background: var(--blue-primary); color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size:14px; display:inline-block;">Continue Shopping</a>
            </div>
        `;
    }
}

function setRating(stars) {
    selectedRating = stars;
    const starBox = document.getElementById('star-rating-box');
    if (!starBox) return;
    let starHTML = "";
    for(let i=1; i<=5; i++) {
        starHTML += `<span onclick="setRating(${i})" style="color: ${i <= stars ? '#f1c40f' : '#ccc'};">★</span>`;
    }
    starBox.innerHTML = starHTML;
}

async function submitReviewCloud(customerName, productId = "") {
    const comment = document.getElementById('review-comment').value.trim();
    const status = document.getElementById('review-status');
    const btn = document.getElementById('btn-review');

    if(!comment) {
        alert("Please write a short review before submitting!"); 
        return;
    }

    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        await db.collection("reviews").add({
            productId: productId || "",
            customerName: customerName,
            rating: selectedRating,
            comment: comment,
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        status.style.display = "block";
        status.style.color = "var(--success-green)";
        status.innerText = "🎉 Review submitted successfully!";
        document.getElementById('review-comment').value = "";
    } catch(e) {
        console.error(e);
        status.style.display = "block";
        status.style.color = "var(--danger-red)";
        status.innerText = "Failed to submit review.";
    } finally {
        btn.disabled = false;
        btn.innerText = "Submitted";
    }
}

window.addEventListener('DOMContentLoaded', () => {
    renderCart();
    loadAvailableCoupons();
    initDynamicFomoTimer();
});