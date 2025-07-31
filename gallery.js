document.addEventListener('DOMContentLoaded', function() {
    const images = ['image1.jpg', 'image2.png', 'image3.jpg', 'image4.jpg', 'image5.png', 'image6.png','image7.png', 'image8.png', 'image9.png', 'image10.png', 'image11.png', 'image12.png' ]; // Список изображений
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