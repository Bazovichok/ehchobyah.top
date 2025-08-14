document.getElementById('toggle_music').addEventListener('click', function() {
    let music = document.getElementById('background_music');
    if (music.paused) {
        music.play();
        this.textContent = '♫';
    } else {
        music.pause();
        this.textContent = '🔇';
    }
});

let currentPage = parseInt(localStorage.getItem('currentPage') || '1', 10);
const reviewsPerPage = 40;
let allReviews = [];

function renderPage(page) {
    const list = document.getElementById('reviews-list');
    list.innerHTML = '';

    let start = (page - 1) * reviewsPerPage;
    let end = start + reviewsPerPage;
    let pageReviews = allReviews.slice(start, end);

    pageReviews.forEach(displayReview);
    document.getElementById('page-number').textContent = page;
    localStorage.setItem('currentPage', page);
}

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
});
document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage * reviewsPerPage < allReviews.length) {
        currentPage++;
        renderPage(currentPage);
    }
});

function displayReview(review) {
    const reviewItem = document.createElement('div');
    reviewItem.classList.add('review-item');

    const headerP = document.createElement('p');
    const nicknameSpan = document.createElement('span');
    nicknameSpan.classList.add('nickname');
    nicknameSpan.textContent = review.nickname || 'Anonymous';

    const dateSpan = document.createElement('span');
    dateSpan.classList.add('review-date');
    let displayDate = review.date?.toDate ? review.date.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) : review.date || '';
    dateSpan.textContent = ` - ${displayDate}`;

    headerP.appendChild(nicknameSpan);
    headerP.appendChild(dateSpan);

    const textP = document.createElement('p');
    textP.textContent = review.reviewText || '';

    // Тег-поиск
    textP.innerHTML = textP.innerHTML.replace(/@(\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2})/g, match => {
        return `<span class="tag-link" data-date="${match.slice(1)}" style="color:blue;cursor:pointer;">${match}</span>`;
    });

    reviewItem.appendChild(headerP);
    reviewItem.appendChild(textP);

    // Медиа
    (review.mediaUrls || []).forEach(url => {
        if (url.endsWith('.mp3')) {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.controls = true;
            reviewItem.appendChild(audio);
        } else {
            const img = document.createElement('img');
            img.src = url;
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

    document.getElementById('reviews-list').appendChild(reviewItem);
}

document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const reviewText = document.getElementById('review-text').value.trim();
    const files = [document.getElementById('review-media-1').files[0], document.getElementById('review-media-2').files[0]].filter(Boolean);

    if (!nickname || !reviewText) return alert('Введите имя и текст.');
    if (nickname.length > 30) return alert('Максимум 30 символов в имени.');
    if (reviewText.length > 250) return alert('Максимум 250 символов в комментарии.');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg'];
    for (let file of files) {
        if (file.size > 5 * 1024 * 1024) return alert('Файл больше 5МБ.');
        if (!allowedTypes.includes(file.type)) return alert('Неверный тип файла.');
    }

    const reviewItem = {
        nickname,
        reviewText,
        date: firebase.firestore.FieldValue.serverTimestamp()
    };

    const uploadPromises = files.map(file => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', 'reviews_unsigned');
        return fetch('https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload', {
            method: 'POST',
            body: fd
        }).then(r => r.json()).then(d => d.secure_url);
    });

    Promise.all(uploadPromises).then(urls => {
        reviewItem.mediaUrls = urls;
        return firebase.firestore().collection('reviews').add(reviewItem);
    }).then(() => {
        document.getElementById('review-form').reset();
        document.getElementById('send_sound').play();
    }).catch(console.error);
});

window.addEventListener('load', function() {
    firebase.firestore().collection('reviews')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            allReviews = [];
            snapshot.forEach(doc => allReviews.push(doc.data()));
            renderPage(currentPage);
        });

    document.body.addEventListener('click', e => {
        if (e.target.classList.contains('tag-link')) {
            let date = e.target.dataset.date;
            let target = [...document.querySelectorAll('.review-item')].find(item => item.querySelector('.review-date')?.textContent.includes(date));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.classList.add('highlight');
                setTimeout(() => target.classList.remove('highlight'), 1000);
            }
        }
    });
});
