#!/usr/bin/env python3
"""
Apply all i18n translations to component files
"""
import re

# Define all replacements
FILE_REPLACEMENTS = {
    '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/Login.tsx': [
        ('placeholder="用户名"', 'placeholder={t(\'login.username_placeholder\')}'),
        ('placeholder="密码"', 'placeholder={t(\'login.password_placeholder\')}'),
        ("'验证中...' : '即刻访问'", "t('login.submitting') : t('login.submit_btn')"),
        ("'登录失败，请检查用户名或密码'", "t('login.error_default')"),
    ],
    '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/MemberSpacePage.tsx': [
        ('👥 成员空间管理', "{t('member.space_management')}"),
        ('查看和管理所有用户的个人空间', "{t('member.view_manage_hint')}"),
        ('placeholder="🔍 搜索用户..."', 'placeholder={t(\'member.search_users\')}'),
        ('共 {filteredUsers.length} 位用户', "{t('member.total_users', { count: filteredUsers.length })}"),
        ('<div>用户</div>', "<div>{t('member.table_user')}</div>"),
        ('<div>所属部门</div>', "<div>{t('member.table_department')}</div>"),
        ('<div>文件数</div>', "<div>{t('member.table_file_count')}</div>"),
        ("style={{ textAlign: 'center' }}>操作<", "style={{ textAlign: 'center' }}>{t('member.table_actions')}<"),
        ("|| '未分配'", "|| t('member.unassigned')"),
        ('>查看<', ">{t('member.action_view')}<"),
        ('未找到匹配的用户', "{t('member.not_found')}"),
    ],
    '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/RecycleBin.tsx': [
        ("'确定清空整个回收站？此操作不可撤销！'", "t('recycle.confirm_clear')"),
        ("'✅ 回收站已清空'", "`✅ ${t('recycle.clear_success')}`"),
        ("'确定要永久删除吗？'", "t('recycle.confirm_delete_single')"),
        ("'确定恢复吗？'", "t('recycle.confirm_restore_single')")
,
        ("'✅ 已恢复'", "`✅ ${t('recycle.restore_success')}`"),
    ],
    '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/Dashboard.tsx': [
        ("|| '加载统计数据失败'", "|| t('error.load_stats_failed')"),
    ],
    '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/client/src/components/FileBrowser.tsx': [
        ('`确定要删除 ${item.name} 吗？`', "t('dialog.confirm_delete', { name: item.name })"),
        ('`确定要删除选中的 ${selectedPaths.length} 个项目吗？`', "t('dialog.confirm_batch_delete', { count: selectedPaths.length })"),
        ("|| '删除失败'", "|| t('error.delete_failed')"),
        ("|| '批量删除失败'", "|| t('error.batch_delete_failed')"),
        ("|| '移动失败'", "|| t('error.batch_move_failed')"),
        ("|| '下载失败'", "|| t('error.download_failed')"),
        ('`分享 - ${new Date().toLocaleDateString()}`', "t('share.default_name', { date: new Date().toLocaleDateString() })"),
        ('"永久"', "t('share.expires_forever')"),
        ('`${batchShareExpires} 天`', "t('share.expires_days', { days: batchShareExpires })"),
    ],
}

# Apply replacements
total_replacements = 0
for filepath, replacements in FILE_REPLACEMENTS.items():
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        file_changes = 0
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                file_changes += 1
                print(f"✓ {filepath.split('/')[-1]}: {old[:50]}...")
        
        if file_changes > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            total_replacements += file_changes
            print(f"  Updated {filepath.split('/')[-1]} ({file_changes} replacements)\n")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

print(f"\n{'='*60}")
print(f"Total: {total_replacements} replacements across {len(FILE_REPLACEMENTS)} files")
print(f"{'='*60}")
