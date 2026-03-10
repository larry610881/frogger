// 簡單測試 - 直接檢查 snake.js 檔案是否存在且可執行
const fs = require('fs');
const path = require('path');

console.log('檢查貪食蛇遊戲檔案...');

const snakeFile = path.join(__dirname, 'snake.js');

// 檢查檔案是否存在
if (!fs.existsSync(snakeFile)) {
    console.error('✗ snake.js 檔案不存在');
    process.exit(1);
}

console.log('✓ snake.js 檔案存在');

// 檢查檔案大小
const stats = fs.statSync(snakeFile);
console.log(`✓ 檔案大小: ${stats.size} 位元組`);

// 檢查檔案是否可執行
try {
    fs.accessSync(snakeFile, fs.constants.X_OK);
    console.log('✓ 檔案可執行');
} catch (err) {
    console.log('⚠ 檔案不可執行（可能需要 chmod +x snake.js）');
}

// 檢查檔案內容
const content = fs.readFileSync(snakeFile, 'utf8');

// 檢查必要的關鍵字
const requiredKeywords = [
    'class SnakeGame',
    'WIDTH = 20',
    'HEIGHT = 20',
    'SNAKE_CHAR',
    'FOOD_CHAR',
    'stdin.setRawMode',
    'setInterval',
    'direction'
];

let allKeywordsFound = true;
for (const keyword of requiredKeywords) {
    if (content.includes(keyword)) {
        console.log(`✓ 包含 "${keyword}"`);
    } else {
        console.log(`✗ 缺少 "${keyword}"`);
        allKeywordsFound = false;
    }
}

if (allKeywordsFound) {
    console.log('\n✅ 所有檢查通過！遊戲檔案看起來正確。');
    console.log('\n遊戲功能：');
    console.log('- 20x20 遊戲區域');
    console.log('- 蛇用 ■ 表示，食物用 ★ 表示');
    console.log('- 方向鍵控制移動');
    console.log('- 按 p 暫停/繼續');
    console.log('- 按 q 退出遊戲');
    console.log('- 遊戲結束後按 r 重新開始');
    console.log('\n運行遊戲：');
    console.log('  node snake.js');
} else {
    console.log('\n❌ 有些檢查未通過，請檢查 snake.js 檔案。');
    process.exit(1);
}
