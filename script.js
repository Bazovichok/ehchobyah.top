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