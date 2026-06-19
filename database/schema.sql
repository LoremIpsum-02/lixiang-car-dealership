
CREATE TABLE IF NOT EXISTS cars (
    id SERIAL PRIMARY KEY,
    model VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    engine VARCHAR(100) NOT NULL,
    transmission VARCHAR(50) NOT NULL,
    drive_type VARCHAR(50) NOT NULL,
    exterior_color VARCHAR(50) NOT NULL,
    interior_color VARCHAR(50) NOT NULL,
    wheel_size INT NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    stock_quantity INT DEFAULT 1,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cars_model ON cars(model);
CREATE INDEX IF NOT EXISTS idx_cars_price ON cars(price);
CREATE INDEX IF NOT EXISTS idx_cars_year ON cars(year);
CREATE INDEX IF NOT EXISTS idx_cars_color ON cars(exterior_color);
CREATE INDEX IF NOT EXISTS idx_cars_available ON cars(is_available);

-- Таблица клиентов
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT unique_phone UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Таблица заявок на тест-драйв
CREATE TABLE IF NOT EXISTS test_drive_requests (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    car_id INT,
    preferred_date DATE NOT NULL,
    preferred_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Гарантируем, что car_id допускает NULL и при удалении автомобиля поле зануляется
ALTER TABLE test_drive_requests
ALTER COLUMN car_id DROP NOT NULL;

ALTER TABLE test_drive_requests
DROP CONSTRAINT IF EXISTS test_drive_requests_car_id_fkey;

ALTER TABLE test_drive_requests
ADD CONSTRAINT test_drive_requests_car_id_fkey
FOREIGN KEY (car_id)
REFERENCES cars(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tdr_customer ON test_drive_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_tdr_car ON test_drive_requests(car_id);
CREATE INDEX IF NOT EXISTS idx_tdr_date ON test_drive_requests(preferred_date);
CREATE INDEX IF NOT EXISTS idx_tdr_status ON test_drive_requests(status);

-- Таблица обращений клиентов
CREATE TABLE IF NOT EXISTS contact_requests (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved')),
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cr_customer ON contact_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_cr_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_cr_created ON contact_requests(created_at);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    car_id INT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    order_date DATE NOT NULL,
    delivery_date DATE,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_production','ready','delivered','cancelled')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_car ON orders(car_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Таблица пользователей (для админ-панели)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'sales' CHECK (role IN ('admin','manager','sales')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Таблица логов действий
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_table ON activity_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);

-- Views
CREATE OR REPLACE VIEW car_catalog AS
SELECT 
    c.id,
    c.model,
    c.year,
    c.engine,
    c.transmission,
    c.drive_type,
    c.exterior_color,
    c.interior_color,
    c.wheel_size,
    c.price,
    c.description,
    c.image,
    c.stock_quantity,
    c.is_available,
    CASE WHEN c.stock_quantity > 0 THEN 'В наличии' ELSE 'Под заказ' END AS availability_status
FROM cars c
WHERE c.is_available = TRUE;

CREATE OR REPLACE VIEW test_drive_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_requests,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests
FROM test_drive_requests
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    COUNT(tdr.id) as test_drive_count,
    COUNT(o.id) as orders_count,
    MAX(tdr.created_at) as last_test_drive,
    MAX(o.created_at) as last_order
FROM customers c
LEFT JOIN test_drive_requests tdr ON c.id = tdr.customer_id
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.phone, c.email;
