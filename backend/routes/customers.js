// API маршруты для работы с клиентами
const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Получить всех клиентов
router.get('/', async (req, res) => {
    try {
        const {
            search,
            limit = 50,
            offset = 0
        } = req.query;

        let sql = `
            SELECT 
                c.id,
                c.name,
                c.phone,
                c.email,
                c.address,
                c.notes,
                c.created_at,
                c.updated_at,
                COUNT(DISTINCT tdr.id) as test_drive_count,
                COUNT(DISTINCT o.id) as orders_count
            FROM customers c
            LEFT JOIN test_drive_requests tdr ON c.id = tdr.customer_id
            LEFT JOIN orders o ON c.id = o.customer_id
            WHERE 1=1
        `;
        
        const params = [];

        // Поиск
        if (search) {
            sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' GROUP BY c.id';
        sql += ' ORDER BY c.created_at DESC';
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const customers = await database.query(sql, params);

        // Получение общего количества
        let countSql = 'SELECT COUNT(*) as total FROM customers c WHERE 1=1';
        const countParams = [];

        if (search) {
            countSql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const [countResult] = await database.query(countSql, countParams);
        const total = countResult.total;

        res.json({
            customers,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Ошибка получения клиентов:', error);
        res.status(500).json({
            error: 'Ошибка получения списка клиентов',
            message: error.message
        });
    }
});

// Получить клиента по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const sql = `
            SELECT 
                c.id,
                c.name,
                c.phone,
                c.email,
                c.address,
                c.notes,
                c.created_at,
                c.updated_at
            FROM customers c
            WHERE c.id = ?
        `;

        const customers = await database.query(sql, [id]);

        if (customers.length === 0) {
            return res.status(404).json({
                error: 'Клиент не найден'
            });
        }

        // Получение истории заявок на тест-драйв
        const testDrives = await database.query(`
            SELECT 
                tdr.id,
                tdr.preferred_date,
                tdr.preferred_time,
                tdr.status,
                tdr.notes,
                tdr.created_at,
                car.model as car_model,
                car.price as car_price
            FROM test_drive_requests tdr
            JOIN cars car ON tdr.car_id = car.id
            WHERE tdr.customer_id = ?
            ORDER BY tdr.created_at DESC
        `, [id]);

        // Получение истории заказов
        const orders = await database.query(`
            SELECT 
                o.id,
                o.order_date,
                o.delivery_date,
                o.total_amount,
                o.status,
                o.payment_status,
                o.notes,
                o.created_at,
                car.model as car_model,
                car.price as car_price
            FROM orders o
            JOIN cars car ON o.car_id = car.id
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
        `, [id]);

        // Получение истории обращений
        const contacts = await database.query(`
            SELECT 
                cr.id,
                cr.message,
                cr.status,
                cr.response,
                cr.created_at
            FROM contact_requests cr
            WHERE cr.customer_id = ?
            ORDER BY cr.created_at DESC
        `, [id]);

        res.json({
            ...customers[0],
            testDrives,
            orders,
            contacts
        });

    } catch (error) {
        console.error('Ошибка получения клиента:', error);
        res.status(500).json({
            error: 'Ошибка получения клиента',
            message: error.message
        });
    }
});

// Создать нового клиента
router.post('/', async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            address,
            notes
        } = req.body;

        // Валидация обязательных полей
        if (!name || !phone || !email) {
            return res.status(400).json({
                error: 'Имя, телефон и email являются обязательными полями'
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Некорректный формат email'
            });
        }

        // Валидация телефона
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                error: 'Некорректный формат телефона'
            });
        }

        // Проверка уникальности email и телефона
        const existingCustomer = await database.query(
            'SELECT id FROM customers WHERE email = ? OR phone = ?',
            [email, phone]
        );

        if (existingCustomer.length > 0) {
            return res.status(409).json({
                error: 'Клиент с таким email или телефоном уже существует'
            });
        }

        const sql = `
            INSERT INTO customers (name, phone, email, address, notes)
            VALUES (?, ?, ?, ?, ?)
        `;

        const params = [name, phone, email, address || null, notes || null];

        const result = await database.query(sql, params);

        res.status(201).json({
            message: 'Клиент успешно создан',
            id: result.insertId
        });

    } catch (error) {
        console.error('Ошибка создания клиента:', error);
        res.status(500).json({
            error: 'Ошибка создания клиента',
            message: error.message
        });
    }
});

// Обновить клиента
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            phone,
            email,
            address,
            notes
        } = req.body;

        // Проверка существования клиента
        const existingCustomer = await database.query(
            'SELECT id FROM customers WHERE id = ?',
            [id]
        );

        if (existingCustomer.length === 0) {
            return res.status(404).json({
                error: 'Клиент не найден'
            });
        }

        // Валидация email, если он предоставлен
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Некорректный формат email'
                });
            }
        }

        // Валидация телефона, если он предоставлен
        if (phone) {
            const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    error: 'Некорректный формат телефона'
                });
            }
        }

        // Проверка уникальности email и телефона (исключая текущего клиента)
        if (email || phone) {
            let checkSql = 'SELECT id FROM customers WHERE (email = ? OR phone = ?) AND id != ?';
            const checkParams = [email || '', phone || '', id];
            
            const duplicateCustomer = await database.query(checkSql, checkParams);
            
            if (duplicateCustomer.length > 0) {
                return res.status(409).json({
                    error: 'Клиент с таким email или телефоном уже существует'
                });
            }
        }

        const sql = `
            UPDATE customers SET
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                address = COALESCE(?, address),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const params = [name, phone, email, address, notes, id];

        await database.query(sql, params);

        res.json({
            message: 'Клиент успешно обновлен'
        });

    } catch (error) {
        console.error('Ошибка обновления клиента:', error);
        res.status(500).json({
            error: 'Ошибка обновления клиента',
            message: error.message
        });
    }
});

// Удалить клиента
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования клиента
        const existingCustomer = await database.query(
            'SELECT id FROM customers WHERE id = ?',
            [id]
        );

        if (existingCustomer.length === 0) {
            return res.status(404).json({
                error: 'Клиент не найден'
            });
        }

        // Проверка связанных записей
        const [testDriveCount] = await database.query(
            'SELECT COUNT(*) as count FROM test_drive_requests WHERE customer_id = ?',
            [id]
        );

        const [orderCount] = await database.query(
            'SELECT COUNT(*) as count FROM orders WHERE customer_id = ?',
            [id]
        );

        if (testDriveCount.count > 0 || orderCount.count > 0) {
            return res.status(409).json({
                error: 'Нельзя удалить клиента с существующими заявками или заказами'
            });
        }

        await database.query(
            'DELETE FROM customers WHERE id = ?',
            [id]
        );

        res.json({
            message: 'Клиент успешно удален'
        });

    } catch (error) {
        console.error('Ошибка удаления клиента:', error);
        res.status(500).json({
            error: 'Ошибка удаления клиента',
            message: error.message
        });
    }
});

// Получить статистику по клиентам
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await database.query(`
            SELECT 
                COUNT(*) as total_customers,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_customers_30d,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_customers_7d
            FROM customers
        `);

        const activityStats = await database.query(`
            SELECT 
                COUNT(DISTINCT c.id) as active_customers
            FROM customers c
            WHERE c.id IN (
                SELECT DISTINCT customer_id FROM test_drive_requests 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION
                SELECT DISTINCT customer_id FROM orders 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION
                SELECT DISTINCT customer_id FROM contact_requests 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            )
        `);

        const monthlyStats = await database.query(`
            SELECT 
                YEAR(created_at) as year,
                MONTH(created_at) as month,
                COUNT(*) as customers_count
            FROM customers
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY YEAR(created_at), MONTH(created_at)
            ORDER BY year DESC, month DESC
        `);

        res.json({
            overview: {
                ...stats[0],
                ...activityStats[0]
            },
            monthlyStats
        });

    } catch (error) {
        console.error('Ошибка получения статистики клиентов:', error);
        res.status(500).json({
            error: 'Ошибка получения статистики клиентов',
            message: error.message
        });
    }
});

module.exports = router;
