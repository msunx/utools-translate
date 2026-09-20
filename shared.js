(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  if (typeof window === 'object') root.TranslatorConfig = value;
})(typeof window === 'object' ? window : this, function () {
  const providers = {
    glm: {
      name: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-4.7-flash',
      models: ['glm-4.7-flash', 'glm-4.7', 'glm-5.3', 'glm-5.2', 'glm-4.5-air'], keyUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys'
    },
    deepseek: {
      name: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-flash',
      models: ['deepseek-flash', 'deepseek-v4-pro'], keyUrl: 'https://platform.deepseek.com/api_keys'
    }
  };
  const languages = { smart: '中英互译', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', en: '英语', ja: '日语', ko: '韩语', fr: '法语', de: '德语', es: '西班牙语', ru: '俄语' };
  function defaults() {
    return { provider: 'glm', target: 'smart', providers: Object.fromEntries(Object.entries(providers).map(([id, p]) => [id, { model: p.defaultModel, apiKey: '' }])) };
  }
  function normalize(value) {
    const result = defaults();
    if (!value || typeof value !== 'object') return result;
    if (Object.hasOwn ? Object.hasOwn(providers, value.provider) : Object.prototype.hasOwnProperty.call(providers, value.provider)) result.provider = value.provider;
    if (Object.prototype.hasOwnProperty.call(languages, value.target)) result.target = value.target;
    for (const id of Object.keys(providers)) {
      const item = value.providers && value.providers[id];
      if (!item || typeof item !== 'object') continue;
      if (typeof item.model === 'string' && item.model.trim()) result.providers[id].model = item.model.trim();
      if (typeof item.apiKey === 'string') result.providers[id].apiKey = item.apiKey.trim();
    }
    return result;
  }
  return { providers, languages, defaults, normalize, maxLength: 20000 };
});
