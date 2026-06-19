// Скрипт для настройки базы данных LiXiang Auto Salon (PostgreSQL)
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class DatabaseSetup {
    constructor() {
        this.client = null;
    }

    async connectToServerDb() {
        // Подключаемся к системной БД postgres, чтобы создать целевую БД
        const cfg = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: 'postgres'
        };
        this.client = new Client(cfg);
        await this.client.connect();
        console.log('✅ Подключение к PostgreSQL (postgres) установлено');
    }

    async ensureDatabase() {
        const dbName = process.env.DB_NAME || 'lixiang_salon';
        const check = await this.client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (check.rowCount === 0) {
            await this.client.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ База данных '${dbName}' создана`);
        } else {
            console.log(`ℹ️  База данных '${dbName}' уже существует`);
        }
    }

    async connectToTargetDb() {
        const cfg = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'lixiang_salon'
        };
        if (this.client) await this.client.end();
        this.client = new Client(cfg);
        await this.client.connect();
        console.log(`✅ Подключение к БД '${cfg.database}' установлено`);
    }

    async executeSqlFile(filePath) {
        const sqlRaw = fs.readFileSync(filePath, 'utf8');
        // Простое разделение по ';' (без функций) — подходит для нашей схемы
        const statements = sqlRaw
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const st of statements) {
            await this.client.query(st);
        }
    }

    async executeSchema() {
        await this.executeSqlFile(path.join(__dirname, 'schema.sql'));
        console.log('✅ Схема БД применена');
    }

    async insertSampleData() {
        await this.executeSqlFile(path.join(__dirname, 'sample_data.sql'));
        console.log('✅ Тестовые данные добавлены');
    }

    async verify() {
        const tables = await this.client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
        console.log('\n📋 Таблицы:');
        tables.rows.forEach(r => console.log('  -', r.table_name));
    }

    async close() {
        if (this.client) await this.client.end();
    }

    async setup() {
        try {
            console.log('🚀 Начало настройки PostgreSQL...');
            await this.connectToServerDb();
            await this.ensureDatabase();
            await this.connectToTargetDb();
            await this.executeSchema();
            await this.insertSampleData();
            await this.verify();
            console.log('\n🎉 Настройка завершена!');
        } catch (e) {
            console.error('💥 Ошибка настройки:', e.message);
            process.exit(1);
        } finally {
            await this.close();
        }
    }
}

if (require.main === module) {
    const setup = new DatabaseSetup();
    setup.setup();
}

module.exports = DatabaseSetup;
