document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('changeButton');

    button.addEventListener('click', function() {
        const audio = new Audio('drop.mp3');
        audio.play();
        audio.addEventListener('ended', function() {
            window.location.href = 'page2.html';
        });
    });
});


document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('dark-mode-toggle');
    const isDark = localStorage.getItem('dark-mode') === 'true';

    // Создать объекты Audio для звуков
    const darkModeSound = new Audio('switch_dark_on.mp3');
    const lightModeSound = new Audio('switch_light_on.mp3');


    // Установить начальный режим
    document.body.classList.toggle('dark-mode', isDark);
    toggleButton.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

    // Обработчик нажатия на кнопку
    toggleButton.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDarkNow = document.body.classList.contains('dark-mode');
        localStorage.setItem('dark-mode', isDarkNow);
        this.innerHTML = isDarkNow ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
     
        // Воспроизвести соответствующий звук
        if (isDarkNow) {
            darkModeSound.play();
        } else {
            lightModeSound.play();
        }

   });
});