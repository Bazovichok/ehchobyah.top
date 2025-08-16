// reviews.js (обновлён — lightbox + карточки + пагинация + теги + возврат блюра)

// Конфигурация
const PER_PAGE = 40;
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload';
const UPLOAD_PRESET = 'reviews_unsigned';

let ALL_REVIEWS = []; // все отзывы (старые -> новые)
let currentPage = 1;

// Включаем/выключаем фон. 
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

// Вспомогательные функции
function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function formatDisplayDate(maybeTimestamp) {
    if (!maybeTimestamp) return 'Date not available';
    if (maybeTimestamp.toDate) {
        return maybeTimestamp.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    }
    return String(maybeTimestamp);
}

function linkifyTags(text) {
    const safe = escapeHtml(text || '');
    return safe.replace(/@(\d{2}\.\d{2}\.\d{4},\s\d{2}:\d{2}:\d{2})/g,
        (m, p1) => `<a href="#" class="tag-link" data-target="${p1}">@${p1}</a>`);
}

// Создать DOM-узел карточки отзыва
function createReviewNode(review, globalIndex) {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.dataset.index = String(globalIndex);
    // дата для поиска
    const displayDate = formatDisplayDate(review.date);
    card.dataset.date = displayDate;

    // header-block (ник + дата)
    const header = document.createElement('div');
    header.className = 'header-block';

    const nickSpan = document.createElement('span');
    nickSpan.className = 'nickname';
    nickSpan.textContent = review.nickname || 'Anonymous';
    header.appendChild(nickSpan);

    const dash = document.createTextNode(' - ');
    header.appendChild(dash);

    const dateSpan = document.createElement('span');
    dateSpan.className = 'datetime';
    dateSpan.textContent = displayDate;
    header.appendChild(dateSpan);

    // при клике на header можно скопировать тег в буфер (как опция)
    header.addEventListener('click', () => {
        try {
            navigator.clipboard.writeText(`@${displayDate}`);
        } catch(e) { /* ignore */ }
    });

    // content-block (текст)
    const content = document.createElement('div');
    content.className = 'content-block';
    content.innerHTML = linkifyTags(review.reviewText || '');

    // media
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'media-container';

    // извлечём URL'ы (поддержка mediaUrls и mediaUrl)
    let urls = [];
    if (Array.isArray(review.mediaUrls) && review.mediaUrls.length) urls = review.mediaUrls.slice(0,2);
    else if (review.mediaUrl) urls = [review.mediaUrl];

    // картинки сначала, аудио позже
    const images = urls.filter(u => /(\.jpe?g|\.png|\.gif)/i.test(u));
    const audios = urls.filter(u => /\.mp3(\?.*)?$/i.test(u) || /audio/i.test(u));

    images.forEach((u, idx) => {
        const img = document.createElement('img');
        img.src = u;
        img.classList.add('blurred');
        img.dataset.isBlurred = 'true';
        img.dataset.src = u;
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';

        // при клике: если блюр — убрать блюр и открыть lightbox; если нет — вернуть блюр
        img.addEventListener('click', () => {
            const isBlurred = img.dataset.isBlurred === 'true';
            if (isBlurred) {
                // убираем блюр
                img.classList.remove('blurred');
                img.dataset.isBlurred = 'false';
                // открываем lightbox (фиксированный overlay) для увеличения
                openLightbox(img.src, img);
            } else {
                // вернуть блюр (и закрыть любой световой оверлей, если открыт)
                img.classList.add('blurred');
                img.dataset.isBlurred = 'true';
                closeLightboxIfMatching(img);
            }
        });

        mediaContainer.appendChild(img);
    });

    audios.forEach(u => {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = u;
        mediaContainer.appendChild(audio);
    });

    // сборка
    card.appendChild(header);
    card.appendChild(content);
    if (urls.length) card.appendChild(mediaContainer);

    return card;
}

// Рендер страницы
function renderPage(page) {
    const list = document.getElementById('reviews-list');
    list.innerHTML = '';

    const total = ALL_REVIEWS.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    currentPage = Math.min(Math.max(page, 1), totalPages);

    const start = (currentPage - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, total);

    const pageReviews = ALL_REVIEWS.slice(start, end); // старые -> новые

    pageReviews.forEach((r, idx) => {
        const node = createReviewNode(r, start + idx);
        list.appendChild(node);
    });

    document.getElementById('page-number').textContent = String(currentPage);
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

// Пагинация
document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(currentPage); }
});
document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
    if (currentPage < totalPages) { currentPage++; renderPage(currentPage); }
});

// Lightbox: открывает оверлей с изображением, при клике закрывает и возвращает блюр
function openLightbox(src, originatingImg) {
    // Если уже есть lightbox — удалим старый (и вернём блюр у старого источника)
    closeLightbox();

    const overlay = document.createElement('div');
    overlay.id = 'image-lightbox';
    overlay.addEventListener('click', () => {
        // при закрытии возвращаем блюр у картинки-источника (если она существует в DOM)
        if (originatingImg && originatingImg instanceof HTMLElement) {
            originatingImg.classList.add('blurred');
            originatingImg.dataset.isBlurred = 'true';
        }
        closeLightbox();
    });

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    // клик по самой картинке также закрывает (и блюр возвращается)
    img.addEventListener('click', (e) => {
        e.stopPropagation(); // чтобы не срабатывало дважды
        if (originatingImg && originatingImg instanceof HTMLElement) {
            originatingImg.classList.add('blurred');
            originatingImg.dataset.isBlurred = 'true';
        }
        closeLightbox();
    });

    overlay.appendChild(img);
    document.body.appendChild(overlay);
}

function closeLightbox() {
    const existing = document.getElementById('image-lightbox');
    if (existing) existing.remove();
}

function closeLightboxIfMatching(imgEl) {
    const lb = document.getElementById('image-lightbox');
    if (!lb) return;
    const lbImg = lb.querySelector('img');
    if (lbImg && lbImg.src === imgEl.src) {
        closeLightbox();
    }
}

// Делегированная обработка клика по тегам @DD.MM.YYYY, HH:MM:SS
document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('tag-link')) {
        e.preventDefault();
        const wantedDate = target.dataset.target;

        // найти индекс в ALL_REVIEWS
        let foundIndex = -1;
        for (let i = 0; i < ALL_REVIEWS.length; i++) {
            const disp = formatDisplayDate(ALL_REVIEWS[i].date);
            if (disp === wantedDate) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }

        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        currentPage = page;
        renderPage(page);

        // Подождать, пока DOM отрисует, затем прокрутить к нужной карточке
        setTimeout(() => {
            const list = document.getElementById('reviews-list');
            const nodes = list.querySelectorAll('.review-card');
            let targetNode = null;
            nodes.forEach(n => { if (n.dataset.date === wantedDate) targetNode = n; });
            if (targetNode) {
                targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetNode.classList.add('highlight');
                setTimeout(() => targetNode.classList.remove('highlight'), 1100);
            }
        }, 120);
    }
});

// Отправка формы: загрузка до 2 файлов и запись в Firestore
document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const reviewText = document.getElementById('review-text').value.trim();
    const files = Array.from(document.getElementById('review-media').files || []).slice(0, 2);

    if (!nickname || !reviewText) { alert('Введите имя и текст.'); return; }
    if (nickname.length > 30) { alert('Ник слишком длинный (макс 30).'); return; }
    if (reviewText.length > 250) { alert('Комментарий слишком длинный (макс 250).'); return; }
    if (files.length > 2) { alert('Можно прикрепить максимум 2 файла.'); return; }

    const allowed = ['image/jpeg','image/png','image/gif','audio/mpeg'];
    for (const f of files) {
        if (!allowed.includes(f.type)) { alert('Недопустимый тип.'); return; }
        if (f.size > 5*1024*1024) { alert('Файл слишком большой (макс 5MB).'); return; }
    }

    const toSave = { nickname, reviewText, date: firebase.firestore.FieldValue.serverTimestamp() };

    if (files.length === 0) {
        firebase.firestore().collection('reviews').add(toSave)
            .then(() => { document.getElementById('review-form').reset(); document.getElementById('send_sound').play(); })
            .catch(err => { console.error(err); alert('Ошибка при сохранении.'); });
        return;
    }

    // Загрузка всех файлов параллельно
    const uploads = files.map(file => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', UPLOAD_PRESET);
        return fetch(CLOUDINARY_URL, { method: 'POST', body: fd }).then(r => r.json());
    });

    Promise.all(uploads)
        .then(results => {
            const urls = results.map(r => r.secure_url).filter(Boolean);
            if (urls.length === 1) { toSave.mediaUrl = urls[0]; toSave.mediaUrls = urls; }
            else if (urls.length > 1) toSave.mediaUrls = urls;
            return firebase.firestore().collection('reviews').add(toSave);
        })
        .then(() => {
            document.getElementById('review-form').reset();
            document.getElementById('send_sound').play();
        })
        .catch(err => {
            console.error('Upload/Save error:', err);
            alert('Не удалось загрузить файлы или сохранить отзыв.');
        });
});

// Подписка на отзывы (реалтайм), собираем весь массив и рендерим текущую страницу
window.addEventListener('load', function() {
    firebase.firestore().collection('reviews').orderBy('date', 'asc')
        .onSnapshot(snapshot => {
            const arr = [];
            snapshot.forEach(doc => arr.push(doc.data()));
            ALL_REVIEWS = arr;
            // корректируем текущую страницу, если надо
            const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
            if (currentPage > totalPages) currentPage = totalPages;
            renderPage(currentPage);
        }, err => console.error('Firestore read error:', err));
});
