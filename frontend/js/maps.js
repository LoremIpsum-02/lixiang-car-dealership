class YandexMaps {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    init() {
        if (this.isInitialized) {
            return;
        } else {
            this.initializeMaps();
        }
    }

    initializeMaps() {
        console.log('🗺️ Initializing Yandex Maps...');
        
        // Инициализируем карту в секции контактов (если есть)
        this.initContactMap();
        
        this.isInitialized = true;
        console.log('✅ Maps initialization completed');
    }

    // Карта в секции контактов
    initContactMap() {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.log('❌ Contact map element not found');
            return;
        }

        console.log('📍 Initializing contact map...');

        // Проверяем, загружена ли Яндекс карта
        if (typeof ymaps === 'undefined') {
            console.log('Yandex Maps API not loaded for contact map');
            // Показываем ссылку на карту как fallback
            mapElement.innerHTML = `
                <div class="d-flex align-items-center justify-content-center h-100">
                    <a href="https://yandex.ru/maps/?pt=37.6176,55.7558&z=16&l=map" 
                       target="_blank" 
                       class="btn btn-outline-primary">
                        <i class="fas fa-map-marker-alt me-2"></i>
                        Открыть карту
                    </a>
                </div>
            `;
            return;
        }

        console.log('Yandex Maps API loaded, initializing contact map...');

        // Инициализируем Яндекс карту для контактов
        ymaps.ready(() => {
            try {
                console.log('Creating contact map...');
                const map = new ymaps.Map('map', {
                    center: [55.7558, 37.6176], // Координаты Тверской улицы, 12
                    zoom: 15,
                    controls: ['zoomControl', 'fullscreenControl']
                });

                // Добавляем маркер с кастомной иконкой
                const placemark = new ymaps.Placemark([55.7558, 37.6176], {
                    balloonContent: `
                        <div style="padding: 15px; font-family: Arial, sans-serif;">
                            <h4 style="margin: 0 0 10px 0; color: #333;">LiXiang Auto Salon</h4>
                            <p style="margin: 5px 0; color: #666;"><strong>📍 Адрес:</strong> Москва, ул. Тверская, 12</p>
                            <p style="margin: 5px 0; color: #666;"><strong>📞 Телефон:</strong> +7 915 057 7220</p>
                            <p style="margin: 5px 0; color: #666;"><strong>✉️ Email:</strong> info@lixiang.ru</p>
                            <p style="margin: 5px 0; color: #666;"><strong>🕒 Часы работы:</strong> Пн-Вс: 9:00 - 21:00</p>
                            <div style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                                <small style="color: #666;">🚗 Официальный дилер LiXiang в России</small>
                            </div>
                        </div>
                    `,
                    hintContent: 'LiXiang Auto Salon - Официальный дилер'
                }, {
                    iconLayout: 'default#image',
                    iconImageHref: 'data:image/svg+xml;base64,' + btoa(`
                        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="20" cy="20" r="18" fill="#000" stroke="#fff" stroke-width="2"/>
                            <path d="M12 16h16v8H12z" fill="#fff"/>
                            <circle cx="16" cy="20" r="2" fill="#000"/>
                            <circle cx="24" cy="20" r="2" fill="#000"/>
                            <path d="M14 24h12" stroke="#000" stroke-width="2" fill="none"/>
                        </svg>
                    `),
                    iconImageSize: [40, 40],
                    iconImageOffset: [-20, -20]
                });

                map.geoObjects.add(placemark);
                
                // Открываем балун при клике на маркер
                placemark.events.add('click', () => {
                    placemark.balloon.open();
                });

                console.log('✅ Contact map initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing contact map:', error);
            }
        });
    }
}

// Инициализируем карты при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    new YandexMaps();
});