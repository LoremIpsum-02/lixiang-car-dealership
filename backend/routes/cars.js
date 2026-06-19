// API маршруты для работы с автомобилями
const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Получить все автомобили с фильтрацией и сортировкой
router.get('/', async (req, res) => {
    try {
        const {
            model,
            minPrice,
            maxPrice,
            year,
            color,
            sortBy = 'price_asc',
            limit = 50,
            offset = 0
        } = req.query;

        let sql = `
            SELECT 
                id, model, year, engine, transmission, drive_type,
                exterior_color, interior_color, wheel_size, price,
                description, image, stock_quantity, is_available,
                created_at, updated_at
            FROM cars 
            WHERE is_available = true
        `;
        
        const params = [];

        // Фильтры
        if (model) {
            sql += ' AND model ILIKE ?';
            params.push(`%${model}%`);
        }

        if (minPrice) {
            sql += ' AND price >= ?';
            params.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            sql += ' AND price <= ?';
            params.push(parseFloat(maxPrice));
        }

        if (year) {
            sql += ' AND year = ?';
            params.push(parseInt(year));
        }

        if (color) {
            sql += ' AND exterior_color = ?';
            params.push(color);
        }

        // Сортировка
        switch (sortBy) {
            case 'price_asc':
                sql += ' ORDER BY price ASC';
                break;
            case 'price_desc':
                sql += ' ORDER BY price DESC';
                break;
            case 'model':
                sql += ' ORDER BY model ASC';
                break;
            case 'year':
                sql += ' ORDER BY year DESC';
                break;
            default:
                sql += ' ORDER BY price ASC';
        }

        // Пагинация
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const cars = await database.query(sql, params);

        // Получение общего количества для пагинации
        let countSql = 'SELECT COUNT(*)::int as total FROM cars WHERE is_available = true';
        const countParams = [];

        if (model) {
            countSql += ' AND model ILIKE ?';
            countParams.push(`%${model}%`);
        }

        if (minPrice) {
            countSql += ' AND price >= ?';
            countParams.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            countSql += ' AND price <= ?';
            countParams.push(parseFloat(maxPrice));
        }

        if (year) {
            countSql += ' AND year = ?';
            countParams.push(parseInt(year));
        }

        if (color) {
            countSql += ' AND exterior_color = ?';
            countParams.push(color);
        }

        const countResult = await database.query(countSql, countParams);
        const total = countResult[0]?.total || 0;

        res.json({
            cars,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Ошибка получения автомобилей:', error);
        res.status(500).json({
            error: 'Ошибка получения списка автомобилей',
            message: error.message
        });
    }
});

// Получить автомобиль по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const sql = `
            SELECT 
                id, model, year, engine, transmission, drive_type,
                exterior_color, interior_color, wheel_size, price,
                description, image, stock_quantity, is_available,
                created_at, updated_at
            FROM cars 
            WHERE id = ? AND is_available = true
        `;

        const cars = await database.query(sql, [id]);

        if (cars.length === 0) {
            return res.status(404).json({
                error: 'Автомобиль не найден'
            });
        }

        res.json(cars[0]);

    } catch (error) {
        console.error('Ошибка получения автомобиля:', error);
        res.status(500).json({
            error: 'Ошибка получения автомобиля',
            message: error.message
        });
    }
});

// Создать новый автомобиль (только для админов)
router.post('/', async (req, res) => {
    try {
        const {
            model,
            year,
            engine,
            transmission,
            drive_type,
            exterior_color,
            interior_color,
            wheel_size,
            price,
            description,
            image,
            stock_quantity = 1
        } = req.body;

        if (!model || !year || !engine || !transmission || !drive_type || 
            !exterior_color || !interior_color || !wheel_size || !price) {
            return res.status(400).json({
                error: 'Не все обязательные поля заполнены'
            });
        }

        const sql = `
            INSERT INTO cars (
                model, year, engine, transmission, drive_type,
                exterior_color, interior_color, wheel_size, price,
                description, image, stock_quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const params = [
            model, year, engine, transmission, drive_type,
            exterior_color, interior_color, wheel_size, price,
            description || null, image || null, stock_quantity
        ];

        const result = await database.query(sql, params);

        res.status(201).json({
            message: 'Автомобиль успешно добавлен',
            id: result[0].id
        });

    } catch (error) {
        console.error('Ошибка создания автомобиля:', error);
        res.status(500).json({
            error: 'Ошибка создания автомобиля',
            message: error.message
        });
    }
});

// Обновить автомобиль (только для админов)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            model,
            year,
            engine,
            transmission,
            drive_type,
            exterior_color,
            interior_color,
            wheel_size,
            price,
            description,
            image,
            stock_quantity,
            is_available
        } = req.body;

        // Проверка существования автомобиля
        const existingCar = await database.query(
            'SELECT id FROM cars WHERE id = ?',
            [id]
        );

        if (existingCar.length === 0) {
            return res.status(404).json({
                error: 'Автомобиль не найден'
            });
        }

        const sql = `
            UPDATE cars SET
                model = COALESCE(?, model),
                year = COALESCE(?, year),
                engine = COALESCE(?, engine),
                transmission = COALESCE(?, transmission),
                drive_type = COALESCE(?, drive_type),
                exterior_color = COALESCE(?, exterior_color),
                interior_color = COALESCE(?, interior_color),
                wheel_size = COALESCE(?, wheel_size),
                price = COALESCE(?, price),
                description = COALESCE(?, description),
                image = COALESCE(?, image),
                stock_quantity = COALESCE(?, stock_quantity),
                is_available = COALESCE(?, is_available),
                updated_at = NOW()
            WHERE id = ?
        `;

        const params = [
            model, year, engine, transmission, drive_type,
            exterior_color, interior_color, wheel_size, price,
            description, image, stock_quantity, is_available, id
        ];

        await database.query(sql, params);

        res.json({
            message: 'Автомобиль успешно обновлен'
        });

    } catch (error) {
        console.error('Ошибка обновления автомобиля:', error);
        res.status(500).json({
            error: 'Ошибка обновления автомобиля',
            message: error.message
        });
    }
});

// Удалить автомобиль (только для админов)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования автомобиля
        const existingCar = await database.query(
            'SELECT id FROM cars WHERE id = ?',
            [id]
        );

        if (existingCar.length === 0) {
            return res.status(404).json({
                error: 'Автомобиль не найден'
            });
        }

        // Мягкое удаление - помечаем как недоступный
        await database.query(
            'UPDATE cars SET is_available = false, updated_at = NOW() WHERE id = ?',
            [id]
        );

        res.json({
            message: 'Автомобиль успешно удален'
        });

    } catch (error) {
        console.error('Ошибка удаления автомобиля:', error);
        res.status(500).json({
            error: 'Ошибка удаления автомобиля',
            message: error.message
        });
    }
});

// Получить статистику по автомобилям
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await database.query(`
            SELECT 
                COUNT(*)::int as total_cars,
                COUNT(CASE WHEN is_available = true THEN 1 END)::int as available_cars,
                COUNT(CASE WHEN stock_quantity > 0 THEN 1 END)::int as in_stock,
                AVG(price)::numeric as average_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM cars
        `);

        const models = await database.query(`
            SELECT 
                model,
                COUNT(*)::int as count,
                AVG(price)::numeric as avg_price
            FROM cars 
            WHERE is_available = true
            GROUP BY model
            ORDER BY count DESC
        `);

        const colors = await database.query(`
            SELECT 
                exterior_color,
                COUNT(*)::int as count
            FROM cars 
            WHERE is_available = true
            GROUP BY exterior_color
            ORDER BY count DESC
        `);

        res.json({
            overview: stats[0],
            models,
            colors
        });

    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({
            error: 'Ошибка получения статистики',
            message: error.message
        });
    }
});

module.exports = router;
