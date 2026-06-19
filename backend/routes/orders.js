// API маршруты для работы с заказами
const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Получить все заказы
router.get('/', async (req, res) => {
    try {
        const {
            status,
            paymentStatus,
            customerId,
            limit = 50,
            offset = 0
        } = req.query;

        let sql = `
            SELECT 
                o.id,
                o.order_date,
                o.delivery_date,
                o.total_amount,
                o.status,
                o.payment_status,
                o.notes,
                o.created_at,
                o.updated_at,
                c.id as customer_id,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                car.id as car_id,
                car.model as car_model,
                car.year as car_year,
                car.price as car_price
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN cars car ON o.car_id = car.id
            WHERE 1=1
        `;
        
        const params = [];

        // Фильтры
        if (status) {
            sql += ' AND o.status = ?';
            params.push(status);
        }

        if (paymentStatus) {
            sql += ' AND o.payment_status = ?';
            params.push(paymentStatus);
        }

        if (customerId) {
            sql += ' AND o.customer_id = ?';
            params.push(customerId);
        }

        sql += ' ORDER BY o.created_at DESC';
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const orders = await database.query(sql, params);

        // Получение общего количества
        let countSql = 'SELECT COUNT(*) as total FROM orders o WHERE 1=1';
        const countParams = [];

        if (status) {
            countSql += ' AND o.status = ?';
            countParams.push(status);
        }

        if (paymentStatus) {
            countSql += ' AND o.payment_status = ?';
            countParams.push(paymentStatus);
        }

        if (customerId) {
            countSql += ' AND o.customer_id = ?';
            countParams.push(customerId);
        }

        const [countResult] = await database.query(countSql, countParams);
        const total = countResult.total;

        res.json({
            orders,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        res.status(500).json({
            error: 'Ошибка получения списка заказов',
            message: error.message
        });
    }
});

// Получить заказ по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const sql = `
            SELECT 
                o.id,
                o.order_date,
                o.delivery_date,
                o.total_amount,
                o.status,
                o.payment_status,
                o.notes,
                o.created_at,
                o.updated_at,
                c.id as customer_id,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                c.address as customer_address,
                car.id as car_id,
                car.model as car_model,
                car.year as car_year,
                car.engine as car_engine,
                car.transmission as car_transmission,
                car.drive_type as car_drive_type,
                car.exterior_color as car_exterior_color,
                car.interior_color as car_interior_color,
                car.wheel_size as car_wheel_size,
                car.price as car_price,
                car.image as car_image
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN cars car ON o.car_id = car.id
            WHERE o.id = ?
        `;

        const orders = await database.query(sql, [id]);

        if (orders.length === 0) {
            return res.status(404).json({
                error: 'Заказ не найден'
            });
        }

        res.json(orders[0]);

    } catch (error) {
        console.error('Ошибка получения заказа:', error);
        res.status(500).json({
            error: 'Ошибка получения заказа',
            message: error.message
        });
    }
});

// Создать новый заказ
router.post('/', async (req, res) => {
    try {
        const {
            customerId,
            carId,
            orderDate,
            deliveryDate,
            totalAmount,
            notes
        } = req.body;

        // Валидация обязательных полей
        if (!customerId || !carId || !orderDate || !totalAmount) {
            return res.status(400).json({
                error: 'Не все обязательные поля заполнены'
            });
        }

        // Проверка существования клиента
        const customer = await database.query(
            'SELECT id, name FROM customers WHERE id = ?',
            [customerId]
        );

        if (customer.length === 0) {
            return res.status(404).json({
                error: 'Клиент не найден'
            });
        }

        // Проверка существования автомобиля
        const car = await database.query(
            'SELECT id, model, price FROM cars WHERE id = ? AND is_available = 1',
            [carId]
        );

        if (car.length === 0) {
            return res.status(404).json({
                error: 'Автомобиль не найден или недоступен'
            });
        }

        // Проверка наличия автомобиля на складе
        const [stockInfo] = await database.query(
            'SELECT stock_quantity FROM cars WHERE id = ?',
            [carId]
        );

        if (stockInfo.stock_quantity <= 0) {
            return res.status(400).json({
                error: 'Автомобиль отсутствует на складе'
            });
        }

        const sql = `
            INSERT INTO orders (
                customer_id, car_id, order_date, delivery_date, 
                total_amount, notes
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
            customerId, carId, orderDate, deliveryDate || null, 
            parseFloat(totalAmount), notes || null
        ];

        const result = await database.query(sql, params);

        // Уменьшение количества на складе
        await database.query(
            'UPDATE cars SET stock_quantity = stock_quantity - 1 WHERE id = ?',
            [carId]
        );

        res.status(201).json({
            message: 'Заказ успешно создан',
            id: result.insertId,
            customerName: customer[0].name,
            carModel: car[0].model
        });

    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({
            error: 'Ошибка создания заказа',
            message: error.message
        });
    }
});

// Обновить статус заказа
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        // Валидация статуса
        const validStatuses = ['pending', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Недопустимый статус заказа'
            });
        }

        // Проверка существования заказа
        const existingOrder = await database.query(
            'SELECT id, status, car_id FROM orders WHERE id = ?',
            [id]
        );

        if (existingOrder.length === 0) {
            return res.status(404).json({
                error: 'Заказ не найден'
            });
        }

        const sql = `
            UPDATE orders SET
                status = ?,
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await database.query(sql, [status, notes, id]);

        // Если заказ отменен, возвращаем автомобиль на склад
        if (status === 'cancelled' && existingOrder[0].status !== 'cancelled') {
            await database.query(
                'UPDATE cars SET stock_quantity = stock_quantity + 1 WHERE id = ?',
                [existingOrder[0].car_id]
            );
        }

        res.json({
            message: 'Статус заказа успешно обновлен'
        });

    } catch (error) {
        console.error('Ошибка обновления статуса заказа:', error);
        res.status(500).json({
            error: 'Ошибка обновления статуса заказа',
            message: error.message
        });
    }
});

// Обновить статус оплаты
router.put('/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus, notes } = req.body;

        // Валидация статуса оплаты
        const validPaymentStatuses = ['pending', 'partial', 'paid'];
        if (!validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                error: 'Недопустимый статус оплаты'
            });
        }

        // Проверка существования заказа
        const existingOrder = await database.query(
            'SELECT id FROM orders WHERE id = ?',
            [id]
        );

        if (existingOrder.length === 0) {
            return res.status(404).json({
                error: 'Заказ не найден'
            });
        }

        const sql = `
            UPDATE orders SET
                payment_status = ?,
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await database.query(sql, [paymentStatus, notes, id]);

        res.json({
            message: 'Статус оплаты успешно обновлен'
        });

    } catch (error) {
        console.error('Ошибка обновления статуса оплаты:', error);
        res.status(500).json({
            error: 'Ошибка обновления статуса оплаты',
            message: error.message
        });
    }
});

// Обновить дату доставки
router.put('/:id/delivery', async (req, res) => {
    try {
        const { id } = req.params;
        const { deliveryDate } = req.body;

        if (!deliveryDate) {
            return res.status(400).json({
                error: 'Дата доставки обязательна'
            });
        }

        // Проверка существования заказа
        const existingOrder = await database.query(
            'SELECT id FROM orders WHERE id = ?',
            [id]
        );

        if (existingOrder.length === 0) {
            return res.status(404).json({
                error: 'Заказ не найден'
            });
        }

        const sql = `
            UPDATE orders SET
                delivery_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await database.query(sql, [deliveryDate, id]);

        res.json({
            message: 'Дата доставки успешно обновлена'
        });

    } catch (error) {
        console.error('Ошибка обновления даты доставки:', error);
        res.status(500).json({
            error: 'Ошибка обновления даты доставки',
            message: error.message
        });
    }
});

// Удалить заказ
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования заказа
        const existingOrder = await database.query(
            'SELECT id, status, car_id FROM orders WHERE id = ?',
            [id]
        );

        if (existingOrder.length === 0) {
            return res.status(404).json({
                error: 'Заказ не найден'
            });
        }

        // Проверка статуса заказа
        if (existingOrder[0].status === 'delivered') {
            return res.status(400).json({
                error: 'Нельзя удалить доставленный заказ'
            });
        }

        await database.query(
            'DELETE FROM orders WHERE id = ?',
            [id]
        );

        // Возвращаем автомобиль на склад, если заказ не был доставлен
        if (existingOrder[0].status !== 'delivered') {
            await database.query(
                'UPDATE cars SET stock_quantity = stock_quantity + 1 WHERE id = ?',
                [existingOrder[0].car_id]
            );
        }

        res.json({
            message: 'Заказ успешно удален'
        });

    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        res.status(500).json({
            error: 'Ошибка удаления заказа',
            message: error.message
        });
    }
});

// Получить статистику по заказам
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await database.query(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
                COUNT(CASE WHEN status = 'in_production' THEN 1 END) as in_production_orders,
                COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_orders,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
                SUM(total_amount) as total_revenue,
                AVG(total_amount) as average_order_value
            FROM orders
        `);

        const paymentStats = await database.query(`
            SELECT 
                COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
                COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial_payments,
                COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders
            FROM orders
        `);

        const monthlyStats = await database.query(`
            SELECT 
                YEAR(order_date) as year,
                MONTH(order_date) as month,
                COUNT(*) as orders_count,
                SUM(total_amount) as monthly_revenue
            FROM orders
            WHERE order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY YEAR(order_date), MONTH(order_date)
            ORDER BY year DESC, month DESC
        `);

        const carStats = await database.query(`
            SELECT 
                car.model,
                COUNT(o.id) as orders_count,
                SUM(o.total_amount) as revenue
            FROM orders o
            JOIN cars car ON o.car_id = car.id
            GROUP BY car.model
            ORDER BY orders_count DESC
        `);

        res.json({
            overview: {
                ...stats[0],
                ...paymentStats[0]
            },
            monthlyStats,
            carStats
        });

    } catch (error) {
        console.error('Ошибка получения статистики заказов:', error);
        res.status(500).json({
            error: 'Ошибка получения статистики заказов',
            message: error.message
        });
    }
});

module.exports = router;
