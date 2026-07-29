const fs = require('fs');
const path = 'i:/gameproject/Medieval/src/ui/ModalController.ts';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const regex = /renderDispatchAdvList\(\);\n\n  \/\/ 更新確認按鈕事件/;
const replacement = `  renderDispatchAdvList();
  renderDispatchTeamRoster();

  // 更新確認按鈕事件`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Patch complete.');
} else {
    console.log('Regex not found!');
}
