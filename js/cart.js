let currentOrderId = "";
let currentSubTotal = 0;
let currentDeliveryCharge = 0;
let appliedDiscount = 0;
let appliedCouponCode = "";
let currentTotal = 0;

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
            customHTML = `<p style="font-size:12px; color:#e74c3c; margin-top:5px;">*Please send your photo on WhatsApp along with your Order ID.</p>`;
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

// কার্ট লোড হলে সক্রিয় কুপন লিস্ট চেক করা
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
            offers.push(`Use <strong>${c.code}</strong> (₹${c.discount} OFF on min ₹${c.minOrder || 0})`);
        });
        badge.innerHTML = `<i class="fas fa-gift" style="color: #27ae60;"></i> Offers: ` + offers.join(" | ");
        badge.style.display = "block";
    } catch(e) {
        badge.style.display = "none";
    }
}

// কুপন অ্যাপ্লাই করা
async function applyCoupon() {
    const code = document.getElementById('coupon-input').value.trim().toUpperCase();
    const phone = document.getElementById('cust-phone') ? document.getElementById('cust-phone').value.trim() : "";
    const msg = document.getElementById('coupon-msg');

    if(!code) { alert("Please enter a coupon code."); return; }
    if(currentSubTotal === 0) { alert("Cart is empty."); return; }

    msg.style.display = "block";
    msg.style.color = "#7f8c8d";
    msg.innerText = "Verifying coupon...";

    try {
        const doc = await db.collection("coupons").doc(code).get();
        if(!doc.exists || !doc.data().isActive) {
            msg.style.color = "red";
            msg.innerText = "❌ Invalid or expired coupon code.";
            appliedDiscount = 0;
            appliedCouponCode = "";
            renderCart();
            return;
        }

        const coupon = doc.data();

        // মিনিমাম অর্ডার চেক
        if(currentSubTotal < (coupon.minOrder || 0)) {
            msg.style.color = "red";
            msg.innerText = `❌ This coupon requires a minimum order of ₹${coupon.minOrder}.`;
            appliedDiscount = 0;
            appliedCouponCode = "";
            renderCart();
            return;
        }

        // ওয়ান-টাইম চেক (লোকাল ও ক্লাউড)
        if(localStorage.getItem('cz_used_' + code)) {
            msg.style.color = "red";
            msg.innerText = `❌ You have already used coupon "${code}" from this device.`;
            return;
        }

        appliedDiscount = coupon.discount;
        appliedCouponCode = code;
        msg.style.color = "green";
        msg.innerText = `✅ Coupon "${code}" applied! You saved ₹${appliedDiscount}.`;
        renderCart();
    } catch(e) {
        console.error(e);
        msg.style.color = "red";
        msg.innerText = "Error applying coupon.";
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

function generateInvoiceAndQR() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const pin = document.getElementById('cust-pin').value.trim();

    if (!name || !phone || !address || !district || !pin) { 
        alert("Please fill all required fields (*)."); 
        return; 
    }
    if (cartItems.length === 0) { alert("Cart is empty."); return; }

    document.getElementById('order-id-display').innerText = "Generated after Payment";

    const upiId = "7439958857@kotakbank"; 
    const payeeName = "Custom Zone";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${currentTotal}&cu=INR`;

    document.getElementById("qrcode-display").innerHTML = "";
    new QRCode(document.getElementById("qrcode-display"), { text: upiUrl, width: 170, height: 170 });
    document.getElementById('payment-section').style.display = "block";
}

async function sendToWhatsApp() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim() || "N/A";
    const address = document.getElementById('cust-address').value.trim();
    const district = document.getElementById('cust-district').value.trim();
    const pin = document.getElementById('cust-pin').value.trim();
    const myWhatsAppNumber = "917439958857"; 
    
    currentOrderId = "CZ" + Math.floor(1000 + Math.random() * 9000);

    let productDetails = "";
    cartItems.forEach(item => {
        let customData = item.customType === "name" ? ` (Name: ${item.userText})` : (item.customType === "pic" ? " (Pic sent separately)" : "");
        productDetails += `- ${item.name}${customData} (₹${item.price})\n`;
    });

    let deliveryTextMsg = currentDeliveryCharge === 0 ? "FREE" : `₹${currentDeliveryCharge}`;
    let couponTextMsg = appliedDiscount > 0 ? `\nCoupon Applied: ${appliedCouponCode} (-₹${appliedDiscount})` : "";
    let fullAddress = `${address}, ${district} - ${pin}`;

    let msg = `*New Order - Custom Zone*\nOrder ID: *${currentOrderId}*\nName: ${name}\nPhone: ${phone}\nAddress: ${fullAddress}\n\n*Items:*\n${productDetails}\nSubtotal: ₹${currentSubTotal}\nDelivery: ${deliveryTextMsg}${couponTextMsg}\n*Total Paid:* ₹${currentTotal}\n\nI have made the payment. Sending screenshot now.`;

    const orderDate = new Date().toLocaleDateString('en-GB'); 
    
    const orderData = {
        status: "Payment Verified - Processing",
        customerName: name,
        phone: phone,
        email: email,
        address: fullAddress,
        totalAmount: currentTotal,
        couponUsed: appliedCouponCode,
        discountGiven: appliedDiscount,
        date: orderDate,
        items: productDetails + `\n[Delivery: ${deliveryTextMsg}]${couponTextMsg}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection("orders").doc(currentOrderId).set(orderData);
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

    if (!document.getElementById('print-style')) {
        const style = document.createElement('style');
        style.id = 'print-style';
        style.innerHTML = `
            @media print {
                body * { visibility: hidden; }
                #printable-letterhead, #printable-letterhead * { visibility: visible; }
                #printable-letterhead { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; border: none !important; }
                .no-print { display: none !important; }
                @page { margin: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    let deliveryHTMLText = currentDeliveryCharge === 0 ? '<span style="color:#27ae60;">FREE</span>' : `₹${currentDeliveryCharge}`;
    let couponHTMLText = appliedDiscount > 0 ? `<p style="margin: 4px 0; color:#27ae60;">Coupon Discount (${appliedCouponCode}): <strong>-₹${appliedDiscount}</strong></p>` : '';

    const cartLayout = document.querySelector('.cart-layout');
    cartLayout.innerHTML = `
        <div style="background: #fff; padding: 30px; border-radius: 8px; width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.06); text-align: left;">
            <div class="no-print" style="text-align: center; margin-bottom: 25px;">
                <i class="fas fa-check-circle" style="font-size: 45px; color: #27ae60;"></i>
                <h2 style="color: #2c3e50; margin-top: 10px;">Order Placed Successfully!</h2>
                <p style="color: #7f8c8d;">Please send your payment screenshot on WhatsApp to complete verification.</p>
            </div>

            <div id="printable-letterhead" style="border: 2px solid #2c3e50; padding: 30px; border-radius: 8px; background: #fff; margin-bottom: 30px;">
                <div style="text-align: center; border-bottom: 2px solid #e74c3c; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #2c3e50; margin: 0; font-size: 30px; font-weight: 900;">CUSTOM ZONE</h1>
                    <p style="color: #e74c3c; margin: 4px 0; font-weight: bold;">CUSTOMIZE WITH LOVE & CARE</p>
                    <p style="color: #555; margin: 0; font-size: 13px;">+91 7439958857 | support@customzone.com</p>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap;">
                    <div>
                        <h4 style="color: #2c3e50; margin-bottom: 5px;">INVOICE TO:</h4>
                        <p style="margin: 2px 0;"><strong>${name}</strong></p>
                        <p style="margin: 2px 0; color: #555; font-size: 14px;">${phone}</p>
                        <p style="margin: 2px 0; color: #555; max-width: 280px; font-size: 14px;">${fullAddress}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="color: #2c3e50; margin-bottom: 5px;">ORDER DETAILS:</h4>
                        <p style="margin: 2px 0;"><strong>Order ID:</strong> <span style="color: #e74c3c;">${currentOrderId}</span></p>
                        <p style="margin: 2px 0;"><strong>Date:</strong> ${orderDate}</p>
                    </div>
                </div>
                
                <hr style="border: 1px dashed #ddd; margin: 15px 0;">
                <h4 style="margin-bottom: 8px; color: #2c3e50;">Items Ordered:</h4>
                <pre style="font-family: inherit; font-size: 14px; white-space: pre-wrap; color: #333; line-height: 1.5; background: #fdfefe; padding: 10px; border-radius: 4px; border: 1px solid #eee;">${productDetails}</pre>
                <hr style="border: 1px dashed #ddd; margin: 15px 0;">
                
                <div style="text-align: right; margin-bottom: 15px; font-size: 14px; color: #555;">
                    <p style="margin: 4px 0;">Subtotal: <strong>₹${currentSubTotal}</strong></p>
                    <p style="margin: 4px 0;">Delivery Charge: <strong>${deliveryHTMLText}</strong></p>
                    ${couponHTMLText}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #2c3e50; padding-top: 15px;">
                    <div>
                        <h3 style="color: #27ae60; font-size: 20px; margin: 0;">Total Paid: ₹${currentTotal}</h3>
                        <p style="color: #7f8c8d; font-size: 12px; margin: 4px 0 0 0;">*Thank you for shopping with Custom Zone.</p>
                    </div>
                    <div style="text-align: center; width: 140px;">
                        <div style="height: 40px;"></div>
                        <hr style="border: 1px solid #2c3e50; margin-bottom: 4px;">
                        <p style="margin: 0; font-weight: bold; font-size: 13px;">Authorized Signature</p>
                    </div>
                </div>
            </div>

            <div class="no-print" style="text-align: center; margin-bottom: 30px;">
                <button onclick="window.print()" style="background: #2c3e50; color: #fff; padding: 12px 25px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"><i class="fas fa-print"></i> Print Invoice</button>
            </div>

            <!-- Review Form -->
            <div class="no-print" style="background: #f8f9fa; border: 1px solid #e2e8f0; padding: 25px; border-radius: 8px; text-align: center;">
                <h3 style="color: #2c3e50; margin-bottom: 6px;">Rate Your Experience ⭐</h3>
                <p style="color: #7f8c8d; font-size: 13px; margin-bottom: 12px;">Leave an authentic review for our website!</p>
                <div style="font-size: 28px; cursor: pointer; color: #f1c40f; margin-bottom: 12px;" id="star-rating-box">
                    <span onclick="setRating(1)">★</span><span onclick="setRating(2)">★</span><span onclick="setRating(3)">★</span><span onclick="setRating(4)">★</span><span onclick="setRating(5)">★</span>
                </div>
                <textarea id="review-comment" placeholder="Write your review here..." style="width: 100%; max-width: 500px; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; margin-bottom: 12px;"></textarea><br>
                <button onclick="submitReviewCloud('${name}')" id="btn-review" style="background: #27ae60; color: white; border: none; padding: 11px 28px; border-radius: 4px; font-weight: bold; cursor: pointer;">Submit Review</button>
                <p id="review-status" style="margin-top: 10px; font-weight: bold; display: none;"></p>
                <div style="margin-top: 20px;">
                    <a href="index.html" style="color: #e74c3c; text-decoration: none; font-weight: 600;">Back to Home</a>
                </div>
            </div>
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
        status.innerText = "🎉 Thank you! Your review is now live on our About page.";
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
};