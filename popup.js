'use strict';

const DEFAULTS = {
  server: '',
  username: '',
  password: '',
  storageId: '',
  token: ''
};

const REQUIRED_COOKIE_KEYS = ['LARK_SUITE_ACCESS_TOKEN', 'LARK_SUITE_DPOP'];

const state = { options: null, storage: null, token: null };

function $(id) {
  return document.getElementById(id);
}

function log(msg, type) {
  const line = document.createElement('div');
  line.className = 'line ' + (type || '');
  line.textContent = msg;
  $('log').appendChild(line);
  $('log').scrollTop = $('log').scrollHeight;
}

function clearLog() {
  $('log').innerHTML = '';
}

function baseUrl() {
  return String(state.options.server || '').replace(/\/+$/, '');
}

function serverOriginPattern() {
  try {
    return new URL(baseUrl()).origin + '/*';
  } catch (e) {
    return null;
  }
}

async function ensureServerPermission() {
  const pattern = serverOriginPattern();
  if (!pattern) {
    throw new Error('请先点击右上角「设置」，填写 OpenList 服务器地址');
  }
  if (await chrome.permissions.contains({ origins: [pattern] })) {
    return;
  }
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) {
    throw new Error('未授权访问服务器 ' + baseUrl() + '。请在浏览器弹出的权限询问中点「允许」后重试');
  }
}

async function api(path, method, bodyObj) {
  await ensureServerPermission();
  const headers = { 'Content-Type': 'application/json' };
  if (!state.token) {
    state.token = await openListLogin();
  }
  headers['Authorization'] = state.token;
  const res = await fetch(baseUrl() + path, {
    method: method,
    headers: headers,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    /* ignore */
  }
  if (!json || json.code !== 200) {
    const msg = json && json.message ? json.message : 'HTTP ' + res.status;
    if (/token|unauthorized|未登录/i.test(String(msg))) {
      state.token = null;
    }
    throw new Error('接口失败 ' + path + '：' + msg);
  }
  return json;
}

async function openListLogin() {
  const o = state.options;
  if (o.token && String(o.token).trim()) {
    return String(o.token).trim();
  }
  if (!o.username || !o.password) {
    throw new Error('未配置 OpenList 用户名/密码，请先点击右上角「设置」填写');
  }
  const res = await fetch(baseUrl() + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: o.username, password: o.password })
  });
  const json = await res.json();
  if (json.code !== 200 || !json.data || !json.data.token) {
    throw new Error('OpenList 登录失败：' + (json.message || 'HTTP ' + res.status));
  }
  return json.data.token;
}

async function fetchStorage() {
  const json = await api('/api/admin/storage/get?id=' + state.options.storageId, 'GET');
  state.storage = json.data;
  $('infoDriver').textContent = state.storage.driver || '-';
  showStoredTokenStatus();
  return state.storage;
}

function decodeJwtExp(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(decodeURIComponent(escape(atob(payload))));
    return parsed && parsed.exp ? new Date(parsed.exp * 1000) : null;
  } catch (e) {
    return null;
  }
}

function extractCookieValue(cookieStr, key) {
  const m = String(cookieStr || '').match(new RegExp('(?:^|;\\s*)' + key + '=([^;]*)'));
  return m ? m[1] : null;
}

function showStoredTokenStatus() {
  try {
    const addition = JSON.parse(state.storage.addition || '{}');
    const storedToken = extractCookieValue(addition.cookie, 'LARK_SUITE_ACCESS_TOKEN');
    if (storedToken) {
      const exp = decodeJwtExp(storedToken);
      if (exp) {
        const status = exp < new Date() ? '已过期' : '正常';
        log('存储内现有 Token 过期时间：' + exp.toLocaleString() + '（' + status + '）', status === '已过期' ? 'warn' : 'ok');
      }
    }
  } catch (e) {
    /* ignore */
  }
}

async function buildCookieFromBrowser() {
  const cookies = await chrome.cookies.getAll({ domain: 'doubao.com' });
  if (!cookies || cookies.length === 0) {
    throw new Error('浏览器中未找到 doubao.com 的 Cookie。请先在浏览器登录豆包云盘：https://www.doubao.com/chat/drive');
  }
  return cookies.map(function (c) { return c.name + '=' + c.value; }).join('; ');
}

function checkCookie(cookieStr) {
  const missing = REQUIRED_COOKIE_KEYS.filter(function (k) {
    return !extractCookieValue(cookieStr, k);
  });
  if (missing.length > 0) {
    throw new Error('Cookie 缺少关键字段：' + missing.join('、') + '。请登录豆包云盘后重新复制完整 Cookie');
  }
  const token = extractCookieValue(cookieStr, 'LARK_SUITE_ACCESS_TOKEN');
  if (token) {
    const exp = decodeJwtExp(token);
    if (exp && exp < new Date()) {
      log('[提示] 新 Cookie 中的 Token 已过期（' + exp.toLocaleString() + '），请先在浏览器重新登录豆包云盘后再更新', 'warn');
    }
  }
}

async function doUpdate(cookieStr) {
  if (!baseUrl() || !state.options.storageId) {
    throw new Error('请先点击右上角「设置」，填写服务器地址和豆包存储 ID');
  }
  if (!state.storage) {
    await fetchStorage();
  }
  const driver = String(state.storage.driver || '');
  if (!/doubao/i.test(driver)) {
    throw new Error('存储 ' + state.options.storageId + ' 的驱动是「' + driver + '」，不是豆包驱动，已取消更新');
  }
  checkCookie(cookieStr);

  const addition = JSON.parse(state.storage.addition || '{}');
  const oldLen = (addition.cookie || '').length;
  addition.cookie = cookieStr;

  const payload = Object.assign({}, state.storage, { addition: JSON.stringify(addition) });
  delete payload.modified;

  log('正在更新 Cookie（旧 ' + oldLen + ' 字符 → 新 ' + cookieStr.length + ' 字符）...');
  const result = await api('/api/admin/storage/update', 'POST', payload);
  log('[成功] 更新成功！OpenList 返回：' + (result.message || 'success'));
  await fetchStorage();
  const st = state.storage;
  log('存储 ' + state.options.storageId + '（' + st.mount_path + '）当前：' + (st.status || '') + (st.disabled ? '（已禁用）' : ''));
}

async function onAuto() {
  clearLog();
  try {
    log('正在从浏览器读取豆包 Cookie...');
    const cookieStr = await buildCookieFromBrowser();
    log('已读取到 ' + cookieStr.split('; ').length + ' 条 Cookie');
    await doUpdate(cookieStr);
  } catch (e) {
    log('[错误] ' + e.message, 'err');
  }
}

async function onPaste() {
  clearLog();
  try {
    const v = $('cookieInput').value.trim();
    if (!v) {
      throw new Error('请先粘贴 Cookie');
    }
    await doUpdate(v);
  } catch (e) {
    log('[错误] ' + e.message, 'err');
  }
}

async function init() {
  state.options = await chrome.storage.local.get(DEFAULTS);
  $('infoServer').textContent = baseUrl() || '（未配置，点右上角设置）';
  $('infoStorage').textContent = state.options.storageId == null || state.options.storageId === '' ? '-' : state.options.storageId;
  $('openOptions').addEventListener('click', function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  $('btnAuto').addEventListener('click', onAuto);
  $('btnPaste').addEventListener('click', function () {
    $('pasteArea').classList.toggle('hidden');
  });
  $('btnPasteGo').addEventListener('click', onPaste);

  if (baseUrl() && state.options.storageId) {
    try {
      await fetchStorage();
    } catch (e) {
      log('[提示] 未能连接服务器：' + e.message, 'warn');
    }
  } else {
    log('[提示] 首次使用请先点右上角「设置」，填写服务器地址和账号信息', 'warn');
  }
}

init();
