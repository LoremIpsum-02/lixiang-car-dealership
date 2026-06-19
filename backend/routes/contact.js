// API маршруты для обращений клиентов
const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Получить все обращения
router.get('/', async (req, res) => {
    try {
        const {
            status,
            limit = 50,
            offset = 0
        } = req.query;

        let sql = `
            SELECT 
                cr.id,
                cr.name,
                cr.phone,
                cr.email,
                cr.message,
                cr.status,
                cr.response,
                cr.created_at,
                cr.updated_at,
                c.id as customer_id
            FROM contact_requests cr
            LEFT JOIN customers c ON cr.customer_id = c.id
            WHERE 1=1
        `;
        
        const params = [];

        // Фильтры
        if (status) {
            sql += ' AND cr.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY cr.created_at DESC';
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const requests = await database.query(sql, params);

        // Получение общего количества
        let countSql = 'SELECT COUNT(*) as total FROM contact_requests cr WHERE 1=1';
        const countParams = [];

        if (status) {
            countSql += ' AND cr.status = ?';
            countParams.push(status);
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
        console.error('Ошибка получения обращений:', error);
        res.status(500).json({
            error: 'Ошибка получения обращений',
            message: error.message
        });
    }
});

// Получить обращение по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const sql = `
            SELECT 
                cr.id,
                cr.name,
                cr.phone,
                cr.email,
                cr.message,
                cr.status,
                cr.response,
                cr.created_at,
                cr.updated_at,
                c.id as customer_id,
                c.address as customer_address
            FROM contact_requests cr
            LEFT JOIN customers c ON cr.customer_id = c.id
            WHERE cr.id = ?
        `;

        const requests = await database.query(sql, [id]);

        if (requests.length === 0) {
            return res.status(404).json({
                error: 'Обращение не найдено'
            });
        }

        res.json(requests[0]);

    } catch (error) {
        console.error('Ошибка получения обращения:', error);
        res.status(500).json({
            error: 'Ошибка получения обращения',
            message: error.message
        });
    }
});

// Создать новое обращение
router.post('/', async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            message
        } = req.body;

        // Валидация обязательных полей
        if (!name || !phone || !email || !message) {
            return res.status(400).json({
                error: 'Не все обязательные поля заполнены'
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Некорректный формат email'
            });
        }

        // Валидация телефона (базовая)
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                error: 'Некорректный формат телефона'
            });
        }

        // Поиск или создание клиента
        let customerId;
        const existingCustomer = await database.query(
            'SELECT id FROM customers WHERE email = $1 OR phone = $2',
            [email, phone]
        );

        if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
            
            // Обновление данных клиента
            await database.query(
                'UPDATE customers SET name = $1, phone = $2, email = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
                [name, phone, email, customerId]
            );
        } else {
            // Создание нового клиента
            const inserted = await database.query(
                'INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3) RETURNING id',
                [name, phone, email]
            );
            customerId = inserted[0].id;
        }

        // Создание обращения
        const created = await database.query(
            `INSERT INTO contact_requests (
                customer_id, name, phone, email, message
            ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [customerId, name, phone, email, message]
        );

        const requestId = created[0].id;

        // Отправка в Telegram в фоне
        (async () => {
            try {
                const token = process.env.TELEGRAM_BOT_TOKEN;
                const chatId = process.env.TELEGRAM_CHAT_ID;
                if (!token || !chatId) return;
                const text = [
                    '📩 Новое обращение (Свяжитесь с нами)',
                    `ID: ${requestId}`,
                    `Имя: ${name}`,
                    `Телефон: ${phone}`,
                    `Email: ${email}`,
                    `Сообщение: ${message}`
                ].join('\n');
                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
            } catch (e) {
                console.error('Не удалось отправить сообщение в Telegram (contact):', e.message);
            }
        })();

        res.status(201).json({ message: 'Обращение успешно отправлено', id: requestId });

    } catch (error) {
        console.error('Ошибка создания обращения:', error);
        res.status(500).json({
            error: 'Ошибка создания обращения',
            message: error.message
        });
    }
});

// Обновить статус обращения
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response } = req.body;

        // Валидация статуса
        const validStatuses = ['new', 'in_progress', 'resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Недопустимый статус'
            });
        }

        // Проверка существования обращения
        const existingRequest = await database.query(
            'SELECT id FROM contact_requests WHERE id = ?',
            [id]
        );

        if (existingRequest.length === 0) {
            return res.status(404).json({
                error: 'Обращение не найдено'
            });
        }

        const sql = `
            UPDATE contact_requests SET
                status = ?,
                response = COALESCE(?, response),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await database.query(sql, [status, response, id]);

        res.json({
            message: 'Статус обращения успешно обновлен'
        });

    } catch (error) {
        console.error('Ошибка обновления статуса обращения:', error);
        res.status(500).json({
            error: 'Ошибка обновления статуса обращения',
            message: error.message
        });
    }
});

// Добавить ответ на обращение
router.put('/:id/response', async (req, res) => {
    try {
        const { id } = req.params;
        const { response } = req.body;

        if (!response || response.trim().length === 0) {
            return res.status(400).json({
                error: 'Ответ не может быть пустым'
            });
        }

        // Проверка существования обращения
        const existingRequest = await database.query(
            'SELECT id, status FROM contact_requests WHERE id = ?',
            [id]
        );

        if (existingRequest.length === 0) {
            return res.status(404).json({
                error: 'Обращение не найдено'
            });
        }

        const sql = `
            UPDATE contact_requests SET
                response = ?,
                status = 'resolved',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await database.query(sql, [response, id]);

        res.json({
            message: 'Ответ успешно добавлен'
        });

    } catch (error) {
        console.error('Ошибка добавления ответа:', error);
        res.status(500).json({
            error: 'Ошибка добавления ответа',
            message: error.message
        });
    }
});

// Удалить обращение
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования обращения
        const existingRequest = await database.query(
            'SELECT id FROM contact_requests WHERE id = ?',
            [id]
        );

        if (existingRequest.length === 0) {
            return res.status(404).json({
                error: 'Обращение не найдено'
            });
        }

        await database.query(
            'DELETE FROM contact_requests WHERE id = ?',
            [id]
        );

        res.json({
            message: 'Обращение успешно удалено'
        });

    } catch (error) {
        console.error('Ошибка удаления обращения:', error);
        res.status(500).json({
            error: 'Ошибка удаления обращения',
            message: error.message
        });
    }
});

// Получить статистику по обращениям
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await database.query(`
            SELECT 
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status = 'new' THEN 1 END) as new_requests,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_requests
            FROM contact_requests
        `);

        const dailyStats = await database.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as requests_count
            FROM contact_requests
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        const monthlyStats = await database.query(`
            SELECT 
                YEAR(created_at) as year,
                MONTH(created_at) as month,
                COUNT(*) as requests_count
            FROM contact_requests
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY YEAR(created_at), MONTH(created_at)
            ORDER BY year DESC, month DESC
        `);

        res.json({
            overview: stats[0],
            dailyStats,
            monthlyStats
        });

    } catch (error) {
        console.error('Ошибка получения статистики обращений:', error);
        res.status(500).json({
            error: 'Ошибка получения статистики обращений',
            message: error.message
        });
    }
});

module.exports = router;
