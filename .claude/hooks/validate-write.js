// Post-write validation hook
// Receives hook input JSON on stdin
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(input);
    const fp = j.tool_input?.file_path || j.tool_response?.filePath;
    if (!fp) return;

    if (fp.endsWith('.json')) {
      const content = fs.readFileSync(fp, 'utf8');
      JSON.parse(content);
      console.log(`[hook] JSON valid: ${path.basename(fp)}`);
    } else {
      console.log(`[hook] File written: ${path.basename(fp)}`);
    }
  } catch (e) {
    // silent fail - don't block the tool
  }
});
