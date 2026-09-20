'use strict';

const DEFAULTS = {
  server: '',
  username: '',
  password: '',
  storageId: '',
  token: ''
};

async function requestServerPermission(server) {
  try {
    const pattern = new URL(server).origin + '/*';
    const has = await chrome.permissions.contains({ origins: [pattern] });
    if (!has) {
      await chrome.permissions.request({ origins: [pattern] });
    }
  } catch (e) {
    /* ignore: 不阻塞保存，弹窗更新时还会再请求 */
  }
}

async function init() {
  const saved = await chrome.storage.local.get(DEFAULTS);
  document.getElementById('server').value = saved.server || '';
  document.getElementById('username').value = saved.username || '';
  document.getElementById('password').value = saved.password || '';
  document.getElementById('storageId').value = saved.storageId == null ? '' : saved.storageId;
  document.getElementById('token').value = saved.token || '';

  document.getElementById('save').addEventListener('click', async function () {
    const server = document.getElementById('server').value.trim();
    const data = {
      server: server,
      username: document.getElementById('username').value.trim(),
      password: document.getElementById('password').value,
      storageId: parseInt(document.getElementById('storageId').value, 10) || '',
      token: document.getElementById('token').value.trim()
    };
    if (!data.server || data.storageId === '') {
      const el = document.getElementById('saved');
      el.textContent = '服务器地址和存储 ID 必填';
      el.style.color = '#c23632';
      return;
    }
    await chrome.storage.local.set(data);
    await requestServerPermission(server);
    const el = document.getElementById('saved');
    el.textContent = '已保存';
    el.style.color = '#1d7a3c';
    setTimeout(function () { el.textContent = ''; }, 2000);
  });
}

init();
