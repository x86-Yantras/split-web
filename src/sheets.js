// Google Sheets v4 + Drive v3 client factory. Browser global `window.SSSheets` (instance) AND Node module (factory).
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.createSheetsClient = mod.createSheetsClient;
  // Lazy browser instance once SSAuth exists.
  if (typeof window !== 'undefined') {
    root.SSSheets = mod.createSheetsClient({
      fetchFn: (u, o) => window.fetch(u, o),
      getToken: () => window.SSAuth.getAccessToken(),
      invalidateToken: () => window.SSAuth.clearToken && window.SSAuth.clearToken(),
      appOrigin: window.location.origin,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  const DRIVE = 'https://www.googleapis.com/drive/v3/files';

  function createSheetsClient({ fetchFn, getToken, invalidateToken, appOrigin }) {
    let token = null;

    async function call(url, opts, _retried) {
      if (!token) token = await getToken();
      const headers = Object.assign({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, opts.headers || {});
      const res = await fetchFn(url, Object.assign({}, opts, { headers }));
      if (res.status === 401 && !_retried) {
        token = null;
        if (invalidateToken) { try { invalidateToken(); } catch (e) {} }
        token = await getToken();
        return call(url, opts, true);
      }
      if (!res.ok) {
        let body = '';
        try { body = (await res.text()).slice(0, 300); } catch (e) {}
        throw new Error('Google API ' + res.status + ' for ' + url + (body ? ' — ' + body : ''));
      }
      return res.json();
    }

    async function createSpreadsheet(title) {
      const body = { properties: { title }, sheets: [
        { properties: { title: '_meta' } }, { properties: { title: 'members' } },
        { properties: { title: 'events' } }, { properties: { title: 'rates' } },
      ] };
      const j = await call(SHEETS, { method: 'POST', body: JSON.stringify(body) });
      return j.spreadsheetId;
    }

    // Seed the header rows for each tab.
    async function initTabs(sheetId, meta, members) {
      const data = [
        { range: '_meta!A1', values: [['key', 'value'], ...Object.entries(meta)] },
        { range: 'members!A1', values: [['person_id', 'email', 'name', 'color', 'role', 'paypal'],
          ...members.map(m => [m.person_id, m.email || '', m.name, m.color, m.role || 'member', m.paypal || ''])] },
        { range: 'events!A1', values: [['seq', 'id', 'type', 'actor', 'ts', 'payload_json']] },
        { range: 'rates!A1', values: [['code', 'usd_rate', 'updated_at']] },
      ];
      return call(SHEETS + '/' + sheetId + '/values:batchUpdate',
        { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
    }

    function appendEvent(sheetId, row /* [seq,id,type,actor,ts,payload_json] */) {
      const url = SHEETS + '/' + sheetId + '/values/events!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
      return call(url, { method: 'POST', body: JSON.stringify({ values: [row] }) });
    }

    async function readEventsSince(sheetId, lastSeq) {
      const j = await call(SHEETS + '/' + sheetId + '/values/events!A2:F', { method: 'GET' });
      const rows = j.values || [];
      const out = [];
      for (const r of rows) {
        const seq = parseInt(r[0], 10);
        if (!seq || seq <= lastSeq) continue;
        let payload = {};
        try { payload = JSON.parse(r[5] || '{}'); } catch (e) { payload = {}; }
        out.push({ seq, id: r[1], type: r[2], actor: r[3], ts: parseInt(r[4], 10) || 0, payload });
      }
      return out;
    }

    async function readMembers(sheetId) {
      const j = await call(SHEETS + '/' + sheetId + '/values/members!A2:F', { method: 'GET' });
      return (j.values || []).map(r => ({ person_id: r[0], email: r[1], name: r[2], color: r[3], role: r[4], paypal: r[5] || undefined }));
    }

    async function readMeta(sheetId) {
      const j = await call(SHEETS + '/' + sheetId + '/values/_meta!A2:B', { method: 'GET' });
      const meta = {};
      for (const r of (j.values || [])) meta[r[0]] = r[1];
      return meta;
    }

    async function readRates(sheetId) {
      const j = await call(SHEETS + '/' + sheetId + '/values/rates!A2:B', { method: 'GET' });
      const out = {};
      for (const r of (j.values || [])) { const n = parseFloat(r[1]); if (r[0] && n) out[r[0]] = n; }
      return out;
    }

    function permissionsCreate(sheetId, email) {
      const url = DRIVE + '/' + sheetId + '/permissions?sendNotificationEmail=false';
      return call(url, { method: 'POST', body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }) });
    }

    async function permissionsList(sheetId) {
      const j = await call(DRIVE + '/' + sheetId + '/permissions?fields=permissions(emailAddress,role)', { method: 'GET' });
      return (j.permissions || []).map(p => (p.emailAddress || '').toLowerCase()).filter(Boolean);
    }

    // Deterministic "does this Sheet still exist?" — Drive files.get reports
    // trashed files too (Sheets API does not, reliably). Returns:
    //   true  → file exists and is not trashed
    //   false → file is gone (404) or trashed
    //   null  → couldn't tell (transient error) — caller should NOT prune
    async function fileExists(sheetId) {
      try {
        const j = await call(DRIVE + '/' + sheetId + '?fields=id,trashed', { method: 'GET' });
        return !!(j && j.id) && !j.trashed;
      } catch (e) {
        if (/\b(404|410)\b/.test(String(e && e.message))) return false;
        return null;
      }
    }

    // App-data index.json: { [groupId]: sheetId }
    async function readIndex() {
      const list = await call(DRIVE + '?spaces=appDataFolder&q=' + encodeURIComponent("name='index.json'") + '&fields=files(id)', { method: 'GET' });
      const file = (list.files || [])[0];
      if (!file) return { fileId: null, map: {} };
      const url = 'https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media';
      let map = {};
      try { map = await call(url, { method: 'GET' }); } catch (e) { map = {}; }
      return { fileId: file.id, map: map || {} };
    }

    async function writeIndex(fileId, map) {
      const meta = { name: 'index.json', parents: ['appDataFolder'], mimeType: 'application/json' };
      if (fileId) {
        const url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media';
        await call(url, { method: 'PATCH', body: JSON.stringify(map) });
        return fileId;
      }
      // multipart create
      const boundary = 'ssb' + '0000';
      const body =
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
        '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(map) +
        '\r\n--' + boundary + '--';
      const j = await call('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
      return j.id;
    }

    return { createSpreadsheet, initTabs, appendEvent, readEventsSince, readMembers, readMeta, readRates,
             permissionsCreate, permissionsList, fileExists, readIndex, writeIndex };
  }

  return { createSheetsClient };
});
