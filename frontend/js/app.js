// Основной JavaScript файл для LiXiang Auto Salon

class LiXiangApp {
    constructor() {
        this.cars = [];
        this.filteredCars = [];
        this.currentCar = null;
        this.apiBaseUrl = 'http://localhost:3000/api';
        
        this.init();
    }

    async init() {
        this.visibleCount = 6; // 2 ряда по 3 карточки на десктопе
        this.showMoreStep = 6;
        await this.loadCars();
        await this.loadFeaturedCars();
        this.setupEventListeners();
        this.renderCars();
        this.initMap();
    }

    // Загрузка автомобилей с сервера
    async loadCars() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cars`);
            if (response.ok) {
                const data = await response.json();
                // Нормализуем ключи полей под фронт
                const rows = (data.cars || data || []);
                this.cars = rows.map(r => ({
                    id: r.id,
                    model: r.model,
                    year: r.year,
                    engine: r.engine,
                    transmission: r.transmission,
                    driveType: r.drive_type,
                    exteriorColor: r.exterior_color,
                    interiorColor: r.interior_color,
                    wheelSize: r.wheel_size,
                    price: Number(r.price),
                    description: r.description,
                    image: r.image,
                    stockQuantity: r.stock_quantity,
                    isAvailable: r.is_available,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                }));
                this.filteredCars = [...this.cars];
                console.log('Загружено автомобилей:', this.cars.length);
            } else {
                console.error('Ошибка загрузки автомобилей');
                this.showError('Не удалось загрузить каталог автомобилей');
                this.cars = [];
                this.filteredCars = [];
            }
        } catch (error) {
            console.error('Ошибка сети:', error);
            this.showError('Ошибка соединения с сервером');
            this.cars = [];
            this.filteredCars = [];
        }
    }

    // Загрузка популярных автомобилей для главной страницы
    async loadFeaturedCars() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cars`);
            if (response.ok) {
                const data = await response.json();
                const allCars = data.cars || data || [];
                // Берем только первые 3 машины для главной страницы
                this.featuredCars = allCars.slice(0, 3).map(r => ({
                    id: r.id,
                    model: r.model,
                    year: r.year,
                    engine: r.engine,
                    transmission: r.transmission,
                    driveType: r.drive_type,
                    exteriorColor: r.exterior_color,
                    interiorColor: r.interior_color,
                    wheelSize: r.wheel_size,
                    price: Number(r.price),
                    description: r.description,
                    image: r.image,
                    stockQuantity: r.stock_quantity,
                    isAvailable: r.is_available,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                }));
                console.log('Загружено популярных автомобилей:', this.featuredCars.length);
                this.renderFeaturedCars();
            } else {
                console.error('Ошибка загрузки автомобилей');
                this.showError('Не удалось загрузить каталог автомобилей');
                this.featuredCars = [];
            }
        } catch (error) {
            console.error('Ошибка сети:', error);
            this.showError('Ошибка соединения с сервером');
            this.featuredCars = [];
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Фильтры (только если элементы существуют)
        const priceRange = document.getElementById('priceRange');
        const modelFilter = document.getElementById('modelFilter');
        const colorFilter = document.getElementById('colorFilter');
        const sortBy = document.getElementById('sortBy');
        
        if (priceRange) priceRange.addEventListener('change', () => this.applyFilters());
        if (modelFilter) modelFilter.addEventListener('change', () => this.applyFilters());
        if (colorFilter) colorFilter.addEventListener('change', () => this.applyFilters());
        if (sortBy) sortBy.addEventListener('change', () => this.applyFilters());
        
        const yearFilter = null;
        const driveTypeFilter = null;
        const transmissionFilter = null;
        const wheelMin = null;
        const wheelMax = null;
        const onlyAvailable = document.getElementById('onlyAvailable');
        const resetBtn = document.getElementById('resetFilters');
        const showMoreBtn = document.getElementById('showMoreBtn');

        // дополнительные фильтры отключены по требованию
        if (onlyAvailable) onlyAvailable.addEventListener('change', () => this.applyFilters());
        if (resetBtn) resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.resetFilters();
        });
        if (showMoreBtn) showMoreBtn.addEventListener('click', () => this.showMore());

        // Форма обратной связи
        const contactForm = document.getElementById('contactForm');
        if (contactForm) contactForm.addEventListener('submit', (e) => this.handleContactForm(e));

        // Форма тест-драйва
        const submitTestDrive = document.getElementById('submitTestDrive');
        if (submitTestDrive) submitTestDrive.addEventListener('click', () => this.handleTestDriveForm());
        
        // Кнопка тест-драйва
        const testDriveBtn = document.getElementById('testDriveBtn');
        if (testDriveBtn) {
            testDriveBtn.addEventListener('click', () => this.showTestDriveModal());
        }
        
        // Ссылка тест-драйва в хедере
        const headerTestDrive = document.getElementById('headerTestDrive');
        if (headerTestDrive) {
            console.log('✅ Header test drive link found');
            headerTestDrive.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔗 Header test drive clicked');
                this.showTestDriveModal();
            });
        } else {
            console.log('❌ Header test drive link not found');
        }
        
        // Ссылка тест-драйва в футере
        const footerTestDrive = document.getElementById('footerTestDrive');
        if (footerTestDrive) {
            console.log('✅ Footer test drive link found');
            footerTestDrive.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔗 Footer test drive clicked');
                this.showTestDriveModal();
            });
        } else {
            console.log('❌ Footer test drive link not found');
        }

        // Плавная прокрутка для навигации
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Применение фильтров
    applyFilters() {
        const priceRangeEl = document.getElementById('priceRange');
        const modelFilterEl = document.getElementById('modelFilter');
        const colorFilterEl = document.getElementById('colorFilter');
        const sortByEl = document.getElementById('sortBy');
        
        const priceRange = priceRangeEl?.value || '';
        const modelFilter = modelFilterEl?.value || '';
        const colorFilter = colorFilterEl?.value || '';
        const sortBy = sortByEl?.value || '';
        const yearFilter = '';
        const driveTypeFilter = '';
        const transmissionFilter = '';
        const wheelMinVal = NaN;
        const wheelMaxVal = NaN;
        const onlyAvailable = document.getElementById('onlyAvailable')?.checked || false;

        this.filteredCars = this.cars.filter(car => {
            // Фильтр по цене
            if (priceRange) {
                const [min, max] = priceRange.split('-').map(p => p === '+' ? Infinity : parseInt(p));
                if (car.price < min || (max !== Infinity && car.price > max)) {
                    return false;
                }
            }

            // Фильтр по модели
            if (modelFilter && !car.model.includes(modelFilter)) {
                return false;
            }

            // Фильтр по цвету
            if (colorFilter && car.exteriorColor !== colorFilter) {
                return false;
            }

            // дополнительные фильтры отключены по требованию

            // Только в наличии
            if (onlyAvailable && !car.isAvailable) {
                return false;
            }

            return true;
        });

        // Сортировка
        this.sortCars(sortBy);
        // Сбрасываем показ до первых двух рядов после любого изменения фильтров
        this.visibleCount = 6;
        this.renderCars();
    }

    // Сортировка автомобилей
    sortCars(sortBy) {
        switch (sortBy) {
            case 'price_asc':
                this.filteredCars.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                this.filteredCars.sort((a, b) => b.price - a.price);
                break;
            case 'model':
                this.filteredCars.sort((a, b) => a.model.localeCompare(b.model));
                break;
            case 'year':
                this.filteredCars.sort((a, b) => b.year - a.year);
                break;
            case 'newest':
                this.filteredCars.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'stock':
                this.filteredCars.sort((a, b) => (b.stockQuantity || 0) - (a.stockQuantity || 0));
                break;
        }
    }

    // Отображение автомобилей
    renderCars() {
        const grid = document.getElementById('carsGrid');
        const showMoreBtn = document.getElementById('showMoreBtn');
        
        if (!grid) return; // Если элемента нет, выходим
        
        if (this.filteredCars.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h4>Автомобили не найдены</h4>
                    <p class="text-muted">Попробуйте изменить параметры фильтрации</p>
                </div>
            `;
            if (showMoreBtn) showMoreBtn.style.display = 'none';
            return;
        }

        const toShow = this.filteredCars.slice(0, this.visibleCount);
        grid.innerHTML = toShow.map(car => this.createCarCard(car)).join('');

        if (showMoreBtn) {
            showMoreBtn.style.display = this.visibleCount < this.filteredCars.length ? 'inline-block' : 'none';
        }
    }

    showMore() {
        this.visibleCount = Math.min(this.visibleCount + this.showMoreStep, this.filteredCars.length);
        this.renderCars();
    }

    resetFilters() {
        const ids = ['priceRange','modelFilter','colorFilter','sortBy'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT' || el.tagName === 'INPUT') {
                if (el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            }
        });
        const onlyAvailable = document.getElementById('onlyAvailable');
        if (onlyAvailable) onlyAvailable.checked = false;
        this.applyFilters();
    }

    // Создание карточки автомобиля
    createCarCard(car) {
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card car-card h-100">
                    <img src="${car.image || 'assets/images/car-placeholder.jpg'}" 
                         class="card-img-top" 
                         alt="${car.model}"
                         onerror="this.src='assets/images/car-placeholder.jpg'">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${car.model}</h5>
                        <p class="card-text">${car.description || 'Премиальный автомобиль LiXiang'}</p>
                        
                        <div class="car-features">
                            <span class="feature-badge">${car.year} год</span>
                            <span class="feature-badge">${car.engine}</span>
                            <span class="feature-badge">${car.transmission}</span>
                        </div>
                        
                        <div class="car-price">${this.formatPrice(car.price)}</div>
                        
                        <div class="mt-auto">
                            <button class="btn btn-outline-primary w-100 mb-2" 
                                    onclick="app.showCarDetails(${car.id})">
                                <i class="fas fa-info-circle"></i> Подробнее
                            </button>
                            <button class="btn btn-primary w-100" 
                                    onclick="app.showTestDriveModal(${car.id})">
                                <i class="fas fa-car"></i> Тест-драйв
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Форматирование цены
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(price);
    }

    // Показать детали автомобиля
    async showCarDetails(carId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cars/${carId}`);
            if (response.ok) {
                const car = await response.json();
                this.currentCar = car;
                this.renderCarDetails(car);
                new bootstrap.Modal(document.getElementById('carDetailsModal')).show();
            } else {
                this.showError('Не удалось загрузить детали автомобиля');
            }
        } catch (error) {
            console.error('Ошибка загрузки деталей:', error);
            this.showError('Ошибка загрузки деталей автомобиля');
        }
    }

    // Отображение деталей автомобиля
    renderCarDetails(car) {
        document.getElementById('carDetailsTitle').textContent = car.model;
        
        const body = document.getElementById('carDetailsBody');
        body.innerHTML = `
            <div class="car-details">
                <div>
                    <img src="${car.image || 'assets/images/car-placeholder.jpg'}" 
                         class="img-fluid rounded mb-3" 
                         alt="${car.model}"
                         onerror="this.src='assets/images/car-placeholder.jpg'">
                </div>
                <div class="car-specs">
                    <h6 class="mb-3">Характеристики</h6>
                    <div class="spec-item">
                        <span class="spec-label">Модель:</span>
                        <span class="spec-value">${car.model}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Год выпуска:</span>
                        <span class="spec-value">${car.year}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Двигатель:</span>
                        <span class="spec-value">${car.engine}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Коробка передач:</span>
                        <span class="spec-value">${car.transmission}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Привод:</span>
                        <span class="spec-value">${car.driveType}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Цвет кузова:</span>
                        <span class="spec-value">${car.exteriorColor}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Цвет салона:</span>
                        <span class="spec-value">${car.interiorColor}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Диаметр дисков:</span>
                        <span class="spec-value">${car.wheelSize}"</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Цена:</span>
                        <span class="spec-value fw-bold text-primary">${this.formatPrice(car.price)}</span>
                    </div>
                </div>
            </div>
            ${car.description ? `<p class="mt-3">${car.description}</p>` : ''}
        `;
    }

    // Показать модальное окно тест-драйва
    showTestDriveModal(carId) {
        console.log('🚗 Opening test drive modal for car ID:', carId);
        this.currentCar = this.cars.find(car => car.id === carId);
        if (this.currentCar) {
            console.log('✅ Car found:', this.currentCar.name);
        } else {
            console.log('❌ Car not found for ID:', carId);
        }
        
        // Проверяем оба возможных ID (для разных страниц)
        const carIdEl = document.getElementById('testDriveCarId') || document.getElementById('selectedCarId');
        const modalEl = document.getElementById('testDriveModal');
        
        if (!modalEl) {
            console.error('❌ Test drive modal not found');
            this.showError('Ошибка: форма тест-драйва не найдена');
            return;
        }
        
        if (carIdEl && carId) {
            carIdEl.value = carId;
            console.log('✅ Car ID set to:', carId);
        } else if (carIdEl) {
            carIdEl.value = '';
            console.log('⚠️ No car ID provided');
        }
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    // Обработка формы обратной связи
    async handleContactForm(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            message: document.getElementById('message').value
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showSuccess('Сообщение успешно отправлено! Мы свяжемся с вами в ближайшее время.');
                document.getElementById('contactForm').reset();
            } else {
                this.showError('Ошибка отправки сообщения. Попробуйте еще раз.');
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    // Обработка формы тест-драйва
    async handleTestDriveForm() {
        // Проверяем оба возможных ID (для разных страниц)
        const carIdEl = document.getElementById('testDriveCarId') || document.getElementById('selectedCarId');
        const nameEl = document.getElementById('testDriveName');
        const phoneEl = document.getElementById('testDrivePhone');
        const emailEl = document.getElementById('testDriveEmail');
        const dateEl = document.getElementById('testDriveDate') || document.getElementById('preferredDate');
        const timeEl = document.getElementById('testDriveTime') || document.getElementById('preferredTime');
        const notesEl = document.getElementById('testDriveNotes');

        if (!nameEl || !phoneEl || !emailEl || !dateEl || !timeEl) {
            this.showError('Ошибка: форма не найдена');
            return;
        }

        const carIdValue = carIdEl?.value ? carIdEl.value.trim() : '';
        const carId = carIdValue ? parseInt(carIdValue) : null;
        const name = nameEl.value.trim();
        const phone = phoneEl.value.trim();
        const email = emailEl.value.trim();
        const preferredDate = dateEl.value;
        const preferredTime = timeEl.value;
        const notes = notesEl ? notesEl.value.trim() : '';

        // Валидация обязательных полей (carId опциональный)
        if (!name || !phone || !email || !preferredDate || !preferredTime) {
            this.showError('Пожалуйста, заполните все обязательные поля');
            return;
        }

        // Валидация формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Пожалуйста, введите корректный email адрес');
            return;
        }

        const formData = {
            name: name,
            phone: phone,
            email: email,
            preferredDate: preferredDate,
            preferredTime: preferredTime,
            notes: notes || undefined
        };

        // Добавляем carId только если он указан
        if (carId && !isNaN(carId)) {
            formData.carId = carId;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/test-drive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const responseData = await response.json();

            if (response.ok) {
                this.showSuccess('Заявка на тест-драйв успешно отправлена! Мы свяжемся с вами для подтверждения времени.');
                const modal = bootstrap.Modal.getInstance(document.getElementById('testDriveModal'));
                if (modal) modal.hide();
                const form = document.getElementById('testDriveForm');
                if (form) form.reset();
            } else {
                const errorMsg = responseData.error || responseData.message || 'Ошибка отправки заявки. Попробуйте еще раз.';
                this.showError(errorMsg);
                console.error('Ошибка сервера:', responseData);
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    // Инициализация карты (теперь используется универсальный модуль maps.js)
    initMap() {
        // Карты теперь инициализируются автоматически через maps.js
        console.log('Maps will be initialized by maps.js module');
    }

    // Показать уведомление об успехе
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    // Показать уведомление об ошибке
    showError(message) {
        this.showAlert(message, 'danger');
    }

    // Показать уведомление
    showAlert(message, type) {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            const div = document.createElement('div');
            div.id = 'alertContainer';
            div.className = 'position-fixed top-0 end-0 p-3';
            div.style.cssText = 'z-index: 9999';
            document.body.appendChild(div);
        }
        
        const alertId = 'alert-' + Date.now();
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show shadow" role="alert" style="min-width: 300px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.getElementById('alertContainer').insertAdjacentHTML('beforeend', alertHtml);
        
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                alertElement.remove();
            }
        }, 5000);
    }

    // Рендеринг популярных автомобилей на главной странице
    renderFeaturedCars() {
        const grid = document.getElementById('featuredCarsGrid');
        if (!grid || !this.featuredCars) return;

        if (this.featuredCars.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fa-solid fa-car fa-3x text-muted mb-3"></i>
                    <h4 class="text-muted">Автомобили не найдены</h4>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.featuredCars.map(car => this.createFeaturedCarCard(car)).join('');
    }

    // Создание карточки популярного автомобиля
    createFeaturedCarCard(car) {
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card h-100">
                    <div class="position-relative">
                        <img src="${car.image || 'assets/images/placeholder.jpg'}" 
                             class="card-img-top" 
                             alt="${car.model}"
                             onerror="this.src='assets/images/placeholder.jpg'">
                        ${!car.isAvailable || car.stockQuantity <= 0 ? 
                            '<div class="position-absolute top-0 start-0 bg-danger text-white px-2 py-1 m-2 rounded">Нет в наличии</div>' : 
                            '<div class="position-absolute top-0 start-0 bg-success text-white px-2 py-1 m-2 rounded">В наличии</div>'
                        }
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${car.model}</h5>
                        <div class="mb-2">
                            <small class="text-muted">
                                <i class="fa-solid fa-calendar me-1"></i>${car.year} год
                                <span class="mx-2">|</span>
                                <i class="fa-solid fa-cog me-1"></i>${car.engine}
                            </small>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted">
                                <i class="fa-solid fa-palette me-1"></i>${this.getColorName(car.exteriorColor)}
                                <span class="mx-2">|</span>
                                <i class="fa-solid fa-wheel me-1"></i>${car.wheelSize}"
                            </small>
                        </div>
                        <p class="card-text text-muted small flex-grow-1">${car.description || 'Описание недоступно'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-auto">
                            <h6 class="text-primary mb-0">${this.formatPrice(car.price)}</h6>
                            <button class="btn btn-outline-primary btn-sm" onclick="app.showTestDriveModal(${car.id})">
                                <i class="fa-solid fa-steering-wheel me-1"></i>Тест-драйв
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Получение названия цвета
    getColorName(color) {
        const colors = {
            'black': 'Черный',
            'white': 'Белый',
            'silver': 'Серебристый',
            'gray': 'Серый',
            'red': 'Красный',
            'blue': 'Синий',
            'green': 'Зеленый',
            'gold': 'Золотой'
        };
        return colors[color] || color;
    }

    // Форматирование цены
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(price);
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new LiXiangApp();
});

// Дополнительные утилиты
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Обработка ошибок изображений
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
        e.target.src = 'assets/images/car-placeholder.jpg';
    }
}, true);
