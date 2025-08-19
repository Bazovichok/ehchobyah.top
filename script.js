document.addEventListener('DOMContentLoaded', function() {

    // ---------- фон: переключение src при смене темы ----------
    const bgImg = document.getElementById('bg-img');
    const DARK_SRC = 'background_dark.png';
    const LIGHT_SRC = 'background_light.png';

    // ---------- переключатель тёмной темы + звуки ----------
    const toggleButton = document.getElementById('dark-mode-toggle');
    const isDarkStored = localStorage.getItem('dark-mode') === 'true';

    // Звуки
    const darkModeSound = new Audio('switch_dark_on.mp3');
    const lightModeSound = new Audio('switch_light_on.mp3');

    // Установить начальное состояние
    if (isDarkStored) {
        document.body.classList.add('dark-mode');
        toggleButton.innerHTML = '<i class="fas fa-sun"></i>';
        if (bgImg) bgImg.src = DARK_SRC;
    } else {
        document.body.classList.remove('dark-mode');
        toggleButton.innerHTML = '<i class="fas fa-moon"></i>';
        if (bgImg) bgImg.src = LIGHT_SRC;
    }

    toggleButton.addEventListener('click', function() {
        const isNowDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('dark-mode', isNowDark);
        this.innerHTML = isNowDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        // Плавная смена изображения: сначала уменьшить непрозрачность, затем сменить src и вернуть
        if (bgImg) {
            bgImg.style.opacity = '0';
            setTimeout(() => {
                bgImg.src = isNowDark ? DARK_SRC : LIGHT_SRC;
                bgImg.style.opacity = '1';
            }, 180);
        }

        // Воспроизведение звука (попытка, может быть заблокировано браузером)
        try {
            if (isNowDark) darkModeSound.play(); else lightModeSound.play();
        } catch (e) { /* игнорируем ошибки автозапуска */ }
    });

    // ---------- кнопка перехода (если есть) — пример с drop.mp3 ----------
    const changeButton = document.getElementById('changeButton');
    if (changeButton) {
        changeButton.addEventListener('click', function() {
            const audio = new Audio('drop.mp3');
            audio.play().catch(()=>{ /* ignore */ });
            audio.addEventListener('ended', function() {
                window.location.href = 'page2.html';
            });
        });
    }

});
