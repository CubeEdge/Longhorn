-- Extended Seed Data: Eagle Products, Parts Catalog, Customers
-- Based on Kinefinity EAGLE knowledge base and parts price list

-- =============================================================================
-- 1. EAGLE Products (EVF/Monitor product line)
-- =============================================================================
INSERT INTO products (product_line, model_name, serial_number, firmware_version, production_batch, production_date, notes) VALUES
-- EAGLE HDMI Series
('EVF', 'Eagle HDMI', 'EGL-2501-H001', 'kvf_2.1_0486', 'E2025-01', '2025-01-15', 'HDMI版本寻像器（带环出）'),
('EVF', 'Eagle HDMI', 'EGL-2501-H002', 'kvf_2.1_0487', 'E2025-01', '2025-01-20', 'HDMI版本寻像器（不带环出）'),
('EVF', 'Eagle HDMI', 'EGL-2503-H003', 'kvf_2.1_0490', 'E2025-03', '2025-03-10', 'HDMI版本寻像器'),
-- EAGLE SDI Series
('EVF', 'Eagle SDI', 'EGL-2501-S001', 'kvf_2.1_0486', 'E2025-01', '2025-01-18', 'SDI版本寻像器'),
('EVF', 'Eagle SDI', 'EGL-2502-S002', 'kvf_2.1_0488', 'E2025-02', '2025-02-08', 'SDI版本寻像器'),
('EVF', 'Eagle SDI', 'EGL-2503-S003', 'kvf_2.1_0490', 'E2025-03', '2025-03-15', 'SDI版本寻像器');

-- =============================================================================
-- 2. Parts Catalog - Eagle Components (based on knowledge base)
-- =============================================================================
INSERT INTO parts_catalog (part_number, part_name, part_name_en, description, category, subcategory, applicable_products, cost_price, retail_price, dealer_price, is_active, is_sellable) VALUES
-- Eagle 主要部件
('EGL-PCB-MAIN', 'Eagle主板', 'Eagle Mainboard', 'Eagle EVF核心主板，含处理器和存储', 'Board', 'Mainboard', '["Eagle HDMI","Eagle SDI"]', 1200.00, 2800.00, 2100.00, 1, 0),
('EGL-LCD-OLED', 'Eagle OLED屏幕', 'Eagle OLED Display', '0.61英寸OLED微显示器', 'Optical', 'Display', '["Eagle HDMI","Eagle SDI"]', 800.00, 1800.00, 1350.00, 1, 0),
('EGL-PCB-OCTOPUS', 'Eagle八爪鱼板', 'Eagle Octopus Board', '按键和LED指示灯控制板', 'Board', 'Control', '["Eagle HDMI","Eagle SDI"]', 150.00, 380.00, 285.00, 1, 0),
('EGL-SW-POWER', 'Eagle电源开关', 'Eagle Power Switch', '侧面电源开关组件', 'Mechanical', 'Switch', '["Eagle HDMI","Eagle SDI"]', 25.00, 80.00, 60.00, 1, 1),
('EGL-CBL-FLEX', 'Eagle内部软排线', 'Eagle Internal Flex Cable', '主板到显示屏的软排线', 'Cable', 'Internal', '["Eagle HDMI","Eagle SDI"]', 45.00, 120.00, 90.00, 1, 1),
('EGL-BODY-SHELL', 'Eagle外壳', 'Eagle Body Shell', 'CNC铝合金外壳', 'Mechanical', 'Housing', '["Eagle HDMI","Eagle SDI"]', 280.00, 650.00, 488.00, 1, 0),
('EGL-EYECUP', 'Eagle眼罩', 'Eagle Eyecup', '硅胶眼罩配件', 'Accessory', 'Eyepiece', '["Eagle HDMI","Eagle SDI"]', 15.00, 45.00, 34.00, 1, 1),
('EGL-LED-LOGO', 'Eagle Logo灯', 'Eagle Logo LED', 'Logo背光LED模组', 'Accessory', 'LED', '["Eagle HDMI","Eagle SDI"]', 8.00, 25.00, 19.00, 1, 1),
('EGL-LED-REC', 'Eagle录制指示灯', 'Eagle Rec LED', '录制状态指示灯模组', 'Accessory', 'LED', '["Eagle HDMI","Eagle SDI"]', 8.00, 25.00, 19.00, 1, 1),

-- Eagle SDI特有部件
('EGL-PCB-SDI', 'Eagle SDI模块', 'Eagle SDI Input Module', 'SDI输入接口模块（3G/1.5G SDI）', 'Board', 'Interface', '["Eagle SDI"]', 320.00, 750.00, 563.00, 1, 0),
('EGL-BNC-SDI', 'Eagle SDI接口', 'Eagle SDI BNC Connector', 'BNC母头接口', 'Mechanical', 'Connector', '["Eagle SDI"]', 18.00, 50.00, 38.00, 1, 1),

-- Eagle HDMI特有部件
('EGL-PCB-HDMI', 'Eagle HDMI模块', 'Eagle HDMI Input Module', 'HDMI输入接口模块', 'Board', 'Interface', '["Eagle HDMI"]', 280.00, 680.00, 510.00, 1, 0),
('EGL-HDMI-CONN', 'Eagle HDMI接口', 'Eagle HDMI Connector', 'Micro HDMI母头接口', 'Mechanical', 'Connector', '["Eagle HDMI"]', 12.00, 35.00, 26.00, 1, 1),
('EGL-PCB-LOOP', 'Eagle HDMI环出模块', 'Eagle HDMI Loop-out Module', 'HDMI信号环出板', 'Board', 'Interface', '["Eagle HDMI"]', 180.00, 450.00, 338.00, 1, 0),

-- 通用配件和线材
('CBL-0B5P-DC', '0B5P供电线', '0B5P DC Power Cable', '5针供电线（0.5m）', 'Cable', 'Power', '["Eagle HDMI","Eagle SDI","KineEVF"]', 35.00, 95.00, 71.00, 1, 1),
('CBL-USB-C', 'USB-C数据线', 'USB-C Cable', 'USB-C to USB-A数据线（1m）', 'Cable', 'Data', '["Eagle HDMI","Eagle SDI"]', 15.00, 45.00, 34.00, 1, 1),
('ADAPT-65W', '65W电源适配器', '65W Power Adapter', 'Kinefinity 65W USB-C+A电源适配器', 'Accessory', 'Power', '["Eagle HDMI","Eagle SDI","MAVO Edge 8K","MAVO Edge 6K"]', 120.00, 280.00, 210.00, 1, 1),

-- MAVO Edge 常用配件
('MAVO-ND-MOTOR', 'MAVO ND滤镜电机', 'MAVO ND Filter Motor', 'ND滤镜驱动电机组件', 'Mechanical', 'Motor', '["MAVO Edge 8K","MAVO Edge 6K"]', 450.00, 1100.00, 825.00, 1, 0),
('MAVO-SENSOR-8K', 'MAVO Edge 8K传感器', 'MAVO Edge 8K Sensor', 'Full Frame 8K CMOS传感器', 'Sensor', 'CMOS', '["MAVO Edge 8K"]', 8500.00, 18000.00, 13500.00, 1, 0),
('MAVO-SENSOR-6K', 'MAVO Edge 6K传感器', 'MAVO Edge 6K Sensor', 'S35 6K CMOS传感器', 'Sensor', 'CMOS', '["MAVO Edge 6K"]', 6500.00, 14000.00, 10500.00, 1, 0),
('MAVO-MAINBOARD', 'MAVO主板', 'MAVO Mainboard', 'MAVO Edge系列核心主板', 'Board', 'Mainboard', '["MAVO Edge 8K","MAVO Edge 6K"]', 3200.00, 7500.00, 5625.00, 1, 0),
('MAVO-LCD-MAIN', 'MAVO主显示屏', 'MAVO Main LCD', '机顶触摸屏模组', 'Optical', 'Display', '["MAVO Edge 8K","MAVO Edge 6K"]', 650.00, 1500.00, 1125.00, 1, 0),
('MAVO-MOUNT-EF', 'EF卡口模块', 'EF Mount Module', 'Canon EF转接卡口', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 280.00, 650.00, 488.00, 1, 1),
('MAVO-MOUNT-PL', 'PL卡口模块', 'PL Mount Module', 'PL转接卡口', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 350.00, 800.00, 600.00, 1, 1),
('MAVO-CFE-SLOT', 'CFexpress卡槽模块', 'CFexpress Slot Module', 'CFexpress Type B卡槽', 'Mechanical', 'Media', '["MAVO Edge 8K","MAVO Edge 6K"]', 180.00, 420.00, 315.00, 1, 0);

-- =============================================================================
-- 3. Customers (Sample end-user customers)
-- =============================================================================
INSERT INTO customers (customer_type, customer_name, contact_person, email, phone, country, company_name, notes) VALUES
('EndUser', 'Berlin Film Studio', 'Michael Schmidt', 'michael.schmidt@berlinfilm.de', '+49-30-1234567', 'Germany', 'Berlin Film Studio GmbH', '老客户，多次采购MAVO Edge'),
('EndUser', 'Studio Clip Productions', 'Emma Johnson', 'emma.j@studioclip.com', '+1-323-555-0101', 'USA', 'Studio Clip LLC', '独立制片人'),
('EndUser', 'CineGear UK', 'James Wilson', 'j.wilson@cinegear.uk', '+44-20-7890-1234', 'UK', 'CineGear Ltd', '设备租赁公司技术总监'),
('EndUser', '北京电影学院', 'Li Wei', 'liwei@bfa.edu.cn', '+86-10-8888-1234', 'China', '北京电影学院', '教育机构采购'),
('EndUser', 'Paris Production', 'Sophie Martin', 'sophie@parisproduction.fr', '+33-1-4567-8901', 'France', 'Paris Production SARL', 'Eagle寻像器用户'),
('EndUser', 'Freelance DP', 'Tom Lee', 'tomlee.dp@gmail.com', '+1-415-555-0202', 'USA', NULL, '独立摄影师，直接客户'),
('EndUser', 'Tokyo Film Labs', 'Yuki Tanaka', 'yuki@tokyofilmlabs.jp', '+81-3-5555-1234', 'Japan', 'Tokyo Film Labs Inc', '日本市场客户'),
('EndUser', 'Munich Rental House', 'Hans Mueller', 'hans@munich-rental.de', '+49-89-555-6789', 'Germany', 'Munich Rental GmbH', '德国设备租赁');
