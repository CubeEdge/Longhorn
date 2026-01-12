const fs = require('fs');
const path = require('path');

const diskA = path.join(__dirname, 'server/data/DiskA');

async function moveContents(srcName, destName) {
    const src = path.join(diskA, srcName);
    const dest = path.join(diskA, destName);

    if (fs.existsSync(src)) {
        console.log(`Processing move from [${srcName}] to [${destName}]...`);
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const items = fs.readdirSync(src);
        for (const item of items) {
            const srcItem = path.join(src, item);
            const destItem = path.join(dest, item);
            try {
                fs.renameSync(srcItem, destItem);
                console.log(`  Moved: ${item}`);
            } catch (err) {
                console.error(`  Error moving ${item}: ${err.message}`);
            }
        }

        try {
            fs.rmdirSync(src);
            console.log(`Removed source folder: ${srcName}`);
        } catch (e) {
            console.log(`Could not remove ${srcName} (maybe not empty): ${e.message}`);
        }
    } else {
        console.log(`Source ${srcName} not found, skipping.`);
    }
}

async function main() {
    // 1. Merge 研发中心 (RD) -> 研发部 (RD)
    await moveContents('研发中心 (RD)', '研发部 (RD)');

    // 2. Merge 综合管理 (GE) -> 通用台面 (GE)
    await moveContents('综合管理 (GE)', '通用台面 (GE)');

    // 3. Rename 通用台面 (GE) -> 通用台面 (RE)
    const srcGE = path.join(diskA, '通用台面 (GE)');
    const destRE = path.join(diskA, '通用台面 (RE)');

    if (fs.existsSync(srcGE)) {
        if (fs.existsSync(destRE)) {
            console.log('Target 通用台面 (RE) already exists, merging contents...');
            await moveContents('通用台面 (GE)', '通用台面 (RE)');
        } else {
            fs.renameSync(srcGE, destRE);
            console.log('Renamed [通用台面 (GE)] to [通用台面 (RE)]');
        }
    }
}

main().catch(console.error);
