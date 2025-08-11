// Updated reviews.js (with Cloudinary instead of Imgur or Firebase)

document.getElementById('toggle_music').addEventListener('click', function() {
    var music = document.getElementById('background_music');
    if (music.paused) {
        music.play();
        this.textContent = '♫'; // Иконка включенной музыки
    } else {
        music.pause();
        this.textContent = '🔇'; // Иконка выключенной музыки
    }
});

function displayReview(review) {
    const reviewItem = document.createElement('div');
    reviewItem.classList.add('review-item');

    // Create elements and use textContent to prevent XSS
    const headerP = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = review.nickname || 'Anonymous'; // Fallback if nickname is empty
    headerP.appendChild(strong);
    headerP.appendChild(document.createTextNode(' - '));

    // Handle date display in Moscow time zone
    let displayDate;
    if (review.date && review.date.toDate) {
        // If date is a Firestore Timestamp
        displayDate = review.date.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    } else if (review.date) {
        // Fallback for existing string dates
        displayDate = review.date;
    } else {
        displayDate = 'Date not available';
    }
    headerP.appendChild(document.createTextNode(displayDate));

    const textP = document.createElement('p');
    textP.textContent = review.reviewText || ''; // Prevent empty reviews

    reviewItem.appendChild(headerP);
    reviewItem.appendChild(textP);

    // Handle image if present
    if (review.imageUrl) {
        const img = document.createElement('img');
        img.src = review.imageUrl;
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.filter = 'blur(10px)';
        img.style.cursor = 'pointer';
        img.style.display = 'block';
        img.style.marginTop = '10px';

        let isBlurred = true;
        let isEnlarged = false;

        img.onclick = function() {
            if (isBlurred) {
                this.style.filter = 'none';
                isBlurred = false;
            }

            if (isEnlarged) {
                this.style.maxWidth = '200px';
                this.style.maxHeight = '200px';
                isEnlarged = false;
            } else {
                this.style.maxWidth = '100%';
                this.style.maxHeight = 'none';
                isEnlarged = true;
            }
        };

        reviewItem.appendChild(img);
    }

    document.getElementById('reviews-list').appendChild(reviewItem);
}

document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim(); // Trim whitespace
    const reviewText = document.getElementById('review-text').value.trim();
    const file = document.getElementById('review-image').files[0];

    // Basic client-side validation
    if (!nickname || !reviewText) {
        alert('Please enter a nickname and review text.');
        return;
    }

    if (nickname.length > 30) {
        alert('Nickname too long: maximum 30 characters.');
        return;
    }

    if (file) {
        // Проверка размера и типа файла
        if (file.size > 1024 * 1024) {
            alert('Image file too large: maximum 1MB.');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Only JPG, PNG, and GIF are allowed.');
            return;
        }
    }

    const reviewItem = {
        nickname: nickname,
        reviewText: reviewText,
        date: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp for consistency
    };

    // Function to add to Firestore
    const addReview = (item) => {
        firebase.firestore().collection('reviews').add(item)
            .then(() => {
                document.getElementById('review-form').reset();
                document.getElementById('send_sound').play();
            })
            .catch((error) => {
                console.error('Ошибка при сохранении отзыва:', error);
            });
    };

    if (file) {
        // Загрузка в Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'reviews_unsigned'); // Вставьте имя вашего unsigned preset, например 'reviews_unsigned'

        fetch('https://api.cloudinary.com/v1_1/dp0smiea6/image/upload', {  // Вставьте ваш Cloud Name вместо YOUR_CLOUD_NAME
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.secure_url) {
                reviewItem.imageUrl = data.secure_url;
                addReview(reviewItem);
            } else {
                alert('Ошибка загрузки изображения в Cloudinary: ' + (data.error ? data.error.message : 'Неизвестная ошибка'));
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке изображения:', error);
            alert('Не удалось загрузить изображение.');
        });
    } else {
        addReview(reviewItem);
    }
});

// Load and display reviews on page load, sorted by date
window.addEventListener('load', function() {
    // Clear the list initially to prevent duplicates on reload
    const reviewsList = document.getElementById('reviews-list');
    reviewsList.innerHTML = ''; // Clear existing content

    // Query with orderBy for chronological sorting
    firebase.firestore().collection('reviews')
        .orderBy('date', 'asc') // 'asc' for oldest first; change to 'desc' if newest first
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    displayReview(change.doc.data());
                }
                // Optionally handle 'modified' or 'removed' if needed in the future
            });
        });
});