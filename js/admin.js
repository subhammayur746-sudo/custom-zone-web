// js/admin.js

window.onload = function() {
    renderAdminProducts();
    renderAdminOrders();
};

// === Promo Pop-up Logic ===
function savePromoPopup() {
    const status = document.getElementById('promo-status').value;
    const title = document.getElementById('promo-title').value;
    const desc = document.getElementById('promo-desc').value;
    const fileInput = document.getElementById('promo-img-file');
    const msgBox = document.getElementById('promo-msg');

    let promoData = { isActive: status, title: title, desc: desc, image: "" };

    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            promoData.image = e.target.result;
            localStorage.setItem('cz_promo_db', JSON.stringify(promoData));
            showPromoSuccess(msgBox);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        // Keep old image if no new image is selected
        let oldPromo = JSON.parse(localStorage.getItem('cz_promo_db'));
        if(oldPromo && oldPromo.image) promoData.image = oldPromo.image;
        
        localStorage.setItem('cz_promo_db', JSON.stringify(promoData));
        showPromoSuccess(msgBox);
    }
}

function showPromoSuccess(msgBox) {
    msgBox.style.display = "block";
    msgBox.innerText = "Promo settings updated successfully!";
    document.getElementById('promo-title').value = "";
    document.getElementById('promo-desc').value = "";
    document.getElementById('promo-img-file').value = "";
    setTimeout(() => { msgBox.style.display = "none"; }, 3000);
}

// === Update Order Status ===
function updateOrderStatus() {
    const orderId = document.getElementById('admin-order-id').value.trim().toUpperCase();
    const newStatus = document.getElementById('admin-order-status').value;
    const msgBox = document.getElementById('status-msg');

    if (orderId === "" || !orderId.startsWith('CZ')) {
        alert("Please enter a valid Order ID starting with 'CZ'.");
        return;
    }

    let ordersDatabase = JSON.parse(localStorage.getItem('cz_orders_db')) || {};
    ordersDatabase[orderId] = newStatus;
    localStorage.setItem('cz_orders_db', JSON.stringify(ordersDatabase));

    msgBox.style.display = "block";
    msgBox.innerText = `Success! ${orderId} is now marked as "${newStatus}".`;
    document.getElementById('admin-order-id').value = "";
    
    setTimeout(() => { msgBox.style.display = "none"; }, 4000);
    renderAdminOrders();
}

// === Product Logic (Multiple Images 1-4) ===
function addNewProduct() {
    const name = document.getElementById('prod-name').value;
    const price = document.getElementById('prod-price').value;
    const customType = document.getElementById('prod-custom-type').value;
    const fileInput = document.getElementById('prod-img-file');
    const msgBox = document.getElementById('prod-msg');

    if (!name || !price || fileInput.files.length === 0) {
        alert("Please fill all fields and select at least 1 image.");
        return;
    }
    if (fileInput.files.length > 4) {
        alert("You can only upload a maximum of 4 images.");
        return;
    }

    let imagesArray = [];
    let filesLoaded = 0;

    for (let i = 0; i < fileInput.files.length; i++) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagesArray.push(e.target.result);
            filesLoaded++;
            
            // Wait until all selected images are read
            if (filesLoaded === fileInput.files.length) {
                let productDB = JSON.parse(localStorage.getItem('cz_products_db')) || [];
                const newId = "P" + (Math.floor(Math.random() * 900) + 100);

                productDB.push({
                    id: newId, name: name, price: parseInt(price),
                    images: imagesArray, customType: customType, isActive: true
                });

                localStorage.setItem('cz_products_db', JSON.stringify(productDB));

                msgBox.style.display = "block";
                msgBox.innerText = `Product "${name}" added successfully!`;
                document.getElementById('prod-name').value = "";
                document.getElementById('prod-price').value = "";
                fileInput.value = "";
                
                setTimeout(() => { msgBox.style.display = "none"; }, 3000);
                renderAdminProducts(); 
            }
        };
        reader.readAsDataURL(fileInput.files[i]);
    }
}

function renderAdminProducts() {
    const tbody = document.getElementById('admin-product-list');
    let products = JSON.parse(localStorage.getItem('cz_products_db')) || [];
    tbody.innerHTML = "";

    products.forEach((prod, index) => {
        let typeLabel = prod.customType === "name" ? "Name" : (prod.customType === "pic" ? "Picture" : "None");
        let statusText = prod.isActive !== false ? "Active" : "Disabled";
        let btnClass = prod.isActive !== false ? "btn-toggle" : "btn-toggle active";
        let btnText = prod.isActive !== false ? "Disable" : "Enable";

        tbody.innerHTML += `
            <tr>
                <td>${prod.id}</td>
                <td>${prod.name} <br><small style="color:red;">[Custom: ${typeLabel}]</small></td>
                <td>
                    <input type="number" id="price-${index}" value="${prod.price}" style="width:70px;">
                    <button class="btn-sm btn-edit" onclick="updatePrice(${index})">Save</button>
                </td>
                <td>${statusText}</td>
                <td>
                    <button class="btn-sm ${btnClass}" onclick="toggleProduct(${index})">${btnText}</button>
                    <button class="btn-sm" style="background:#e74c3c; margin-left: 5px;" onclick="deleteProduct(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function updatePrice(index) {
    let products = JSON.parse(localStorage.getItem('cz_products_db')) || [];
    let newPrice = document.getElementById(`price-${index}`).value;
    products[index].price = parseInt(newPrice);
    localStorage.setItem('cz_products_db', JSON.stringify(products));
    alert("Price updated successfully!");
    renderAdminProducts();
}

function toggleProduct(index) {
    let products = JSON.parse(localStorage.getItem('cz_products_db')) || [];
    products[index].isActive = products[index].isActive === false ? true : false;
    localStorage.setItem('cz_products_db', JSON.stringify(products));
    renderAdminProducts();
}

function deleteProduct(index) {
    if(confirm("Are you sure you want to delete this product?")) {
        let products = JSON.parse(localStorage.getItem('cz_products_db')) || [];
        products.splice(index, 1);
        localStorage.setItem('cz_products_db', JSON.stringify(products));
        renderAdminProducts();
    }
}

function renderAdminOrders() {
    const tbody = document.getElementById('admin-order-list');
    let ordersDb = JSON.parse(localStorage.getItem('cz_orders_db')) || {};
    tbody.innerHTML = "";

    for (let orderId in ordersDb) {
        tbody.innerHTML += `
            <tr>
                <td><strong>${orderId}</strong></td>
                <td>Data in WhatsApp</td>
                <td>-</td>
                <td><span style="color: #27ae60; font-weight: bold;">${ordersDb[orderId]}</span></td>
                <td>Recent</td>
            </tr>
        `;
    }
}