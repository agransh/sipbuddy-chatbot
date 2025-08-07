const sr = ScrollReveal({
    distance: '50px',
    duration: 1500,
    delay: 100, // Lowered global delay
    easing: 'cubic-bezier(0.5, 0, 0, 1)',
    reset: false
});

sr.reveal('.hero-text h1', { origin: 'top' });
sr.reveal('.hero-text p', { origin: 'top', delay: 150 }); // Adjusted delay
sr.reveal('.hero-text .cta-button', { origin: 'top', delay: 200 }); // Adjusted delay

sr.reveal('.feature-text', { origin: 'left' });
sr.reveal('.feature-visual', { origin: 'right' });

sr.reveal('.network-section h2', { origin: 'top' });
sr.reveal('.network-section .section-subtitle', { origin: 'top', delay: 150 }); // Adjusted delay
sr.reveal('.network-container', { origin: 'bottom', delay: 200 }); // Adjusted delay

sr.reveal('.testimonials-section h2', { origin: 'top' });
sr.reveal('.testimonial-card', { origin: 'bottom', interval: 100 }); // Adjusted interval

sr.reveal('.who-its-for-section h2', { origin: 'top' });
sr.reveal('.persona-card', { origin: 'bottom', interval: 100 }); // Adjusted interval

sr.reveal('.faq-section h2', { origin: 'top' });
sr.reveal('.faq-item', { origin: 'bottom', interval: 100 }); // Adjusted interval



const map = L.map('map').setView([34.0522, -118.2437], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const stores = [
    { name: 'The Wine Rack', lat: 34.0522, lng: -118.2437 },
    { name: 'Craft Beer Haven', lat: 34.0622, lng: -118.2537 },
    { name: 'Spirits & More', lat: 34.0422, lng: -118.2337 }
];

stores.forEach(store => {
    L.marker([store.lat, store.lng]).addTo(map)
        .bindPopup(store.name);
});

document.addEventListener('DOMContentLoaded', () => {
    const mainSearchInput = document.getElementById('main-search');
    const mainSearchBtn = document.getElementById('main-search-btn');

    mainSearchBtn.addEventListener('click', () => {
        const searchQuery = mainSearchInput.value;
        if (searchQuery) {
            alert(`Searching for: ${searchQuery}`);
            // In a real application, you would integrate with a search API that handles both location and alcohol
        } else {
            alert('Please enter a search query.');
        }
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});