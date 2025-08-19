
const PER_PAGE = 30;
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dp0smiea6/auto/upload';
const UPLOAD_PRESET = 'reviews_unsigned';

let ALL_REVIEWS = []; // items: { id, nickname, reviewText, date, mediaUrl?, mediaUrls? }
let currentPage = 1;
let renderedSliceIds = []; // cached visible doc IDs
let tagsMap = {}; // targetId -> array of { taggerId, taggerIndex }
let initialNavigationDone = false; // ensure initial auto-jump happens once per page open

// IntersectionObserver to mark cards as read
let cardObserver = null;
const LAST_SEEN_KEY = 'eh_reviews_last_seen_v1';
const LAST_LOCAL_ADD_KEY = 'eh_reviews_last_local_add';

// ------------------- Utilities -------------------
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function formatDisplayDate(maybeTimestamp){
    if (!maybeTimestamp) return 'Date not available';
    try {
        if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    } catch(e){}
    if (maybeTimestamp instanceof Date) return maybeTimestamp.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    return String(maybeTimestamp);
}
function dateFromReviewDateField(field){
    if (!field) return null;
    try {
        if (typeof field.toDate === 'function') return field.toDate();
    } catch(e){}
    try {
        const d = new Date(field);
        if (!isNaN(d.getTime())) return d;
    } catch(e){}
    return null;
}

// ------------------- localStorage lastSeen helpers -------------------
function getLastSeen() {
    try {
        const v = localStorage.getItem(LAST_SEEN_KEY);
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    } catch(e) { return null; }
}
function setLastSeen(dateOrNow) {
    try {
        const d = dateOrNow instanceof Date ? dateOrNow : new Date();
        localStorage.setItem(LAST_SEEN_KEY, d.toISOString());
    } catch(e){}
}
function updateLastSeenIfLater(candidateDate) {
    if (!candidateDate || isNaN(candidateDate.getTime())) return;
    const cur = getLastSeen();
    if (!cur || candidateDate > cur) {
        setLastSeen(candidateDate);
        refreshNewBadges();
    }
}

// ------------------- Media / Lightbox -------------------
function pauseAllMedia() {
    try {
        document.querySelectorAll('audio, video').forEach(m => {
            try { m.pause(); } catch(e) {}
        });
    } catch(e){}
}
function closeLightbox() {
    const ex = document.getElementById('image-lightbox');
    if (!ex) return;
    const v = ex.querySelector('video');
    if (v) {
        try { v.pause(); v.src = ''; v.load && v.load(); } catch(e) {}
    }
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
    video.addEventListener('click', function(e){ e.stopPropagation(); });
    overlay.appendChild(video);
    document.body.appendChild(overlay);
}

function openLightboxEmbed(embedUrl) {
    pauseAllMedia(); closeLightbox();
    const overlay = document.createElement('div'); overlay.id = 'image-lightbox';
    overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.display='flex';
    overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='9999';
    overlay.addEventListener('click', function(){ closeLightbox(); });
    const iframe = document.createElement('iframe'); iframe.src = embedUrl;
    iframe.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
    iframe.setAttribute('allowfullscreen','');
    iframe.setAttribute('referrerpolicy','no-referrer');
    iframe.style.width='90%'; iframe.style.height='80%'; iframe.frameBorder='0';
    iframe.addEventListener('click', e => e.stopPropagation());
    overlay.appendChild(iframe); document.body.appendChild(overlay);
}

// ------------------- External embeds (YouTube/Twitch) -------------------
function parseExternalEmbed(urlStr) {
    try {
        const u = new URL(urlStr);
        const host = u.hostname.replace(/^www\./i,'').toLowerCase();

        // YouTube (handles youtu.be, watch?v=, /embed/, /shorts/)
        if (host === 'youtu.be' || host.indexOf('youtube.com') !== -1 || host === 'youtube-nocookie.com') {
            let vid = null;
            if (host === 'youtu.be') {
                vid = u.pathname.slice(1);
            } else {
                vid = u.searchParams.get('v') || (u.pathname.match(/\/(embed|shorts)\/([^/]+)/) || [])[2];
            }
            if (vid) {
                // previewEmbedUrl: standard embed (not autoplay), lightbox plays with autoplay
                const previewEmbedUrl = 'https://www.youtube.com/embed/' + encodeURIComponent(vid) + '?rel=0&modestbranding=1';
                const lightboxEmbedUrl = 'https://www.youtube.com/embed/' + encodeURIComponent(vid) + '?autoplay=1';
                return {
                    provider: 'youtube',
                    previewEmbedUrl: previewEmbedUrl,
                    lightboxEmbedUrl: lightboxEmbedUrl,
                    embedPossible: true
                };
            }
        }

        // Twitch (clips and channels)
        if (host.indexOf('twitch.tv') !== -1 || host === 'clips.twitch.tv') {
            const pathParts = u.pathname.split('/').filter(Boolean);
            const parent = window.location.hostname;
            // detect if running locally/file:// — Twitch requires a real parent
            const forbiddenLocal = (parent === 'localhost' || parent === '127.0.0.1' || parent.indexOf('192.168.') === 0 || parent === '');
            if (host === 'clips.twitch.tv' && pathParts.length >=1) {
                const slug = pathParts[0];
                if (forbiddenLocal) return { provider:'twitch', embedPossible:false, url:urlStr };
                return {
                    provider:'twitch',
                    previewEmbedUrl:'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug) + '&parent=' + encodeURIComponent(parent),
                    lightboxEmbedUrl:'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug) + '&autoplay=true&parent=' + encodeURIComponent(parent),
                    embedPossible:true
                };
            }
            if (pathParts[0] === 'clips' && pathParts[1]) {
                const slug = pathParts[1];
                if (forbiddenLocal) return { provider:'twitch', embedPossible:false, url:urlStr };
                return {
                    provider:'twitch',
                    previewEmbedUrl:'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug) + '&parent=' + encodeURIComponent(parent),
                    lightboxEmbedUrl:'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug) + '&autoplay=true&parent=' + encodeURIComponent(parent),
                    embedPossible:true
                };
            }
            if (pathParts.length >= 1) {
                const channel = pathParts[0];
                if (forbiddenLocal) return { provider:'twitch', embedPossible:false, url:urlStr };
                return {
                    provider:'twitch',
                    previewEmbedUrl:'https://player.twitch.tv/?channel=' + encodeURIComponent(channel) + '&parent=' + encodeURIComponent(parent) + '&muted=true',
                    lightboxEmbedUrl:'https://player.twitch.tv/?channel=' + encodeURIComponent(channel) + '&parent=' + encodeURIComponent(parent) + '&autoplay=true',
                    embedPossible:true
                };
            }
        }
    } catch(e){}
    return null;
}

// ------------------- Tags computation -------------------
function computeTagsMap() {
    tagsMap = {};
    const idByDate = {};
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

// ------------------- DOM: creation + tag indicators -------------------
function buildTagIndicatorsForCard(cardEl, reviewIndex) {
    let indicators = cardEl.querySelector('.tag-indicators');
    if (!indicators) {
        indicators = document.createElement('span'); indicators.className = 'tag-indicators';
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
    // placeholder for indicators (filled later)
    const indicators = document.createElement('span'); indicators.className = 'tag-indicators'; indicators.style.marginLeft='8px';
    header.appendChild(indicators);

    // content
    const content = document.createElement('div'); content.className = 'content-block';
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

    // also detect inline links to youtube/twitch inside text and include them (but do not duplicate)
    try {
        const inlineLinks = (review.reviewText || '').match(/https?:\/\/[^\s<>"']+/g) || [];
        inlineLinks.forEach(l => {
            if (urls.length >= 2) return;
            if (urls.indexOf(l) === -1) {
                const emb = parseExternalEmbed(l);
                if (emb) urls.push(l);
            }
        });
    } catch(e){}

    for (let i=0;i<Math.min(2, urls.length); i++){
        const u = urls[i]; if (!u) continue;
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
            continue;
        }

        // audio mp3
        if (/\.mp3(\?.*)?$/.test(low)) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = u;
            audio.style.marginTop = '10px';
            mediaContainer.appendChild(audio);
            continue;
        }

        // local video (mp4, webm, mov)
        if (/\.(mp4|webm|mov)(\?.*)?$/.test(low)) {
            const vid = document.createElement('video');
            vid.src = u;
            vid.classList.add('preview', 'blurred'); // preview class + blurred
            vid.dataset.isBlurred = 'true';
            vid.muted = true;
            vid.controls = false;
            vid.preload = 'metadata';
            vid.style.maxWidth = '220px';
            vid.style.maxHeight = '160px';
            vid.style.display = 'block';
            vid.style.marginTop = '10px';
            vid.style.cursor = 'pointer';

            vid.addEventListener('click', function(e) {
                e.preventDefault();
                const isBlurred = vid.dataset.isBlurred === 'true';
                if (isBlurred) {
                    vid.classList.remove('blurred'); vid.dataset.isBlurred = 'false';
                    openLightboxVideo(u);
                } else {
                    vid.classList.add('blurred'); vid.dataset.isBlurred = 'true';
                    closeLightbox();
                    try { vid.pause(); vid.currentTime = 0; vid.muted = true; } catch(e){}
                }
            });

            mediaContainer.appendChild(vid);
            continue;
        }

        // external embed (YouTube/Twitch)
        const emb = parseExternalEmbed(u);
        if (emb) {
            if (emb.provider === 'twitch' && emb.embedPossible === false) {
                const a = document.createElement('a'); a.href = u; a.className='twitch-fallback'; a.textContent = 'Открыть в Twitch'; a.target='_blank'; a.rel='noopener noreferrer';
                mediaContainer.appendChild(a);
            } else {
                // create iframe with correct attributes so previews show
                const iframe = document.createElement('iframe');
                // prefer previewEmbedUrl (non-autoplay)
                iframe.src = emb.previewEmbedUrl || emb.lightboxEmbedUrl || u;
                iframe.className = 'embed-preview';
                iframe.setAttribute('frameborder','0');
                iframe.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
                iframe.setAttribute('allowfullscreen','');
                iframe.setAttribute('referrerpolicy','no-referrer');
                iframe.style.width = '320px';
                iframe.style.height = '180px';
                iframe.style.marginTop = '10px';
                iframe.style.border = 'none';
                // wrapper + overlay: overlay opens lightbox with autoplay embed (lightboxEmbedUrl)
                const wrap = document.createElement('div'); wrap.style.display = 'inline-block'; wrap.style.position = 'relative';
                wrap.appendChild(iframe);
                const overlay = document.createElement('div'); overlay.style.position = 'absolute'; overlay.style.inset = '0'; overlay.style.cursor = 'pointer';
                overlay.addEventListener('click', function(e){ e.stopPropagation(); const light = emb.lightboxEmbedUrl || emb.previewEmbedUrl || u; openLightboxEmbed(light); });
                wrap.appendChild(overlay);
                mediaContainer.appendChild(wrap);
            }
            continue;
        }

        // fallback link
        const a = document.createElement('a'); a.href = u; a.textContent = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        mediaContainer.appendChild(a);
    }

    card.appendChild(header);
    card.appendChild(content);
    if (mediaContainer.children.length) card.appendChild(mediaContainer);

    return card;
}

// Helper: compare arrays equality shallow
function arraysEqual(a,b){
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return false;
    return true;
}

// ------------------- Tooltip for tag preview (reliable) -------------------
// Single shared tooltip element
let tagTooltipEl = null;
let tooltipTargetEl = null;

function createTooltipEl() {
    if (tagTooltipEl) return tagTooltipEl;
    tagTooltipEl = document.createElement('div');
    tagTooltipEl.className = 'tag-tooltip';
    tagTooltipEl.style.display = 'none';
    // inner structure: name + text
    const name = document.createElement('div'); name.className = 'tt-name'; name.style.fontWeight = '700'; name.style.marginBottom = '6px';
    const text = document.createElement('div'); text.className = 'tt-text';
    tagTooltipEl.appendChild(name);
    tagTooltipEl.appendChild(text);
    document.body.appendChild(tagTooltipEl);
    return tagTooltipEl;
}

function setTooltipContent(nick, txt) {
    createTooltipEl();
    const nameEl = tagTooltipEl.querySelector('.tt-name');
    const textEl = tagTooltipEl.querySelector('.tt-text');
    nameEl.textContent = nick || '(аноним)';
    textEl.textContent = txt || '(пустой комментарий)';
}

function positionTooltip(x, y) {
    if (!tagTooltipEl) return;
    const pad = 12;
    // ensure it's visible to measure
    tagTooltipEl.style.left = '0px';
    tagTooltipEl.style.top = '0px';
    const tw = tagTooltipEl.offsetWidth || 200;
    const th = tagTooltipEl.offsetHeight || 80;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 12;
    let top = y + 12;
    if (left + tw + pad > vw) left = Math.max(pad, x - tw - 12);
    if (top + th + pad > vh) top = Math.max(pad, y - th - 12);
    tagTooltipEl.style.left = left + 'px';
    tagTooltipEl.style.top = top + 'px';
}

function showTooltip(nick, text, clientX, clientY) {
    setTooltipContent(nick, text);
    tagTooltipEl.style.display = 'block';
    requestAnimationFrame(() => positionTooltip(clientX, clientY));
}

function hideTooltip() {
    if (!tagTooltipEl) return;
    tagTooltipEl.style.display = 'none';
    // clear content
    tagTooltipEl.querySelector('.tt-name').textContent = '';
    tagTooltipEl.querySelector('.tt-text').textContent = '';
    tooltipTargetEl = null;
}

// Get review info (nick + text) for a tag element
function getReviewInfoFromTagElement(tagEl) {
    if (!tagEl) return null;
    const isTimeOnly = tagEl.classList.contains('tag-link-time');
    const target = tagEl.dataset && tagEl.dataset.target;
    if (!target) return null;
    if (!Array.isArray(ALL_REVIEWS) || ALL_REVIEWS.length === 0) return null;

    if (!isTimeOnly) {
        for (let i=0;i<ALL_REVIEWS.length;i++){
            const d = formatDisplayDate(ALL_REVIEWS[i].date);
            if (d === target) {
                return { nick: ALL_REVIEWS[i].nickname || 'Anonymous', text: ALL_REVIEWS[i].reviewText || '' };
            }
        }
        return null;
    }

    for (let i=0;i<ALL_REVIEWS.length;i++){
        const d = formatDisplayDate(ALL_REVIEWS[i].date);
        if (d.slice(-8) === target) {
            return { nick: ALL_REVIEWS[i].nickname || 'Anonymous', text: ALL_REVIEWS[i].reviewText || '' };
        }
    }
    return null;
}

// Delegated handlers to show/hide tooltip reliably
document.addEventListener('mouseover', function(e){
    const tag = e.target.closest && e.target.closest('.tag-link, .tag-link-time');
    if (!tag) return;
    const info = getReviewInfoFromTagElement(tag);
    if (!info) return;
    tooltipTargetEl = tag;
    const maxLen = 1200;
    const short = (info.text && info.text.length > maxLen) ? info.text.slice(0, maxLen) + '…' : info.text;
    createTooltipEl();
    showTooltip(info.nick, short, e.clientX, e.clientY);
});

document.addEventListener('mousemove', function(e){
    if (!tooltipTargetEl) return;
    positionTooltip(e.clientX, e.clientY);
});

document.addEventListener('mouseout', function(e){
    const tag = e.target.closest && e.target.closest('.tag-link, .tag-link-time');
    if (!tag) return;
    // if leaving the tag element to somewhere not inside it — hide
    const related = e.relatedTarget;
    if (!related || (related !== tag && !tag.contains(related))) {
        hideTooltip();
    }
});

// Hide tooltip on many global actions (click, scroll, page change)
document.addEventListener('click', function(){ hideTooltip(); });
window.addEventListener('scroll', function(){ hideTooltip(); }, true);

// ------------------- Rendering + pagination -------------------
function observeVisibleCards() {
    if (!cardObserver) {
        cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const node = entry.target;
                const dateStr = node.dataset.date;
                if (!dateStr) return;
                let found = null;
                for (let i=0;i<ALL_REVIEWS.length;i++){
                    if (formatDisplayDate(ALL_REVIEWS[i].date) === dateStr) { found = ALL_REVIEWS[i]; break; }
                }
                if (found) {
                    const d = dateFromReviewDateField(found.date);
                    if (d) updateLastSeenIfLater(d);
                }
            });
        }, { root: null, rootMargin: '0px', threshold: 0.5 });
    }

    const nodes = document.querySelectorAll('.review-card');
    nodes.forEach(n => {
        try { cardObserver.observe(n); } catch(e){}
    });
}

function updateVisibleTagIndicators(start, end) {
    const nodes = document.querySelectorAll('.review-card');
    nodes.forEach(node => {
        const date = node.dataset.date;
        let idx = -1;
        for (let i = start; i < end; i++) { if (formatDisplayDate(ALL_REVIEWS[i].date) === date) { idx = i; break; } }
        if (idx === -1) {
            for (let j=0;j<ALL_REVIEWS.length;j++){ if (formatDisplayDate(ALL_REVIEWS[j].date) === date) { idx = j; break; } }
        }
        if (idx !== -1) buildTagIndicatorsForCard(node, idx);
    });
}

function refreshNewBadges() {
    const lastSeen = getLastSeen();
    document.querySelectorAll('.review-card').forEach(card => {
        const dateStr = card.dataset.date;
        if (!dateStr) return;
        let rev = null;
        for (let i=0;i<ALL_REVIEWS.length;i++){ if (formatDisplayDate(ALL_REVIEWS[i].date) === dateStr) { rev = ALL_REVIEWS[i]; break; } }
        const badge = card.querySelector('.new-badge');
        const d = rev ? dateFromReviewDateField(rev.date) : null;
        const isNew = d && (!lastSeen || d > lastSeen);
        if (isNew) {
            if (!badge) {
                const nb = document.createElement('span'); nb.className = 'new-badge'; nb.title = 'Новый';
                const dateSpan = card.querySelector('.datetime');
                if (dateSpan) dateSpan.parentNode.insertBefore(nb, dateSpan.nextSibling);
                else card.querySelector('.header-block').appendChild(nb);
            }
        } else {
            if (badge) badge.remove();
        }
    });
}

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
        updateVisibleTagIndicators(start, end);
        document.getElementById('page-number').textContent = String(currentPage);
        document.getElementById('prev-page').disabled = currentPage <= 1;
        document.getElementById('next-page').disabled = currentPage >= totalPages;
        buildPageDropdown(totalPages);
        observeVisibleCards();
        refreshNewBadges();
        return;
    }

    renderedSliceIds = newSliceIds.slice(0);
    list.innerHTML = '';
    for (let i=0;i<pageSlice.length;i++){
        const node = createReviewNode(pageSlice[i], start + i);
        list.appendChild(node);
    }
    for (let i = start; i < end; i++){
        const idxOnPage = i - start;
        const node = list.children[idxOnPage];
        if (node) buildTagIndicatorsForCard(node, i);
    }

    document.getElementById('page-number').textContent = String(currentPage);
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    buildPageDropdown(totalPages);

    observeVisibleCards();
    refreshNewBadges();
}

// Prev/Next handlers
document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); hideTooltip(); } });
document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
    if (currentPage < totalPages) { currentPage++; renderPage(currentPage); hideTooltip(); }
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
            hideTooltip();
        });
        pageDropdown.appendChild(b);
    }
}

// ------------------- Tag click handlers -------------------
document.addEventListener('click', function(e){
    const t = e.target;
    if (!t) return;

    if (t.classList && t.classList.contains('tag-link')) {
        e.preventDefault();
        const wanted = t.dataset.target;
        let foundIndex = -1;
        for (let i=0;i<ALL_REVIEWS.length;i++){
            if (formatDisplayDate(ALL_REVIEWS[i].date) === wanted) { foundIndex = i; break; }
        }
        if (foundIndex === -1) { alert('Комментарий не найден (возможно удалён).'); return; }
        const page = Math.floor(foundIndex / PER_PAGE) + 1;
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
        hideTooltip();
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
        hideTooltip();
        return;
    }

    if (t.classList && t.classList.contains('tag-dot')) {
        const taggerIndex = parseInt(t.dataset.taggerIndex,10);
        if (!isNaN(taggerIndex)) goToReviewByIndex(taggerIndex);
        hideTooltip();
        return;
    }
});

// ------------------- Jump to review helper -------------------
function goToReviewByIndex(targetIndex) {
    if (targetIndex < 0 || targetIndex >= ALL_REVIEWS.length) return;
    const page = Math.floor(targetIndex / PER_PAGE) + 1;
    const shouldRender = page !== currentPage;
    if (shouldRender) {
        currentPage = page; renderPage(page);
        setTimeout(() => {
            const wanted = formatDisplayDate(ALL_REVIEWS[targetIndex].date);
            const nodes = document.querySelectorAll('.review-card'); let tar=null;
            nodes.forEach(n => { if (n.dataset.date === wanted) tar=n; });
            if (tar) { tar.scrollIntoView({ behavior:'smooth', block:'center' }); tar.classList.add('highlight'); setTimeout(()=>tar.classList.remove('highlight'),1100); }
        }, 140);
    } else {
        const wanted = formatDisplayDate(ALL_REVIEWS[targetIndex].date);
        const nodes = document.querySelectorAll('.review-card'); let tar=null;
        nodes.forEach(n => { if (n.dataset.date === wanted) tar=n; });
        if (tar) { tar.scrollIntoView({ behavior:'smooth', block:'center' }); tar.classList.add('highlight'); setTimeout(()=>tar.classList.remove('highlight'),1100); }
    }
}

// ------------------- Form submit (uploads) -------------------
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
            .then((docRef) => {
                document.getElementById('review-form').reset();
                document.getElementById('send_sound').play();
                try { sessionStorage.setItem(LAST_LOCAL_ADD_KEY, docRef.id); setTimeout(()=>sessionStorage.removeItem(LAST_LOCAL_ADD_KEY), 5000); } catch(e){}
            })
            .catch(err => { console.error('Firestore add error', err); alert('Ошибка при сохранении (см. консоль).'); });
        return;
    }

    const uploads = files.map(file => {
        const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET);
        return fetch(CLOUDINARY_URL, { method: 'POST', body: fd }).then(r => r.json());
    });

    Promise.all(uploads)
        .then(results => {
            const urls = results.map(r => r && r.secure_url ? r.secure_url : null).filter(Boolean);
            if (!urls.length) throw new Error('Cloudinary did not return URLs');
            reviewDoc.mediaUrls = urls; if (urls.length === 1) reviewDoc.mediaUrl = urls[0];
            return firebase.firestore().collection('reviews').add(reviewDoc);
        })
        .then((docRef) => {
            document.getElementById('review-form').reset();
            document.getElementById('send_sound').play();
            try { sessionStorage.setItem(LAST_LOCAL_ADD_KEY, docRef.id); setTimeout(()=>sessionStorage.removeItem(LAST_LOCAL_ADD_KEY), 5000); } catch(e){}
        })
        .catch(err => {
            console.error('Upload/save error', err);
            if (err && err.error && err.error.message) alert('Cloudinary error: ' + err.error.message);
            else if (err && err.message) alert('Ошибка: ' + err.message);
            else alert('Не удалось загрузить/сохранить (см. консоль).');
        });
});

// ------------------- Firestore subscription and initial unread navigation -------------------
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

function findFirstUnreadIndex() {
    const lastSeen = getLastSeen();
    if (!lastSeen) return 0;
    for (let i=0;i<ALL_REVIEWS.length;i++){
        const d = dateFromReviewDateField(ALL_REVIEWS[i].date);
        if (!d) continue;
        if (d > lastSeen) return i;
    }
    return -1;
}

function navigateToFirstUnreadIfAny() {
    if (!Array.isArray(ALL_REVIEWS) || ALL_REVIEWS.length === 0) return;
    const firstUnread = findFirstUnreadIndex();
    if (firstUnread === -1) {
        const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
        currentPage = totalPages;
        renderPage(currentPage);
        return;
    }
    const lastSeen = getLastSeen();
    if (!lastSeen) {
        const totalPages = Math.max(1, Math.ceil(ALL_REVIEWS.length / PER_PAGE));
        currentPage = totalPages;
        renderPage(currentPage);
        return;
    }
    const page = Math.floor(firstUnread / PER_PAGE) + 1;
    currentPage = page; renderPage(page);
    setTimeout(() => {
        const wantedDate = formatDisplayDate(ALL_REVIEWS[firstUnread].date);
        const nodes = document.querySelectorAll('.review-card');
        let targetNode = null;
        nodes.forEach(n => { if (n.dataset.date === wantedDate) targetNode = n; });
        if (targetNode) {
            targetNode.scrollIntoView({ behavior:'smooth', block:'center' });
            targetNode.classList.add('highlight');
            setTimeout(() => targetNode.classList.remove('highlight'), 1400);
        }
    }, 160);
}

window.addEventListener('load', function() {
    waitForFirebaseInit(5000).then(() => {
        try {
            firebase.firestore().collection('reviews').orderBy('date', 'asc').onSnapshot(snapshot => {
                const prevIds = ALL_REVIEWS.map(r => r.id);
                const arr = [];
                snapshot.forEach(doc => {
                    const data = doc.data() || {};
                    arr.push(Object.assign({ id: doc.id }, data));
                });
                const newIds = arr.map(r => r.id);
                const addedIds = newIds.filter(id => !prevIds.includes(id));

                if (initialNavigationDone && addedIds.length > 0) {
                    try {
                        const lastLocal = sessionStorage.getItem(LAST_LOCAL_ADD_KEY);
                        const otherAdded = addedIds.filter(id => id !== lastLocal);
                        if (otherAdded.length > 0) {
                            try { document.getElementById('send_sound').play(); } catch(e){}
                        }
                    } catch(e){}
                }

                ALL_REVIEWS = arr;
                computeTagsMap();

                if (!initialNavigationDone) {
                    navigateToFirstUnreadIfAny();
                    initialNavigationDone = true;
                } else {
                    renderPage(currentPage);
                }
            }, err => {
                console.error('onSnapshot error', err);
                firebase.firestore().collection('reviews').orderBy('date','asc').get()
                    .then(snap => {
                        const arr = [];
                        snap.forEach(doc => { const data = doc.data() || {}; arr.push(Object.assign({ id: doc.id }, data)); });
                        ALL_REVIEWS = arr;
                        computeTagsMap();
                        if (!initialNavigationDone) { navigateToFirstUnreadIfAny(); initialNavigationDone = true; } else renderPage(currentPage);
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
