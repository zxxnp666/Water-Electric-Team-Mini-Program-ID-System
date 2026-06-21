#!/usr/bin/env python3
# -*- coding: utf-8 -*-

CREATE_MATERIALS_TABLE = """
CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    excel_barcode VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    specification VARCHAR(500),
    brand VARCHAR(100),
    unit VARCHAR(50) DEFAULT '个',
    stock INT DEFAULT 0,
    purchase_price DECIMAL(10,2) DEFAULT 0.00,
    total_price DECIMAL(12,2),
    note TEXT,
    strategic_contract DECIMAL(10,2),
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_barcode (barcode),
    INDEX idx_name (name),
    INDEX idx_stock (stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

CREATE_WORKERS_TABLE = """
CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    department VARCHAR(100) DEFAULT '水电班',
    position VARCHAR(100) DEFAULT '工人',
    phone VARCHAR(20),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    INDEX idx_worker_id (worker_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

CREATE_RECORDS_TABLE = """
CREATE TABLE IF NOT EXISTS records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    barcode VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    user VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT '出库',
    time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT '处理中',
    INDEX idx_barcode (barcode),
    INDEX idx_user (user),
    INDEX idx_time (time),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

INSERT_DEFAULT_WORKER = """
INSERT IGNORE INTO workers (worker_id, password, name, department, position, phone)
VALUES (%s, %s, %s, %s, %s, %s)
"""

SELECT_MATERIAL_BY_BARCODE = """
SELECT barcode, name, specification, brand, unit, stock, purchase_price
FROM materials 
WHERE barcode = %s
"""

SELECT_ALL_MATERIALS = """
SELECT barcode, name, specification, brand, unit, stock, purchase_price
FROM materials 
ORDER BY name
"""

SELECT_MATERIALS_WITH_STOCK = """
SELECT barcode, name, specification, brand, unit, stock, purchase_price
FROM materials 
WHERE stock > 0
ORDER BY name
"""

UPDATE_MATERIAL_STOCK = """
UPDATE materials 
SET stock = stock - %s, last_update = NOW()
WHERE barcode = %s AND stock >= %s
"""

UPDATE_MATERIAL_STOCK_INCREASE = """
UPDATE materials 
SET stock = stock + %s, last_update = NOW()
WHERE barcode = %s
"""

INSERT_RECORD = """
INSERT INTO records (barcode, quantity, user, type, time, status)
VALUES (%s, %s, %s, %s, NOW(), %s)
"""

SELECT_RECORDS_BY_USER = """
SELECT r.id, r.barcode, r.quantity, r.user, r.type, r.time, r.status,
       m.name, m.specification, m.unit
FROM records r
LEFT JOIN materials m ON r.barcode = m.barcode
WHERE r.user = %s
ORDER BY r.time DESC
LIMIT %s OFFSET %s
"""

SELECT_ALL_RECORDS = """
SELECT r.id, r.barcode, r.quantity, r.user, r.type, r.time, r.status,
       m.name, m.specification, m.unit
FROM records r
LEFT JOIN materials m ON r.barcode = m.barcode
ORDER BY r.time DESC
LIMIT %s OFFSET %s
"""

SELECT_RECORDS_COUNT = """
SELECT COUNT(*) as total FROM records
"""

SELECT_RECORDS_COUNT_BY_USER = """
SELECT COUNT(*) as total FROM records WHERE user = %s
"""

SELECT_WORKER_BY_ID = """
SELECT worker_id, name, password, department, position, phone, status
FROM workers 
WHERE worker_id = %s
"""

SELECT_ALL_WORKERS = """
SELECT worker_id, name, department, position, phone, status, created_at, last_login
FROM workers 
ORDER BY worker_id
"""

VERIFY_WORKER_LOGIN = """
SELECT worker_id, name, password, department, position, phone, status
FROM workers 
WHERE worker_id = %s AND status = 'active'
"""

UPDATE_WORKER_LAST_LOGIN = """
UPDATE workers 
SET last_login = NOW()
WHERE worker_id = %s
"""

UPDATE_WORKER_LOGIN_TIME = """
UPDATE workers 
SET last_login = NOW()
WHERE worker_id = %s
"""

SEARCH_MATERIALS = """
SELECT barcode, name, specification, brand, unit, stock, purchase_price
FROM materials 
WHERE name LIKE %s OR barcode LIKE %s OR specification LIKE %s
ORDER BY name
LIMIT %s OFFSET %s
"""

SEARCH_MATERIALS_COUNT = """
SELECT COUNT(*) as total
FROM materials 
WHERE name LIKE %s OR barcode LIKE %s OR specification LIKE %s
"""

GET_MATERIAL_STATS = """
SELECT 
    COUNT(*) as total_materials,
    SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as materials_in_stock,
    SUM(stock) as total_stock,
    COUNT(DISTINCT unit) as unit_types
FROM materials
"""

GET_RECORD_STATS = """
SELECT 
    COUNT(*) as total_records,
    SUM(CASE WHEN type = '出库' THEN 1 ELSE 0 END) as checkout_records,
    SUM(CASE WHEN type = '入库' THEN 1 ELSE 0 END) as checkin_records,
    COUNT(DISTINCT user) as active_users
FROM records
WHERE DATE(time) = CURDATE()
"""

INSERT_MATERIAL = """
INSERT INTO materials (barcode, excel_barcode, name, specification, brand, unit, stock, purchase_price, total_price, note)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

UPDATE_MATERIAL = """
UPDATE materials 
SET name = %s, specification = %s, brand = %s, unit = %s, stock = %s, 
    purchase_price = %s, total_price = %s, note = %s, last_update = NOW()
WHERE barcode = %s
"""

DELETE_MATERIAL = """
DELETE FROM materials WHERE barcode = %s
"""

HEALTH_CHECK_QUERY = """
SELECT 1 as status, NOW() as server_time, VERSION() as mysql_version
"""

GET_MATERIALS_LIST = SELECT_ALL_MATERIALS
GET_MATERIAL_BY_BARCODE = SELECT_MATERIAL_BY_BARCODE
GET_RECORDS_BY_USER = SELECT_RECORDS_BY_USER
