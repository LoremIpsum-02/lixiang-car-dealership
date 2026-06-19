// Основной сервер для LiXiang Auto Salon
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const carRoutes = require('./routes/cars');
const customerRoutes = require('./routes/customers');
const testDriveRoutes = require('./routes/testDrive');
const contactRoutes = require('./routes/contact');
const orderRoutes = require('./routes/orders');
const requestRoutes = require('./routes/requests');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// API Routes
app.use('/api/cars', carRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/test-drive', testDriveRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/requests', requestRoutes);

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// API Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'LiXiang Auto Salon API работает',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Обработка 404
app.use('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        res.status(404).json({
            error: 'API endpoint не найден',
            path: req.originalUrl
        });
    } else {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
});

// Обработка ошибок
app.use((error, req, res, next) => {
    console.error('Ошибка сервера:', error);
    
    res.status(error.status || 500).json({
        error: error.message || 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('🚀 LiXiang Auto Salon Server запущен');
    console.log(`📍 Адрес: http://localhost:${PORT}`);
    console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 API: http://localhost:${PORT}/api/health`);
    console.log('─'.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Получен сигнал SIGTERM, завершение работы сервера...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Получен сигнал SIGINT, завершение работы сервера...');
    process.exit(0);
});

module.exports = app;
