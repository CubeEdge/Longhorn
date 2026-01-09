#!/usr/bin/env python3
"""
Apply admin component translations systematically
"""
import re

def update_dept_dashboard():
    """Update DepartmentDashboard.tsx"""
    file = '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/DepartmentDashboard.tsx'
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    replacements = [
        # Tabs
        ('>概览<', ">{t('dept.overview_tab')}<"),
        ('>成员<', ">{t('dept.members_tab')}<"),
        ('>权限管理<', ">{t('dept.permissions_tab')}<"),
        
        # Stats labels
        ('总成员数', "{t('dept.total_members')}"),
        ('文件总数', "{t('dept.total_files')}"),
        ('存储使用', "{t('dept.storage_usage')}"),
        ('成员存储使用', "{t('dept.recent_activity')}"),  # Actually should be member_storage
        ('最近活动', "{t('dept.recent_activity')}"),
        
        # Activity text
        (' 人', " {t('common.people_suffix')}"),
        ('访问了', "{t('dept.visited')}"),
        ('个文件', "{t('dept.files_suffix')}"),
    ]
    
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            count += 1
            print(f"  ✓ {old[:30]}... → {new[:30]}...")
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nDepartmentDashboard.tsx: {count} replacements")
    return count

def update_user_management():
    """Update UserManagement.tsx"""
    file = '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/UserManagement.tsx'
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Weekdays array replacement
    content = re.sub(
        r"\['日', '一', '二', '三', '四', '五', '六'\]",
        "[t('user.weekday_sun'), t('user.weekday_mon'), t('user.weekday_tue'), t('user.weekday_wed'), t('user.weekday_thu'), t('user.weekday_fri'), t('user.weekday_sat')]",
        content
    )
    
    replacements = [
        # Buttons
        ('>清除<', ">{t('user.clear_button')}<"),
        ('>浏览<', ">{t('user.browse_button')}<"),
        ('>选定<', ">{t('user.select_button')}<"),
        ('>授权生效<', ">{t('user.grant_permission_button')}<"),
        
        # Expiry presets
        ("'7天'", "t('user.expiry_7days')"),
        ("'1个月'", "t('user.expiry_1month')"),
        ("'永久'", "t('user.expiry_forever')"),
        ("'自定义'", "t('user.expiry_custom')"),
        
        # Error messages
        ("'更新失败", "t('user.update_failed')"),
        ("'授权失败", "t('user.grant_failed')"),
        
        # Labels
        ('到期:', "{t('user.expires_on')}:"),
        ('修改用户名', "{t('user.edit_username')}"),
        ('职能角色', "{t('user.edit_role')}"),
        
        # Permission descriptions
        ('仅可查看和下载文件', "{t('user.permission_readonly_desc')}"),
        ('可上传文件、创建文件夹，但只能修改/删除自己上传的内容', "{t('user.permission_contribute_desc')}"),
        ('可修改/删除任意文件，包括他人上传的内容', "{t('user.permission_full_desc')}"),
        
        # Messages
        ('请选择授权失效的具体日期', "{t('user.select_expiry_date')}"),
        ('选择授权文件夹', "{t('user.select_folder_title')}"),
        ('返回上级...', "{t('user.back_to_parent')}"),
        ('该目录下无可用子目录', "{t('user.no_subdirs')}"),
        ('权限说明', "{t('user.permission_help_title')}"),
        
        # Role descriptions
        ('拥有系统所有权限，包括用户管理、部门设置、全局文件访问等', "{t('user.admin_desc')}"),
        ('拥有所辖部门文件夹的完全控制权，可查看本部门成员列表', "{t('user.lead_desc')}"),
        ('仅拥有个人空间和被授权文件夹的访问权限', "{t('user.member_desc')}"),
    ]
    
    count = 1  # Already counted weekdays
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            count += 1
            print(f"  ✓ {old[:30]}...")
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nUserManagement.tsx: {count} replacements")
    return count

def update_dept_management():
    """Update DepartmentManagement.tsx"""
    file = '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/DepartmentManagement.tsx'
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    replacements = [
        ("'请完整填写部门名称和代码'", "t('dept.alert_fill_info')"),
        ("'部门代码必须是 2-3 位大写字母 (例如: MS, HR)'", "t('dept.alert_code_format')"),
        ("'请输入自定义有效期（如：3months, 10days）:'", "t('dept.prompt_custom_expiry')"),
        ('>自定义<', ">{t('user.expiry_custom')}<"),
    ]
    
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            count += 1
            print(f"  ✓ {old[:40]}...")
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nDepartmentManagement.tsx: {count} replacements")
    return count

# Execute updates
print("="*70)
print("Applying Admin Component Translations")
print("="*70)

total = 0
total += update_dept_dashboard()
total += update_user_management()
total += update_dept_management()

print("\n" + "="*70)
print(f"TOTAL: {total} replacements across 3 files")
print("="*70)
