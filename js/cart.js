let currentSubTotal = 0;
let currentDeliveryCharge = 0;
let appliedDiscount = 0;
let appliedCouponCode = "";
let currentTotal = 0;
let isGiftWrappingClaimed = false;
let fomoTimerInterval = null;
let flashBenefitName = "FREE Premium Gift Wrapping";

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

// Load Active Coupons into Cart Offers Banner
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
            let codeName = c.code || doc.id;
            let discountVal = c.discountAmount || c.discount || 0;
            if(c.type !== 'referral' && c.type !== 'voucher' && !codeName.startsWith('GIFT-') && !codeName.startsWith('REF-')) {
                offers.push(`Use <strong>${codeName}</strong> (₹${discountVal} OFF on min ₹${c.minOrder || 0})`);
            }
        });

        if(offers.length > 0) {
            badge.innerHTML = `<i class="fas fa-gift" style="color: var(--success-green);"></i> Store Offers: ` + offers.join(" | ");
            badge.style.display = "block";
        } else {
            badge.style.display = "none";
        }
    } catch(e) {
        console.error("Coupons load error", e);
        badge.style.display = "none";
    }
}

// Auto-fill saved customer address
function autoFillCustomerAddress() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) return;

    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const addressInput = document.getElementById('cust-address');

    if (nameInput && customer.name) nameInput.value = customer.name;
    if (phoneInput && customer.phone) phoneInput.value = customer.phone;
    if (addressInput && customer.savedAddress) addressInput.value = customer.savedAddress;
}

// Render Cart Items
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
                    <div class="cart-item-price">₹${price} (Qty: ${item.quantity || 1})</div>
                </div>

                <button class="cart-remove-btn" onclick="removeFromCart(${index})" title="Remove item">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

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

// Coupon / Gift Card Verification
async function applyCoupon() {
    let rawCode = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msg = document.getElementById('coupon-msg');

    if(!rawCode) { alert("Please enter a coupon code."); return; }
    if(currentSubTotal === 0) { alert("Cart is empty."); return; }

    msg.style.display = "block";
    msg.style.color = "#28469E";
    msg.innerText = "Verifying code...";

    try {
        let doc = await db.collection("coupons").doc(rawCode).get();
        if (doc.exists && doc.data().isActive !== false) {
            const coupon = doc.data();
            if(currentSubTotal < (coupon.minOrder || 0)) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ Requires a minimum order of ₹${coupon.minOrder}.`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            appliedDiscount = parseInt(coupon.discountAmount || coupon.discount) || 0;
            appliedCouponCode = rawCode;
            msg.style.color = "var(--success-green)";
            msg.innerText = `✅ Code "${rawCode}" applied! You saved ₹${appliedDiscount}.`;
            renderCart();
            return;
        }

        if (rawCode === "FIRST10" || rawCode === "FRIST10") {
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
        msg.style.color = "var(--danger-red)";
        msg.innerText = "Error applying code.";
    }
}

// PAYMENT-FIRST SYSTEM: Place Order creates Temporary Payment Reference (NO Final Order ID generated)
async function submitOrderViaWhatsApp() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));

    if (!customer) {
        alert("Please sign in or create an account before placing your order.");
        window.location.href = "index.html";
        return;
    }

    if (cartItems.length === 0) {
        alert("Your shopping cart is empty.");
        return;
    }

    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const pin = document.getElementById('cust-pin').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const postOffice = document.getElementById('cust-postoffice').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const greeting = document.getElementById('cust-greeting-note')?.value.trim() || '';

    if (!name || !phone || !pin || !district || !postOffice || !address) { 
        alert("Please fill all required delivery details (*)."); 
        return; 
    }

    const btn = document.querySelector('.checkout-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Creating Payment Order Request...";
    }

    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    const paymentReference = `CZ-PAY-${randomHex}`;

    let fullDeliveryAddress = `${address}, P.O: ${postOffice}, ${district} - ${pin}`;

    const pendingPaymentRecord = {
        paymentReference: paymentReference,
        customerId: customer.customerId || "N/A",
        customerName: name,
        phone: phone,
        items: cartItems,
        subTotal: currentSubTotal,
        deliveryFee: currentDeliveryCharge,
        discountGiven: appliedDiscount,
        couponUsed: appliedCouponCode || "None",
        totalAmount: currentTotal,
        actualDeliveryAddress: fullDeliveryAddress,
        greetingNote: greeting,
        paymentStatus: "Pending",
        orderStatus: "Payment Pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        date: new Date().toLocaleDateString('en-GB')
    };

    try {
        await db.collection("pending_payments").doc(paymentReference).set(pendingPaymentRecord);

        if (address && customer.savedAddress !== fullDeliveryAddress) {
            customer.savedAddress = fullDeliveryAddress;
            localStorage.setItem('cz_customer_user', JSON.stringify(customer));
            await db.collection("customers").doc(customer.phone).update({ savedAddress: fullDeliveryAddress });
        }

        localStorage.removeItem('cz_cart');
        updateNavbarCartCount();

        renderPaymentGateScreen(paymentReference, currentTotal, name, phone);

    } catch (err) {
        console.error(err);
        alert("Server error creating payment order. Please try again.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Place Order";
        }
    }
}

function renderPaymentGateScreen(paymentRef, amount, customerName, phone) {
    const container = document.querySelector('.cart-layout');
    if (!container) return;

    const configuredWhatsApp = "916290407730";
    const waPaymentText = `Hello Custom Zone,\nI have completed the payment.\nPayment Reference: ${paymentRef}\nCustomer: ${customerName}\nAmount: ₹${amount}`;
    const waUrl = `https://api.whatsapp.com/send?phone=${configuredWhatsApp}&text=${encodeURIComponent(waPaymentText)}`;

    container.innerHTML = `
        <div style="background:var(--white); padding:35px 25px; border-radius:12px; width:100%; box-shadow:var(--shadow-soft); text-align:center; border:1px solid var(--card-border);">
            <div style="background:var(--blue-light); display:inline-block; padding:8px 16px; border-radius:20px; color:var(--blue-primary); font-weight:700; font-size:13px; margin-bottom:15px; border:1px solid var(--card-border);">
                Payment Reference: ${paymentRef}
            </div>
            <h2 style="color:var(--text-primary); margin:0 0 10px 0; font-weight:800;">Order Request Created</h2>
            <p style="color:var(--text-muted); font-size:14px; margin-bottom:15px;">Please scan the QR code below and complete your payment.</p>
            
            <div style="font-size:28px; font-weight:800; color:var(--blue-primary); margin-bottom:20px;">
                Amount to Pay: ₹${amount}
            </div>

            <div style="margin:0 auto 20px auto; max-width:240px; padding:12px; border:2px dashed var(--blue-primary); border-radius:12px; background:#FFFFFF;">
                <img src="assets/images/payment-qr.png" onerror="this.src='assets/images/logo.png'" alt="Payment QR" style="width:100%; border-radius:8px; display:block;">
                <small style="color:var(--text-muted); font-weight:600; display:block; margin-top:8px;">UPI / GPay / PhonePe / Paytm</small>
            </div>

            <div style="max-width:440px; margin:0 auto 20px auto;">
                <a href="${waUrl}" target="_blank" style="background:var(--success-green); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 20px; border-radius:8px; font-weight:700; font-size:14px; text-decoration:none;">
                    <i class="fab fa-whatsapp" style="font-size:20px;"></i> Send Payment Confirmation on WhatsApp
                </a>
            </div>

            <div style="background:#FFFBEB; border:1px solid #FCD34D; padding:14px; border-radius:8px; max-width:520px; margin:0 auto; font-size:12px; color:#92400E; text-align:left; line-height:1.5;">
                <strong>⚠️ Strict Business Rule Notice:</strong><br>
                Your official <strong>Final Order ID</strong> will be generated automatically once our admin team verifies your payment screenshot. You can view your Payment Pending request inside your <a href="profile.html" style="color:#28469E; font-weight:bold;">Profile Page</a>.
            </div>
        </div>
    `;
}

window.addEventListener('DOMContentLoaded', () => {
    renderCart();
    autoFillCustomerAddress();
    loadAvailableCoupons();
    initDynamicFomoTimer();
});