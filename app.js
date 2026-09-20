'use strict';

const cfg = window.TranslatorConfig;
const bridge = window.translator;
const $ = id => document.getElementById(id);
const state = { settings: null, busy: false, sequence: 0, settingsDirty: false, result: '', text: '', nativeInput: false, started: 0, available: Boolean(bridge) };
const emptySettings = () => ({ ...cfg.defaults(), providers: Object.fromEntries(Object.entries(cfg.providers).map(([id, p]) => [id, { model: p.defaultModel, hasKey: false }])) });
state.settings = emptySettings();

function status(message, kind = '') { $('status').textContent = message; $('status').dataset.kind = kind; }
function settingsStatus(message, kind = '') { $('settingsStatus').textContent = message; $('settingsStatus').dataset.kind = kind; }
function submitKey() { return state.nativeInput ? 'Enter' : /Mac/i.test(navigator.platform) ? '⌘ Enter' : 'Ctrl Enter'; }
function refreshControls() {
  const selected = state.settings.provider;
  document.querySelectorAll('[data-provider]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.provider === selected)); button.disabled = state.busy; });
  const account = state.settings.providers[selected];
  $('modelLabel').textContent = account.model;
  $('modelLabel').title = account.model;
  $('setupHint').hidden = !state.available || account.hasKey;
  $('setupText').textContent = `配置${cfg.providers[selected].name}的 API Key，即可开始翻译。`;
  $('translateButton').hidden = state.busy;
  $('cancelButton').hidden = !state.busy;
  $('shortcutHint').hidden = state.busy;
  $('translateButton').disabled = !state.available || !state.text.trim() || state.text.length > cfg.maxLength;
  $('copyButton').disabled = !state.result;
  ['targetLanguage', 'settingsButton', 'setupButton'].forEach(id => { $(id).disabled = state.busy; });
  $('charCount').textContent = `${state.text.length.toLocaleString()} / 20,000`;
  $('charCount').classList.toggle('over-limit', state.text.length > cfg.maxLength);
  $('sourcePreview').textContent = state.text;
  $('sourcePreview').hidden = !state.text.trim();
  $('sourceEmpty').hidden = Boolean(state.text.trim());
  $('emptyResultTitle').textContent = state.busy ? '正在翻译这段文字…' : state.text.trim() ? '准备好翻译了' : '等一句想翻译的话';
  $('emptyResultHint').textContent = state.busy ? '译文会逐步显示，可以随时停止' : state.text.trim() ? `按 ${submitKey()} 或点击「翻译」开始` : state.nativeInput ? '在顶部输入，译文会显示在这里' : '在原文框输入，译文会显示在这里';
}
function showResult(text) {
  state.result = text;
  const result = $('resultText');
  const nearBottom = result.scrollHeight - result.scrollTop - result.clientHeight < 80;
  result.value = text;
  result.hidden = !text;
  $('emptyResult').hidden = Boolean(text);
  $('copyButton').disabled = !text;
  if (nearBottom) result.scrollTop = result.scrollHeight;
}
function resetResult() { showResult(''); $('resultMeta').textContent = '保留原文格式与段落'; status('准备就绪'); }
function refreshInputMode() {
  $('fallbackInput').hidden = state.nativeInput;
  $('inputHint').textContent = state.nativeInput ? '顶部输入 · Enter 翻译' : '自动识别语言 · ⌘ / Ctrl Enter 翻译';
  $('shortcutHint').textContent = submitKey();
  refreshControls();
}
function focusSource() { if (state.nativeInput) bridge.focusInput(); else $('sourceText').focus(); }
function activateInput() {
  try { state.nativeInput = Boolean(bridge?.showInput?.(state.text, text => updateSource(text))); }
  catch (_) { state.nativeInput = false; }
  refreshInputMode();
}
function updateSource(text, syncNative = false) {
  text = String(text || '');
  if (text !== state.text) {
    const interrupted = state.busy;
    if (interrupted) { bridge.cancel(); state.sequence++; state.busy = false; }
    state.text = text;
    $('sourceText').value = text;
    resetResult();
    if (text.length > cfg.maxLength) status('单次最多 20,000 个字符，请分段翻译。', 'error');
    else if (text.trim()) status(interrupted ? `原文已修改，旧翻译已停止。按 ${submitKey()} 重新翻译。` : `输入完成后，按 ${submitKey()} 或点击「翻译」。`);
  }
  if (syncNative && state.nativeInput) bridge.setInputText(text);
  refreshControls();
}
function preferencesChanged() {
  try { state.settings = bridge.savePreferences({ provider: state.settings.provider, target: $('targetLanguage').value }); }
  catch (error) { status(error.message, 'error'); }
}

function buildSettings() {
  for (const [id, provider] of Object.entries(cfg.providers)) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'provider-form';
    // The only interpolated strings below are static, bundled provider identifiers and names.
    fieldset.innerHTML = `<legend>${provider.name}</legend>
      <div class="field"><label class="field-label" for="${id}Model">模型名称</label><input id="${id}Model" name="${id}Model" list="${id}Models" maxlength="160" required spellcheck="false" autocapitalize="off"><datalist id="${id}Models"></datalist><p class="field-hint">选择建议模型，或填写平台支持的模型 ID。</p></div>
      <div class="field"><label class="field-label" for="${id}Key">API Key</label><div class="key-input-wrap"><input id="${id}Key" name="${id}Key" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="off" maxlength="4096"><button id="${id}Reveal" type="button" class="text-button" aria-label="显示${provider.name}新输入的密钥" aria-pressed="false">显示</button></div>
      <div class="key-options"><button id="${id}KeyPage" class="key-link" type="button">获取 API Key</button><label class="delete-key" id="${id}ClearLabel"><input id="${id}Clear" type="checkbox">移除密钥</label></div><p id="${id}KeyHint" class="field-hint"></p></div>`;
    $('providerSettings').appendChild(fieldset);
    for (const model of provider.models) { const option = document.createElement('option'); option.value = model; $(`${id}Models`).appendChild(option); }
    $(`${id}Reveal`).addEventListener('click', () => {
      const reveal = $(`${id}Key`).type === 'password';
      $(`${id}Key`).type = reveal ? 'text' : 'password';
      $(`${id}Reveal`).textContent = reveal ? '隐藏' : '显示';
      $(`${id}Reveal`).setAttribute('aria-pressed', String(reveal));
      $(`${id}Reveal`).setAttribute('aria-label', `${reveal ? '隐藏' : '显示'}${provider.name}新输入的密钥`);
    });
    $(`${id}KeyPage`).addEventListener('click', () => {
      if (bridge) Promise.resolve(bridge.openKeyPage(id)).catch(() => settingsStatus('无法打开平台页面，请在浏览器访问平台控制台。', 'error'));
      else settingsStatus('请在 uTools 中配置密钥。');
    });
    $(`${id}Clear`).addEventListener('change', event => {
      $(`${id}Key`).disabled = event.target.checked;
      if (event.target.checked) $(`${id}Key`).value = '';
      state.settingsDirty = true;
    });
  }
}
function fillSettings() {
  for (const id of Object.keys(cfg.providers)) {
    const account = state.settings.providers[id];
    $(`${id}Model`).value = account.model;
    $(`${id}Key`).value = '';
    $(`${id}Key`).type = 'password';
    $(`${id}Key`).disabled = false;
    $(`${id}Reveal`).textContent = '显示';
    $(`${id}Reveal`).setAttribute('aria-pressed', 'false');
    $(`${id}Reveal`).setAttribute('aria-label', `显示${cfg.providers[id].name}新输入的密钥`);
    $(`${id}Key`).placeholder = account.hasKey ? '已保存 · 留空则保持不变' : '粘贴平台提供的 API Key';
    $(`${id}Clear`).checked = false;
    $(`${id}ClearLabel`).hidden = !account.hasKey;
    $(`${id}KeyHint`).textContent = account.hasKey ? '密钥已加密保存，可输入新密钥替换。' : '尚未配置。只需填写你要使用的平台。';
  }
  state.settingsDirty = false;
}
function openSettings() {
  if (state.busy) return;
  bridge?.hideInput?.();
  state.nativeInput = false;
  if (!state.settingsDirty) fillSettings();
  $('translatePage').hidden = true;
  $('settingsPage').hidden = false;
  $('settingsButton').hidden = true;
  $('backButton').hidden = false;
  settingsStatus(state.available ? '' : '请在 uTools 中打开插件后保存设置。');
  $('saveButton').disabled = !state.available;
  $(`${state.settings.provider}Model`).focus();
}
function closeSettings() {
  $('translatePage').hidden = false;
  $('settingsPage').hidden = true;
  $('settingsButton').hidden = false;
  $('backButton').hidden = true;
  if (state.settingsDirty) status('设置草稿尚未保存；当前翻译仍使用已保存的配置。', 'warning');
  activateInput();
  focusSource();
}
async function translate() {
  if (state.busy || !state.available) return;
  if (!state.settings.providers[state.settings.provider].hasKey) { openSettings(); $(`${state.settings.provider}Key`).focus(); return; }
  if (!state.text.trim()) { focusSource(); return; }
  if (state.text.length > cfg.maxLength) { status('单次最多 20,000 个字符，请分段翻译。', 'error'); return; }
  const sequence = ++state.sequence;
  const provider = state.settings.provider;
  const model = state.settings.providers[provider].model;
  const target = $('targetLanguage').value;
  state.busy = true;
  state.started = Date.now();
  showResult('');
  refreshControls();
  status('正在连接翻译模型…', 'loading');
  $('resultMeta').textContent = `${cfg.providers[provider].name} · ${model}`;
  try {
    const result = await bridge.translate({ provider, target, text: state.text }, event => {
      if (sequence !== state.sequence) return;
      if (event.type === 'text') { showResult(event.text); status('正在翻译…', 'loading'); }
      else if (event.type === 'thinking' && !state.result) status('模型正在思考，稍后开始输出…', 'loading');
    });
    if (sequence !== state.sequence) return;
    showResult(result.text);
    const elapsed = ((Date.now() - state.started) / 1000).toFixed(1);
    status(result.warning || `翻译完成 · ${elapsed} 秒`, result.warning ? 'warning' : 'success');
  } catch (error) {
    if (sequence !== state.sequence) return;
    if (error.code === 'CANCELLED') status(state.result ? '已停止，当前显示的是部分译文。' : '已停止翻译。', 'warning');
    else status(`${error.message || '翻译失败，请重试。'}${state.result ? ' 当前显示的是部分译文。' : ''}`, 'error');
  } finally {
    if (sequence === state.sequence) { state.busy = false; refreshControls(); }
  }
}

for (const [id, name] of Object.entries(cfg.languages)) { const option = document.createElement('option'); option.value = id; option.textContent = name; $('targetLanguage').appendChild(option); }
buildSettings();
try { if (bridge) state.settings = bridge.getSettings(); }
catch (error) { status(error.message, 'error'); state.available = false; }
$('targetLanguage').value = state.settings.target;
$('previewHint').hidden = Boolean(bridge);
if (!bridge) refreshInputMode();
refreshControls();
if (state.available && !state.settings.providers[state.settings.provider].hasKey) status('先配置一个平台，即可开始。');

document.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', () => {
  if (state.busy) return;
  state.settings.provider = button.dataset.provider;
  if (bridge) preferencesChanged();
  refreshControls();
}));
$('targetLanguage').addEventListener('change', () => {
  if (bridge) preferencesChanged();
  if (state.result) { $('resultMeta').textContent = '目标语言已修改，请重新翻译'; status('目标语言已修改'); }
});
$('sourceText').addEventListener('input', event => updateSource(event.target.value));
$('clearButton').addEventListener('click', () => { updateSource('', true); resetResult(); focusSource(); });
$('pasteButton').addEventListener('click', async () => {
  try {
    const text = bridge ? bridge.readClipboard() : await navigator.clipboard.readText();
    if (!text) { status('剪贴板里没有文本。'); return; }
    updateSource(text, true); focusSource();
  } catch (_) { status('无法读取剪贴板，请使用 ⌘V 粘贴。', 'error'); }
});
$('copyButton').addEventListener('click', async () => {
  if (!state.result) return;
  try { if (bridge) bridge.copyText(state.result); else await navigator.clipboard.writeText(state.result); status('译文已复制。', 'success'); }
  catch (_) { status('复制失败，请选中译文手动复制。', 'error'); }
});
$('settingsButton').addEventListener('click', openSettings);
$('setupButton').addEventListener('click', openSettings);
$('backButton').addEventListener('click', closeSettings);
$('translateButton').addEventListener('click', translate);
$('cancelButton').addEventListener('click', () => bridge?.cancel());
$('settingsForm').addEventListener('input', () => { state.settingsDirty = true; settingsStatus('有未保存的修改'); });
$('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!state.available) return;
  const changes = { providers: Object.fromEntries(Object.keys(cfg.providers).map(id => [id, { model: $(`${id}Model`).value, apiKey: $(`${id}Key`).value, clearKey: $(`${id}Clear`).checked }])) };
  try { state.settings = bridge.saveSettings(changes); fillSettings(); refreshControls(); settingsStatus('设置已保存。返回即可开始翻译。', 'success'); }
  catch (error) { settingsStatus(error.message, 'error'); }
});
document.addEventListener('keydown', event => {
  if (event.isComposing || event.keyCode === 229 || event.repeat || $('translatePage').hidden) return;
  const focusedControl = event.target?.closest?.('input, textarea, select, button, [contenteditable="true"]');
  const submit = event.key === 'Enter' && (event.metaKey || event.ctrlKey || (state.nativeInput && !focusedControl && !event.shiftKey && !event.altKey));
  if (submit) { event.preventDefault(); translate(); }
  if (event.key === 'Escape' && state.busy) { event.preventDefault(); bridge.cancel(); }
});
bridge?.onDetach?.(() => {
  state.nativeInput = false;
  refreshInputMode();
  if (!$('translatePage').hidden) focusSource();
});
bridge?.onEnter(action => {
  if (action.code === 'settings') { openSettings(); return; }
  const incoming = ['over', 'regex'].includes(action.type) && typeof action.payload === 'string' ? action.payload : null;
  if (incoming !== null) updateSource(incoming);
  closeSettings();
  // Entering with selected text fills the native input; translation still requires Enter or the button.
});
