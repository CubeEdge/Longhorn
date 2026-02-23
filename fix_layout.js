const fs = require('fs');
const file = './client/src/components/KinefinityWiki.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Extract the search results block
const searchResultsStart = "                            {/* 搜索结果列表 - 搜索 Tab 激活时显示（位于 Tab 栏下方） */}";
const tabStart = "                            {/* 统一 Tab 栏 + 搜索框 + 管理按钮 */}";

const idx1 = content.indexOf(searchResultsStart);
const idx2 = content.indexOf(tabStart);

if (idx1 === -1 || idx2 === -1) {
    console.error("Could not find blocks");
    process.exit(1);
}

// Search results block
const searchResultsBlock = content.slice(idx1, idx2);
const newContent1 = content.slice(0, idx1) + content.slice(idx2);

// 2. Find where to insert it (after the Tab Bar block)
const searchTabContentStart = "                            {/* 搜索结果内容 - 搜索 Tab 激活时显示 */}";
const idxProductGroups = newContent1.indexOf("                            {/* 分组折叠视图 - 只在非搜索模式下显示 */}");

if (idxProductGroups === -1) {
    console.error("Could not find product groups");
    process.exit(1);
}

// Remove the syntax error duplicate block if any
const duplicateStartIdx = newContent1.indexOf(searchTabContentStart);
let finalContent;
if (duplicateStartIdx !== -1 && duplicateStartIdx < idxProductGroups) {
    // replace from duplicateStartIdx to idxProductGroups with the searchResultsBlock
    finalContent = newContent1.slice(0, duplicateStartIdx) + searchResultsBlock + newContent1.slice(idxProductGroups);
} else {
    // just insert before idxProductGroups
    finalContent = newContent1.slice(0, idxProductGroups) + searchResultsBlock + newContent1.slice(idxProductGroups);
}

fs.writeFileSync(file, finalContent, 'utf8');
console.log("Moved search results block to be under the unified tab bar.");
