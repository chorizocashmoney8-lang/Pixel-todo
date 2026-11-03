const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nsis = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).build.nsis;
const includePath = path.join(root, 'build', 'installer.nsh');
const source = fs.readFileSync(includePath, 'utf8');
const templates = path.join(root, 'node_modules/app-builder-lib/templates/nsis');

function block(kind, name, text = source) {
  const end = kind === 'Function' ? 'FunctionEnd' : '!macroend';
  const match = text.match(new RegExp(`^${kind} ${name}\\s*\\r?\\n([\\s\\S]*?)^${end}`, 'm'));
  assert.ok(match, `${kind} ${name} must exist`);
  return match[1];
}

function runMacro(name, input = {}) {
  const values = {
    '${Silent}': Boolean(input.silent),
    '${isUpdated}': Boolean(input.updated),
    '${isNoDesktopShortcut}': Boolean(input.noDesktop),
    '${isKeepShortcuts}': Boolean(input.keepShortcuts),
    '$PixelTodoDesktopShortcut': input.checked === false ? 0 : 1,
    '${BST_CHECKED}': 1,
    '$R0': input.marker ?? '',
    '${Errors}': Boolean(input.errors),
    '${FileExists} "$newDesktopLink"': Boolean(input.existingLink),
  };
  const resolve = (token) => {
    if (Object.hasOwn(values, token)) return values[token];
    if (/^".*"$/.test(token)) return token.slice(1, -1);
    assert.fail(`unsupported NSIS expression token: ${token}`);
  };
  let errors = Boolean(input.errors);
  let marker = input.marker ?? '';
  function evaluate(expression) {
    expression = expression.trim();
    if (expression.startsWith('${FileExists}')) return values['${FileExists} "$newDesktopLink"'];
    if (expression.startsWith('${Errors}')) return errors;
    const comparison = expression.match(/^(.+?)\s+(==|!=)\s+(.+)$/);
    if (comparison) {
      const [, left, operator, right] = comparison;
      return operator === '==' ? resolve(left) === resolve(right) : resolve(left) !== resolve(right);
    }
    return Boolean(resolve(expression));
  }

  const stack = [];
  const events = [];
  let active = true;

  for (const raw of block('!macro', name).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const branch = line.match(/^\$\{(If|IfNot|OrIf|ElseIf|AndIf|AndIfNot|Else|EndIf)\}(?:\s+(.*))?$/i);
    if (branch) {
      const [, keyword, expression] = branch;
      const key = keyword.toLowerCase();
      if (key === 'if' || key === 'ifnot') {
        let selected = evaluate(expression);
        if (key === 'ifnot') selected = !selected;
        stack.push({ parent: active, selected, taken: selected });
        active = active && selected;
      } else if (key === 'orif') {
        const frame = stack.at(-1);
        const selected = evaluate(expression);
        frame.selected ||= selected;
        frame.taken ||= selected;
        active = frame.parent && frame.selected;
      } else if (key === 'elseif') {
        const frame = stack.at(-1);
        const selected = !frame.taken && evaluate(expression);
        frame.selected = selected;
        frame.taken ||= selected;
        active = frame.parent && selected;
      } else if (key === 'else') {
        const frame = stack.at(-1);
        frame.selected = !frame.taken;
        frame.taken = true;
        active = frame.parent && frame.selected;
      } else if (key === 'endif') {
        active = stack.pop().parent;
      } else {
        const frame = stack.at(-1);
        const selected = key === 'andif' ? evaluate(expression) : !evaluate(expression);
        frame.selected &&= selected;
        active = frame.parent && frame.selected;
      }
      continue;
    }
    if (line.startsWith('!undef ') || line.startsWith('!define ')) continue;
    if (!active) continue;
    if (/^CreateShortCut "\$newDesktopLink"/.test(line)) {
      events.push('create');
      errors = input.createSucceeds === false;
    } else if (line === 'ClearErrors') {
      errors = false;
    } else if (/^WriteRegStr SHELL_CONTEXT .* PixelTodoDesktopShortcut "(true|false)"$/.test(line)) {
      marker = line.match(/"(true|false)"$/)[1];
      events.push(`marker:${marker}`);
    } else if (/^WinShell::SetLnkAUMI /.test(line)) {
      events.push('aumi');
    } else if (/^WinShell::UninstShortcut /.test(line)) {
      events.push('uninst-shortcut');
    } else if (/^Delete "\$oldDesktopLink"$/.test(line)) {
      events.push('delete');
    } else if (/^ReadRegStr \$R0 /.test(line)) {
      marker = input.marker ?? '';
    } else if (/^!insertmacro addDesktopLink \$keepShortcuts$/.test(line)) {
      events.push('builtin');
    } else if (line.startsWith('System::Call ')) {
      events.push('refresh');
    } else {
      assert.fail(`unsupported ${name} instruction: ${line}`);
    }
  }
  assert.equal(stack.length, 0);
  return { events, marker };
}

test('使用中文 assisted 向导和自定义页面，关闭 electron-builder 自动桌面链接', () => {
  assert.equal(nsis.oneClick, false);
  assert.equal(nsis.createDesktopShortcut, false);
  assert.equal(nsis.include, 'build/installer.nsh');
  assert.deepEqual(nsis.installerLanguages, ['zh_CN']);
  assert.equal(nsis.perMachine, false);
  assert.equal(nsis.allowToChangeInstallationDirectory, true);
  assert.equal(nsis.customNsisResources.version, '3.4.1');
  assert.match(nsis.customNsisResources.url, /nsis-resources-3\.4\.1/);
  assert.equal(nsis.runAfterFinish, true);
  assert.match(block('!macro', 'customPageAfterChangeDir'), /Page custom PixelTodoDesktopShortcutPageCreate PixelTodoDesktopShortcutPageLeave/);
  assert.match(block('Function', 'PixelTodoDesktopShortcutPageCreate'), /NSD_CreateCheckbox.*"创建桌面快捷方式"/);
  const assisted = fs.readFileSync(path.join(templates, 'assistedInstaller.nsh'), 'utf8');
  assert.ok(assisted.indexOf('!insertmacro MUI_PAGE_DIRECTORY') < assisted.indexOf('!insertmacro customPageAfterChangeDir'));
  assert.ok(assisted.indexOf('!insertmacro customPageAfterChangeDir') < assisted.indexOf('!insertmacro MUI_PAGE_INSTFILES'));
  const install = fs.readFileSync(path.join(templates, 'installSection.nsh'), 'utf8');
  assert.ok(install.indexOf('!insertmacro addDesktopLink $keepShortcuts') < install.indexOf('!insertmacro customInstall'));
});

test('默认勾选且前进/返回会保存并恢复用户选择；silent/update 跳过交互页', () => {
  assert.match(block('!macro', 'customInit'), /StrCpy \$PixelTodoDesktopShortcut \$\{BST_CHECKED\}/);
  const page = block('Function', 'PixelTodoDesktopShortcutPageCreate');
  assert.match(page, /\$\{If\} \$\{Silent\}[\s\S]*?Abort/);
  assert.doesNotMatch(page, /isUpdated/, 'the page must not expand plugin-backed flag checks before NSIS plugin directories are loaded');
  assert.match(page, /NSD_SetState\} \$PixelTodoDesktopShortcutCheckbox \$PixelTodoDesktopShortcut/);
  assert.match(page, /NSD_OnBack\} PixelTodoDesktopShortcutPageLeave/);
  assert.match(block('Function', 'PixelTodoDesktopShortcutPageLeave'), /NSD_GetState\} \$PixelTodoDesktopShortcutCheckbox \$PixelTodoDesktopShortcut/);
  assert.doesNotMatch(page, /StrCpy \$PixelTodoDesktopShortcut /);
});

test('真实 NSIS 分支：勾选创建并写 AUMI，取消/禁用/已有链接均不覆盖用户链接', () => {
  assert.deepEqual(runMacro('customInstall').events, ['create', 'marker:true', 'aumi', 'refresh']);
  assert.deepEqual(runMacro('customInstall', { checked: false }), { events: ['marker:false'], marker: 'false' });
  assert.deepEqual(runMacro('customInstall', { noDesktop: true }), { events: ['marker:false'], marker: 'false' });
  assert.deepEqual(runMacro('customInstall', { existingLink: true }), { events: ['marker:false'], marker: 'false' });
  assert.deepEqual(runMacro('customInstall', { createSucceeds: false }), { events: ['create', 'marker:false'], marker: 'false' });
  assert.doesNotMatch(block('!macro', 'customInstall'), /\b(?:Delete|Rename|UninstShortcut)\b/);
});

test('silent install 和更新走 electron-builder 内置策略，不进入 checkbox 分支', () => {
  for (const options of [{ silent: true }, { updated: true }]) {
    assert.deepEqual(runMacro('customInstall', options).events, ['builtin']);
  }
  assert.deepEqual(runMacro('customInstall', { silent: true, noDesktop: true }), { events: ['builtin', 'marker:false'], marker: 'false' });
  assert.deepEqual(runMacro('customInstall', { updated: true, noDesktop: true }).events, ['builtin']);
  assert.match(block('!macro', 'customInstall'), /!undef DO_NOT_CREATE_DESKTOP_SHORTCUT\s+!insertmacro addDesktopLink \$keepShortcuts\s+!define DO_NOT_CREATE_DESKTOP_SHORTCUT/);
  const builtin = fs.readFileSync(path.join(templates, 'include/installer.nsh'), 'utf8');
  assert.match(builtin, /!macro addDesktopLink keepShortcuts[\s\S]*?\$\{ifNot\} \$\{isNoDesktopShortcut\}/);
  assert.match(builtin, /\$keepShortcuts == "false"/);
});

test('卸载按安装时记录决定是否删除链接，并尊重 keep-shortcuts 及旧版安装', () => {
  assert.deepEqual(runMacro('customUnInstall', { marker: 'true' }).events, ['uninst-shortcut', 'delete']);
  assert.deepEqual(runMacro('customUnInstall', { marker: '' }).events, ['uninst-shortcut', 'delete']);
  assert.deepEqual(runMacro('customUnInstall', { marker: 'false' }).events, []);
  assert.deepEqual(runMacro('customUnInstall', { marker: 'true', keepShortcuts: true }).events, []);
  assert.match(source, /^!ifdef BUILD_UNINSTALLER[\s\S]*?!macro customUnInstall[\s\S]*?!else/m);
  assert.match(source, /PixelTodoDesktopShortcut "true"/);
  assert.doesNotMatch(source, /!ifdef BUILD_UNINSTALLER\s+!undef DO_NOT_CREATE_DESKTOP_SHORTCUT/);
  const uninstall = fs.readFileSync(path.join(templates, 'uninstaller.nsh'), 'utf8');
  assert.ok(uninstall.indexOf('!insertmacro customUnInstall') < uninstall.indexOf('!ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT'));
});

// Native syntax check only; compile temporary fixtures, never execute them.
test('NSIS 原生编译自定义交互页和卸载逻辑', { timeout: 30000 }, (t) => {
  if (process.platform !== 'win32') return t.skip('requires a cached Windows NSIS compiler');
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const cache = process.env.ELECTRON_BUILDER_CACHE || path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache');
  function findCached(prefix, relative) {
    if (!fs.existsSync(cache)) return undefined;
    for (const group of fs.readdirSync(cache, { withFileTypes: true })) {
      if (!group.isDirectory() || !group.name.startsWith(prefix)) continue;
      const folder = path.join(cache, group.name);
      for (const entry of [folder, ...fs.readdirSync(folder, { withFileTypes: true })
        .filter((item) => item.isDirectory()).map((item) => path.join(folder, item.name))]) {
        if (fs.existsSync(path.join(entry, relative))) return entry;
      }
    }
  }
  const nsisDir = findCached('nsis-', 'makensis.exe');
  const resources = findCached('nsis-resources-', 'plugins/x86-unicode/WinShell.dll');
  if (!nsisDir || !resources) return t.skip('electron-builder NSIS cache is unavailable');
  const { NsisScriptGenerator } = require('app-builder-lib/out/targets/nsis/nsisScriptGenerator');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-todo-nsis-test-'));
  try {
    for (const mode of ['interactive', 'uninstaller']) {
      const generator = new NsisScriptGenerator();
      generator.addIncludeDir(path.join(nsisDir, 'Include'));
      generator.addIncludeDir(path.join(templates, 'include'));
      generator.addPluginDir('x86-unicode', path.join(resources, 'plugins/x86-unicode'));
      generator.include(path.join(templates, 'include/StdUtils.nsh'));
      generator.flags(['updated', 'no-desktop-shortcut', 'keep-shortcuts']);
      generator.lines.push(
        '!include "LogicLib.nsh"',
        '!include "nsDialogs.nsh"',
        '!define APP_ID "local.pixel-todo"',
        '!define APP_DESCRIPTION "Pixel Todo"',
        '!define APP_EXECUTABLE_FILENAME "Pixel Todo.exe"',
        '!define INSTALL_REGISTRY_KEY "Software\\PixelTodoCompileTest"',
        '!define SHELL_CONTEXT HKCU',
        'Var appExe',
        'Var keepShortcuts',
        'Var newDesktopLink',
        'Var oldDesktopLink',
        '!macro addDesktopLink keepShortcuts',
        '  DetailPrint "upstream shortcut policy fixture"',
        '!macroend',
        '!define DO_NOT_CREATE_DESKTOP_SHORTCUT'
      );
      if (mode === 'uninstaller') generator.lines.push('!define BUILD_UNINSTALLER');
      generator.include(includePath);
      if (mode === 'interactive') {
        generator.lines.push(
          'Page custom PixelTodoDesktopShortcutPageCreate PixelTodoDesktopShortcutPageLeave',
          'Function .onInit',
          '  !insertmacro customInit',
          'FunctionEnd',
          'Section "Install fixture"',
          '  !insertmacro customInstall',
          'SectionEnd'
        );
      } else {
        generator.lines.push('Section "Uninstall fixture"', '  !insertmacro customUnInstall', 'SectionEnd');
      }
      const script = path.join(temp, `${mode}.nsi`);
      const output = path.join(temp, `${mode}.exe`);
      fs.writeFileSync(script, `Unicode true\nOutFile "${output}"\n${generator.build()}`);
      const result = spawnSync(path.join(nsisDir, 'makensis.exe'), ['/INPUTCHARSET', 'UTF8', '/V2', script], {
        encoding: 'utf8', windowsHide: true, timeout: 15000,
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${mode}:\n${result.stdout}\n${result.stderr}`);
      assert.ok(fs.statSync(output).size > 0, `${mode} compiled output missing`);
      t.diagnostic(`${mode}: makensis exit 0 (not executed)`);
    }
  } finally {
    assert.equal(path.dirname(temp), os.tmpdir());
    assert.ok(path.basename(temp).startsWith('pixel-todo-nsis-test-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
