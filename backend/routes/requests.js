const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Создать новую заявку (кредит, лизинг, партнерство, карьера, корпоративные продажи)
router.post('/', async (req, res) => {
    try {
        const {
            type,
            name,
            phone,
            email,
            message,
            data
        } = req.body;

        if (!type || !name || !phone || !email) {
            return res.status(400).json({
                error: 'Не все обязательные поля заполнены'
            });
        }

        const validTypes = ['credit', 'leasing', 'partner', 'career', 'corporate', 'offer'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: 'Некорректный тип заявки'
            });
        }

        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                error: 'Некорректный формат телефона'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Некорректный формат email'
            });
        }

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

        const inserted = await database.query(
            `INSERT INTO contact_requests (
                customer_id, name, phone, email, message
            ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [customerId, name, phone, email, JSON.stringify({ type, ...data, message }) || null]
        );

        const requestId = inserted[0].id;

        (async () => {
            try {
                const token = process.env.TELEGRAM_BOT_TOKEN;
                const chatId = process.env.TELEGRAM_CHAT_ID;
                if (!token || !chatId) return;

                const typeNames = {
                    credit: '💳 Кредит',
                    leasing: '📄 Лизинг',
                    partner: '🤝 Партнерство',
                    career: '💼 Карьера',
                    corporate: '🏢 Корпоративные продажи',
                    offer: '📝 Получить предложение'
                };

                const text = [
                    `${typeNames[type]}`,
                    `ID: ${requestId}`,
                    `Имя: ${name}`,
                    `Телефон: ${phone}`,
                    `Email: ${email}`,
                    data && Object.keys(data).length > 0 ? `\nДополнительная информация:\n${Object.entries(data).map(([key, value]) => `  • ${key}: ${value}`).join('\n')}` : '',
                    message ? `\nСообщение: ${message}` : ''
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
            success: true,
            requestId,
            message: 'Заявка успешно отправлена'
        });

    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({
            error: 'Ошибка создания заявки',
            message: error.message
        });
    }
});

module.exports = router;

