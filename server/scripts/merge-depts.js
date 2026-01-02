const fs = require('fs-extra');
const path = require('path');

const DISK_A = path.join(__dirname, '../data/DiskA');
const DISK_B = path.join(__dirname, '../data/DiskB');

const mapping = {
    'MS': '市场部 (MS)',
    'GE': '综合管理 (GE)',
    'RD': '研发中心 (RD)',
    'OP': '运营部 (OP)'
};

async function mergeDir(oldName, newName) {
    for (const disk of [DISK_A, DISK_B]) {
        const oldPath = path.join(disk, oldName);
        const newPath = path.join(disk, newName);

        if (fs.existsSync(oldPath)) {
            console.log(`[Merge] Processing ${oldPath} -> ${newPath}`);
            await fs.ensureDir(newPath);
            const items = await fs.readdir(oldPath);

            for (const item of items) {
                const src = path.join(oldPath, item);
                const dest = path.join(newPath, item);

                if (fs.existsSync(dest)) {
                    console.log(`[Merge] Conflict for ${item}, skipping or renaming...`);
                    const timestamp = Date.now();
                    await fs.move(src, path.join(newPath, `${timestamp}_${item}`));
                } else {
                    await fs.move(src, dest);
                }
            }

            // Delete old directory if empty
            const remaining = await fs.readdir(oldPath);
            if (remaining.length === 0) {
                await fs.remove(oldPath);
                console.log(`[Merge] Deleted empty old dir: ${oldPath}`);
            } else {
                console.log(`[Merge] Warning: ${oldPath} not empty after merge:`, remaining);
            }
        }
    }
}

async function run() {
    console.log('🚀 Starting Department Merge...');
    for (const [oldName, newName] of Object.entries(mapping)) {
        await mergeDir(oldName, newName);
    }
    console.log('✅ Merge Complete.');
}

run().catch(console.error);
