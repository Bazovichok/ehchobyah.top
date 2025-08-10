// Updated reviews.js

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

    document.getElementById('reviews-list').appendChild(reviewItem);
}

document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim(); // Trim whitespace
    const reviewText = document.getElementById('review-text').value.trim();

    // Basic client-side validation to prevent empty submissions
    if (!nickname || !reviewText) {
        alert('Please enter a nickname and review text.');
        return;
    }

    const reviewItem = {
        nickname: nickname,
        reviewText: reviewText,
        date: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp for consistency
    };

    // Save review to Firestore
    firebase.firestore().collection('reviews').add(reviewItem)
        .then(() => {
            // Do NOT display manually here to avoid duplication
            document.getElementById('review-form').reset();
            document.getElementById('send_sound').play();
        })
        .catch((error) => {
            console.error('Ошибка при сохранении отзыва:', error);
        });
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