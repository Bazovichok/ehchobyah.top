import { collection, addDoc, onSnapshot } from "firebase/firestore";

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
    
    // Сохраняем отзыв в Firestore
    addDoc(collection(firebase.firestore(), 'reviews'), reviewItem)
        .then(() => {
            // Отображаем отзыв на странице
            displayReview(reviewItem);
            document.getElementById('review-form').reset();
        })
        .catch((error) => {
            console.error('Ошибка при сохранении отзыва:', error);
        });
});

// Загружаем сохраненные отзывы при загрузке страницы
window.addEventListener('load', function() {
    onSnapshot(collection(firebase.firestore(), 'reviews'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                displayReview(change.doc.data());
            }
        });
    });
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
    document.getElementById('send_sound').play();
    document.getElementById('review-form').reset();

});