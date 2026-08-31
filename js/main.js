let uploadedReviewBase64 = "";

// ছবি সিলেক্ট করলে প্রিভিউ ও কম্প্রেশন
function previewReviewImage(input) {
    const file = input.files[0];
    const previewBox = document.getElementById('review-photo-preview-box');
    const previewImg = document.getElementById('review-photo-preview-img');

    if (!file) {
        uploadedReviewBase64 = "";
        previewBox.style.display = "none";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            // ক্লাউড স্টোরেজ অপটিমাইজেশনের জন্য ছবি অটো-কম্প্রেস করা
            const canvas = document.createElement('canvas');
            const maxDimension = 600;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            uploadedReviewBase64 = canvas.toDataURL('image/jpeg', 0.7);
            previewImg.src = uploadedReviewBase64;
            previewBox.style.display = "block";
        };
    };
    reader.readAsDataURL(file);
}

// ক্লাউডে প্রোডাক্ট রিভিউ সাবমিশন
async function submitProductReviewCloud() {
    let customer = JSON.parse(localStorage.getItem('cz_customer_user'));
    if (!customer) { openAuthModal(); return; }

    const text = document.getElementById('pdm-review-text').value.trim();
    const btn = document.getElementById('btn-sub-prod-rev');

    if (!text) { alert("Please write a short review before submitting."); return; }

    btn.disabled = true;
    btn.innerText = "Publishing...";

    let curProd = liveProducts.find(p => p.id === currentOpenProductId);
    let prodName = curProd ? curProd.name : "Custom Product";

    try {
        await db.collection("reviews").add({
            productId: currentOpenProductId,
            productName: prodName,
            customerName: customer.name || "Valued Customer",
            customerPhone: customer.phone || "",
            rating: selectedReviewStar,
            comment: text,
            photoUrl: uploadedReviewBase64 || "",
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("🎉 Thank you! Your review & real photo have been posted.");
        document.getElementById('pdm-review-text').value = "";
        document.getElementById('pdm-review-file').value = "";
        document.getElementById('review-photo-preview-box').style.display = "none";
        uploadedReviewBase64 = "";
        document.getElementById('product-write-review-box').style.display = "none";
        
        loadProductSpecificReviews(currentOpenProductId);
    } catch (e) {
        console.error(e);
        alert("Failed to submit review.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Review";
    }
}