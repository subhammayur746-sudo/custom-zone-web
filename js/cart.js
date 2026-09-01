let cart = JSON.parse(localStorage.getItem('cz_cart')) || [];
let appliedDiscount = 0;
let appliedCouponCode = "";
let countdownSeconds = 300; // 5 mins FOMO timer

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const totalItemsEl = document.getElementById('total-items');
    const totalPriceEl = document.getElementById('total-price');
    const discountRow = document.getElementById('discount-row');
    const discountPriceEl = document.getElementById('discount-price');

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#4B5563;">
                <i class="fas fa-shopping-basket" style="font-size:45px; color:#28469E; margin-bottom:12px;"></i>
                <h3 style="color:#111827; margin-bottom:6px;">Your Cart is Empty!</h3>
                <p style="font-size:13px; margin-bottom:18px;">Explore our handcrafted & customized gifts and add your favorites.</p>
                <a href="index.html" style="background:#28469E; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:700; font-size:13px; display:inline-block;">Start Shopping</a>
            </div>
        `;
        if (totalItemsEl) totalItemsEl.innerText = "0";
        if (totalPriceEl) totalPriceEl.innerText = "0";
        if (discountRow) discountRow.style.display = "none";
        return;
    }

    let subtotal = 0;
    let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;

    const fallbackImg = "assets/images/logo.png";

    cart.forEach((item, index) => {
        let price = parseInt(item.price) || 0;
        subtotal += price;
        let imgSrc = item.image && item.image.trim() !== "" ? item.image : fallbackImg;

        let variantBadge = item.variantName && item.variantName.trim() !== "" 
            ? `<span style="background:var(--blue-light); color:var(--blue-primary); font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--card-border); display:inline-block; margin-top:2px;">Option: ${item.variantName}</span>` 
            : "";

        let customNote = item.userText && item.userText.trim() !== "" 
            ? `<p style="margin:4px 0 0 0; font-size:12px; color:#d97706; background:#fffdfa; padding:3px 8px; border-radius:4px; border:1px dashed #fcd34d;">Custom Text: <strong>"${item.userText}"</strong></p>` 
            : "";

        html += `
            <div class="cart-item-card">
                <img src="${imgSrc}" onerror="this.src='${fallbackImg}'" class="cart-item-img" alt="${item.name}">
                
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${item.name}</h4>
                    ${variantBadge}
                    ${customNote}
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

    let payableTotal = Math.max(0, subtotal - appliedDiscount);

    if (totalItemsEl) totalItemsEl.innerText = cart.length;
    if (totalPriceEl) totalPriceEl.innerText = payableTotal;

    if (appliedDiscount > 0 && discountRow && discountPriceEl) {
        discountRow.style.display = "flex";
        discountPriceEl.innerText = appliedDiscount;
    } else if (discountRow) {
        discountRow.style.display = "none";
    }

    updateNavbarCartCount();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cz_cart', JSON.stringify(cart));
    renderCartItems();
}

function updateNavbarCartCount() {
    const countEls = document.querySelectorAll('.cart-count');
    countEls.forEach(el => el.innerText = cart.length);
}

// FOMO Countdown Timer
function startFomoTimer() {
    const countdownEl = document.getElementById('fomo-countdown');
    if (!countdownEl) return;

    const timer = setInterval(() => {
        let minutes = Math.floor(countdownSeconds / 60);
        let seconds = countdownSeconds % 60;
        countdownEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (countdownSeconds <= 0) {
            clearInterval(timer);
            countdownEl.innerText = "EXPIRED";
        } else {
            countdownSeconds--;
        }
    }, 1000);
}

// Pincode Lookup (Postal API)
async function lookupPincode(pin) {
    const statusEl = document.getElementById('pin-status');
    const districtInput = document.getElementById('cust-district');
    const poInput = document.getElementById('cust-postoffice');

    if (pin.length !== 6) {
        if (statusEl) statusEl.innerText = "";
        return;
    }

    if (statusEl) {
        statusEl.style.color = "#28469E";
        statusEl.innerText = "Checking delivery PIN...";
    }

    try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await response.json();

        if (data[0].Status === "Success") {
            const poData = data[0].PostOffice[0];
            if (districtInput) districtInput.value = poData.District || "";
            if (poInput && !poInput.value) poInput.value = poData.Name || "";

            if (statusEl) {
                statusEl.style.color = "var(--success-green)";
                statusEl.innerText = `✓ Deliverable (${poData.District}, ${poData.State})`;
            }
        } else {
            if (statusEl) {
                statusEl.style.color = "var(--danger-red)";
                statusEl.innerText = "Invalid PIN code. Please check.";
            }
        }
    } catch (e) {
        if (statusEl) statusEl.innerText = "";
    }
}

// Coupon Logic
async function applyCoupon() {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-msg');
    const code = input ? input.value.trim().toUpperCase() : "";

    if (!code) return;
    if (cart.length === 0) { alert("Cart is empty."); return; }

    msg.style.display = "block";
    msg.style.color = "#28469E";
    msg.innerText = "Verifying coupon...";

    try {
        const doc = await db.collection("coupons").doc(code).get();
        if (doc.exists && doc.data().isActive !== false) {
            const data = doc.data();
            appliedDiscount = parseInt(data.discountAmount) || 0;
            appliedCouponCode = code;
            msg.style.color = "var(--success-green)";
            msg.innerText = `✅ Coupon '${code}' applied! You saved ₹${appliedDiscount}`;
            renderCartItems();
        } else {
            if (code === "FRIST10" || code === "FIRST10") {
                appliedDiscount = 10;
                appliedCouponCode = code;
                msg.style.color = "var(--success-green)";
                msg.innerText = `✅ Special offer applied! ₹10 Discount.`;
                renderCartItems();
            } else {
                appliedDiscount = 0;
                msg.style.color = "var(--danger-red)";
                msg.innerText = "❌ Invalid or expired coupon code.";
                renderCartItems();
            }
        }
    } catch (e) {
        msg.style.color = "var(--danger-red)";
        msg.innerText = "Error applying coupon.";
    }
}

// WhatsApp Order Submit
async function submitOrderViaWhatsApp() {
    if (cart.length === 0) {
        alert("Your cart is empty! Please add products before checking out.");
        return;
    }

    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const pin = document.getElementById('cust-pin').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const po = document.getElementById('cust-postoffice').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const greeting = document.getElementById('cust-greeting-note').value.trim();
    const occType = document.getElementById('cust-occasion-type').value;
    const occDate = document.getElementById('cust-occasion-date').value;

    if (!name || !phone || !pin || !address || !po) {
        alert("Please fill in all mandatory delivery fields (*).");
        return;
    }

    let subtotal = cart.reduce((sum, item) => sum + (parseInt(item.price) || 0), 0);
    let finalAmount = Math.max(0, subtotal - appliedDiscount);
    let orderId = "CZ" + Math.floor(1000 + Math.random() * 9000);

    let itemsSummary = cart.map((item, idx) => {
        let varText = item.variantName ? ` (Option: ${item.variantName})` : "";
        let custText = item.userText ? ` [Custom: "${item.userText}"]` : "";
        return `${idx + 1}. ${item.name}${varText} - ₹${item.price}${custText}`;
    }).join("\n");

    const orderData = {
        orderId: orderId,
        customerName: name,
        phone: phone,
        items: itemsSummary,
        subtotal: subtotal,
        discount: appliedDiscount,
        couponCode: appliedCouponCode || "None",
        totalAmount: finalAmount,
        pincode: pin,
        district: district,
        postOffice: po,
        address: address,
        greetingCardNote: greeting || "None",
        occasionType: occType || "None",
        occasionDate: occDate || "",
        status: "Processing",
        date: new Date().toLocaleDateString('en-GB'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("orders").doc(orderId).set(orderData);
    } catch (e) {
        console.error("Order cloud sync error", e);
    }

    // WhatsApp Message Format
    let waMsg = `*🛍️ NEW ORDER REQUEST - CUSTOM ZONE*\n` +
                `--------------------------------------\n` +
                `*Order ID:* #${orderId}\n` +
                `*Customer:* ${name}\n` +
                `*Phone:* ${phone}\n\n` +
                `*📦 Ordered Items:*\n${itemsSummary}\n\n` +
                `*Subtotal:* ₹${subtotal}\n` +
                (appliedDiscount > 0 ? `*Discount:* -₹${appliedDiscount} (${appliedCouponCode})\n` : "") +
                `*Payable Total:* ₹${finalAmount}\n\n` +
                `*📍 Delivery Address:*\n${address}, P.O: ${po}, ${district} - ${pin}\n` +
                (greeting ? `\n*💌 Gift Card Note:* "${greeting}"\n` : "") +
                `--------------------------------------\n` +
                `Please confirm and proceed with my custom order! ❤️`;

    localStorage.removeItem('cz_cart');
    const waUrl = `https://api.whatsapp.com/send?phone=916290407730&text=${encodeURIComponent(waMsg)}`;
    window.location.href = waUrl;
}

window.addEventListener('DOMContentLoaded', () => {
    renderCartItems();
    startFomoTimer();
});