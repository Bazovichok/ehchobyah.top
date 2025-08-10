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
    reviewItem.innerHTML = `
        <p><strong>${review.nickname}</strong> - ${review.date}</p>
        <p>${review.reviewText}</p>
    `;
    
    document.getElementById('reviews-list').appendChild(reviewItem);
}


document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value;
    const reviewText = document.getElementById('review-text').value;
    const date = new Date().toLocaleString();
    
    const reviewItem = {
        nickname: nickname,
        reviewText: reviewText,
        date: date
    };
    
    // сохраняет отзыв в Firestore
    firebase.firestore().collection('reviews').add(reviewItem)
        .then(() => {
            // Отображаем отзыв на странице
            displayReview(reviewItem);
            document.getElementById('review-form').reset();
            document.getElementById('send_sound').play();
        })
        .catch((error) => {
            console.error('Ошибка при сохранении отзыва:', error);
        });
});

// загружает сохраненные отзывы при загрузке страницы
window.addEventListener('load', function() {
    firebase.firestore().collection('reviews').onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                displayReview(change.doc.data());
 
}
function sanitizeMsg(text) {
  return text.replace(/<[^>]*>/g, "");
}

function displayReview(review) {
  const reviewItem = document.createElement("div");
  reviewItem.classList.add("review-item");
  reviewItem.innerHTML = `
        <p><strong>${sanitizeMsg(review.nickname)}</strong> - ${review.date}</p>
        <p>${sanitizeMsg(review.reviewText)}</p>
    `;

  













           }
        });
    });
});