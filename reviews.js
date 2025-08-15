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
    const strongNick = document.createElement('strong');
    strongNick.textContent = review.nickname || 'Anonymous'; // Fallback if nickname is empty
    headerP.appendChild(strongNick);
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

    const strongDate = document.createElement('strong');
    strongDate.textContent = displayDate;
    headerP.appendChild(strongDate);

    const textP = document.createElement('p');
    textP.textContent = review.reviewText || ''; // Prevent empty reviews

    reviewItem.appendChild(headerP);
    reviewItem.appendChild(textP);

    reviewItem.setAttribute('data-date', displayDate); // Для теггинга

    // Handle media if present (multiple)
    if (review.mediaUrls && review.mediaUrls.length > 0) {
        const mediaContainer = document.createElement('div');
        mediaContainer.classList.add('media-container');

        review.mediaUrls.forEach(url => {
            if (url.endsWith('.mp3')) {
                // Display audio
                const audio = document.createElement('audio');
                audio.src = url;
                audio.controls = true;
                mediaContainer.appendChild(audio); // Аудио ниже
            } else {
                // Display image
                const img = document.createElement('img');
                img.src = url;
                img.style.filter = 'blur(10px)';
                img.style.cursor = 'pointer';
                let isBlurred = true;
                let isEnlarged = false;

                img.onclick = function() {
                    isBlurred = !isBlurred;
                    isEnlarged = !isEnlarged;
                    this.style.filter = isBlurred ? 'blur(10px)' : 'none';
                    this.style.maxWidth = isEnlarged ? '100%' : '200px';
                    this.style.maxHeight = isEnlarged ? 'none' : '200px';
                };

                mediaContainer.appendChild(img);
            }
        });

        reviewItem.appendChild(mediaContainer);
    }

    return reviewItem; // Возвращаем для пагинации
}

document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim(); // Trim whitespace
    const reviewText = document.getElementById('review-text').value.trim();
    const file1 = document.getElementById('review-media1').files[0];
    const file2 = document.getElementById('review-media2').files[0];
    const files = [file1, file2].filter(f => f); // Только непустые

    // Basic client-side validation
    if (!nickname || !reviewText) {
        alert('Please enter a nickname and review text.');
        return;
    }

    if (nickname.length > 30) {
        alert('Nickname too long: maximum 30 characters.');
        return;
    }

    if (reviewText.length > 250) {
        alert('Review too long: maximum 250 characters.');
        return;
    }

    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) { // 5 МБ
            alert('File too large: maximum 5MB.');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Only JPG, PNG, GIF, and MP3 are allowed.');
            return;
        }
    });

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

    if (files.length > 0) {
        // Загрузка в Cloudinary
        const uploadPromises = files.map(file => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'reviews_unsigned'); // Ваш preset

            return fetch('https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload', {
                method: 'POST',
                body: formData
            }).then(response => response.json()).then(data => {
                if (data.secure_url) {
                    return data.secure_url;
                } else {
                    throw new Error('Ошибка загрузки в Cloudinary');
                }
            });
        });

        Promise.all(uploadPromises)
            .then(urls => {
                reviewItem.mediaUrls = urls;
                addReview(reviewItem);
            })
            .catch(error => {
                console.error('Ошибка при загрузке файлов:', error);
                alert('Не удалось загрузить файлы.');
            });
    } else {
        addReview(reviewItem);
    }
});

// Load and display reviews on page load, sorted by date
let reviewsData = [];
let currentPage = 1;
const pageSize = 40;
const reviewsList = document.getElementById('reviews-list');

function renderPage(page) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageReviews = reviewsData.slice(start, end);

    reviewsList.innerHTML = ''; // Очистка
    pageReviews.forEach(review => {
        const reviewItem = displayReview(review);
        reviewsList.appendChild(reviewItem);
    });

    // Обработка тегов после рендера
    document.querySelectorAll('.review-item p:nth-child(2)').forEach(textP => {
        textP.innerHTML = textP.textContent.replace(/@(\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2})/g, (match, dateStr) => {
            return `<a href="#" class="tag-link" data-target-date="${dateStr}">${match}</a>`;
        });
    });

    document.getElementById('page-number').textContent = `${page} / ${Math.ceil(reviewsData.length / pageSize) || 1}`;

    document.getElementById('prev-page').disabled = page === 1;
    document.getElementById('next-page').disabled = end >= reviewsData.length;
}

window.addEventListener('load', function() {
    // Clear the list initially
    reviewsList.innerHTML = '';

    // Для локального тестирования (закомментируйте в проде)
    // if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    //     firebase.firestore().useEmulator('localhost', 8080);
    // }

    // Realtime listener с сортировкой
    firebase.firestore().collection('reviews')
        .orderBy('date', 'asc')
        .onSnapshot(snapshot => {
            reviewsData = snapshot.docs.map(doc => doc.data());
            renderPage(currentPage);
        });

    // Пагинация события
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage(currentPage);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if ((currentPage * pageSize) < reviewsData.length) {
            currentPage++;
            renderPage(currentPage);
        }
    });

    // Делегирование кликов по тегам
    reviewsList.addEventListener('click', e => {
        if (e.target.classList.contains('tag-link')) {
            e.preventDefault();
            const targetDate = e.target.getAttribute('data-target-date');
            const targetReview = document.querySelector(`.review-item[data-date="${targetDate}"]`);
            if (targetReview) {
                targetReview.scrollIntoView({ behavior: 'smooth' });
                targetReview.style.backgroundColor = '#ffff99'; // Подсветка
                setTimeout(() => { targetReview.style.backgroundColor = ''; }, 1000);
            } else {
                alert('Отзыв не найден.');
            }
        }
    });
});