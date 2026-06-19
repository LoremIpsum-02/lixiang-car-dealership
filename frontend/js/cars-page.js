class CarsPage {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.cars = [];
        this.filteredCars = [];
        this.currentPage = 1;
        this.carsPerPage = 9;
        this.isGridView = true;
        
        this.init();
    }

    async init() {
        await this.loadCars();
        this.setupEventListeners();
        this.setupPriceSlider();
        this.renderCars();
        // Карты теперь инициализируются автоматически через maps.js
    }

    async loadCars() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cars`);
            if (response.ok) {
                const data = await response.json();
                this.cars = data.cars || data || [];
                this.filteredCars = [...this.cars];
                console.log('Загружено автомобилей:', this.cars.length);
                this.updateResultsCount();
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

    setupEventListeners() {
        // Price range inputs
        document.getElementById('priceMinInput').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('priceMin').value = value;
            this.applyFilters();
        });

        document.getElementById('priceMaxInput').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('priceMax').value = value;
            this.applyFilters();
        });

        // Price sliders
        document.getElementById('priceMin').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('priceMinInput').value = value;
            this.applyFilters();
        });

        document.getElementById('priceMax').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('priceMaxInput').value = value;
            this.applyFilters();
        });

        // Model checkboxes
        document.querySelectorAll('input[type="checkbox"][id^="model"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });

        // Other filters
        document.getElementById('colorFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('sortBy').addEventListener('change', () => this.applyFilters());
        document.getElementById('onlyAvailable').addEventListener('change', () => this.applyFilters());

        // Reset filters
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

        // View toggle
        document.getElementById('gridView').addEventListener('click', () => this.setGridView());
        document.getElementById('listView').addEventListener('click', () => this.setListView());

        // Show more button
        document.getElementById('showMoreBtn').addEventListener('click', () => this.showMoreCars());

        // Test drive form
        const submitTestDriveBtn = document.getElementById('submitTestDrive');
        if (submitTestDriveBtn) {
            submitTestDriveBtn.addEventListener('click', () => this.submitTestDrive());
        }
        
        // Кнопка тест-драйва
        const testDriveBtn = document.getElementById('testDriveBtn');
        if (testDriveBtn) {
            testDriveBtn.addEventListener('click', () => this.openTestDriveModal());
        }
        
        // Ссылка тест-драйва в хедере
        const headerTestDrive = document.getElementById('headerTestDrive');
        if (headerTestDrive) {
            headerTestDrive.addEventListener('click', (e) => {
                e.preventDefault();
                this.openTestDriveModal();
            });
        }

        // Делегирование событий для кнопок тест-драйва в карточках машин
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-drive-btn')) {
                const btn = e.target.closest('.test-drive-btn');
                const carId = btn.getAttribute('data-car-id');
                if (carId) {
                    this.openTestDriveModal(parseInt(carId));
                } else {
                    this.openTestDriveModal();
                }
            }
        });
    }

    setupPriceSlider() {
        const priceMin = document.getElementById('priceMin');
        const priceMax = document.getElementById('priceMax');
        const priceMinInput = document.getElementById('priceMinInput');
        const priceMaxInput = document.getElementById('priceMaxInput');

        // Set initial values
        const minPrice = Math.min(...this.cars.map(car => car.price));
        const maxPrice = Math.max(...this.cars.map(car => car.price));

        priceMin.min = minPrice;
        priceMin.max = maxPrice;
        priceMin.value = minPrice;
        priceMax.min = minPrice;
        priceMax.max = maxPrice;
        priceMax.value = maxPrice;

        priceMinInput.min = minPrice;
        priceMinInput.max = maxPrice;
        priceMinInput.value = minPrice;
        priceMaxInput.min = minPrice;
        priceMaxInput.max = maxPrice;
        priceMaxInput.value = maxPrice;
    }

    applyFilters() {
        const priceMin = parseInt(document.getElementById('priceMin').value);
        const priceMax = parseInt(document.getElementById('priceMax').value);
        const selectedModels = Array.from(document.querySelectorAll('input[type="checkbox"][id^="model"]:checked'))
            .map(cb => cb.value);
        const selectedColor = document.getElementById('colorFilter').value;
        const onlyAvailable = document.getElementById('onlyAvailable').checked;

        this.filteredCars = this.cars.filter(car => {
            // Price filter
            if (car.price < priceMin || car.price > priceMax) return false;

            // Model filter
            if (selectedModels.length > 0) {
                const carModel = car.model.replace('LiXiang ', '');
                if (!selectedModels.some(model => carModel.includes(model))) return false;
            }

            // Color filter
            if (selectedColor && car.exterior_color !== selectedColor) return false;

            // Availability filter
            if (onlyAvailable && (!car.is_available || car.stock_quantity <= 0)) return false;

            return true;
        });

        this.sortCars();
        this.currentPage = 1;
        this.renderCars();
    }

    sortCars() {
        const sortBy = document.getElementById('sortBy').value;

        this.filteredCars.sort((a, b) => {
            switch (sortBy) {
                case 'price_asc':
                    return a.price - b.price;
                case 'price_desc':
                    return b.price - a.price;
                case 'model_asc':
                    return a.model.localeCompare(b.model);
                case 'model_desc':
                    return b.model.localeCompare(a.model);
                case 'year_desc':
                    return b.year - a.year;
                case 'year_asc':
                    return a.year - b.year;
                case 'available_desc':
                    if (a.is_available && b.is_available) return b.stock_quantity - a.stock_quantity;
                    if (a.is_available && !b.is_available) return -1;
                    if (!a.is_available && b.is_available) return 1;
                    return 0;
                default:
                    return 0;
            }
        });
    }

    renderCars() {
        const grid = document.getElementById('carsGrid');
        const startIndex = 0;
        const endIndex = this.currentPage * this.carsPerPage;
        const carsToShow = this.filteredCars.slice(startIndex, endIndex);

        if (carsToShow.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fa-solid fa-car fa-3x text-muted mb-3"></i>
                    <h4 class="text-muted">Автомобили не найдены</h4>
                    <p class="text-muted">Попробуйте изменить параметры фильтрации</p>
                </div>
            `;
            document.getElementById('showMoreBtn').style.display = 'none';
            return;
        }

        grid.innerHTML = carsToShow.map(car => this.createCarCard(car)).join('');

        // Show/hide "Show more" button
        const showMoreBtn = document.getElementById('showMoreBtn');
        if (endIndex < this.filteredCars.length) {
            showMoreBtn.style.display = 'block';
        } else {
            showMoreBtn.style.display = 'none';
        }

        this.updateResultsCount();
    }

    createCarCard(car) {
        const gridClass = this.isGridView ? 'col-lg-4 col-md-6 mb-4' : 'col-12 mb-3';
        const cardClass = this.isGridView ? 'card car-card h-100' : 'card car-card';
        
        return `
            <div class="${gridClass}">
                <div class="${cardClass}">
                    <div class="position-relative">
                        <img src="${car.image || 'assets/images/placeholder.jpg'}" 
                             class="card-img-top" 
                             alt="${car.model}"
                             onerror="this.src='assets/images/placeholder.jpg'">
                        ${!car.is_available || car.stock_quantity <= 0 ? 
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
                                <i class="fa-solid fa-palette me-1"></i>${this.getColorName(car.exterior_color)}
                                <span class="mx-2">|</span>
                                <i class="fa-solid fa-wheel me-1"></i>${car.wheel_size}"
                            </small>
                        </div>
                        <p class="card-text text-muted small flex-grow-1">${car.description || 'Описание недоступно'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-auto">
                            <h6 class="text-primary mb-0">${this.formatPrice(car.price)}</h6>
                            <button class="btn btn-outline-primary btn-sm test-drive-btn" data-car-id="${car.id}">
                                <i class="fa-solid fa-steering-wheel me-1"></i>Тест-драйв
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

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

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(price);
    }

    showMoreCars() {
        this.currentPage++;
        this.renderCars();
    }

    setGridView() {
        this.isGridView = true;
        document.getElementById('gridView').classList.add('active');
        document.getElementById('listView').classList.remove('active');
        this.renderCars();
    }

    setListView() {
        this.isGridView = false;
        document.getElementById('listView').classList.add('active');
        document.getElementById('gridView').classList.remove('active');
        this.renderCars();
    }

    resetFilters() {
        // Reset price range
        const minPrice = Math.min(...this.cars.map(car => car.price));
        const maxPrice = Math.max(...this.cars.map(car => car.price));
        
        document.getElementById('priceMin').value = minPrice;
        document.getElementById('priceMax').value = maxPrice;
        document.getElementById('priceMinInput').value = minPrice;
        document.getElementById('priceMaxInput').value = maxPrice;

        // Reset checkboxes
        document.querySelectorAll('input[type="checkbox"][id^="model"]').forEach(cb => cb.checked = false);

        // Reset selects
        document.getElementById('colorFilter').value = '';
        document.getElementById('sortBy').value = 'price_asc';
        document.getElementById('onlyAvailable').checked = false;

        this.applyFilters();
    }

    updateResultsCount() {
        document.getElementById('resultsCount').textContent = `Найдено автомобилей: ${this.filteredCars.length}`;
    }

    openTestDriveModal(carId) {
        console.log('🚗 Opening test drive modal for car ID:', carId);
        const selectedCarIdEl = document.getElementById('selectedCarId');
        const modalEl = document.getElementById('testDriveModal');
        
        if (!selectedCarIdEl || !modalEl) {
            console.error('❌ Test drive modal elements not found');
            this.showError('Ошибка: форма тест-драйва не найдена');
            return;
        }
        
        if (carId) {
            selectedCarIdEl.value = carId;
            console.log('✅ Car ID set to:', carId);
        } else {
            selectedCarIdEl.value = '';
            console.log('⚠️ No car ID provided');
        }
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    async submitTestDrive() {
        const form = document.getElementById('testDriveForm');
        const selectedCarIdEl = document.getElementById('selectedCarId');
        const nameEl = document.getElementById('testDriveName');
        const phoneEl = document.getElementById('testDrivePhone');
        const emailEl = document.getElementById('testDriveEmail');
        const dateEl = document.getElementById('preferredDate');
        const timeEl = document.getElementById('preferredTime');
        const notesEl = document.getElementById('testDriveNotes');

        if (!form || !nameEl || !phoneEl || !emailEl || !dateEl || !timeEl) {
            this.showError('Ошибка: форма не найдена');
            return;
        }

        const carIdValue = selectedCarIdEl?.value ? selectedCarIdEl.value.trim() : '';
        const carId = carIdValue ? parseInt(carIdValue) : null;
        const name = nameEl.value.trim();
        const phone = phoneEl.value.trim();
        const email = emailEl.value.trim();
        const preferredDate = dateEl.value;
        const preferredTime = timeEl.value;
        const notes = notesEl ? notesEl.value.trim() : '';

        // Валидация обязательных полей
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

        const data = {
            name: name,
            phone: phone,
            email: email,
            preferredDate: preferredDate,
            preferredTime: preferredTime,
            notes: notes || undefined
        };

        // Добавляем carId только если он указан
        if (carId && !isNaN(carId)) {
            data.carId = carId;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/test-drive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const responseData = await response.json();

            if (response.ok) {
                const carModelText = responseData.carModel ? ` Модель: ${responseData.carModel}` : '';
                this.showSuccess(`Заявка на тест-драйв успешно отправлена!${carModelText}`);
                form.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('testDriveModal'));
                if (modal) modal.hide();
            } else {
                const errorMsg = responseData.error || responseData.message || 'Ошибка отправки заявки';
                this.showError(errorMsg);
                console.error('Ошибка сервера:', responseData);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

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

    // Карты теперь инициализируются автоматически через maps.js
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.carsPage = new CarsPage();
});

