// script.js (v6) — переключатель темы с плавным переходом
document.addEventListener('DOMContentLoaded', function () {
    const toggleButton = document.getElementById('dark-mode-toggle');
    const isDarkStored = localStorage.getItem('dark-mode') === 'true';
    const body = document.body;

    // Инициализация
    if (isDarkStored) {
        body.classList.add('dark-mode');
        toggleButton.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        body.classList.remove('dark-mode');
        toggleButton.innerHTML = '<i class="fas fa-moon"></i>';
    }

    toggleButton.addEventListener('click', function () {
        const nowDark = body.classList.toggle('dark-mode');
        localStorage.setItem('dark-mode', nowDark);
        toggleButton.innerHTML = nowDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        // эффект при клике
        toggleButton.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.06)' },
            { transform: 'scale(1)' }
        ], { duration: 220, easing: 'ease-out' });
    });
});
