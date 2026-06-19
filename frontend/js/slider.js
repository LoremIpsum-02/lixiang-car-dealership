// Hero Slider JavaScript
class HeroSlider {
    constructor() {
        this.slides = document.querySelectorAll('.hero-slide');
        this.indicators = document.querySelectorAll('.hero-indicator');
        this.prevBtn = document.querySelector('.hero-nav-prev');
        this.nextBtn = document.querySelector('.hero-nav-next');
        this.currentSlide = 0;
        this.slideInterval = null;
        this.autoSlideDelay = 4000; // 4 секунд

        this.init();
    }

    init() {
        if (this.slides.length === 0) return;

        // Устанавливаем фоновые изображения
        this.setBackgroundImages();
        
        // Добавляем обработчики событий
        this.addEventListeners();
        
        // Запускаем автопрокрутку
        this.startAutoSlide();
        
        // Показываем первый слайд
        this.showSlide(0);
    }

    setBackgroundImages() {
        this.slides.forEach(slide => {
            const bgImage = slide.getAttribute('data-bg');
            if (bgImage) {
                slide.style.backgroundImage = `url('${bgImage}')`;
            }
        });
    }

    addEventListeners() {
        // Кнопки навигации
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.prevSlide());
        }
        
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextSlide());
        }

        // Индикаторы
        this.indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => this.showSlide(index));
        });

        // Останавливаем автопрокрутку при наведении
        const sliderContainer = document.querySelector('.hero-slider-container');
        if (sliderContainer) {
            sliderContainer.addEventListener('mouseenter', () => this.stopAutoSlide());
            sliderContainer.addEventListener('mouseleave', () => this.startAutoSlide());
        }

        // Клавиатурная навигация
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prevSlide();
            } else if (e.key === 'ArrowRight') {
                this.nextSlide();
            }
        });

        // Свайп для мобильных устройств
        this.addSwipeSupport();
    }

    showSlide(index) {
        // Убираем активный класс со всех слайдов и индикаторов
        this.slides.forEach(slide => slide.classList.remove('active'));
        this.indicators.forEach(indicator => indicator.classList.remove('active'));

        // Добавляем активный класс к текущему слайду и индикатору
        if (this.slides[index]) {
            this.slides[index].classList.add('active');
        }
        if (this.indicators[index]) {
            this.indicators[index].classList.add('active');
        }

        this.currentSlide = index;
    }

    nextSlide() {
        const nextIndex = (this.currentSlide + 1) % this.slides.length;
        this.showSlide(nextIndex);
    }

    prevSlide() {
        const prevIndex = this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1;
        this.showSlide(prevIndex);
    }

    startAutoSlide() {
        this.stopAutoSlide(); // Останавливаем предыдущий интервал
        this.slideInterval = setInterval(() => {
            this.nextSlide();
        }, this.autoSlideDelay);
    }

    stopAutoSlide() {
        if (this.slideInterval) {
            clearInterval(this.slideInterval);
            this.slideInterval = null;
        }
    }

    addSwipeSupport() {
        let startX = 0;
        let endX = 0;
        const sliderContainer = document.querySelector('.hero-slider-container');

        if (!sliderContainer) return;

        sliderContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });

        sliderContainer.addEventListener('touchmove', (e) => {
            endX = e.touches[0].clientX;
        });

        sliderContainer.addEventListener('touchend', () => {
            const threshold = 50; // Минимальное расстояние для свайпа
            const diff = startX - endX;

            if (Math.abs(diff) > threshold) {
                if (diff > 0) {
                    this.nextSlide(); // Свайп влево - следующий слайд
                } else {
                    this.prevSlide(); // Свайп вправо - предыдущий слайд
                }
            }
        });
    }

    // Метод для обновления задержки автопрокрутки
    setAutoSlideDelay(delay) {
        this.autoSlideDelay = delay;
        if (this.slideInterval) {
            this.startAutoSlide();
        }
    }

    // Метод для паузы/возобновления автопрокрутки
    toggleAutoSlide() {
        if (this.slideInterval) {
            this.stopAutoSlide();
        } else {
            this.startAutoSlide();
        }
    }

    // Метод для перехода к конкретному слайду
    goToSlide(index) {
        if (index >= 0 && index < this.slides.length) {
            this.showSlide(index);
        }
    }
}

// Инициализация слайдера когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
    new HeroSlider();
});

// Экспорт для использования в других модулях
window.HeroSlider = HeroSlider;
