// reviews.js — исправленная версия: видео-превью блюрятся, lightbox корректно останавливает звук,
// и предотвращаем ненужный re-render текущей страницы (чтобы не дергалось при тегах/новых коммерах).

/* ====== Настройки ====== */
const PER_PAGE = 30; // как у тебя
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload';
const UPLOAD_PRESET = 'reviews_unsigned';
/* ======================= */

let ALL_REVIEWS = []; // { id, nickname, reviewText, date, mediaUrl?, mediaUrls? }
let currentPage = 1;

// cached ids currently rendered on page (to avoid re-render if unchanged)
let renderedSliceIds = []; // array of doc.id strings

// музыка
document.getElementById('toggle_music').addEventListener('click', function() {
    const music = document.getElementById('background_music');
    if (music.paused) { music.play(); this.textContent = '♫'; } else { music.pause(); this.textContent = '🔇'; }
});

// утилиты
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function formatDisplayDate(maybeTimestamp){
    if (!maybeTimestamp) return 'Date not available';
    if (maybeTimestamp.toDate) return maybeTimestamp.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    return String(maybeTimestamp);
}

// Pause all media on page (used before opening lightbox)
function pauseAllMedia() {
    try {
        document.querySelectorAll('audio, video').forEach(m => {
            try { m.pause(); } catch(e) {}
        });
    } catch(e){}
}

// Lightbox: stops and removes video element safely
function closeLightbox() {
    const ex = document.getElementById('image-lightbox');
    if (!ex) return;
    // If contains video element, pause and clear src before removal to stop audio
    const v = ex.querySelector('video');
    if (v) {
        try { v.pause(); } catch(e) {}
        try { v.src = ''; } catch(e) {}
        try { v.load && v.load(); } catch(e) {}
    }
    // If contains iframe, try to remove src to stop audio
    const iframe = ex.querySelector('iframe');
    if (iframe) {
        try { iframe.src = 'about:blank'; } catch(e) {}
    }
    ex.remove();
}

function openLightboxImage(src, originEl) {
    pauseAllMedia();
    closeLightbox();
    const overlay = document.createElement('div'); overlay.id = 'image-lightbox';
    overlay.style.position='fixed'; overlay.style.inset='0';
    overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='9999';
    overlay.addEventListener('click', function(){
        if (originEl instanceof HTMLElement) {
            originEl.classList.add('blurred'); originEl.dataset.isBlurred='true';
        }
        closeLightbox();
    });
    const img = document.createElement('img'); img.src = src; img.style.maxWidth='95%'; img.style.maxHeight='95%';
    img.addEventListener('click', function(e){ e.stopPropagation(); if (originEl instanceof HTMLElement) { originEl.classList.add('blurred'); originEl.dataset.isBlurred='true'; } closeLightbox(); });
    overlay.appendChild(img);
    document.body.appendChild(overlay);
}

function openLightboxVideo(src) {
    pauseAllMedia();
    closeLightbox();
    const overlay = document.createElement('div'); overlay.id = 'image-lightbox';
    overlay.style.position='fixed'; overlay.style.inset='0';
    overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='9999';
    overlay.addEventListener('click', function(){ closeLightbox(); });
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.style.maxWidth = '95%';
    video.style.maxHeight = '95%';
    overlay.appendChild(video);
    document.body.appendChild(overlay);

    // Ensure on overlay removal we stop and clear src (handled in closeLightbox)
    // Also stop propagation when clicking video controls
    video.addEventListener('click', function(e){ e.stopPropagation(); });
}

// Создание DOM-узла для одного отзыва
function createReviewNode(review, globalIndex) {
    // review has id property from Firestore doc.id
    const card = document.createElement('div');
    card.className = 'review-card';
    card.dataset.index = String(globalIndex);
    if (review.id) card.dataset.id = review.id;

    const displayDate = formatDisplayDate(review.date);
    card.dataset.date = displayDate;

    // header
    const header = document.createElement('div'); header.className = 'header-block';
    const nick = document.createElement('span'); nick.className='nickname'; nick.textContent = review.nickname || 'Anonymous';
    header.appendChild(nick);
    header.appendChild(document.createTextNode(' - '));
    const dateSpan = document.createElement('span'); dateSpan.className='datetime'; dateSpan.textContent = displayDate;
    header.appendChild(dateSpan);

    // content
    const content = document.createElement('div'); content.className = 'content-block';
    // simple tagification handled elsewhere; keep text safe
    content.innerHTML = escapeHtml(review.reviewText || '')
        // full datetime tag format
        .replace(/@(\d{2}\.\d{2}\.\d{4},\s\d{2}:\d{2}:\d{2})/g, (m,p1) => `<a href="#" class="tag-link" data-target="${escapeHtml(p1)}">@${escapeHtml(p1)}</a>`)
        // time-only tag
        .replace(/@(\d{2}:\d{2}:\d{2})/g, (m,p1) => `<a href="#" class="tag-link-time" data-target="${escapeHtml(p1)}">@${escapeHtml(p1)}</a>`);

    // media container
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'media-container';

    // collect urls
    let urls = [];
    if (Array.isArray(review.mediaUrls) && review.mediaUrls.length) urls = review.mediaUrls.slice(0,2);
    else if (review.mediaUrl) urls = [review.mediaUrl];

    urls.forEach(u => {
        if (!u) return;
        const low = u.toLowerCase();

        // image
        if (/\.(jpe?g|png|gif)(\?.*)?$/.test(low)) {
            const img = document.createElement('img');
            img.src = u;
            img.classList.add('blurred');
            img.dataset.isBlurred = 'true';
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            img.style.display = 'block';
            img.style.marginTop = '10px';
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

        // audio mp3
        if (/\.mp3(\?.*)?$/.test(low)) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = u;
            audio.style.marginTop = '10px';
            mediaContainer.appendChild(audio);
            return;
        }

        // local video (mp4, webm, mov) — PREVIEW: muted, blurred, no controls; open lightbox plays full player
        if (/\.(mp4|webm|mov)(\?.*)?$/.test(low)) {
            const vid = document.createElement('video');
            vid.src = u;
            vid.classList.add('preview', 'blurred'); // preview class + blurred
            vid.dataset.isBlurred = 'true';
            vid.muted = true;           // prevent preview sound
            vid.controls = false;       // no controls in preview
            vid.preload = 'metadata';
            vid.style.maxWidth = '220px';
            vid.style.maxHeight = '160px';
            vid.style.display = 'block';
            vid.style.marginTop = '10px';
            vid.style.cursor = 'pointer';

            // Clicking preview toggles blur state and opens lightbox
            vid.addEventListener('click', function(e) {
                e.preventDefault();
                const isBlurred = vid.dataset.isBlurred === 'true';
                if (isBlurred) {
                    // reveal => remove blur visually and open lightbox
                    vid.classList.remove('blurred'); vid.dataset.isBlurred = 'false';
                    openLightboxVideo(u);
                } else {
                    // re-blur local preview (close lightbox separately)
                    vid.classList.add('blurred'); vid.dataset.isBlurred = 'true';
                    closeLightbox();
                    // ensure preview itself is paused and muted (just in case)
                    try { vid.pause(); vid.currentTime = 0; vid.muted = true; } catch(e){}
                }
            });

            mediaContainer.appendChild(vid);
            return;
        }

        // fallback link
        const a = document.createElement('a'); a.href = u; a.textContent = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        mediaContainer.appendChild(a);
    });

    card.appendChild(header);
    card.appendChild(content);
    if (mediaContainer.children.length) card.appendChild(mediaContainer);

    return card;
}

// Helper: compare arrays equality shallow
function arraysEqual(a,b){
    if (a.length !== b.length) return false;
    for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return false;
    return true;
}

// Render page — but skip re-render if visible slice ids unchanged
function renderPage(page) {
    const list = document.getElementById('reviews-list');
    const total = ALL_REVIEWS.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(Math.max(page, 1), totalPages);
    currentPage = page;

    const start = (currentPage - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, total);
    const pageSlice = ALL_REVIEWS.slice(start, end);

    const newSliceIds = pageSlice.map(r => r.id || (r.date ? formatDisplayDate(r.date) : String(start++))); // fallback id if none

    // If same as renderedSliceIds, skip actual DOM recreate (this prevents reloading videos unnecessarily)
    if (arraysEqual(newSliceIds, renderedSliceIds)) {
        // still update pagination UI (buttons/text)
        document.getElementById('page-number').textContent = String(currentPage);
        document.getElementById('prev-page').disabled = currentPage <= 1;
        document.getElementById('next-page').disabled = currentPage >= totalPages;
        buildPageDropdown(totalPages);
        return;
    }

    // else re-render
    renderedSliceIds = newSliceIds.slice(0);
    list.innerHTML = '';

    pageSlice.forEach((r, idx) => {
        const node = createReviewNode(r, start + idx);
        list.appendChild(node);
    });

    document.getElementById('page-number').textContent = String(currentPage);
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    buildPageDropdown(totalPages);
}

// Prev/Next handlers
document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); } });
document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
    if (currentPage < totalPages) { currentPage++; renderPage(currentPage); }
});

// Dropdown page number
const pageNumberBtn = document.getElementById('page-number');
const pageDropdown = document.getElementById('page-dropdown');

pageNumberBtn.addEventListener('click', function(e){
    e.stopPropagation();
    const shown = pageDropdown.style.display === 'block';
    pageDropdown.style.display = shown ? 'none' : 'block';
});
document.addEventListener('click', () => { pageDropdown.style.display = 'none'; });

function buildPageDropdown(totalPages) {
    pageDropdown.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const b = document.createElement('button');
        b.textContent = 'Стр ' + i;
        b.style.display = 'block';
        b.style.width = '100%';
        b.style.padding = '6px 8px';
        b.style.border = 'none';
        b.style.background = 'transparent';
        b.style.textAlign = 'left';
        b.style.cursor = 'pointer';
        b.addEventListener('click', function(e){
            e.stopPropagation();
            pageDropdown.style.display = 'none';
            currentPage = i;
            renderPage(currentPage);
        });
        pageDropdown.appendChild(b);
    }
}

// Tag click handlers: support full datetime and time-only tags
document.addEventListener('click', function(e){
    const t = e.target;
    if (!t) return;

    // full datetime tag
    if (t.classList && t.classList.contains('tag-link')) {
        e.preventDefault();
        const wanted = t.dataset.target; // exact display date
        let foundIndex = -1;
        for (let i=0;i<ALL_REVIEWS.length;i++){
            if (formatDisplayDate(ALL_REVIEWS[i].date) === wanted) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        // If page is same as currentPage — do NOT re-render (avoid reloading videos). Just scroll and highlight
        if (page === currentPage) {
            const wantedDate = formatDisplayDate(ALL_REVIEWS[foundIndex].date);
            const nodes = document.querySelectorAll('.review-card');
            let targetNode = null;
            nodes.forEach(n => { if (n.dataset.date === wantedDate) targetNode = n; });
            if (targetNode) {
                targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetNode.classList.add('highlight');
                setTimeout(() => targetNode.classList.remove('highlight'), 1100);
            }
        } else {
            currentPage = page;
            renderPage(page);
            setTimeout(() => {
                const wantedDate = formatDisplayDate(ALL_REVIEWS[foundIndex].date);
                const nodes = document.querySelectorAll('.review-card');
                let targetNode = null;
                nodes.forEach(n => { if (n.dataset.date === wantedDate) targetNode = n; });
                if (targetNode) {
                    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetNode.classList.add('highlight');
                    setTimeout(() => targetNode.classList.remove('highlight'), 1100);
                }
            }, 140);
        }
        return;
    }

    // time-only tag
    if (t.classList && t.classList.contains('tag-link-time')) {
        e.preventDefault();
        const wantedTime = t.dataset.target; // 'HH:MM:SS'
        let foundIndex = -1;
        for (let i=0;i<ALL_REVIEWS.length;i++){
            const d = formatDisplayDate(ALL_REVIEWS[i].date);
            if (d.slice(-8) === wantedTime) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        if (page === currentPage) {
            const wanted = formatDisplayDate(ALL_REVIEWS[foundIndex].date);
            const nodes = document.querySelectorAll('.review-card');
            let targetNode = null;
            nodes.forEach(n => { if (n.dataset.date === wanted) targetNode = n; });
            if (targetNode) {
                targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetNode.classList.add('highlight');
                setTimeout(() => targetNode.classList.remove('highlight'), 1100);
            }
        } else {
            currentPage = page;
            renderPage(page);
            setTimeout(() => {
                const wanted = formatDisplayDate(ALL_REVIEWS[foundIndex].date);
                const nodes = document.querySelectorAll('.review-card');
                let targetNode = null;
                nodes.forEach(n => { if (n.dataset.date === wanted) targetNode = n; });
                if (targetNode) {
                    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetNode.classList.add('highlight');
                    setTimeout(() => targetNode.classList.remove('highlight'), 1100);
                }
            }, 140);
        }
        return;
    }
});

// Submit form: upload up to 2 files. Validation: images/mp3 <=5MB, videos mp4/webm/mov <=15MB
document.getElementById('review-form').addEventListener('submit', function(e){
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const reviewText = document.getElementById('review-text').value.trim();
    const files = Array.from(document.getElementById('review-media').files || []).slice(0,2);

    if (!nickname || !reviewText) { alert('Введите имя и текст.'); return; }
    if (nickname.length > 30) { alert('Ник слишком длинный (макс 30).'); return; }
    if (reviewText.length > 250) { alert('Комментарий слишком длинный (макс 250).'); return; }
    if (files.length > 2) { alert('Можно прикрепить максимум 2 файла.'); return; }

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

    const reviewDoc = { nickname: nickname, reviewText: reviewText, date: firebase.firestore.FieldValue.serverTimestamp() };

    if (files.length === 0) {
        firebase.firestore().collection('reviews').add(reviewDoc)
            .then(() => { document.getElementById('review-form').reset(); document.getElementById('send_sound').play(); })
            .catch(err => { console.error('Firestore add error', err); alert('Ошибка при сохранении (см. консоль).'); });
        return;
    }

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
            reviewDoc.mediaUrls = urls;
            if (urls.length === 1) reviewDoc.mediaUrl = urls[0];
            return firebase.firestore().collection('reviews').add(reviewDoc);
        })
        .then(() => {
            document.getElementById('review-form').reset();
            document.getElementById('send_sound').play();
        })
        .catch(err => {
            console.error('Upload/save error', err);
            if (err && err.error && err.error.message) alert('Cloudinary error: ' + err.error.message);
            else if (err && err.message) alert('Ошибка: ' + err.message);
            else alert('Не удалось загрузить/сохранить (см. консоль).');
        });
});

// Firestore subscription — store doc.id to ensure stable ids
function waitForFirebaseInit(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function check() {
            try { if (window.firebase && firebase.apps && firebase.apps.length > 0) return resolve(); } catch(e){}
            if (Date.now() - start > timeoutMs) return reject(new Error('Firebase init timeout'));
            setTimeout(check, 50);
        })();
    });
}

window.addEventListener('load', function() {
    waitForFirebaseInit(5000).then(() => {
        try {
            firebase.firestore().collection('reviews').orderBy('date', 'asc').onSnapshot(snapshot => {
                const arr = [];
                snapshot.forEach(doc => {
                    const data = doc.data() || {};
                    arr.push(Object.assign({ id: doc.id }, data));
                });
                ALL_REVIEWS = arr;
                // If current page out of range, clamp
                const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
                if (currentPage > totalPages) currentPage = totalPages;
                // Render (renderPage itself checks whether slice changed)
                renderPage(currentPage);
            }, err => {
                console.error('onSnapshot error', err);
                // fallback get
                firebase.firestore().collection('reviews').orderBy('date','asc').get()
                    .then(snap => {
                        const arr = [];
                        snap.forEach(doc => { const data = doc.data() || {}; arr.push(Object.assign({ id: doc.id }, data)); });
                        ALL_REVIEWS = arr;
                        renderPage(currentPage);
                    }).catch(e => {
                        console.error('Firestore read error', e);
                        document.getElementById('reviews-list').innerHTML = '<div style="color:#f00;padding:10px;">Не удалось загрузить отзывы. Проверьте настройки Firestore (см. консоль).</div>';
                    });
            });
        } catch(e) {
            console.error('subscribe init error', e);
            document.getElementById('reviews-list').innerHTML = '<div style="color:#f00;padding:10px;">Ошибка инициализации отзывов. См. консоль.</div>';
        }
    }).catch(err => {
        console.error('Firebase init error', err);
        document.getElementById('reviews-list').innerHTML = '<div style="color:#f00;padding:10px;">Ошибка инициализации Firebase. См. консоль.</div>';
    });
});
