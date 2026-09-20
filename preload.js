'use strict';

const config = require('./shared');
const { requestTranslation } = require('./client');
const { clipboard, shell } = require('electron');
const STORE_KEY = 'muyang.ai-translator.settings.v1';
let activeRequest = null;
let enterListener = null;
let pendingEnter = null;
let nativeInputActive = false;
let detachListener = null;

function storage() {
  if (!window.utools?.dbCryptoStorage) throw new Error('当前 uTools 不支持加密存储，请升级 uTools 后再配置密钥。');
  return window.utools.dbCryptoStorage;
}
function readSettings() { return config.normalize(storage().getItem(STORE_KEY)); }
function publicSettings(settings) {
  return {
    provider: settings.provider, target: settings.target,
    providers: Object.fromEntries(Object.entries(settings.providers).map(([id, p]) => [id, { model: p.model, hasKey: Boolean(p.apiKey) }]))
  };
}

window.translator = {
  getSettings: () => publicSettings(readSettings()),
  saveSettings(changes) {
    const next = readSettings();
    for (const id of Object.keys(config.providers)) {
      const change = changes.providers && changes.providers[id];
      if (!change) continue;
      const model = String(change.model || '').trim();
      if (!model || model.length > 160 || /[\r\n]/.test(model)) throw new Error(`请填写${config.providers[id].name}的有效模型名称。`);
      const key = String(change.apiKey || '').trim();
      if (/[\r\n]/.test(key) || key.length > 4096) throw new Error(`${config.providers[id].name} 的 API Key 格式不正确。`);
      next.providers[id].model = model;
      if (change.clearKey) next.providers[id].apiKey = '';
      else if (key) next.providers[id].apiKey = key;
    }
    storage().setItem(STORE_KEY, next);
    return publicSettings(next);
  },
  savePreferences({ provider, target }) {
    const next = readSettings();
    if (Object.prototype.hasOwnProperty.call(config.providers, provider)) next.provider = provider;
    if (Object.prototype.hasOwnProperty.call(config.languages, target)) next.target = target;
    storage().setItem(STORE_KEY, next);
    return publicSettings(next);
  },
  async translate(input, onEvent) {
    if (activeRequest) throw new Error('已有翻译正在进行，请等待完成或先停止。');
    const request = requestTranslation(readSettings(), input, onEvent);
    activeRequest = request;
    try { return await request.promise; } finally { if (activeRequest === request) activeRequest = null; }
  },
  cancel() { const request = activeRequest; activeRequest = null; request?.cancel(); },
  showInput(text, onChange) {
    const host = window.utools;
    if (!host.setSubInput || (host.getWindowType && host.getWindowType() !== 'main')) return false;
    nativeInputActive = true;
    host.setSubInput(details => { if (nativeInputActive) onChange(String(details.text || '')); }, '输入要翻译的内容，按 Enter 翻译', true);
    host.setSubInputValue(String(text));
    return true;
  },
  setInputText(text) { if (nativeInputActive) window.utools.setSubInputValue(String(text)); },
  focusInput() { if (nativeInputActive) window.utools.subInputFocus(); },
  hideInput() { if (nativeInputActive) { nativeInputActive = false; window.utools.removeSubInput(); } },
  onDetach(callback) { detachListener = callback; },
  copyText(text) { clipboard.writeText(String(text)); },
  readClipboard() { return clipboard.readText(); },
  openKeyPage(id) { if (config.providers[id]) return shell.openExternal(config.providers[id].keyUrl); },
  onEnter(callback) { enterListener = callback; if (pendingEnter) { callback(pendingEnter); pendingEnter = null; } }
};

window.utools.onPluginEnter(action => {
  if (enterListener) enterListener(action); else pendingEnter = action;
});
window.utools.onPluginOut(() => { nativeInputActive = false; window.translator.cancel(); });
window.utools.onPluginDetach?.(() => { nativeInputActive = false; detachListener?.(); });
