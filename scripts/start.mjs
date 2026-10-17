import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Read the secret directly from the terminal, without echoing or shell history.
async function readKey(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('キー入力には対話型ターミナルが必要です。VS Codeのターミナルで npm start を実行してください。');
  }
  process.stdout.write(`${label}を貼り付けてEnter（非表示・保存しません）。\nWindows: Ctrl+V／VS Code: Ctrl+Shift+V。空Enterで省略。\n入力: 0文字`);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise(resolve => {
    let value = '';
    let finished = false;
    let pending = Promise.resolve();
    const showCount = () => process.stdout.write(`\r入力: ${value.length}文字\u001b[K`);
    const finish = result => {
      finished = true;
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      resolve(result);
    };
    const consume = async chunk => {
      // Some terminals wrap pasted text in bracketed-paste escape sequences.
      for (const char of chunk.replace(/\u001b\[(?:200|201)~/g, '')) {
        if (finished) return;
        if (char === '\u0003') { finish(null); return; }
        if (char === '\r' || char === '\n') { finish(value.trim()); return; }
        if (char === '\u0016' && process.platform === 'win32') {
          try {
            const clipboard = await new Promise((resolve, reject) => {
              const reader = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
              let text = '';
              reader.stdout.setEncoding('utf8');
              reader.stdout.on('data', part => { text += part; });
              reader.on('error', reject);
              reader.on('exit', code => code === 0 ? resolve(text) : reject(new Error('clipboard')));
            });
            value += clipboard.trim().replace(/[^\x20-\x7e]/g, '');
          } catch { process.stdout.write('\n貼り付けできません。Ctrl+Shift+V または右クリックをお試しください。\n'); }
          showCount();
          continue;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ' && char <= '~') value += char;
      }
      showCount();
    };
    const onData = chunk => { pending = pending.then(() => consume(chunk)); };
    process.stdin.on('data', onData);
  });
}

try {
  let key = await readKey('Freesound APIキー');
  if (key === null) process.exit(130);
  let openaiKey = await readKey('OpenAI APIキー（本文の分析用）');
  if (openaiKey === null) process.exit(130);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url)), 'start', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, FREESOUND_API_KEY: key, OPENAI_API_KEY: openaiKey },
  });
  key = '';
  openaiKey = '';
  // The terminal sends Ctrl+C to Expo as well. Wait for its normal cleanup.
  process.on('SIGINT', () => {});
  child.on('error', () => { console.error('Expoを起動できません。npm install を確認してください。'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(error instanceof Error ? error.message : '起動できません。');
  process.exitCode = 1;
}
