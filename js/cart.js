let currentOrderId = "";
let currentSubTotal = 0;
let currentDeliveryCharge = 0;
let currentTotal = 0;

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const totalItemsEl = document.getElementById('total-items');
    const totalPriceEl = document.getElementById('total-price');
    
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

    currentTotal = currentSubTotal + currentDeliveryCharge;

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
    if(totalPriceEl) totalPriceEl.innerText = currentTotal;
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
    let fullAddress = `${address}, ${district} - ${pin}`;

    let msg = `*New Order - Custom Zone*\nOrder ID: *${currentOrderId}*\nName: ${name}\nPhone: ${phone}\nAddress: ${fullAddress}\n\n*Items:*\n${productDetails}\nSubtotal: ₹${currentSubTotal}\nDelivery: ${deliveryTextMsg}\n*Total Paid:* ₹${currentTotal}\n\nI have made the payment. Sending screenshot now.`;

    const orderDate = new Date().toLocaleDateString('en-GB'); 
    
    const orderData = {
        status: "Payment Verified - Processing",
        customerName: name,
        phone: phone,
        email: email,
        address: fullAddress,
        totalAmount: currentTotal,
        date: orderDate,
        items: productDetails + `\n[Delivery Charge: ${deliveryTextMsg}]`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection("orders").doc(currentOrderId).set(orderData);
    } catch (error) {
        console.error(error);
        alert("Issue saving order. Please contact support.");
    }

    window.open(`https://wa.me/${myWhatsAppNumber}?text=${encodeURIComponent(msg)}`, "_blank");
    
    localStorage.removeItem('cz_cart');
    document.querySelector('.cart-count').innerText = "0";

    // Show Invoice and Live Review Rating Form
    const cartLayout = document.querySelector('.cart-layout');
    cartLayout.innerHTML = `
        <div style="background: #fff; padding: 30px; border-radius: 8px; width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.06); text-align: left;">
            <div style="text-align: center; margin-bottom: 25px;">
                <i class="fas fa-check-circle" style="font-size: 45px; color: #27ae60;"></i>
                <h2 style="color: #2c3e50; margin-top: 10px;">Order Placed Successfully!</h2>
                <p style="color: #7f8c8d;">Order ID: <strong>${currentOrderId}</strong></p>
            </div>

            <!-- Review & Rating Section -->
            <div style="background: #f8f9fa; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                <h3 style="color: #2c3e50; margin-bottom: 5px;">Rate Your Experience ⭐</h3>
                <p style="color: #7f8c8d; font-size: 13px; margin-bottom: 12px;">Help us grow by leaving an authentic review!</p>
                <div style="font-size: 26px; cursor: pointer; color: #f1c40f; margin-bottom: 12px;" id="star-rating-box">
                    <span onclick="setRating(1)">★</span><span onclick="setRating(2)">★</span><span onclick="setRating(3)">★</span><span onclick="setRating(4)">★</span><span onclick="setRating(5)">★</span>
                </div>
                <textarea id="review-comment" placeholder="Write your feedback..." style="width: 100%; max-width: 450px; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; margin-bottom: 10px;"></textarea><br>
                <button onclick="submitReviewCloud('${name}')" id="btn-review" style="background: #27ae60; color: white; border: none; padding: 10px 25px; border-radius: 4px; font-weight: bold; cursor: pointer;">Submit Review</button>
                <p id="review-status" style="margin-top: 8px; font-weight: bold; display: none;"></p>
            </div>

            <div style="text-align: center;">
                <a href="index.html" style="background: #e74c3c; color: #fff; padding: 12px 25px; border-radius: 4px; text-decoration: none; font-weight: 600;">Continue Shopping</a>
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
        alert("Please write a short review before submitting!"); return;
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

window.onload = renderCart;