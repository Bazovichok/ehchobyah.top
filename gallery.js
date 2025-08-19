document.addEventListener('DOMContentLoaded', function() {
    const images = ['image1.jpg', 'holova.jpg', 'image3.gif', 'image4.gif', '888.gif', 'fact.png','dima.png', 'dimatachka.gif','image7.png'  ]; // Список изображений
    let currentIndex = 0;

    const imageElement = document.getElementById('galleryImage');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    function showImage(index) {
        imageElement.src = images[index];
    }

    prevButton.addEventListener('click', function() {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        showImage(currentIndex);
    });

    nextButton.addEventListener('click', function() {
        currentIndex = (currentIndex + 1) % images.length;
        showImage(currentIndex);
    });

    showImage(currentIndex);
});