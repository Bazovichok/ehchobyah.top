// reviews.js — добавлено: YouTube/Twitch inline-embed (preview + lightbox), метки "•" (tag indicators)

const PER_PAGE = 30;
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload';
const UPLOAD_PRESET = 'reviews_unsigned';

let ALL_REVIEWS = []; // items: { id, nickname, reviewText, date, mediaUrl?, mediaUrls? }
let currentPage = 1;
let renderedSliceIds = []; // cached visible doc IDs
let tagsMap = {}; // targetId -> array of { taggerId, taggerIndex }

// музыка-кнопка
document.getElementById('toggle_music').addEventListener('click', function() {
    const music = document.getElementById('background_music');
    if (music.paused) { music.play(); this.textContent = '♫'; } else { music.pause(); this.textContent = '🔇'; }
});

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function formatDisplayDate(maybeTimestamp){
    if (!maybeTimestamp) return 'Date not available';
    if (maybeTimestamp.toDate) return maybeTimestamp.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    return String(maybeTimestamp);
}

// parseExternalEmbed: detect YouTube/Twitch links and return preview/lightbox URLs
function parseExternalEmbed(urlStr) {
    try {
        const u = new URL(urlStr);
        const host = u.hostname.replace(/^www\./i,'').toLowerCase();

        // YouTube
        if (host === 'youtu.be' || host.indexOf('youtube.com') !== -1 || host === 'youtube-nocookie.com') {
            let vid = null;
            if (host === 'youtu.be') vid = u.pathname.slice(1);
            else vid = u.searchParams.get('v') || (u.pathname.match(/\/(embed|shorts)\/([^/]+)/) || [])[2];
            if (vid) {
                return {
                    provider: 'youtube',
                    previewEmbedUrl: 'https://www.youtube.com/embed/' + vid + '?rel=0',
                    lightboxEmbedUrl: 'https://www.youtube.com/embed/' + vid + '?autoplay=1'
                };
            }
        }

        // Twitch (clips or channels)
        if (host.indexOf('twitch.tv') !== -1 || host === 'clips.twitch.tv') {
            const pathParts = u.pathname.split('/').filter(Boolean);
            const parent = window.location.hostname;
            const forbiddenLocal = (parent === 'localhost' || parent === '127.0.0.1' || parent.indexOf('192.168.') === 0 || parent === '');
            // clip
            if (host === 'clips.twitch.tv' && pathParts.length >=1) {
                const slug = pathParts[0];
                if (forbiddenLocal) return { provider: 'twitch', embedPossible: false, url: urlStr };
                return {
                    provider: 'twitch',
                    previewEmbedUrl: 'https://clips.twitch.tv/embed?clip=' + slug + '&parent=' + parent,
                    lightboxEmbedUrl: 'https://clips.twitch.tv/embed?clip=' + slug + '&autoplay=true&parent=' + parent,
                    embedPossible: true
                };
            }
            // /clips/slug or channel
            if (pathParts[0] === 'clips' && pathParts[1]) {
                const slug = pathParts[1];
                if (forbiddenLocal) return { provider:'twitch', embedPossible:false, url:urlStr };
                return {
                    provider:'twitch',
                    previewEmbedUrl: 'https://clips.twitch.tv/embed?clip=' + slug + '&parent=' + parent,
                    lightboxEmbedUrl: 'https://clips.twitch.tv/embed?clip=' + slug + '&autoplay=true&parent=' + parent,
                    embedPossible:true
                };
            }
            if (pathParts.length >= 1) {
                const channel = pathParts[0];
                if (forbiddenLocal) return { provider:'twitch', embedPossible:false, url:urlStr };
                return {
                    provider:'twitch',
                    previewEmbedUrl: 'https://player.twitch.tv/?channel=' + channel + '&parent=' + parent + '&muted=true',
                    lightboxEmbedUrl: 'https://player.twitch.tv/?channel=' + channel + '&parent=' + parent + '&autoplay=true',
                    embedPossible:true
                };
            }
        }
    } catch(e) {
        // invalid URL
    }
    return null;
}

// pause all audio/video on page
function pauseAllMedia() {
    try { document.querySelectorAll('audio, video').forEach(m => { try{ m.pause(); } catch(e){} }); } catch(e){}
}

function closeLightbox() {
    const ex = document.getElementById('image-lightbox'); if (!ex) return;
    // stop video/audio/iframe
    const v = ex.querySelector('video'); if (v) { try { v.pause(); v.src=''; v.load && v.load(); } catch(e){} }
    const iframe = ex.querySelector('iframe'); if (iframe) { try { iframe.src = 'about:blank'; } catch(e){} }
    ex.remove();
}

function openLightboxEmbed(embedUrl) {
    pauseAllMedia(); closeLightbox();
    const overlay = document.createElement('div'); overlay.id='image-lightbox';
    overlay.style.position='fixed'; overlay.style.inset='0';
    overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='9999';
    overlay.addEventListener('click', () => closeLightbox());
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.setAttribute('allow','autoplay; encrypted-media; fullscreen');
    iframe.style.width='90%'; iframe.style.height='80%'; iframe.frameBorder='0';
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
    iframe.addEventListener('click', e => e.stopPropagation());
}

// open image or local video lightbox
function openLightboxImage(src, originEl) {
    pauseAllMedia(); closeLightbox();
    const overlay = document.createElement('div'); overlay.id='image-lightbox';
    overlay.style.position='fixed'; overlay.style.inset='0';
    overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='9999';
    overlay.addEventListener('click', function(){
        if (originEl instanceof HTMLElement) { originEl.classList.add('blurred'); originEl.dataset.isBlurred='true'; }
        closeLightbox();
    });
    const img = document.createElement('img'); img.src = src;
    img.style.maxWidth='95%'; img.style.maxHeight='95%';
    img.addEventListener('click', e => { e.stopPropagation(); if (originEl instanceof HTMLElement) { originEl.classList.add('blurred'); originEl.dataset.isBlurred='true'; } closeLightbox(); });
    overlay.appendChild(img); document.body.appendChild(overlay);
}

function openLightboxVideo(src) {
    pauseAllMedia(); closeLightbox();
    const overlay = document.createElement('div'); overlay.id='image-lightbox';
    overlay.style.position='fixed'; overlay.style.inset='0';
    overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='9999';
    overlay.addEventListener('click', () => closeLightbox());
    const video = document.createElement('video'); video.src = src; video.controls = true; video.autoplay = true;
    video.style.maxWidth='95%'; video.style.maxHeight='95%';
    video.addEventListener('click', e => e.stopPropagation());
    overlay.appendChild(video); document.body.appendChild(overlay);
}

// compute tagsMap from ALL_REVIEWS
function computeTagsMap() {
    tagsMap = {};
    const idByDate = {}; // map displayDate -> index
    for (let i=0;i<ALL_REVIEWS.length;i++){
        const d = formatDisplayDate(ALL_REVIEWS[i].date);
        idByDate[d] = i;
    }
    for (let i=0;i<ALL_REVIEWS.length;i++){
        const r = ALL_REVIEWS[i];
        const text = r.reviewText || '';
        // full datetime tags
        const fullRegex = /@(\d{2}\.\d{2}\.\d{4},\s\d{2}:\d{2}:\d{2})/g;
        let m;
        while ((m = fullRegex.exec(text)) !== null) {
            const targetDate = m[1];
            const targetIndex = idByDate[targetDate];
            if (targetIndex !== undefined) {
                const targetId = ALL_REVIEWS[targetIndex].id || String(targetIndex);
                if (!tagsMap[targetId]) tagsMap[targetId] = [];
                tagsMap[targetId].push({ taggerId: r.id || String(i), taggerIndex: i });
            }
        }
        // time-only tags
        const timeRegex = /@(\d{2}:\d{2}:\d{2})/g;
        while ((m = timeRegex.exec(text)) !== null) {
            const wantedTime = m[1];
            // find first review whose displayDate ends with that time
            let found = -1;
            for (let j=0;j<ALL_REVIEWS.length;j++){
                const ds = formatDisplayDate(ALL_REVIEWS[j].date);
                if (ds.slice(-8) === wantedTime) { found = j; break; }
            }
            if (found !== -1) {
                const targetId = ALL_REVIEWS[found].id || String(found);
                if (!tagsMap[targetId]) tagsMap[targetId] = [];
                tagsMap[targetId].push({ taggerId: r.id || String(i), taggerIndex: i });
            }
        }
    }
}

// build tag indicators (DOM) for a specific card element and its corresponding review index
function buildTagIndicatorsForCard(cardEl, reviewIndex) {
    // remove existing indicators
    let indicators = cardEl.querySelector('.tag-indicators');
    if (!indicators) {
        // append after the datetime span
        indicators = document.createElement('span');
        indicators.className = 'tag-indicators';
        // find datetime span
        const datetimeSpan = cardEl.querySelector('.datetime');
        if (datetimeSpan) datetimeSpan.parentNode.insertBefore(indicators, datetimeSpan.nextSibling);
        else cardEl.querySelector('.header-block').appendChild(indicators);
    } else {
        indicators.innerHTML = '';
    }

    const review = ALL_REVIEWS[reviewIndex];
    const targetId = review.id || String(reviewIndex);
    const arr = tagsMap[targetId] || [];
    // create a dot for each tag (up to a reasonable cap, rest not shown)
    for (let k=0;k<arr.length;k++){
        const dot = document.createElement('span');
        dot.className = 'tag-dot';
        dot.title = 'Перейти к отзыву, который тегнул этот комментарий';
        dot.dataset.taggerIndex = String(arr[k].taggerIndex);
        dot.textContent = '•';
        indicators.appendChild(dot);
    }
    // if no tags, make sure container empty
    if (arr.length === 0) indicators.innerHTML = '';
}

// function to jump to a review by its global index (handles pagination)
function goToReviewByIndex(targetIndex) {
    if (targetIndex < 0 || targetIndex >= ALL_REVIEWS.length) return;
    const page = Math.floor(targetIndex / PER_PAGE) + 1;
    const shouldRender = page !== currentPage;
    if (shouldRender) {
        currentPage = page;
        renderPage(page);
        setTimeout(() => {
            const wanted = formatDisplayDate(ALL_REVIEWS[targetIndex].date);
            const nodes = document.querySelectorAll('.review-card');
            let targetNode = null;
            nodes.forEach(n => { if (n.dataset.date === wanted) targetNode = n; });
            if (targetNode) { targetNode.scrollIntoView({ behavior:'smooth', block:'center' }); targetNode.classList.add('highlight'); setTimeout(()=>targetNode.classList.remove('highlight'),1100); }
        }, 140);
    } else {
        // same page: just scroll/highlight
        const wanted = formatDisplayDate(ALL_REVIEWS[targetIndex].date);
        const nodes = document.querySelectorAll('.review-card');
        let targetNode = null;
        nodes.forEach(n => { if (n.dataset.date === wanted) targetNode = n; });
        if (targetNode) { targetNode.scrollIntoView({ behavior:'smooth', block:'center' }); targetNode.classList.add('highlight'); setTimeout(()=>targetNode.classList.remove('highlight'),1100); }
    }
}

// Create DOM node for one review (includes embedding of YouTube/Twitch previews)
function createReviewNode(review, globalIndex) {
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

    // tag indicators placeholder (filled later)
    const indicators = document.createElement('span'); indicators.className = 'tag-indicators';
    indicators.style.marginLeft = '8px';
    header.appendChild(indicators);

    // content
    const content = document.createElement('div'); content.className = 'content-block';
    // escape and replace tags into anchors
    content.innerHTML = escapeHtml(review.reviewText || '')
        .replace(/@(\d{2}\.\d{2}\.\d{4},\s\d{2}:\d{2}:\d{2})/g, (m,p1) => `<a href="#" class="tag-link" data-target="${escapeHtml(p1)}">@${escapeHtml(p1)}</a>`)
        .replace(/@(\d{2}:\d{2}:\d{2})/g, (m,p1) => `<a href="#" class="tag-link-time" data-target="${escapeHtml(p1)}">@${escapeHtml(p1)}</a>`);

    const mediaContainer = document.createElement('div'); mediaContainer.className='media-container';

    // mediaUrls or mediaUrl
    let urls = [];
    if (Array.isArray(review.mediaUrls) && review.mediaUrls.length) urls = review.mediaUrls.slice(0,2);
    else if (review.mediaUrl) urls = [review.mediaUrl];

    // also parse inline links in text for YouTube/Twitch embeds
    try {
        const inlineLinks = (review.reviewText || '').match(/https?:\/\/[^\s<>"']+/g) || [];
        inlineLinks.forEach(l => {
            // include found links to urls array if they are youtube/twitch and not already in urls
            const emb = parseExternalEmbed(l);
            if (emb && urls.indexOf(l) === -1) urls.push(l);
        });
    } catch(e){}

    for (let i=0;i<Math.min(2, urls.length); i++){
        const u = urls[i];
        if (!u) continue;
        const low = u.toLowerCase();

        // image
        if (/\.(jpe?g|png|gif)(\?.*)?$/.test(low)) {
            const img = document.createElement('img'); img.src = u;
            img.classList.add('blurred'); img.dataset.isBlurred='true';
            img.style.maxWidth='200px'; img.style.maxHeight='200px'; img.style.display='block'; img.style.marginTop='10px';
            img.addEventListener('click', function(){
                const isBlurred = img.dataset.isBlurred === 'true';
                if (isBlurred) { img.classList.remove('blurred'); img.dataset.isBlurred='false'; openLightboxImage(u, img); }
                else { img.classList.add('blurred'); img.dataset.isBlurred='true'; closeLightbox(); }
            });
            mediaContainer.appendChild(img);
            continue;
        }

        // audio
        if (/\.mp3(\?.*)?$/.test(low)) {
            const audio = document.createElement('audio'); audio.controls=true; audio.src=u; audio.style.marginTop='10px';
            mediaContainer.appendChild(audio); continue;
        }

        // local video
        if (/\.(mp4|webm|mov)(\?.*)?$/.test(low)) {
            const vid = document.createElement('video'); vid.src=u;
            vid.classList.add('preview','blurred'); vid.dataset.isBlurred='true'; vid.muted=true; vid.controls=false; vid.preload='metadata';
            vid.style.maxWidth='220px'; vid.style.maxHeight='160px'; vid.style.display='block'; vid.style.marginTop='10px';
            vid.addEventListener('click', function(e){
                e.preventDefault();
                const isBlurred = vid.dataset.isBlurred === 'true';
                if (isBlurred) { vid.classList.remove('blurred'); vid.dataset.isBlurred='false'; openLightboxVideo(u); }
                else { vid.classList.add('blurred'); vid.dataset.isBlurred='true'; closeLightbox(); try{ vid.pause(); vid.currentTime=0; vid.muted=true;}catch(e){} }
            });
            mediaContainer.appendChild(vid); continue;
        }

        // external embed (YouTube/Twitch)
        const emb = parseExternalEmbed(u);
        if (emb) {
            if (emb.provider === 'twitch' && emb.embedPossible === false) {
                // fallback link
                const a = document.createElement('a'); a.href = u; a.className='twitch-fallback'; a.textContent = 'Открыть в Twitch'; a.target = '_blank'; a.rel='noopener noreferrer';
                mediaContainer.appendChild(a);
            } else {
                // show small iframe preview (no autoplay)
                const iframe = document.createElement('iframe'); iframe.src = emb.previewEmbedUrl || emb.lightboxEmbedUrl || u;
                iframe.className = 'embed-preview';
                iframe.setAttribute('frameborder','0'); iframe.setAttribute('allow','encrypted-media; fullscreen');
                iframe.style.width='320px'; iframe.style.height='180px'; iframe.style.marginTop='10px';
                iframe.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); const light = emb.lightboxEmbedUrl || emb.previewEmbedUrl; openLightboxEmbed(light); });
                // also add a click overlay because some browsers ignore clicks on iframe: wrap in div
                const wrap = document.createElement('div'); wrap.style.display='inline-block'; wrap.style.position='relative';
                wrap.appendChild(iframe);
                // overlay to capture clicks
                const overlay = document.createElement('div'); overlay.style.position='absolute'; overlay.style.inset='0'; overlay.style.cursor='pointer';
                overlay.addEventListener('click', function(e){ e.stopPropagation(); const light = emb.lightboxEmbedUrl || emb.previewEmbedUrl; openLightboxEmbed(light); });
                wrap.appendChild(overlay);
                mediaContainer.appendChild(wrap);
            }
            continue;
        }

        // fallback plain link
        const a2 = document.createElement('a'); a2.href=u; a2.textContent=u; a2.target='_blank'; a2.rel='noopener noreferrer';
        mediaContainer.appendChild(a2);
    }

    card.appendChild(header);
    card.appendChild(content);
    if (mediaContainer.children.length) card.appendChild(mediaContainer);
    return card;
}

// helper compare arrays
function arraysEqual(a,b){ if (a.length!==b.length) return false; for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return false; return true; }

// update tag indicators for visible slice without full re-render
function updateVisibleTagIndicators(start, end) {
    // iterate DOM nodes and update indicators
    const nodes = document.querySelectorAll('.review-card');
    nodes.forEach(node => {
        const date = node.dataset.date;
        // find index in ALL_REVIEWS for this date
        let idx = -1;
        for (let i = start; i < end; i++) {
            if (formatDisplayDate(ALL_REVIEWS[i].date) === date) { idx = i; break; }
        }
        if (idx === -1) {
            // fallback search entire array
            for (let j=0;j<ALL_REVIEWS.length;j++){ if (formatDisplayDate(ALL_REVIEWS[j].date) === date) { idx=j; break; } }
        }
        if (idx !== -1) buildTagIndicatorsForCard(node, idx);
    });
}

// buildTagIndicatorsForCard used earlier; redefine here to ensure scope
function buildTagIndicatorsForCard(cardEl, reviewIndex) {
    let indicators = cardEl.querySelector('.tag-indicators');
    if (!indicators) {
        indicators = document.createElement('span'); indicators.className='tag-indicators';
        const datetimeSpan = cardEl.querySelector('.datetime');
        if (datetimeSpan) datetimeSpan.parentNode.insertBefore(indicators, datetimeSpan.nextSibling);
        else cardEl.querySelector('.header-block').appendChild(indicators);
    }
    indicators.innerHTML = '';
    const review = ALL_REVIEWS[reviewIndex];
    const targetId = review.id || String(reviewIndex);
    const arr = tagsMap[targetId] || [];
    for (let k=0;k<arr.length;k++){
        const dot = document.createElement('span'); dot.className='tag-dot'; dot.title='Перейти к тегнувшему отзыву'; dot.dataset.taggerIndex = String(arr[k].taggerIndex); dot.textContent='•';
        indicators.appendChild(dot);
    }
}

// render page (but if visible slice ids unchanged, only update tag indicators)
function renderPage(page) {
    const list = document.getElementById('reviews-list');
    const total = ALL_REVIEWS.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(Math.max(page,1), totalPages);
    currentPage = page;

    const start = (currentPage - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, total);
    const pageSlice = ALL_REVIEWS.slice(start, end);

    const newSliceIds = pageSlice.map(r => r.id || formatDisplayDate(r.date));

    if (arraysEqual(newSliceIds, renderedSliceIds)) {
        // update indicators only (in case someone tagged/un-tagged)
        updateVisibleTagIndicators(start, end);
        // update pagination UI
        document.getElementById('page-number').textContent = String(currentPage);
        document.getElementById('prev-page').disabled = currentPage <= 1;
        document.getElementById('next-page').disabled = currentPage >= totalPages;
        buildPageDropdown(totalPages);
        return;
    }

    // full re-render
    renderedSliceIds = newSliceIds.slice(0);
    list.innerHTML = '';
    for (let i=0;i<pageSlice.length;i++){
        const node = createReviewNode(pageSlice[i], start + i);
        list.appendChild(node);
    }
    // after nodes created, populate tag indicators for them
    for (let i = start; i < end; i++){
        const idxOnPage = i - start;
        const node = list.children[idxOnPage];
        if (node) buildTagIndicatorsForCard(node, i);
    }

    document.getElementById('page-number').textContent = String(currentPage);
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    buildPageDropdown(totalPages);
}

// pagination handlers
document.getElementById('prev-page').addEventListener('click', () => { if (currentPage>1){ currentPage--; renderPage(currentPage); }});
document.getElementById('next-page').addEventListener('click', () => { const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE)); if (currentPage < totalPages){ currentPage++; renderPage(currentPage); }});

// dropdown page number
const pageNumberBtn = document.getElementById('page-number');
const pageDropdown = document.getElementById('page-dropdown');
pageNumberBtn.addEventListener('click', function(e){ e.stopPropagation(); const shown = pageDropdown.style.display === 'block'; pageDropdown.style.display = shown ? 'none' : 'block'; });
document.addEventListener('click', () => { pageDropdown.style.display = 'none'; });
function buildPageDropdown(totalPages) {
    pageDropdown.innerHTML = '';
    for (let i=1;i<=totalPages;i++){
        const b = document.createElement('button'); b.textContent = 'Стр ' + i;
        b.style.display='block'; b.style.width='100%'; b.style.padding='6px 8px'; b.style.border='none'; b.style.background='transparent'; b.style.textAlign='left';
        b.addEventListener('click', function(ev){ ev.stopPropagation(); pageDropdown.style.display='none'; currentPage = i; renderPage(currentPage); });
        pageDropdown.appendChild(b);
    }
}

// click delegation: tags (text) and tag-dot (indicators) and inline embed clicks handled in createReviewNode
document.addEventListener('click', function(e){
    const t = e.target;
    if (!t) return;

    // tag links inside text
    if (t.classList && t.classList.contains('tag-link')) {
        e.preventDefault();
        const wanted = t.dataset.target;
        let foundIndex = -1;
        for (let i=0;i<ALL_REVIEWS.length;i++){ if (formatDisplayDate(ALL_REVIEWS[i].date) === wanted){ foundIndex=i; break; } }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        if (page === currentPage) {
            const nodes = document.querySelectorAll('.review-card'); let tar=null;
            nodes.forEach(n => { if (n.dataset.date === wanted) tar=n; });
            if (tar) { tar.scrollIntoView({behavior:'smooth', block:'center'}); tar.classList.add('highlight'); setTimeout(()=>tar.classList.remove('highlight'),1100); }
        } else {
            currentPage = page; renderPage(page);
            setTimeout(()=>{ const nodes = document.querySelectorAll('.review-card'); let tar=null; nodes.forEach(n=>{ if (n.dataset.date === wanted) tar=n;}); if (tar){ tar.scrollIntoView({behavior:'smooth', block:'center'}); tar.classList.add('highlight'); setTimeout(()=>tar.classList.remove('highlight'),1100);} },140);
        }
        return;
    }

    if (t.classList && t.classList.contains('tag-link-time')) {
        e.preventDefault();
        const wantedTime = t.dataset.target;
        let foundIndex = -1;
        for (let i=0;i<ALL_REVIEWS.length;i++){
            const d = formatDisplayDate(ALL_REVIEWS[i].date);
            if (d.slice(-8) === wantedTime) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
        if (page === currentPage) {
            const wanted = formatDisplayDate(ALL_REVIEWS[foundIndex].date);
            const nodes = document.querySelectorAll('.review-card'); let tar=null;
            nodes.forEach(n => { if (n.dataset.date === wanted) tar=n; });
            if (tar) { tar.scrollIntoView({behavior:'smooth', block:'center'}); tar.classList.add('highlight'); setTimeout(()=>tar.classList.remove('highlight'),1100); }
        } else {
            currentPage = page; renderPage(page);
            setTimeout(()=>{ const wanted = formatDisplayDate(ALL_REVIEWS[foundIndex].date); const nodes = document.querySelectorAll('.review-card'); let tar=null; nodes.forEach(n=>{ if (n.dataset.date === wanted) tar=n;}); if (tar){ tar.scrollIntoView({behavior:'smooth', block:'center'}); tar.classList.add('highlight'); setTimeout(()=>tar.classList.remove('highlight'),1100);} },140);
        }
        return;
    }

    // click on tag-dot indicator => go to tagger review
    if (t.classList && t.classList.contains('tag-dot')) {
        const taggerIndex = parseInt(t.dataset.taggerIndex,10);
        if (!isNaN(taggerIndex)) goToReviewByIndex(taggerIndex);
        return;
    }
});

// Form submit (same validation + upload)
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
        const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET);
        return fetch(CLOUDINARY_URL, { method: 'POST', body: fd }).then(r => r.json());
    });

    Promise.all(uploads).then(results => {
        const urls = results.map(r => r && r.secure_url ? r.secure_url : null).filter(Boolean);
        if (!urls.length) throw new Error('Cloudinary did not return URLs');
        reviewDoc.mediaUrls = urls; if (urls.length === 1) reviewDoc.mediaUrl = urls[0];
        return firebase.firestore().collection('reviews').add(reviewDoc);
    }).then(() => {
        document.getElementById('review-form').reset();
        document.getElementById('send_sound').play();
    }).catch(err => {
        console.error('Upload/save error', err);
        if (err && err.error && err.error.message) alert('Cloudinary error: ' + err.error.message);
        else if (err && err.message) alert('Ошибка: ' + err.message);
        else alert('Не удалось загрузить/сохранить (см. консоль).');
    });
});

// Firestore subscription — keep doc.id and compute tagsMap
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
                // recompute tags map
                computeTagsMap();
                // clamp page
                const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
                if (currentPage > totalPages) currentPage = totalPages;
                renderPage(currentPage);
            }, err => {
                console.error('onSnapshot error', err);
                firebase.firestore().collection('reviews').orderBy('date','asc').get()
                    .then(snap => {
                        const arr = [];
                        snap.forEach(doc => { const data = doc.data() || {}; arr.push(Object.assign({ id: doc.id }, data)); });
                        ALL_REVIEWS = arr;
                        computeTagsMap();
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
