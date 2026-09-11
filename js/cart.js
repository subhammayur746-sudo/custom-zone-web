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
            if (doc.exists) flashData = doc.data();
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

    } catch (e) {}
}

async function loadAvailableCoupons() {
    const badge = document.getElementById('available-coupons-badge');
    if(!badge) return;
    try {
        const snapshot = await db.collection("coupons").where("isActive", "==", true).get();
        if(snapshot.empty) { badge.style.display = "none"; return; }
        let offers = [];
        snapshot.forEach(doc => {
            let c = doc.data();
            let codeName = c.code || doc.id;
            let discountVal = c.discountAmount !== undefined ? c.discountAmount : (c.discount || 0);
            let minOrdVal = c.minOrderAmount !== undefined ? c.minOrderAmount : (c.minOrder || 0);

            if(c.type !== 'referral' && c.type !== 'gift_card' && !codeName.startsWith('GIFT-') && !codeName.startsWith('REF-')) {
                offers.push(`Use <strong>${codeName}</strong> (₹${discountVal} OFF on min ₹${minOrdVal})`);
            }
        });

        if(offers.length > 0) {
            badge.innerHTML = `<i class="fas fa-gift" style="color: var(--success-green);"></i> Store Offers: ` + offers.join(" | ");
            badge.style.display = "block";
        } else {
            badge.style.display = "none";
        }
    } catch(e) { badge.style.display = "none"; }
}

function autoFillCustomerAddress() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) return;

    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const pinInput = document.getElementById('cust-pin');
    const districtInput = document.getElementById('cust-district');
    const poInput = document.getElementById('cust-postoffice');
    const addressInput = document.getElementById('cust-address');

    if (nameInput && customer.name) nameInput.value = customer.name;
    if (phoneInput && customer.phone) phoneInput.value = customer.phone;

    if (customer.pin && pinInput) pinInput.value = customer.pin;
    if (customer.district && districtInput) districtInput.value = customer.district;
    if (customer.postOffice && poInput) poInput.value = customer.postOffice;
    
    if (addressInput) {
        addressInput.value = customer.flatAddress || customer.savedAddress || "";
    }

    if ((!customer.pin || !customer.district) && customer.savedAddress) {
        try {
            let raw = customer.savedAddress;
            let pinMatch = raw.match(/\b\d{6}\b/);
            if (pinMatch && pinInput && !pinInput.value) pinInput.value = pinMatch[0];

            let poMatch = raw.match(/P\.O\s*:\s*([^,]+)/i);
            if (poMatch && poInput && !poInput.value) poInput.value = poMatch[1].trim();

            let distMatch = raw.match(/,\s*([^,-]+)\s*-\s*\d{6}/);
            if (distMatch && districtInput && !districtInput.value) districtInput.value = distMatch[1].trim();

            let cleanStreet = raw.split(/,\s*P\.O/i)[0];
            if (addressInput) addressInput.value = customer.flatAddress || cleanStreet || raw;
        } catch(e) {}
    }
}

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
                <p style="font-size:13px; margin-bottom:18px;">Explore our handcrafted gifts and customized keepsakes.</p>
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
            ? `<span style="background:var(--blue-light); color:var(--blue-primary); font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--card-border); display:inline-block; margin-top:2px;">${item.variantName}</span>` 
            : "";

        let customHTML = "";
        let placeholderText = item.name.toLowerCase().includes("gift card") ? "Enter Recipient Name / Phone" : "Enter Name / Text to print";

        if(item.customType === "name" || item.name.toLowerCase().includes("gift card")) {
            let val = item.userText || "";
            customHTML = `<input type="text" placeholder="${placeholderText}" value="${val}" onchange="saveCustomData(${index}, 'text', this.value)" style="width: 100%; margin-top: 6px; padding: 6px 10px; border: 1px solid var(--card-border); border-radius: 4px; font-size: 12px;">`;
        } else if(item.customType === "pic") {
            customHTML = `<p style="font-size:11px; color:#d97706; margin-top:4px;">*Please send your photo on WhatsApp after placing order.</p>`;
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
                <button class="cart-remove-btn" onclick="removeFromCart(${index})" title="Remove item"><i class="fas fa-times"></i></button>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

    if (currentSubTotal === 0) currentDeliveryCharge = 0;
    else if (deliverySettings.freeAbove > 0 && currentSubTotal >= deliverySettings.freeAbove) currentDeliveryCharge = 0; 
    else currentDeliveryCharge = deliverySettings.fee || 0;

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
            if (statusEl) statusEl.innerText = "";
        }
    } else {
        if (statusEl) statusEl.innerText = "";
    }
}

// FIXED COUPON QUERY WITH FIRESTORE WHERE CLAUSE
async function applyCoupon() {
    let rawCode = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msg = document.getElementById('coupon-msg');
    const customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    let phoneInput = document.getElementById('cust-phone')?.value.trim() || customer?.phone || "";
    phoneInput = phoneInput.replace(/[^0-9]/g, '');
    if (phoneInput.length > 10) phoneInput = phoneInput.slice(-10);

    if(!rawCode) { alert("Please enter a coupon code."); return; }
    if(currentSubTotal === 0) { alert("Cart is empty."); return; }

    if (!phoneInput || phoneInput.length < 10) {
        alert("Please provide your 10-digit WhatsApp number first to verify coupon eligibility.");
        document.getElementById('cust-phone')?.focus();
        return;
    }

    msg.style.display = "block";
    msg.style.color = "#28469E";
    msg.innerText = "Verifying code & phone eligibility...";

    try {
        const pastOrdersSnap = await db.collection("orders")
            .where("phone", "==", phoneInput)
            .where("couponUsed", "==", rawCode)
            .limit(1)
            .get();

        const pendingOrdersSnap = await db.collection("pending_payments")
            .where("phone", "==", phoneInput)
            .where("couponUsed", "==", rawCode)
            .limit(1)
            .get();

        if (!pastOrdersSnap.empty || !pendingOrdersSnap.empty) {
            msg.style.color = "var(--danger-red)";
            msg.innerText = `❌ You have already used "${rawCode}" with phone number ${phoneInput}! (Only 1 time allowed)`;
            appliedDiscount = 0;
            appliedCouponCode = "";
            renderCart();
            return;
        }

        // Query by 'code' field instead of document ID
        let couponQuery = await db.collection("coupons").where("code", "==", rawCode).limit(1).get();
        
        if (!couponQuery.empty) {
            let couponDoc = couponQuery.docs[0];
            let coupon = couponDoc.data();

            if (coupon.isActive === false) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = "❌ This coupon is currently inactive.";
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            let usedPhones = coupon.usedByPhones || [];
            if (usedPhones.includes(phoneInput)) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ You have already used "${rawCode}" with phone ${phoneInput}!`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            if (coupon.isOneTime && coupon.isUsed) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = "❌ This Gift Card Voucher has already been redeemed!";
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            let minOrdVal = coupon.minOrderAmount !== undefined ? coupon.minOrderAmount : (coupon.minOrder || 0);
            let discountVal = coupon.discountAmount !== undefined ? coupon.discountAmount : (coupon.discount || 0);

            if(currentSubTotal < minOrdVal) {
                msg.style.color = "var(--danger-red)";
                msg.innerText = `❌ Requires a minimum order of ₹${minOrdVal}.`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            appliedDiscount = parseInt(discountVal) || 0;
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
        msg.innerText = "❌ Invalid or expired coupon code.";
        appliedDiscount = 0;
        appliedCouponCode = "";
        renderCart();

    } catch(e) {
        console.error(e);
        msg.style.color = "var(--danger-red)";
        msg.innerText = "Error verifying coupon.";
    }
}

async function submitOrderViaWhatsApp() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));

    if (!customer) {
        alert("Please sign in or create an account before placing your order.");
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
    }

    if (cartItems.length === 0) { alert("Your cart is empty."); return; }

    const name = document.getElementById('cust-name').value.trim();
    let phone = document.getElementById('cust-phone').value.trim();
    phone = phone.replace(/[^0-9]/g, '');
    if (phone.length > 10) phone = phone.slice(-10);

    const pin = document.getElementById('cust-pin').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const postOffice = document.getElementById('cust-postoffice').value.trim();
    const address = document.getElementById('cust-address').value.trim();

    const greeting = document.getElementById('cust-greeting-note')?.value.trim() 
                  || document.getElementById('greeting-note')?.value.trim() || '';

    const occasionTypeSelect = document.getElementById('cust-occasion-type') 
                            || document.getElementById('occasion-type')
                            || document.querySelector('select[name="occasionType"]')
                            || document.querySelector('.occasion-select');
    const occasionType = (occasionTypeSelect && occasionTypeSelect.value && !occasionTypeSelect.value.startsWith('--')) 
                       ? occasionTypeSelect.value 
                       : '';

    const occasionDateInput = document.getElementById('cust-occasion-date') 
                           || document.getElementById('occasion-date')
                           || document.querySelector('input[type="date"]');
    const occasionDate = occasionDateInput ? occasionDateInput.value : '';

    if (!name || phone.length < 10 || !pin || !district || !postOffice || !address) { 
        alert("Please fill all required delivery fields (*)."); 
        return; 
    }

    const btn = document.querySelector('.checkout-btn');
    if (btn) { btn.disabled = true; btn.innerText = "Generating Instant Payment QR..."; }

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
        occasionType: occasionType,
        occasionDate: occasionDate,
        paymentStatus: "Pending",
        orderStatus: "Payment Pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        date: new Date().toLocaleDateString('en-GB')
    };

    try {
        await db.collection("pending_payments").doc(paymentReference).set(pendingPaymentRecord);

        if (appliedCouponCode && appliedCouponCode !== "FIRST10" && appliedCouponCode !== "FRIST10") {
            // Find coupon document ID by code to update usage
            let cSnap = await db.collection("coupons").where("code", "==", appliedCouponCode).limit(1).get();
            if (!cSnap.empty) {
                await db.collection("coupons").doc(cSnap.docs[0].id).update({
                    usedByPhones: firebase.firestore.FieldValue.arrayUnion(phone),
                    isUsed: true
                });
            }
        }

        if (occasionDate || occasionType) {
            try {
                await db.collection("customers").doc(phone).update({
                    savedOccasionType: occasionType,
                    savedOccasionDate: occasionDate
                });
            } catch(e) {}
        }

        localStorage.removeItem('cz_cart');
        updateNavbarCartCount();

        renderPaymentGateScreen(paymentReference, currentTotal, name, phone);

    } catch (err) {
        alert("Error placing order. Please try again.");
        if (btn) { btn.disabled = false; btn.innerText = "Place Order"; }
    }
}

function renderPaymentGateScreen(paymentRef, amount, customerName, phone) {
    const container = document.querySelector('.cart-layout');
    if (!container) return;

    const upiId = "subhammayur746@oksbi";
    const upiPayUrl = `upi://pay?pa=${upiId}&pn=CustomZone&am=${amount}&cu=INR&tn=Ref_${paymentRef}`;
    const dynamicFastQR = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=5&data=${encodeURIComponent(upiPayUrl)}`;
    const localStandeeQR = `assets/images/payment-jpeg.jpeg`;
    const rootStandeeQR = `payment-qr.jpeg`;

    const configuredWhatsApp = "916290407730";
    const waPaymentText = `Hello Custom Zone,\nI have sent the payment.\n\n*Payment Reference:* ${paymentRef}\n*Customer:* ${customerName}\n*Amount:* ₹${amount}\n\nPlease verify screenshot.`;
    const waUrl = `https://api.whatsapp.com/send?phone=${configuredWhatsApp}&text=${encodeURIComponent(waPaymentText)}`;

    container.innerHTML = `
        <div style="background:var(--white); padding:30px 20px; border-radius:12px; width:100%; box-shadow:var(--shadow-soft); text-align:center; border:1px solid var(--card-border);">
            <div style="background:var(--blue-light); display:inline-block; padding:7px 16px; border-radius:20px; color:var(--blue-primary); font-weight:700; font-size:13px; margin-bottom:12px; border:1px solid var(--card-border);">
                Reference: ${paymentRef}
            </div>
            <h2 style="color:var(--text-primary); margin:0 0 6px 0; font-weight:800; font-size:22px;">Scan & Pay ₹${amount}</h2>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:15px;">Scan with GooglePay, PhonePe, Paytm or any UPI App:</p>
            
            <div style="margin: 0 auto 16px auto; width: 260px; min-height: 260px; padding: 10px; border: 2px solid var(--blue-primary); border-radius: 12px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <img src="${localStandeeQR}" 
                     onerror="this.onerror=null; this.src='${rootStandeeQR}'; this.onerror=()=>this.src='${dynamicFastQR}';" 
                     alt="Payment QR" 
                     style="width: 100%; height: auto; max-height: 320px; object-fit: contain; display: block; border-radius: 6px;">
            </div>

            <p style="font-size:13px; font-weight:bold; color:var(--blue-primary); margin-bottom:16px;">UPI ID: ${upiId}</p>

            <div style="max-width:420px; margin:0 auto 16px auto;">
                <a href="${waUrl}" target="_blank" style="background:var(--success-green); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 20px; border-radius:8px; font-weight:700; font-size:14px; text-decoration:none;">
                    <i class="fab fa-whatsapp" style="font-size:18px;"></i> Send Payment Screenshot on WhatsApp
                </a>
            </div>

            <div style="background:#FFFBEB; border:1px solid #FCD34D; padding:14px; border-radius:8px; max-width:480px; margin:0 auto; font-size:12px; color:#92400E; text-align:left; line-height:1.5;">
                <strong>⚠️ Verification Note:</strong> Your official <strong>Order ID</strong> will be confirmed automatically once our admin team verifies your payment screenshot. 
                <br><br>
                👉 Track status directly anytime in your <a href="profile.html" style="color:#1D4ED8; font-weight:bold; text-decoration:underline;">Customer Profile & Orders Status</a>.
            </div>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('DOMContentLoaded', () => {
    renderCart();
    autoFillCustomerAddress();
    loadAvailableCoupons();
    initDynamicFomoTimer();
});