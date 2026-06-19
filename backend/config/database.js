// Конфигурация базы данных для LiXiang Auto Salon (PostgreSQL)
const { Pool } = require('pg');
require('dotenv').config();

function transformPlaceholders(sql) {
    // Заменяет каждый '?' на последовательные $1, $2, ...
    let index = 0;
    return sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
}

class Database {
    constructor() {
        this.pool = null;
        this.init();
    }

    init() {
        try {
            this.pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'lixiang_salon',
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 60000
            });

            this.pool.on('error', (err) => {
                console.error('❌ Ошибка пула PostgreSQL:', err.message);
            });

            console.log('✅ Пул соединений PostgreSQL создан');
        } catch (error) {
            console.error('❌ Ошибка создания пула соединений:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const pgSql = transformPlaceholders(sql);
            const result = await client.query(pgSql, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Ошибка выполнения запроса:', error.message);
            console.error('SQL:', sql);
            console.error('Параметры:', params);
            throw error;
        } finally {
            client.release();
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Ошибка транзакции:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ Пул соединений закрыт');
        }
    }

    async testConnection() {
        try {
            const result = await this.query('SELECT 1 as test');
            return result[0] && result[0].test === 1;
        } catch (error) {
            console.error('❌ Ошибка проверки соединения:', error.message);
            return false;
        }
    }
}

const database = new Database();

module.exports = database;
