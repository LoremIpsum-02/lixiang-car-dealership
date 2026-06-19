// API маршруты для заявок на тест-драйв
const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Получить все заявки на тест-драйв
router.get('/', async (req, res) => {
    try {
        const {
            status,
            date,
            limit = 50,
            offset = 0
        } = req.query;

        let sql = `
            SELECT 
                tdr.id,
                tdr.preferred_date,
                tdr.preferred_time,
                tdr.status,
                tdr.notes,
                tdr.created_at,
                c.id as customer_id,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                car.id as car_id,
                car.model as car_model,
                car.price as car_price
            FROM test_drive_requests tdr
            LEFT JOIN customers c ON tdr.customer_id = c.id
            LEFT JOIN cars car ON tdr.car_id = car.id
            WHERE 1=1
        `;
        
        const params = [];

        // Фильтры
        if (status) {
            sql += ' AND tdr.status = ?';
            params.push(status);
        }

        if (date) {
            sql += ' AND DATE(tdr.preferred_date) = ?';
            params.push(date);
        }

        sql += ' ORDER BY tdr.created_at DESC';
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const requests = await database.query(sql, params);

        // Получение общего количества
        let countSql = 'SELECT COUNT(*) as total FROM test_drive_requests tdr WHERE 1=1';
        const countParams = [];

        if (status) {
            countSql += ' AND tdr.status = ?';
            countParams.push(status);
        }

        if (date) {
            countSql += ' AND DATE(tdr.preferred_date) = ?';
            countParams.push(date);
        }

        const [countResult] = await database.query(countSql, countParams);
        const total = countResult.total;

        res.json({
            requests,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Ошибка получения заявок на тест-драйв:', error);
        res.status(500).json({
            error: 'Ошибка получения заявок на тест-драйв',
            message: error.message
        });
    }
});

// Получить заявку по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const sql = `
            SELECT 
                tdr.id,
                tdr.preferred_date,
                tdr.preferred_time,
                tdr.status,
                tdr.notes,
                tdr.created_at,
                tdr.updated_at,
                c.id as customer_id,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                c.address as customer_address,
                car.id as car_id,
                car.model as car_model,
                car.year as car_year,
                car.price as car_price,
                car.image as car_image
            FROM test_drive_requests tdr
            LEFT JOIN customers c ON tdr.customer_id = c.id
            LEFT JOIN cars car ON tdr.car_id = car.id
            WHERE tdr.id = ?
        `;

        const requests = await database.query(sql, [id]);

        if (requests.length === 0) {
            return res.status(404).json({
                error: 'Заявка на тест-драйв не найдена'
            });
        }

        res.json(requests[0]);

    } catch (error) {
        console.error('Ошибка получения заявки на тест-драйв:', error);
        res.status(500).json({
            error: 'Ошибка получения заявки на тест-драйв',
            message: error.message
        });
    }
});

// Создать новую заявку на тест-драйв (PostgreSQL) + отправка в Telegram
router.post('/', async (req, res) => {
    try {
        const {
            carId,
            name,
            phone,
            email,
            preferredDate,
            preferredTime,
            notes
        } = req.body;

        // Валидация обязательных полей
        if (!name || !phone || !email || !preferredDate || !preferredTime) {
            return res.status(400).json({ 
                error: 'Не все обязательные поля заполнены',
                message: 'Пожалуйста, заполните все обязательные поля: имя, телефон, email, дата и время'
            });
        }

        // Проверка формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Некорректный формат email' });
        }

        // Проверка формата телефона
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ error: 'Некорректный формат телефона' });
        }

        // Проверка существования автомобиля (если указан carId)
        let car = null;
        if (carId) {
            const carIdNum = parseInt(carId);
            if (isNaN(carIdNum)) {
                return res.status(400).json({ error: 'Некорректный ID автомобиля' });
            }
            
            const carResult = await database.query(
                'SELECT id, model FROM cars WHERE id = $1',
                [carIdNum]
            );
            
            if (carResult.length === 0) {
                return res.status(404).json({ error: 'Автомобиль не найден' });
            }
            
            car = carResult[0];
        }

        // Поиск или создание клиента
        let customerId;
        const existingCustomer = await database.query(
            'SELECT id FROM customers WHERE email = $1 OR phone = $2',
            [email, phone]
        );
        if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
            await database.query(
                'UPDATE customers SET name = $1, phone = $2, email = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
                [name, phone, email, customerId]
            );
        } else {
            const inserted = await database.query(
                'INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3) RETURNING id',
                [name, phone, email]
            );
            customerId = inserted[0].id;
        }

        // Создание заявки на тест-драйв
        const created = await database.query(
            `INSERT INTO test_drive_requests (
                customer_id, car_id, preferred_date, preferred_time, notes
            ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [customerId, carId || null, preferredDate, preferredTime, notes || null]
        );

        const requestId = created[0].id;

        // Не блокируем ответ, отправляем уведомление в Telegram в фоне
        (async () => {
            try {
                const token = process.env.TELEGRAM_BOT_TOKEN;
                const chatId = process.env.TELEGRAM_CHAT_ID; // личка или группа
                if (!token || !chatId) return; // интеграция выключена, если нет настроек

                const text = [
                    '📝 Новая заявка на тест-драйв',
                    `ID заявки: ${requestId}`,
                    car ? `Модель: ${car.model} (ID: ${carId})` : 'Модель: не указана',
                    `Имя: ${name}`,
                    `Телефон: ${phone}`,
                    `Email: ${email}`,
                    `Дата/время: ${preferredDate} ${preferredTime}`,
                    notes ? `Комментарий: ${notes}` : ''
                ].filter(Boolean).join('\n');

                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text })
                });
            } catch (e) {
                console.error('Не удалось отправить сообщение в Telegram:', e.message);
            }
        })();

        res.status(201).json({
            message: 'Заявка на тест-драйв успешно создана',
            id: requestId,
            carModel: car ? car.model : null
        });
    } catch (error) {
        console.error('Ошибка создания заявки на тест-драйв:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            constraint: error.constraint,
            detail: error.detail
        });
        res.status(500).json({ 
            error: 'Ошибка создания заявки на тест-драйв', 
            message: error.message,
            detail: error.detail || error.message
        });
    }
});

// Обновить статус заявки на тест-драйв
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        // Валидация статуса
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Недопустимый статус'
            });
        }

        // Проверка существования заявки
        const existingRequest = await database.query(
            'SELECT id FROM test_drive_requests WHERE id = ?',
            [id]
        );

        if (existingRequest.length === 0) {
            return res.status(404).json({
                error: 'Заявка на тест-драйв не найдена'
            });
        }

        const sql = `
            UPDATE test_drive_requests SET
                status = ?,
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await database.query(sql, [status, notes, id]);

        res.json({
            message: 'Статус заявки успешно обновлен'
        });

    } catch (error) {
        console.error('Ошибка обновления статуса заявки:', error);
        res.status(500).json({
            error: 'Ошибка обновления статуса заявки',
            message: error.message
        });
    }
});

// Удалить заявку на тест-драйв
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования заявки
        const existingRequest = await database.query(
            'SELECT id FROM test_drive_requests WHERE id = ?',
            [id]
        );

        if (existingRequest.length === 0) {
            return res.status(404).json({
                error: 'Заявка на тест-драйв не найдена'
            });
        }

        await database.query(
            'DELETE FROM test_drive_requests WHERE id = ?',
            [id]
        );

        res.json({
            message: 'Заявка на тест-драйв успешно удалена'
        });

    } catch (error) {
        console.error('Ошибка удаления заявки на тест-драйв:', error);
        res.status(500).json({
            error: 'Ошибка удаления заявки на тест-драйв',
            message: error.message
        });
    }
});

// Получить статистику по заявкам на тест-драйв
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await database.query(`
            SELECT 
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_requests,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests
            FROM test_drive_requests
        `);

        const dailyStats = await database.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as requests_count
            FROM test_drive_requests
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        const carStats = await database.query(`
            SELECT 
                car.model,
                COUNT(tdr.id) as requests_count
            FROM test_drive_requests tdr
            JOIN cars car ON tdr.car_id = car.id
            GROUP BY car.model
            ORDER BY requests_count DESC
        `);

        res.json({
            overview: stats[0],
            dailyStats,
            carStats
        });

    } catch (error) {
        console.error('Ошибка получения статистики заявок:', error);
        res.status(500).json({
            error: 'Ошибка получения статистики заявок',
            message: error.message
        });
    }
});

module.exports = router;
