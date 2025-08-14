document.getElementById('toggle_music').addEventListener('click', function() {
    const music = document.getElementById('background_music');
    if (music.paused) {
        music.play();
        this.textContent = '♫';
    } else {
        music.pause();
        this.textContent = '🔇';
    }
});

const reviewsPerPage = 40;
let currentPage = 1;
let reviewsCache = [];

function displayReview(review, index) {
    const reviewItem = document.createElement('div');
    reviewItem.classList.add('review-item');
    reviewItem.id = `review-${index}`;

    const headerP = document.createElement('p');
    headerP.classList.add('review-header');

    const strong = document.createElement('strong');
    strong.textContent = review.nickname || 'Anonymous';
    headerP.appendChild(strong);

    const dateSpan = document.createElement('span');
    dateSpan.classList.add('review-date');

    let displayDate;
    if (review.date && review.date.toDate) {
        displayDate = review.date.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    } else {
        displayDate = review.date || 'Date not available';
    }
    dateSpan.textContent = ` - ${displayDate}`;
    headerP.appendChild(dateSpan);

    headerP.addEventListener('click', () => {
        const target = document.querySelector(`#review-${index}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlighted');
            setTimeout(() => target.classList.remove('highlighted'), 1500);
        }
    });

    const textP = document.createElement('p');
    textP.textContent = review.reviewText || '';

    reviewItem.appendChild(headerP);
    reviewItem.appendChild(textP);

    let mediaList = [];
    if (Array.isArray(review.mediaUrls)) {
        mediaList = review.mediaUrls;
    } else if (review.mediaUrl) {
        mediaList = [review.mediaUrl];
    }

    mediaList.forEach(url => {
        if (!url) return;
        if (url.endsWith('.mp3')) {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.controls = true;
            reviewItem.appendChild(audio);
        } else {
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            img.style.filter = 'blur(10px)';
            img.style.cursor = 'pointer';
            img.style.display = 'block';
            img.style.marginTop = '10px';
            let isBlurred = true;
            img.onclick = function() {
                if (isBlurred) {
                    this.style.filter = 'none';
                    isBlurred = false;
                } else {
                    this.style.filter = 'blur(10px)';
                    isBlurred = true;
                }
            };
            reviewItem.appendChild(img);
        }
    });

    return reviewItem;
}

function renderPage() {
    const reviewsList = document.getElementById('reviews-list');
    reviewsList.innerHTML = '';

    const startIndex = (currentPage - 1) * reviewsPerPage;
    const endIndex = startIndex + reviewsPerPage;
    const pageReviews = reviewsCache.slice(startIndex, endIndex); // уже в порядке от старых к новым

    pageReviews.forEach((review, idx) => {
        reviewsList.appendChild(displayReview(review, startIndex + idx));
    });

    document.getElementById('page-number').textContent = currentPage;
}

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage();
    }
});
document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < Math.ceil(reviewsCache.length / reviewsPerPage)) {
        currentPage++;
        renderPage();
    }
});

document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const nickname = document.getElementById('nickname').value.trim();
    const reviewText = document.getElementById('review-text').value.trim();
    const files = Array.from(document.getElementById('review-media').files);

    if (!nickname || !reviewText) {
        alert('Введите имя и комментарий.');
        return;
    }
    if (nickname.length > 30) {
        alert('Максимум 30 символов для имени.');
        return;
    }
    if (reviewText.length > 250) {
        alert('Максимум 250 символов для комментария.');
        return;
    }
    if (files.length > 2) {
        alert('Можно прикрепить максимум 2 файла.');
        return;
    }

    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
            alert('Максимальный размер файла — 5MB.');
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg'];
        if (!allowedTypes.includes(file.type)) {
            alert('Можно загружать только JPG, PNG, GIF и MP3.');
            return;
        }
    }

    const reviewItem = {
        nickname,
        reviewText,
        date: firebase.firestore.FieldValue.serverTimestamp()
    };

    const addReview = (item) => {
        firebase.firestore().collection('reviews').add(item)
            .then(() => {
                document.getElementById('review-form').reset();
                document.getElementById('send_sound').play();
            })
            .catch(err => console.error('Ошибка сохранения:', err));
    };

    if (files.length > 0) {
        Promise.all(files.map(file => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'reviews_unsigned');
            return fetch('https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload', {
                method: 'POST',
                body: formData
            }).then(res => res.json());
        }))
        .then(results => {
            reviewItem.mediaUrls = results.map(r => r.secure_url);
            addReview(reviewItem);
        })
        .catch(err => {
            console.error('Ошибка загрузки файлов:', err);
            alert('Не удалось загрузить файлы.');
        });
    } else {
        addReview(reviewItem);
    }
});

window.addEventListener('load', () => {
    firebase.firestore().collection('reviews')
        .orderBy('date', 'asc') // всегда от старых к новым
        .onSnapshot(snapshot => {
            reviewsCache = snapshot.docs.map(doc => doc.data());
            renderPage();
        });
});
