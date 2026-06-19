// Управление overlay меню

class OverlayMenu {
    constructor() {
        this.activeOverlay = null;
        this.init();
    }

    init() {
        // Добавляем обработчики событий
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeOverlay) {
                this.closeOverlay(this.activeOverlay);
            }
        });

        // Предотвращаем скролл body когда overlay открыт
        this.preventBodyScroll();
    }

    toggleOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) {
            console.error(`Overlay with id "${overlayId}" not found`);
            return;
        }

        if (this.activeOverlay === overlayId) {
            this.closeOverlay(overlayId);
        } else {
            // Закрываем текущий overlay если есть
            if (this.activeOverlay) {
                this.closeOverlay(this.activeOverlay);
            }
            this.openOverlay(overlayId);
        }
    }

    openOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;

        console.log(`🔓 Opening compact dropdown: ${overlayId}`);
        
        // Показываем dropdown
        overlay.style.display = 'block';
        
        // Добавляем класс active с небольшой задержкой для анимации
        setTimeout(() => {
            overlay.classList.add('active');
        }, 5);

        this.activeOverlay = overlayId;

        // Добавляем обработчик клика вне меню для закрытия
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick.bind(this));
        }, 100);
    }

    closeOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;

        console.log(`🔒 Closing compact dropdown: ${overlayId}`);

        // Убираем класс active
        overlay.classList.remove('active');

        // Скрываем dropdown после анимации
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 150);
        
        this.activeOverlay = null;

        // Убираем обработчик клика вне меню
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }

    handleOutsideClick(event) {
        if (!this.activeOverlay) return;
        
        const overlay = document.getElementById(this.activeOverlay);
        const menuTrigger = event.target.closest('[onclick*="toggleOverlay"]');
        
        // Если клик не по меню и не по триггеру - закрываем
        if (!overlay.contains(event.target) && !menuTrigger) {
            this.closeOverlay(this.activeOverlay);
        }
    }

    closeAllOverlays() {
        const overlays = document.querySelectorAll('.menu-overlay');
        overlays.forEach(overlay => {
            if (overlay.classList.contains('active')) {
                this.closeOverlay(overlay.id);
            }
        });
    }

    preventBodyScroll() {
        // Для dropdown меню не блокируем скролл body
        // Только предотвращаем случайные свайпы вне меню на мобильных
        document.addEventListener('touchmove', (e) => {
            if (this.activeOverlay && !e.target.closest('.overlay-content')) {
                // Не блокируем скролл, позволяем пользователю скроллить страницу
                // e.preventDefault(); // Убираем блокировку
            }
        }, { passive: true }); // Делаем passive для лучшей производительности
    }
}

// Глобальные функции для использования в HTML
let overlayMenu;

function toggleOverlay(overlayId) {
    if (!overlayMenu) {
        overlayMenu = new OverlayMenu();
    }
    overlayMenu.toggleOverlay(overlayId);
}

function closeOverlay(overlayId) {
    if (!overlayMenu) {
        overlayMenu = new OverlayMenu();
    }
    overlayMenu.closeOverlay(overlayId);
}

function closeAllOverlays() {
    if (!overlayMenu) {
        overlayMenu = new OverlayMenu();
    }
    overlayMenu.closeAllOverlays();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    overlayMenu = new OverlayMenu();
    console.log('✅ Overlay menu system initialized');
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OverlayMenu, toggleOverlay, closeOverlay, closeAllOverlays };
}
