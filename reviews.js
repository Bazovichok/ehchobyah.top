// reviews.js — актуализирован: теги time-only, видео (mp4/webm/mov) <=15MB, пагинация 30/стр, dropdown по номеру

// ========== Настройки ==========
const PER_PAGE = 30; // уменьшено с 40 до 30
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload';
const UPLOAD_PRESET = 'reviews_unsigned';
// ===========================

let ALL_REVIEWS = []; // все отзывы (от старых к новым)
let currentPage = 1;

// музыка-кнопка
document.getElementById('toggle_music').addEventListener('click', function() {
    const music = document.getElementById('background_music');
    if (music.paused) { music.play(); this.textContent = '♫'; } else { music.pause(); this.textContent = '🔇'; }
});

// Утилиты
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function formatDisplayDate(maybeTimestamp){
    if (!maybeTimestamp) return 'Date not available';
    if (maybeTimestamp.toDate) return maybeTimestamp.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    return String(maybeTimestamp);
}

// Преобразует текст: делает кликабельные теги (date-time и time-only)
function linkifyTags(text) {
    if (!text) return '';
    let safe = escapeHtml(text);

    // ссылки (оставляем как обычный текст/ссылка — не обрабатываем внешние embeds здесь)
    safe = safe.replace(/https?:\/\/[^\s<>"']+/g, function(url) {
        const esc = escapeHtml(url);
        return `<a href="${esc}" target="_blank" rel="noopener noreferrer">${esc}</a>`;
    });

    // теги полного формата @DD.MM.YYYY, HH:MM:SS
    safe = safe.replace(/@(\d{2}\.\d{2}\.\d{4},\s\d{2}:\d{2}:\d{2})/g, (m,p1) => `<a href="#" class="tag-link" data-target="${p1}">@${p1}</a>`);

    // теги time-only @HH:MM:SS
    safe = safe.replace(/@(\d{2}:\d{2}:\d{2})/g, (m,p1) => `<a href="#" class="tag-link-time" data-target="${p1}">@${p1}</a>`);

    return safe;
}

// Пауза всех воспроизводимых медиа на странице (чтобы не было дублирующего звука)
function pauseAllMedia() {
    try {
        document.querySelectorAll('audio, video').forEach(m => { try { m.pause(); } catch(e) {} });
    } catch(e){}
}

// Lightbox (файлы/картинки)
function closeLightbox() {
    const ex = document.getElementById('image-lightbox'); if (ex) ex.remove();
}
function openLightboxImage(src, originEl) {
    pauseAllMedia();
    closeLightbox();
    const overlay = document.createElement('div'); overlay.id = 'image-lightbox';
    overlay.addEventListener('click', () => { if (originEl) { originEl.classList.add('blurred'); originEl.dataset.isBlurred = 'true'; } closeLightbox(); });
    const img = document.createElement('img'); img.src = src; img.alt = '';
    img.addEventListener('click', e => { e.stopPropagation(); if (originEl) { originEl.classList.add('blurred'); originEl.dataset.isBlurred = 'true'; } closeLightbox(); });
    overlay.appendChild(img); document.body.appendChild(overlay);
}
function openLightboxVideo(src) {
    pauseAllMedia();
    closeLightbox();
    const overlay = document.createElement('div'); overlay.id = 'image-lightbox';
    overlay.addEventListener('click', () => closeLightbox());
    const video = document.createElement('video'); video.src = src; video.controls = true; video.autoplay = true;
    overlay.appendChild(video); document.body.appendChild(overlay);
}

// Создать карточку отзыва
function createReviewNode(review, globalIndex) {
    const card = document.createElement('div'); card.className = 'review-card'; card.dataset.index = String(globalIndex);

    const displayDate = formatDisplayDate(review.date);
    card.dataset.date = displayDate;

    // header блок: ник + дата
    const header = document.createElement('div'); header.className = 'header-block';
    const nick = document.createElement('span'); nick.className = 'nickname'; nick.textContent = review.nickname || 'Anonymous';
    const dash = document.createTextNode(' - ');
    const dateSpan = document.createElement('span'); dateSpan.className = 'datetime'; dateSpan.textContent = displayDate;
    header.appendChild(nick); header.appendChild(dash); header.appendChild(dateSpan);

    // content блок (текст с тегами)
    const content = document.createElement('div'); content.className = 'content-block';
    content.innerHTML = linkifyTags(review.reviewText || '');

    // media container
    const mediaContainer = document.createElement('div'); mediaContainer.className = 'media-container';

    // Поддержка mediaUrls (массив) или mediaUrl (один)
    let urls = [];
    if (Array.isArray(review.mediaUrls) && review.mediaUrls.length) urls = review.mediaUrls.slice(0,2);
    else if (review.mediaUrl) urls = [review.mediaUrl];

    urls.forEach(u => {
        if (!u) return;
        const lower = u.toLowerCase();
        if (/\.(jpe?g|png|gif)(\?.*)?$/.test(lower)) {
            const img = document.createElement('img'); img.src = u;
            img.classList.add('blurred'); img.dataset.isBlurred = 'true';
            img.style.maxWidth = '200px'; img.style.maxHeight = '200px';
            img.style.display = 'block'; img.style.marginTop = '10px';
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                const isBlurred = img.dataset.isBlurred === 'true';
                if (isBlurred) {
                    img.classList.remove('blurred'); img.dataset.isBlurred = 'false';
                    openLightboxImage(u, img);
                } else {
                    img.classList.add('blurred'); img.dataset.isBlurred = 'true';
                    closeLightbox();
                }
            });
            mediaContainer.appendChild(img);
            return;
        }
        if (/\.mp3(\?.*)?$/.test(lower)) {
            const audio = document.createElement('audio'); audio.controls = true; audio.src = u;
            audio.style.marginTop = '10px';
            mediaContainer.appendChild(audio);
            return;
        }
        if (/\.(mp4|webm|mov)(\?.*)?$/.test(lower)) {
            const vid = document.createElement('video'); vid.src = u;
            vid.style.maxWidth = '220px'; vid.style.maxHeight = '160px';
            vid.style.display = 'block'; vid.style.marginTop = '10px';
            vid.style.cursor = 'pointer';
            // не автоплей в превью
            vid.controls = true;
            // при клике открываем lightbox (и ставим pause любым другим медиа)
            vid.addEventListener('click', function(e) {
                e.preventDefault();
                openLightboxVideo(u);
            });
            mediaContainer.appendChild(vid);
            return;
        }
        // fallback: обычная ссылка
        const a = document.createElement('a'); a.href = u; a.textContent = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        mediaContainer.appendChild(a);
    });

    card.appendChild(header);
    card.appendChild(content);
    if (mediaContainer.children.length) card.appendChild(mediaContainer);
    return card;
}

// Render указанной страницы
function renderPage(page) {
    const list = document.getElementById('reviews-list');
    list.innerHTML = '';
    const total = ALL_REVIEWS.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    currentPage = Math.min(Math.max(page, 1), totalPages);

    const start = (currentPage - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, total);

    const pageReviews = ALL_REVIEWS.slice(start, end);
    pageReviews.forEach((r, idx) => {
        const node = createReviewNode(r, start + idx);
        list.appendChild(node);
    });

    document.getElementById('page-number').textContent = String(currentPage);
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;

    buildPageDropdown(totalPages);
}

// Prev/Next
document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); } });
document.getElementById('next-page').addEventListener('click', () => { const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE)); if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } });

// Dropdown по номеру страницы
const pageNumberBtn = document.getElementById('page-number');
const pageDropdown = document.getElementById('page-dropdown');

pageNumberBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const shown = pageDropdown.style.display === 'block';
    pageDropdown.style.display = shown ? 'none' : 'block';
    pageNumberBtn.setAttribute('aria-expanded', String(!shown));
});
document.addEventListener('click', () => { pageDropdown.style.display = 'none'; pageNumberBtn.setAttribute('aria-expanded','false'); });

function buildPageDropdown(totalPages) {
    pageDropdown.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = 'Стр ' + i;
        btn.style.display = 'block'; btn.style.width = '100%'; btn.style.padding = '6px 8px';
        btn.style.border = 'none'; btn.style.background = 'transparent'; btn.style.textAlign = 'left'; btn.style.cursor = 'pointer';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            pageDropdown.style.display = 'none';
            pageNumberBtn.setAttribute('aria-expanded','false');
            currentPage = i;
            renderPage(currentPage);
        });
        pageDropdown.appendChild(btn);
    }
}

// Тег-клики: поддержка @DD.MM.YYYY, HH:MM:SS и @HH:MM:SS
document.addEventListener('click', function(e) {
    const t = e.target;
    if (!t) return;

    if (t.classList && t.classList.contains('tag-link')) {
        e.preventDefault();
        const wanted = t.dataset.target; // full datetime
        let foundIndex = -1;
        for (let i = 0; i < ALL_REVIEWS.length; i++) {
            if (formatDisplayDate(ALL_REVIEWS[i].date) === wanted) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        currentPage = page;
        renderPage(page);
        // подсветка и скролл
        setTimeout(() => {
            const nodes = document.querySelectorAll('.review-card');
            let targetNode = null;
            nodes.forEach(n => { if (n.dataset.date === wanted) targetNode = n; });
            if (targetNode) { targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetNode.classList.add('highlight'); setTimeout(()=>targetNode.classList.remove('highlight'),1100); }
        }, 120);
        return;
    }

    if (t.classList && t.classList.contains('tag-link-time')) {
        e.preventDefault();
        const wantedTime = t.dataset.target; // "HH:MM:SS"
        let foundIndex = -1;
        for (let i = 0; i < ALL_REVIEWS.length; i++) {
            const d = formatDisplayDate(ALL_REVIEWS[i].date);
            if (d.slice(-8) === wantedTime) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        currentPage = page;
        renderPage(page);
        setTimeout(() => {
            const wanted = formatDisplayDate(ALL_REVIEWS[foundIndex].date);
            const nodes = document.querySelectorAll('.review-card');
            let targetNode = null;
            nodes.forEach(n => { if (n.dataset.date === wanted) targetNode = n; });
            if (targetNode) { targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetNode.classList.add('highlight'); setTimeout(()=>targetNode.classList.remove('highlight'),1100); }
        }, 120);
        return;
    }
});

// Отправка формы: загрузка до двух файлов; валидация: картинки/mp3 <=5MB, видео mp4/webm/mov <=15MB
document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const reviewText = document.getElementById('review-text').value.trim();
    const files = Array.from(document.getElementById('review-media').files || []).slice(0,2);

    if (!nickname || !reviewText) { alert('Введите имя и текст.'); return; }
    if (nickname.length > 30) { alert('Ник слишком длинный (макс 30).'); return; }
    if (reviewText.length > 250) { alert('Комментарий слишком длинный (макс 250).'); return; }
    if (files.length > 2) { alert('Можно прикрепить максимум 2 файла.'); return; }

    // валидация размеров
    for (const f of files) {
        const t = f.type || '';
        if (t.startsWith('image/')) {
            if (f.size > 5*1024*1024) { alert('Картинки/GIF: max 5MB'); return; }
        } else if (t === 'audio/mpeg') {
            if (f.size > 5*1024*1024) { alert('MP3: max 5MB'); return; }
        } else if (t.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name)) {
            if (f.size > 15*1024*1024) { alert('Видео: max 15MB'); return; }
        } else {
            alert('Недопустимый тип файла: ' + t); return;
        }
    }

    const doc = { nickname: nickname, reviewText: reviewText, date: firebase.firestore.FieldValue.serverTimestamp() };

    if (files.length === 0) {
        firebase.firestore().collection('reviews').add(doc)
            .then(() => { document.getElementById('review-form').reset(); document.getElementById('send_sound').play(); })
            .catch(err => { console.error('Firestore add error', err); alert('Ошибка при сохранении (см. консоль).'); });
        return;
    }

    // загрузка на Cloudinary
    const uploads = files.map(file => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', UPLOAD_PRESET);
        return fetch(CLOUDINARY_URL, { method: 'POST', body: fd }).then(r => r.json());
    });

    Promise.all(uploads)
        .then(results => {
            const urls = results.map(r => r && r.secure_url ? r.secure_url : null).filter(Boolean);
            if (!urls.length) throw new Error('Cloudinary did not return URLs');
            doc.mediaUrls = urls;
            if (urls.length === 1) doc.mediaUrl = urls[0];
            return firebase.firestore().collection('reviews').add(doc);
        })
        .then(() => {
            document.getElementById('review-form').reset();
            document.getElementById('send_sound').play();
            // опция: можно перейти на последнюю страницу и подсветить новый отзыв — по желанию
        })
        .catch(err => {
            console.error('Upload/save error', err);
            if (err && err.error && err.error.message) alert('Cloudinary error: ' + err.error.message);
            else if (err && err.message) alert('Ошибка: ' + err.message);
            else alert('Не удалось загрузить/сохранить (см. консоль).');
        });
});

// Подписка на Firestore (ordered asc: старые -> новые), ждём инициализации firebase
function waitForFirebaseInit(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function check() {
            try {
                if (window.firebase && firebase.apps && firebase.apps.length > 0) return resolve();
            } catch(e){}
            if (Date.now() - start > timeoutMs) return reject(new Error('Firebase init timeout'));
            setTimeout(check, 50);
        })();
    });
}

window.addEventListener('load', function() {
    waitForFirebaseInit(5000).then(() => {
        firebase.firestore().collection('reviews').orderBy('date', 'asc').onSnapshot(snapshot => {
            const arr = [];
            snapshot.forEach(doc => arr.push(doc.data()));
            ALL_REVIEWS = arr;
            const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
            if (currentPage > totalPages) currentPage = totalPages;
            renderPage(currentPage);
        }, err => {
            console.error('onSnapshot error', err);
            // fallback get
            firebase.firestore().collection('reviews').orderBy('date','asc').get()
                .then(snap => {
                    const arr = [];
                    snap.forEach(doc => arr.push(doc.data()));
                    ALL_REVIEWS = arr;
                    renderPage(currentPage);
                }).catch(e => {
                    console.error('Firestore read error', e);
                    document.getElementById('reviews-list').innerHTML = '<div style="color:#f00;padding:10px;">Не удалось загрузить отзывы. Проверьте настройки Firestore (см. консоль).</div>';
                });
        });
    }).catch(err => {
        console.error('Firebase init error', err);
        document.getElementById('reviews-list').innerHTML = '<div style="color:#f00;padding:10px;">Ошибка инициализации Firebase. См. консоль.</div>';
    });
});
