-- 水电班仓库管理系统 - 完整数据库脚本
-- 包含正确的表结构和示例数据
-- 生成时间: 2025-10-17

-- 创建数据库
CREATE DATABASE IF NOT EXISTS warehouse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE warehouse_db;

-- 创建物资表（与项目代码完全匹配）
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建工人表（与项目代码完全匹配）
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建记录表（与项目代码完全匹配）
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认工人账号（密码已哈希）
INSERT INTO workers (worker_id, name, password, department, position, phone) VALUES
('W001', '张三', 'e10adc3949ba59abbe56e057f20f883e', '水电班', '班长', '13800138001'),
('W002', '李四', 'e10adc3949ba59abbe56e057f20f883e', '水电班', '工人', '13800138002'),
('W003', '王五', 'e10adc3949ba59abbe56e057f20f883e', '水电班', '工人', '13800138003'),
('W004', '赵六', 'e10adc3949ba59abbe56e057f20f883e', '水电班', '工人', '13800138004'),
('W005', '钱七', 'e10adc3949ba59abbe56e057f20f883e', '水电班', '工人', '13800138005'),
('ADMIN', '系统管理员', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '管理部', '系统管理员', '13800138888'),
('WH001', '仓库管理员', 'c888c9ce9e098d5864d3ded6ebcc140a12142263bace3a23a36f9905f12bd64a', '仓储部', '仓库管理', '13800138999');

-- 插入物资数据（从Excel文件导入的数据 + 扩展示例数据）
INSERT INTO materials (barcode, excel_barcode, name, specification, brand, unit, stock, purchase_price, total_price, note) VALUES
-- 从Excel导入的测试数据
('WH_20251017175132_7653', NULL, '测试电线', 'BV-2.5mm²', NULL, '卷', 50, 85.5, NULL, NULL),
('WH_20251017175132_3107', NULL, '测试管道', 'Φ20mm', NULL, '米', 100, 3.2, NULL, NULL),
('WH_20251017175132_7968', NULL, '测试开关', '86型 10A', NULL, '个', 80, 15.8, NULL, NULL),
('WH_20251017175132_7895', NULL, '测试插座', '五孔 10A', NULL, '个', 60, 18.6, NULL, NULL),
('WH_20251017175132_7448', NULL, '测试工具', '标准规格', NULL, '件', 200, 2.5, NULL, NULL),

-- 扩展的水电材料数据
-- 电线电缆类
('WH_20241017_001', 'ELEC001', '铜芯电线', 'BV-2.5mm²', '远东电缆', '卷', 50, 85.50, 4275.00, '常用规格'),
('WH_20241017_002', 'ELEC002', '铜芯电线', 'BV-4mm²', '远东电缆', '卷', 30, 132.80, 3984.00, '大功率用'),
('WH_20241017_003', 'ELEC003', '铜芯电线', 'BV-6mm²', '江南电缆', '卷', 25, 205.30, 5132.50, '主线用'),
('WH_20241017_004', 'ELEC004', '铜芯电缆', 'YJV-4×10mm²', '江南电缆', '米', 15, 48.60, 729.00, '配电用'),
('WH_20241017_005', 'ELEC005', '屏蔽电缆', 'RVVP-2×1.5mm²', '熊猫电缆', '米', 10, 12.50, 125.00, '信号传输'),

-- 管线类
('WH_20241017_006', 'PIPE001', 'PVC穿线管', 'Φ20mm', '联塑管道', '米', 200, 3.20, 640.00, '常用规格'),
('WH_20241017_007', 'PIPE002', 'PVC穿线管', 'Φ25mm', '联塑管道', '米', 150, 4.50, 675.00, '大线径用'),
('WH_20241017_008', 'PIPE003', 'PPR热水管', 'Φ20mm', '伟星管业', '米', 180, 12.80, 2304.00, '热水系统'),
('WH_20241017_009', 'PIPE004', 'PPR热水管', 'Φ25mm', '伟星管业', '米', 120, 18.50, 2220.00, '主管道'),
('WH_20241017_010', 'PIPE005', '镀锌钢管', 'DN20', '天津钢管', '米', 30, 28.60, 858.00, '工业用'),

-- 开关插座类
('WH_20241017_011', 'SWCH001', '单开单控开关', '86型 10A', '公牛电器', '个', 80, 15.80, 1264.00, '标准开关'),
('WH_20241017_012', 'SWCH002', '双开单控开关', '86型 10A', '公牛电器', '个', 60, 25.50, 1530.00, '双控开关'),
('WH_20241017_013', 'SWCH003', '五孔插座', '86型 10A', '公牛电器', '个', 120, 18.60, 2232.00, '常用插座'),
('WH_20241017_014', 'SWCH004', '空调插座', '86型 16A', '西门子', '个', 40, 28.50, 1140.00, '大功率用'),
('WH_20241017_015', 'SWCH005', '带USB五孔插座', '86型 10A', '西门子', '个', 30, 35.80, 1074.00, '智能插座'),

-- 电气保护类
('WH_20241017_016', 'PROT001', '漏电保护器', '2P 63A', '正泰电器', '个', 20, 85.60, 1712.00, '安全保护'),
('WH_20241017_017', 'PROT002', '空气开关', '1P 16A', '正泰电器', '个', 30, 18.50, 555.00, '过载保护'),
('WH_20241017_018', 'PROT003', '空气开关', '1P 20A', '德力西', '个', 30, 22.80, 684.00, '大电流保护'),
('WH_20241017_019', 'PROT004', '浪涌保护器', 'T2 40kA', '施耐德', '个', 5, 185.00, 925.00, '雷电保护'),
('WH_20241017_020', 'PROT005', '配电箱', '16位暗装', '正泰电器', '个', 8, 156.00, 1248.00, '配电控制'),

-- 水暖配件类
('WH_20241017_021', 'PLUM001', '弯头', 'PPR Φ20mm', '伟星管业', '个', 200, 2.50, 500.00, '管道连接'),
('WH_20241017_022', 'PLUM002', '弯头', 'PPR Φ25mm', '伟星管业', '个', 150, 3.80, 570.00, '大管径用'),
('WH_20241017_023', 'PLUM003', '三通', 'PPR Φ20mm', '联塑管道', '个', 100, 3.20, 320.00, '分支连接'),
('WH_20241017_024', 'PLUM004', '截止阀', 'DN20', '日丰', '个', 50, 28.50, 1425.00, '流量控制'),
('WH_20241017_025', 'PLUM005', '水龙头', '单冷 4分', '九牧', '个', 40, 18.50, 740.00, '冷水用'),
('WH_20241017_026', 'PLUM006', '水龙头', '冷热 4分', '九牧', '个', 30, 45.80, 1374.00, '冷热水用'),

-- 工具耗材类
('WH_20241017_027', 'TOOL001', '生料带', '10米/卷', '普通', '卷', 100, 1.50, 150.00, '密封材料'),
('WH_20241017_028', 'TOOL002', '电工胶带', 'PVC 10米', '3M', '卷', 80, 2.50, 200.00, '绝缘材料'),
('WH_20241017_029', 'TOOL003', '膨胀螺丝', 'M8×60mm', '普通', '个', 500, 0.60, 300.00, '固定用'),
('WH_20241017_030', 'TOOL004', '自攻螺丝', '4×25mm', '普通', '盒', 30, 8.50, 255.00, '安装用'),
('WH_20241017_031', 'TOOL005', '接线端子', '2.5mm²', '凤凰端子', '包', 20, 12.80, 256.00, '电气连接');

-- 数据导入完成，共 31 条记录
-- 默认登录账号:
-- 工人账号: W001-W005, 密码: 123456
-- 管理员: ADMIN, 密码: admin123
-- 仓库管理员: WH001, 密码: wh123456

-- 注意：如果您有包含1153条数据的Excel文件，请使用以下步骤恢复：
-- 1. 将完整的Excel文件放在项目根目录
-- 2. 运行 python generate_complete_sql.py 重新生成SQL
-- 3. 或者使用管理员PC端的批量导入功能
