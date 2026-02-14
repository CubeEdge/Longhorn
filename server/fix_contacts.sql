-- 删除所有联系人
DELETE FROM contacts;

-- 为经销商创建正确的联系人
INSERT INTO contacts (account_id, name, email, phone, job_title, status, is_primary, created_at) VALUES
-- ProAV UK (id=1)
(1, 'Mike Johnson', 'mike.johnson@proav.co.uk', '+44 1908 366 601', 'Sales Manager', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(1, 'Sarah Williams', 'sarah.williams@proav.co.uk', '+44 1908 366 602', 'Technical Support', 'ACTIVE', 0, CURRENT_TIMESTAMP),
(1, 'David Brown', 'david.brown@proav.co.uk', '+44 1908 366 603', 'Account Manager', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- Gafpa Gear (id=2)
(2, 'Hans Mueller', 'hans.mueller@gafpa.de', '+49 30 1234 5678', 'Geschäftsführer', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(2, 'Anna Schmidt', 'anna.schmidt@gafpa.de', '+49 30 1234 5679', 'Verkaufsleiterin', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- 1SourceVideo (id=3)
(3, 'John Smith', 'john.smith@1sourcevideo.com', '+1 323 555 0101', 'CEO', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(3, 'Emily Davis', 'emily.davis@1sourcevideo.com', '+1 323 555 0102', 'Sales Director', 'ACTIVE', 0, CURRENT_TIMESTAMP),
(3, 'Michael Chen', 'michael.chen@1sourcevideo.com', '+1 323 555 0103', 'Technical Lead', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- DP Gadget (id=5)
(5, 'Tan Wei Ming', 'tanwm@dpgadget.sg', '+65 6123 4567', 'Managing Director', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(5, 'Lim Siew Hua', 'limsh@dpgadget.sg', '+65 6123 4568', 'Sales Manager', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- Cinetx (id=6)
(6, 'Robert Taylor', 'robert.taylor@cinetx.ca', '+1 416 555 0120', 'General Manager', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- RMK Australia (id=7)
(7, 'James Wilson', 'james.wilson@rmk.com.au', '+61 2 9252 9999', 'Director', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- EU Office (id=8)
(8, 'Pierre Dubois', 'pierre.dubois@euoffice.fr', '+33 1 42 60 35 00', 'Directeur', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(8, 'Marie Laurent', 'marie.laurent@euoffice.fr', '+33 1 42 60 35 01', 'Responsable Commercial', 'ACTIVE', 0, CURRENT_TIMESTAMP);

-- 为机构客户创建正确的联系人
INSERT INTO contacts (account_id, name, email, phone, job_title, status, is_primary, created_at) VALUES
-- CVP UK (id=4)
(4, 'Tom Wilson', 'tom.wilson@cvp.com', '+44 20 8282 1112', 'Procurement Manager', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(4, 'Lisa Anderson', 'lisa.anderson@cvp.com', '+44 20 8282 1113', 'Technical Director', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- Netflix Studios (id=9)
(9, 'Christopher Nolan', 'cnolan@netflix.com', '+1 310 734 8889', 'Director', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(9, 'Emma Thomas', 'ethomas@netflix.com', '+1 310 734 8890', 'Producer', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- ARRI Rental (id=10)
(10, 'Markus Zeiler', 'mzeiler@arri.de', '+49 89 3809 100', 'CEO', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(10, 'Klaus Riemer', 'kriemer@arri.de', '+49 89 3809 101', 'Sales Manager', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- Panavision London (id=11)
(11, 'Richard Thompson', 'rthompson@panavision.com', '+44 20 7434 9512', 'General Manager', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(11, 'Helen Parker', 'hparker@panavision.com', '+44 20 7434 9513', 'Operations Director', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- 北京光线传媒 (id=12)
(12, '张艺谋', 'zhang@enlightmedia.com', '+86 10 8418 8889', '艺术总监', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(12, '陈凯歌', 'chen@enlightmedia.com', '+86 10 8418 8890', '制作总监', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- 上海东方传媒 (id=13)
(13, '王小明', 'wangxm@smg.cn', '+86 21 6256 8889', '技术总监', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(13, '李小红', 'lixh@smg.cn', '+86 21 6256 8890', '采购经理', 'ACTIVE', 0, CURRENT_TIMESTAMP),

-- Wanda Pictures (id=14)
(14, '王健林', 'wangjl@wandapictures.com', '+86 10 8585 8889', '董事长', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- Sony Pictures (id=15)
(15, 'Tony Vinciquerra', 'tvinciquerra@sonypictures.com', '+1 310 244 4000', 'CEO', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- BBC Studios (id=16)
(16, 'John Smith', 'john.smith@bbc.co.uk', '+44 20 8743 8000', 'Technical Manager', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- NHK Japan (id=17)
(17, '山田太郎', 'yamada@nhk.or.jp', '+81 3 3465 1111', '技術部長', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- Village Roadshow (id=18)
(18, 'Bruce Berman', 'bruce@villageroadshow.com.au', '+61 3 9421 8889', 'CEO', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- Telefilm Canada (id=19)
(19, 'Jean-Pierre Blais', 'jeanpierre@telefilm.ca', '+1 514 283 6364', 'Director', 'PRIMARY', 1, CURRENT_TIMESTAMP),

-- CCTV (id=20)
(20, '李明', 'liming@cctv.com', '+86 10 6850 8889', '技术中心主任', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(20, '王芳', 'wangfang@cctv.com', '+86 10 6850 8890', '采购部主任', 'ACTIVE', 0, CURRENT_TIMESTAMP);

-- 为个人客户创建正确的联系人（个人客户联系人就是自己）
INSERT INTO contacts (account_id, name, email, phone, job_title, status, is_primary, created_at) VALUES
(21, '张伟', 'zhangwei@example.com', '+86 138 1234 5678', '独立摄影师', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(22, 'Michael Jordan', 'mjordan@example.com', '+1 312 555 0199', '摄影指导', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(23, '山田太郎', 'yamada@example.jp', '+81 90 1234 5678', '映像作家', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(24, 'Jean Pierre', 'jpierre@example.fr', '+33 6 12 34 56 78', 'Directeur de la photographie', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(25, '李明', 'liming@example.com', '+86 139 8765 4321', '摄影助理', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(26, 'Emma Watson', 'ewatson@example.co.uk', '+44 7700 900123', 'Cinematographer', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(27, 'Hans Mueller', 'hmueller@example.de', '+49 151 1234 5678', 'Kameramann', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(28, '王小红', 'wangxh@example.com', '+86 135 2468 1357', '自由摄影师', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(29, 'Chris Hemsworth', 'chemsworth@example.au', '+61 412 345 678', 'Director of Photography', 'PRIMARY', 1, CURRENT_TIMESTAMP),
(30, 'Ryan Reynolds', 'rreynolds@example.ca', '+1 604 555 0123', 'Filmmaker', 'PRIMARY', 1, CURRENT_TIMESTAMP);

-- 验证结果
SELECT 'Contacts created successfully' as status;
SELECT account_type, COUNT(*) as contact_count 
FROM contacts c 
JOIN accounts a ON c.account_id = a.id 
GROUP BY account_type;
