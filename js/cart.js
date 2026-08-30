let currentSubTotal = 0;
let currentDeliveryCharge = 0;
let appliedDiscount = 0;
let appliedCouponCode = "";
let currentTotal = 0;
let isGiftWrappingClaimed = false;
let fomoTimerInterval = null;
let flashBenefitName = "FREE Premium Gift Wrapping";

// ক্লাউড ডেটাবেস থেকে Flash Offer সেটিংস যাচাই ও টাইমার চালনা
async function initDynamicFomoTimer() {
    const fomoContainer = document.getElementById('fomo-timer-container');
    const countdownEl = document.getElementById('fomo-countdown');
    const descEl = document.getElementById('fomo-desc');

    if (!fomoContainer) return;

    try {
        const doc = await db.collection("settings").doc("flash_offer").get();
        let flashData = { enabled: true, benefit: "FREE Premium Gift Wrapping!", duration: 5 };
        
        if (doc.exists) {
            flashData = doc.data();
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
        console.log("Flash offer sync error", e);
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

    if(cartItems.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding: 25px; color:#7f8c8d;'>Your cart is currently empty.</p>";
    }

    cartItems.forEach((item, index) => {
        currentSubTotal += item.price;
        let customHTML = "";
        if(item.customType === "name") {
            customHTML = `<input type="text" placeholder="Enter Name/Text to print" onchange="saveCustomData(${index}, 'text', this.value)" style="width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #e74c3c; border-radius: 4px;">`;
        } else if(item.customType === "pic") {
            customHTML = `<p style="font-size:12px; color:#e74c3c; margin-top:5px;">*Please send your photo on WhatsApp along with your order message.</p>`;
        }

        container.innerHTML += `
            <div class="cart-item-row" style="padding: 12px; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${item.name}</h4>
                        <span style="font-weight: 700; color: #e74c3c;">₹${item.price}</span>
                    </div>
                    <button onclick="removeFromCart(${index})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">&times;</button>
                </div>
                ${customHTML}
            </div>
        `;
    });

    if (currentSubTotal === 0) {
        currentDeliveryCharge = 0;
    } else if (deliverySettings.freeAbove > 0 && currentSubTotal >= deliverySettings.freeAbove) {
        currentDeliveryCharge = 0; 
    } else {
        currentDeliveryCharge = deliverySettings.fee || 0;
    }

    currentTotal = Math.max(0, currentSubTotal + currentDeliveryCharge - appliedDiscount);

    if(cartItems.length > 0) {
        let deliveryText = currentDeliveryCharge === 0 ? '<span style="color:#27ae60; font-weight:bold;">FREE</span>' : `₹${currentDeliveryCharge}`;
        container.innerHTML += `
            <div style="padding: 12px; background: #fdfefe; text-align: right; border-bottom: 1px solid #eee;">
                <p style="margin: 4px 0; color: #555;">Subtotal: <strong>₹${currentSubTotal}</strong></p>
                <p style="margin: 4px 0; color: #555;">Delivery Charge: <strong>${deliveryText}</strong></p>
            </div>
        `;
    }

    if(totalItemsEl) totalItemsEl.innerText = cartItems.length;
    if(discountRow) {
        if(appliedDiscount > 0) {
            discountRow.style.display = "block";
            discountPriceEl.innerText = appliedDiscount;
        } else {
            discountRow.style.display = "none";
        }
    }
    if(totalPriceEl) totalPriceEl.innerText = currentTotal;
}

// অটো পিন কোড লুকআপ
async function lookupPincode(pin) {
    const pinStr = pin.trim();
    const statusEl = document.getElementById('pin-status');
    const distInput = document.getElementById('cust-district');
    const poInput = document.getElementById('cust-postoffice');

    if (pinStr.length === 6) {
        statusEl.style.color = "#3498db";
        statusEl.innerText = "Finding District & Post Office...";

        try {
            const res = await fetch(`https://api.postalpincode.in/pincode/${pinStr}`);
            const data = await res.json();

            if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const poList = data[0].PostOffice;
                const district = poList[0].District;
                
                distInput.value = district;
                poInput.value = poList[0].Name;
                statusEl.style.color = "green";
                statusEl.innerText = `✓ ${district}`;
            } else {
                statusEl.style.color = "#e67e22";
                statusEl.innerText = "Please enter District & P.O. manually.";
            }
        } catch (err) {
            console.error("PIN lookup error", err);
            statusEl.innerText = "";
        }
    } else {
        statusEl.innerText = "";
    }
}

// কুপন লোড (শুধুমাত্র সাধারণ অফার কুপন শো করবে, গিফট কার্ড বা রেফারেল কোড সম্পূর্ণ লুকিয়ে রাখবে)
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
            // সিকিউরিটি ফিল্টার: voucher, gift card বা referral কোড ব্যানারে শো করবে না
            if(c.type !== 'referral' && c.type !== 'voucher' && !c.code.startsWith('GIFT-') && !c.code.startsWith('REF-')) {
                offers.push(`Use <strong>${c.code}</strong> (₹${c.discount} OFF on min ₹${c.minOrder || 0})`);
            }
        });

        if(offers.length > 0) {
            badge.innerHTML = `<i class="fas fa-gift" style="color: #27ae60;"></i> Offers: ` + offers.join(" | ");
            badge.style.display = "block";
        } else {
            badge.style.display = "none";
        }
    } catch(e) {
        badge.style.display = "none";
    }
}

// ইউনিভার্সাল কুপন, গিফট কার্ড ও রেফারেল ভ্যালিডেশন
async function applyCoupon() {
    let rawCode = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msg = document.getElementById('coupon-msg');

    if(!rawCode) { alert("Please enter a coupon, gift card, or referral code."); return; }
    if(currentSubTotal === 0) { alert("Cart is empty."); return; }

    msg.style.display = "block";
    msg.style.color = "#7f8c8d";
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
                msg.style.color = "red";
                msg.innerText = `❌ Requires a minimum order of ₹${coupon.minOrder}.`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            if(localStorage.getItem('cz_used_' + targetCode)) {
                msg.style.color = "red";
                msg.innerText = `❌ You have already used "${targetCode}" from this device.`;
                return;
            }

            appliedDiscount = coupon.discount;
            appliedCouponCode = targetCode;
            msg.style.color = "green";
            
            let successLabel = coupon.type === 'voucher' ? '🎁 Gift Card' : 'Code';
            msg.innerText = `✅ ${successLabel} "${targetCode}" applied! You saved ₹${appliedDiscount}.`;
            renderCart();
            return;
        }

        // সরাসরি 'orders' টেবিলে রেফারেল চেক
        let cleanOrderId = rawCode.replace("REF-", "");
        let orderDoc = await db.collection("orders").doc(cleanOrderId).get();

        if (orderDoc.exists) {
            let refCodeName = "REF-" + cleanOrderId;

            if(currentSubTotal < 199) {
                msg.style.color = "red";
                msg.innerText = `❌ Referral code requires a minimum order of ₹199.`;
                appliedDiscount = 0;
                appliedCouponCode = "";
                renderCart();
                return;
            }

            if(localStorage.getItem('cz_used_' + refCodeName)) {
                msg.style.color = "red";
                msg.innerText = `❌ You have already used "${refCodeName}" from this device.`;
                return;
            }

            appliedDiscount = 50;
            appliedCouponCode = refCodeName;
            msg.style.color = "green";
            msg.innerText = `✅ Referral Code "${refCodeName}" applied! You saved ₹50.`;
            renderCart();
            return;
        }

        msg.style.color = "red";
        msg.innerText = "❌ Invalid or expired code.";
        appliedDiscount = 0;
        appliedCouponCode = "";
        renderCart();

    } catch(e) {
        console.error(e);
        msg.style.color = "red";
        msg.innerText = "Error applying code.";
    }
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
    const countEl = document.querySelector('.cart-count');
    if(countEl) countEl.innerText = cartItems.length;
}

// WhatsApp অর্ডার সাবমিশন
async function submitOrderViaWhatsApp() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim() || "N/A";
    const pin = document.getElementById('cust-pin').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const postOffice = document.getElementById('cust-postoffice').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    
    // Greeting Note & Occasion
    const greetingNote = document.getElementById('cust-greeting-note') ? document.getElementById('cust-greeting-note').value.trim() : "";
    const occasionType = document.getElementById('cust-occasion-type') ? document.getElementById('cust-occasion-type').value : "";
    const occasionDate = document.getElementById('cust-occasion-date') ? document.getElementById('cust-occasion-date').value : "";

    const myWhatsAppNumber = "916290407730"; 

    if (!name || !phone || !pin || !district || !postOffice || !address) { 
        alert("Please fill all required delivery details (*)."); 
        return; 
    }
    if (cartItems.length === 0) { alert("Cart is empty."); return; }

    const internalOrderId = "CZ" + Math.floor(1000 + Math.random() * 9000);

    let productDetails = "";
    cartItems.forEach(item => {
        let customData = item.customType === "name" ? ` (Name: ${item.userText || 'N/A'})` : (item.customType === "pic" ? " (Photo on WhatsApp)" : "");
        productDetails += `- ${item.name}${customData} (₹${item.price})\n`;
    });

    let deliveryTextMsg = currentDeliveryCharge === 0 ? "FREE" : `₹${currentDeliveryCharge}`;
    let couponTextMsg = appliedDiscount > 0 ? `\nCoupon/Gift Card/Referral Applied: ${appliedCouponCode} (-₹${appliedDiscount})` : "";
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
        }
    } catch (error) {
        console.error(error);
    }

    const waUrl = `https://api.whatsapp.com/send?phone=${myWhatsAppNumber}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
    
    localStorage.removeItem('cz_cart');
    const countEl = document.querySelector('.cart-count');
    if(countEl) countEl.innerText = "0";

    const cartLayout = document.querySelector('.cart-layout');
    cartLayout.innerHTML = `
        <div style="background: #fff; padding: 35px 25px; border-radius: 8px; width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.06); text-align: center;">
            <i class="fab fa-whatsapp" style="font-size: 55px; color: #25d366;"></i>
            <h2 style="color: #2c3e50; margin-top: 15px;">Order Request Sent to WhatsApp!</h2>
            <p style="color: #555; font-size: 15px; margin-bottom: 25px; line-height: 1.6;">
                We have received your order details on WhatsApp.<br>
                Please complete the payment on WhatsApp. Once verified, our team will generate and send your <strong>Official Tax Invoice</strong> directly to you!
            </p>

            <div style="background: #f8f9fa; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; max-width: 500px; margin: 0 auto 25px auto;">
                <h3 style="color: #2c3e50; margin-bottom: 5px;">Rate Your Experience ⭐</h3>
                <p style="color: #7f8c8d; font-size: 13px; margin-bottom: 10px;">Leave a feedback for Custom Zone!</p>
                <div style="font-size: 26px; cursor: pointer; color: #f1c40f; margin-bottom: 10px;" id="star-rating-box">
                    <span onclick="setRating(1)">★</span><span onclick="setRating(2)">★</span><span onclick="setRating(3)">★</span><span onclick="setRating(4)">★</span><span onclick="setRating(5)">★</span>
                </div>
                <textarea id="review-comment" placeholder="Write your feedback..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></textarea><br>
                <button onclick="submitReviewCloud('${name}')" id="btn-review" style="background: #27ae60; color: white; border: none; padding: 9px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 8px;">Submit Review</button>
                <p id="review-status" style="margin-top: 8px; font-weight: bold; display: none;"></p>
            </div>

            <a href="index.html" style="background: #2c3e50; color: #fff; padding: 12px 25px; border-radius: 4px; text-decoration: none; font-weight: 600;">Continue Shopping</a>
        </div>
    `;
}

let selectedRating = 5;
function setRating(stars) {
    selectedRating = stars;
    const starBox = document.getElementById('star-rating-box');
    let starHTML = "";
    for(let i=1; i<=5; i++) {
        starHTML += `<span onclick="setRating(${i})" style="color: ${i <= stars ? '#f1c40f' : '#ccc'};">★</span>`;
    }
    starBox.innerHTML = starHTML;
}

async function submitReviewCloud(customerName) {
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
            customerName: customerName,
            rating: selectedRating,
            comment: comment,
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        status.style.display = "block";
        status.style.color = "green";
        status.innerText = "🎉 Review submitted successfully!";
        document.getElementById('review-comment').value = "";
    } catch(e) {
        console.error(e);
        status.style.display = "block";
        status.style.color = "red";
        status.innerText = "Failed to submit review.";
    } finally {
        btn.disabled = false;
        btn.innerText = "Submitted";
    }
}

window.onload = () => {
    renderCart();
    loadAvailableCoupons();
    initDynamicFomoTimer();
};