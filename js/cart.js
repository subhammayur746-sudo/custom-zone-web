// js/cart.js

let currentOrderId = "";
let currentSubTotal = 0;
let currentDeliveryCharge = 0;
let currentTotal = 0;

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const totalItemsEl = document.getElementById('total-items');
    const totalPriceEl = document.getElementById('total-price');
    
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    let deliverySettings = JSON.parse(localStorage.getItem('cz_delivery_db')) || { fee: 0, freeAbove: 0 };
    
    container.innerHTML = "";
    currentSubTotal = 0;

    cartItems.forEach((item, index) => {
        currentSubTotal += item.price;
        
        let customHTML = "";
        if(item.customType === "name") {
            customHTML = `<input type="text" placeholder="Enter Name/Text to print" onchange="saveCustomData(${index}, 'text', this.value)" style="width: 100%; margin-top: 10px; padding: 8px; border: 1px solid #e74c3c; border-radius: 4px;">`;
        } else if(item.customType === "pic") {
            customHTML = `<p style="font-size:12px; color:#e74c3c; margin-top:5px;">*Please send the high-quality picture on our WhatsApp along with your Order ID.</p>`;
        }

        container.innerHTML += `
            <div class="cart-item-row" style="padding: 15px; border-bottom: 1px solid #ddd;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <h4>${item.name}</h4>
                        <span style="font-weight: 600; color: #e74c3c;">₹${item.price}</span>
                    </div>
                    <button onclick="removeFromCart(${index})" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">X</button>
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
        currentDeliveryCharge = deliverySettings.fee;
    }

    currentTotal = currentSubTotal + currentDeliveryCharge;

    if(cartItems.length > 0) {
        let deliveryText = currentDeliveryCharge === 0 ? '<span style="color:#27ae60; font-weight:bold;">FREE</span>' : `₹${currentDeliveryCharge}`;
        container.innerHTML += `
            <div style="padding: 15px; background: #fdfefe; text-align: right; border-bottom: 1px solid #ddd;">
                <p style="margin: 5px 0; color: #555;">Subtotal: <strong>₹${currentSubTotal}</strong></p>
                <p style="margin: 5px 0; color: #555;">Delivery Charge: <strong>${deliveryText}</strong></p>
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
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const address = document.getElementById('cust-address').value;
    const district = document.getElementById('cust-district').value;
    const pin = document.getElementById('cust-pin').value;

    if (!name || !phone || !address || !district || !pin) { 
        alert("Please fill all the required details (*)."); 
        return; 
    }
    if (cartItems.length === 0) { alert("Cart is empty."); return; }

    document.getElementById('order-id-display').innerText = "Generated after Payment";

    const upiId = "7439958857@kotakbank"; 
    const payeeName = "Custom Zone";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${currentTotal}&cu=INR`;

    document.getElementById("qrcode-display").innerHTML = "";
    new QRCode(document.getElementById("qrcode-display"), { text: upiUrl, width: 180, height: 180 });
    document.getElementById('payment-section').style.display = "block";
}

// "async" যোগ করা হয়েছে যাতে ফায়ারবেসে ডেটা সেভ হওয়ার জন্য অপেক্ষা করতে পারে
async function sendToWhatsApp() {
    let cartItems = JSON.parse(localStorage.getItem('cz_cart')) || [];
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const email = document.getElementById('cust-email').value || "N/A";
    const address = document.getElementById('cust-address').value;
    const district = document.getElementById('cust-district').value;
    const pin = document.getElementById('cust-pin').value;
    const myWhatsAppNumber = "917439958857"; 
    
    // Create Order ID
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    currentOrderId = "CZ" + randomDigits;

    let productDetails = "";
    cartItems.forEach(item => {
        let customData = item.customType === "name" ? ` (Name: ${item.userText})` : (item.customType === "pic" ? " (Pic sent separately)" : "");
        productDetails += `- ${item.name}${customData} (₹${item.price})\n`;
    });

    let deliveryTextMsg = currentDeliveryCharge === 0 ? "FREE" : `₹${currentDeliveryCharge}`;
    let fullAddress = `${address}, ${district} - ${pin}`;

    let msg = `*New Order - Custom Zone*\nOrder ID: *${currentOrderId}*\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nAddress: ${fullAddress}\n\n*Items:*\n${productDetails}\nSubtotal: ₹${currentSubTotal}\nDelivery Charge: ${deliveryTextMsg}\n*Total Paid Amount:* ₹${currentTotal}\n\nI have made the payment via QR code. Sending screenshot now.`;

    const orderDate = new Date().toLocaleDateString('en-GB'); 
    
    // Order Data Object
    const orderData = {
        status: "Payment Verified - Processing",
        customerName: name,
        phone: phone,
        email: email,
        address: fullAddress,
        district: district,
        pin: pin,
        totalAmount: currentTotal,
        date: orderDate,
        items: productDetails + `\n[Delivery Charge: ${deliveryTextMsg}]`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // ক্লাউডে সেভ হওয়ার সঠিক সময়
    };
    
    try {
        // ফায়ারবেস ক্লাউডে ডেটা সেভ করা হচ্ছে
        await db.collection("orders").doc(currentOrderId).set(orderData);
        console.log("Order saved to Firebase successfully!");
    } catch (error) {
        console.error("Error saving order to Firebase:", error);
        alert("There was an issue saving your order to the server. Please try again.");
        return;
    }

    // Open WhatsApp in new tab
    const waLink = `https://wa.me/${myWhatsAppNumber}?text=${encodeURIComponent(msg)}`;
    window.open(waLink, "_blank");
    
    // Clear cart memory
    localStorage.removeItem('cz_cart');
    document.querySelector('.cart-count').innerText = "0";

    // --- PRINT CSS INJECTION START ---
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
    // --- PRINT CSS INJECTION END ---

    let deliveryHTMLText = currentDeliveryCharge === 0 ? '<span style="color:#27ae60;">FREE</span>' : `₹${currentDeliveryCharge}`;

    const cartLayout = document.querySelector('.cart-layout');
    cartLayout.innerHTML = `
        <div style="background: #fff; padding: 40px; border-radius: 8px; width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: left;">
            
            <div class="no-print" style="text-align: center; margin-bottom: 30px;">
                <i class="fas fa-check-circle" style="font-size: 50px; color: #27ae60;"></i>
                <h2 style="color: #2c3e50; margin-top: 10px;">Order Placed Successfully!</h2>
                <p style="color: #7f8c8d;">Please share the payment screenshot on WhatsApp.</p>
            </div>

            <div id="printable-letterhead" style="border: 2px solid #2c3e50; padding: 30px; border-radius: 8px; background: #fff;">
                
                <div style="text-align: center; border-bottom: 2px solid #e74c3c; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #2c3e50; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 900;">CUSTOM ZONE</h1>
                    <p style="color: #e74c3c; margin: 5px 0; font-weight: bold; letter-spacing: 1px;">CUSTOMIZE WITH LOVE & CARE</p>
                    <p style="color: #555; margin: 0; font-size: 14px;">
                        <i class="fas fa-phone-alt"></i> +91 7439958857 | <i class="fas fa-envelope"></i> support@customzone.com
                    </p>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap;">
                    <div>
                        <h3 style="color: #2c3e50; margin-bottom: 10px;">INVOICE TO:</h3>
                        <p style="margin: 2px 0;"><strong>${name}</strong></p>
                        <p style="margin: 2px 0; color: #555; font-size: 14px;"><i class="fas fa-phone-alt" style="font-size:12px;"></i> ${phone}</p>
                        <p style="margin: 2px 0; color: #555; font-size: 14px;"><i class="fas fa-envelope" style="font-size:12px;"></i> ${email}</p>
                        <p style="margin: 4px 0 0 0; color: #555; max-width: 250px; font-size: 14px;">${fullAddress}</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="color: #2c3e50; margin-bottom: 10px;">ORDER DETAILS:</h3>
                        <p style="margin: 2px 0;"><strong>Order ID:</strong> <span style="color: #e74c3c;">${currentOrderId}</span></p>
                        <p style="margin: 2px 0;"><strong>Date:</strong> ${orderDate}</p>
                    </div>
                </div>
                
                <hr style="border: 1px dashed #ddd; margin: 20px 0;">
                
                <h4 style="margin-bottom: 10px; color: #2c3e50;">Items Ordered:</h4>
                <pre style="font-family: inherit; font-size: 14px; white-space: pre-wrap; color: #333; line-height: 1.6;">${productDetails}</pre>
                
                <hr style="border: 1px dashed #ddd; margin: 20px 0;">
                
                <div style="text-align: right; margin-bottom: 20px; color: #555; font-size: 14px;">
                    <p style="margin: 5px 0;">Subtotal: <strong>₹${currentSubTotal}</strong></p>
                    <p style="margin: 5px 0;">Delivery Charge: <strong>${deliveryHTMLText}</strong></p>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #2c3e50; padding-top: 15px;">
                    <div>
                        <h3 style="color: #27ae60; font-size: 22px; margin: 0;">Total Paid: ₹${currentTotal}</h3>
                        <p style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">*Thank you for shopping with Custom Zone.</p>
                    </div>
                    
                    <div style="text-align: center; width: 150px;">
                        <div style="height: 50px;"></div> 
                        <hr style="border: 1px solid #2c3e50; margin-bottom: 5px;">
                        <p style="margin: 0; font-weight: bold; font-size: 14px; color: #2c3e50;">Authorized Signature</p>
                    </div>
                </div>

            </div>
            
            <div class="no-print" style="margin-top: 30px; display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                <button onclick="window.print()" style="background: #2c3e50; color: #fff; padding: 12px 25px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"><i class="fas fa-print"></i> Print Invoice</button>
                <a href="index.html" style="background: #e74c3c; color: #fff; padding: 12px 25px; border-radius: 4px; text-decoration: none; font-weight: 600; text-align: center;">Continue Shopping</a>
            </div>
        </div>
    `;
}

window.onload = renderCart;