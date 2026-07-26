const RESOURCE_GROUPS = {
  enterprise: [
    { value: 'enterprises', label: '企业档案' },
    { value: 'parks', label: '园区档案' },
    { value: 'enterprise-tags', label: '企业标签' },
    { value: 'partners', label: '合作方' },
    { value: 'stores', label: '门店档案' },
  ],
  production: [
    { value: 'production-plans', label: '生产计划' },
    { value: 'production-orders', label: '生产订单' },
    { value: 'boms', label: '物料清单 BOM' },
  ],
  inventory: [
    { value: 'inventories', label: '企业库存' },
    { value: 'sales-order-lines', label: '销售订单明细' },
    { value: 'returns', label: '退货记录' },
    { value: 'freezer-records', label: '冻库记录' },
  ],
  transport: [
    { value: 'transport-task-summaries', label: '运输任务摘要' },
    { value: 'transport-resources', label: '运输资源' },
  ],
};

const state = {
  activeSection: 'overview',
  resource: {
    enterprise: 'enterprises',
    production: 'production-plans',
    inventory: 'inventories',
    transport: 'transport-task-summaries',
  },
  importBatchId: null,
};

function getAPI() {
  return window.API;
}

function dataOf(result) {
  return result && result.json ? result.json.data : null;
}

function errorOf(result) {
  const body = result && result.json;
  if (!body) return `请求失败（HTTP ${result ? result.status : '未知'}）`;
  const first = body.errors && body.errors[0];
  return first ? `${body.code || '请求失败'}：${first.message}` : `${body.code || '请求失败'}：${body.message || `HTTP ${result.status}`}`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeHtml(value) {
  return formatValue(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setMessage(message, type = 'info') {
  const el = document.getElementById('global-message');
  if (!el) return;
  el.textContent = message;
  el.className = `message ${type}`;
}

function setLoading(target, message = '加载中…') {
  const el = document.getElementById(target);
  if (el) el.innerHTML = `<div class="loading-state">${escapeHtml(message)}</div>`;
}

function renderTable(target, items, emptyMessage = '暂无数据') {
  const el = document.getElementById(target);
  if (!el) return;
  if (!Array.isArray(items) || !items.length) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  const keys = [...new Set(items.flatMap((item) => Object.keys(item)))];
  el.innerHTML = `<div class="table-scroll"><table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead><tbody>${items.map((item) => `<tr>${keys.map((key) => `<td>${escapeHtml(item[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function formatNumber(value, maximumFractionDigits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(number);
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (Math.abs(number) >= 10000) return `¥${(number / 10000).toFixed(2)}万`;
  return `¥${formatNumber(number)}`;
}

function formatShortDate(value, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatValue(value);
  const options = includeTime
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('zh-CN', options).format(date).replaceAll('/', '-');
}

function renderLineChart(target, items, labelKey, valueKey, gradientId) {
  const el = document.getElementById(target);
  if (!el) return;
  if (!Array.isArray(items) || items.length < 2) {
    el.innerHTML = '<div class="empty-state">暂无趋势数据</div>';
    return;
  }
  const values = items.map((item) => Number(item[valueKey]) || 0);
  const width = 450;
  const height = 180;
  const bottom = 150;
  const top = 12;
  const left = 16;
  const right = 12;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const lower = Math.max(0, min * 0.78);
  const range = Math.max(max * 1.08 - lower, 1);
  const points = items.map((item, index) => ({
    x: left + index * ((width - left - right) / Math.max(items.length - 1, 1)),
    y: bottom - ((Number(item[valueKey]) - lower) / range) * (bottom - top),
    label: formatShortDate(item[labelKey]),
    value: Number(item[valueKey]) || 0,
  }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${points.at(-1).x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z`;
  const sales = target.includes('sales');
  const color = sales ? '#e8bd62' : '#62dda0';
  const grid = [0, 1, 2, 3].map((index) => `<line class="chart-grid-line" x1="${left}" y1="${top + index * 46}" x2="${width - right}" y2="${top + index * 46}" />`).join('');
  const labels = points.map((point) => `<text class="chart-axis-label" x="${point.x}" y="170" text-anchor="middle">${escapeHtml(point.label)}</text>`).join('');
  const dots = points.map((point) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHtml(point.label)}：${escapeHtml(formatNumber(point.value))}</title></circle>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${sales ? '销售额' : '订单量'}趋势图"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".34"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" style="fill:url(#${gradientId})" d="${area}"/><path class="chart-line" d="${path}"/>${dots}${labels}</svg>`;
}

function renderCapacityList(items) {
  const el = document.getElementById('public-capacity');
  if (!el) return;
  const rows = (items || []).slice(0, 8);
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">暂无产能数据</div>';
    return;
  }
  const max = Math.max(...rows.map((item) => Number(item.capacity_remaining) || 0), 1);
  el.innerHTML = rows.map((item) => {
    const value = Number(item.capacity_remaining) || 0;
    const width = Math.max(5, Math.round(value / max * 100));
    return `<div class="capacity-item" title="${escapeHtml(item.enterprise_display_name)} · ${escapeHtml(item.category)} · ${escapeHtml(formatNumber(value))} ${escapeHtml(item.unit)}"><strong>${escapeHtml(item.enterprise_display_name)}</strong><span>${escapeHtml(item.category)}</span><div class="capacity-bar"><i style="width:${width}%"></i></div><span class="capacity-value">${escapeHtml(formatNumber(value))} ${escapeHtml(item.unit)}</span></div>`;
  }).join('');
}

function renderEnterpriseDonut(items) {
  const el = document.getElementById('public-enterprise-chart');
  if (!el) return;
  const rows = (items || []).slice(0, 10);
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">暂无企业订单数据</div>';
    return;
  }
  const colors = ['#59d69a', '#38b97f', '#87d68f', '#d4b85e', '#65b6ae', '#4d8fc3', '#9178c5', '#cc7f6f', '#8aa25c', '#5e7f73'];
  const total = rows.reduce((sum, item) => sum + Number(item.committed_order_quantity || 0), 0) || 1;
  let cursor = 0;
  const segments = rows.map((item, index) => {
    const start = cursor;
    cursor += Number(item.committed_order_quantity || 0) / total * 100;
    return `${colors[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  const legend = rows.map((item, index) => `<div title="${escapeHtml(item.enterprise_label)}：${escapeHtml(formatNumber(item.committed_order_quantity))}"><i style="--legend-color:${colors[index]}"></i><span>${escapeHtml(item.enterprise_label)}</span><strong>${escapeHtml((Number(item.committed_order_quantity || 0) / total * 100).toFixed(1))}%</strong></div>`).join('');
  el.innerHTML = `<div class="donut-visual" style="background:conic-gradient(${segments.join(',')})"><div class="donut-center"><strong>${escapeHtml(formatNumber(total))}</strong><span>订单总量 kg</span></div></div><div class="donut-legend">${legend}</div>`;
}

function renderPreorderList(items) {
  const el = document.getElementById('public-preorders');
  if (!el) return;
  const rows = [...(items || [])].sort((a, b) => String(a.required_start_at).localeCompare(String(b.required_start_at))).slice(0, 7);
  el.innerHTML = rows.map((item) => `<div class="preorder-item" title="${escapeHtml(item.partner_display_name)} · ${escapeHtml(item.category)} · ${escapeHtml(formatNumber(item.quantity))} ${escapeHtml(item.unit)}"><strong>${escapeHtml(item.partner_display_name)}</strong><span>${escapeHtml(item.category)}</span><b>${escapeHtml(formatNumber(item.quantity))} ${escapeHtml(item.unit)}</b><time>${escapeHtml(formatShortDate(item.required_start_at, true))}</time></div>`).join('') || '<div class="empty-state">暂无预订单</div>';
}

function renderTransportSummary(items) {
  const el = document.getElementById('public-transport');
  if (!el) return;
  const rows = items || [];
  const vehicles = rows.reduce((sum, item) => sum + Number(item.required_vehicle_count || 0), 0);
  const fee = rows.reduce((sum, item) => sum + Number(item.estimated_fee || 0), 0);
  const abnormal = rows.filter((item) => item.anomaly).length;
  el.innerHTML = `<div class="transport-stat"><strong>${escapeHtml(rows.length)}</strong><span>展示任务</span></div><div class="transport-stat"><strong>${escapeHtml(vehicles)}</strong><span>所需车辆</span></div><div class="transport-stat"><strong>${escapeHtml(formatMoney(fee))}</strong><span>预计费用</span></div><div class="transport-stat ${abnormal ? 'alert' : ''}"><strong>${escapeHtml(abnormal)}</strong><span>异常任务</span></div>`;
}

function renderPolicyFeed(items) {
  const el = document.getElementById('public-policies');
  if (!el) return;
  const rows = items || [];
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">暂无政策词条</div>';
    return;
  }
  const displayRows = rows.length > 4 ? [...rows, ...rows] : rows;
  el.innerHTML = displayRows.map((item) => `<a class="screen-policy-item" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(item.category)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.summary)} · ${escapeHtml(item.source_type || 'OFFICIAL')}</small></div></a>`).join('');
}

function renderRouteMap(items) {
  const el = document.getElementById('public-route-map');
  if (!el) return;
  const routes = (items || []).filter((item) => item.path_points && item.path_points.length).slice(0, 6);
  el.innerHTML = routes.map((route, index) => {
    const points = route.path_points.slice(0, 6).map((point) => `<span class="screen-route-point ${point.point_color === 'red' ? 'anomaly' : ''}" title="${escapeHtml(point.recorded_at)} · ${escapeHtml(point.anomaly_status)}"></span>`).join('');
    return `<div class="screen-route-line"><div class="route-task"><strong>${escapeHtml(route.task_id)}</strong><span>园区 → 配送节点 ${String(index + 1).padStart(2, '0')}</span></div><div class="screen-route-points">${points}</div><div class="route-meta"><strong>${escapeHtml(route.vehicle_type_name || route.vehicle_type_id)}</strong>${escapeHtml(route.required_vehicle_count)} 辆 · ${escapeHtml(formatMoney(route.estimated_fee))}</div><span class="route-state ${route.anomaly ? 'abnormal' : ''}">${route.anomaly ? '异常' : '正常'}</span></div>`;
  }).join('') || '<div class="empty-state">暂无运输轨迹</div>';
}

function applyPublicScreenScale() {
  const canvas = document.getElementById('public-screen-canvas');
  if (!canvas || !document.body.classList.contains('screen-mode')) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function updatePublicClock() {
  const now = new Date();
  const clock = document.getElementById('public-clock');
  const date = document.getElementById('public-date');
  if (clock) clock.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
  if (date) date.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
}

async function togglePublicFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    const stateEl = document.getElementById('public-sync-state');
    if (stateEl) stateEl.textContent = `全屏切换失败：${error.message}`;
  }
}

function setupOverviewDetails() {
  const popover = document.getElementById('overview-detail-popover');
  document.querySelectorAll('.detail-card').forEach((card) => {
    const show = () => {
      if (!popover) return;
      popover.textContent = card.dataset.detail || '';
      popover.hidden = false;
    };
    card.addEventListener('mouseenter', show);
    card.addEventListener('focus', show);
    card.addEventListener('click', show);
    card.addEventListener('mouseleave', () => { if (popover) popover.hidden = true; });
    card.addEventListener('blur', () => { if (popover) popover.hidden = true; });
  });
}

function renderAuthState(user) {
  const stateEl = document.getElementById('auth-state');
  const loginButton = document.getElementById('open-login');
  const logoutButton = document.getElementById('logout-button');
  if (user) {
    stateEl.textContent = `${user.username} · ${user.role}`;
    loginButton.hidden = true;
    logoutButton.hidden = false;
  } else {
    stateEl.textContent = getAPI().isMock() ? 'Mock E01 会话' : '未登录';
    loginButton.hidden = false;
    logoutButton.hidden = true;
  }
}

function requireAuth(result) {
  if (result && result.status === 401 && !getAPI().isMock()) {
    document.getElementById('auth-panel').hidden = false;
    setMessage('E01 接口需要登录，请先输入后端账号。', 'warning');
    return true;
  }
  return false;
}

async function loadOverview() {
  setLoading('overview-body');
  const result = await getAPI().getDashboard('overview');
  if (!result.ok) {
    requireAuth(result);
    setMessage(errorOf(result), 'error');
    return;
  }
  const data = dataOf(result) || {};
  const cards = {
    'kpi-enterprise-count': data.enterprise_count,
    'kpi-production-count': data.production_plan_count,
    'kpi-inventory-count': data.inventory_record_count,
    'kpi-preorder-count': data.preorder_count,
    'kpi-transport-count': data.transport_task_count,
    'kpi-freezer-count': data.freezer_count,
  };
  Object.entries(cards).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatValue(value);
  });
  const cutoff = result.json && result.json.data_cutoff;
  document.getElementById('data-cutoff').textContent = formatValue(cutoff);
  renderTable('overview-enterprise-details', data.details || [], '暂无企业明细');
  document.getElementById('overview-body').textContent = `E01 总览已同步：预计订单 ${formatValue(data.expected_order_quantity)}，已承担订单 ${formatValue(data.committed_order_quantity)}，销售额 ${formatValue(data.sales_amount_total)}；当前未处理库存预警 ${formatValue(data.inventory_alert_count)}。`;
  setMessage('E01 总览加载完成。', 'success');
}

async function loadResource(section) {
  const resource = state.resource[section];
  const resultTarget = `${section}-table`;
  setLoading(resultTarget);
  const result = await getAPI().list(resource);
  if (!result.ok) {
    requireAuth(result);
    setMessage(errorOf(result), 'error');
    return;
  }
  const data = dataOf(result) || {};
  renderTable(resultTarget, data.items || []);
  const total = document.getElementById(`${section}-total`);
  if (total) total.textContent = `${data.total || 0} 条记录`;
  if (section === 'inventory') {
    const alerts = (data.items || []).filter((item) => item.inventory_alert_status);
    document.getElementById('inventory-alerts').textContent = alerts.length ? `当前列表有 ${alerts.length} 条库存预警，状态：${alerts.map((item) => item.inventory_alert_status).join('、')}。` : '当前列表暂无已生成库存预警；阈值申请需企业提交并由园区审批。';
  }
  if (section === 'transport') {
    const monitored = (data.items || []).filter((item) => item.telemetry && item.telemetry.length);
    document.getElementById('transport-monitoring').textContent = monitored.length ? `当前有 ${monitored.length} 条运输任务带遥测记录，异常点将在 E02 以红色展示。` : '当前没有遥测记录；可先用 DEMO_SIMULATION 数据演示路径和温湿度异常。';
  }
}

async function loadPublicDashboard() {
  ['public-capacity', 'public-preorders', 'public-transport', 'public-order-chart', 'public-sales-chart', 'public-enterprise-chart', 'public-route-map', 'public-policies'].forEach((target) => setLoading(target));
  const syncState = document.getElementById('public-sync-state');
  if (syncState) syncState.textContent = '正在同步公开数据…';
  const [overview, capacity, preorders, transport, policies] = await Promise.all([
    getAPI().getPublicDashboard('overview'),
    getAPI().getPublicDashboard('capacity'),
    getAPI().getPublicDashboard('preorders'),
    getAPI().getPublicDashboard('transport'),
    getAPI().getPublicDashboard('policies'),
  ]);
  if (!overview.ok || !capacity.ok || !preorders.ok || !transport.ok || !policies.ok) {
    const message = errorOf([overview, capacity, preorders, transport, policies].find((item) => !item.ok));
    if (syncState) syncState.textContent = `同步失败：${message}`;
    setMessage(message, 'error');
    return;
  }
  const summary = dataOf(overview) || {};
  const transportItems = dataOf(transport) || [];
  const transportTotal = Object.values(summary.transport_task_counts || {}).reduce((sum, item) => sum + Number(item || 0), 0);
  const abnormalCount = transportItems.filter((item) => item.anomaly).length;
  const orderTrend = summary.order_trend || [];
  const salesTrend = summary.sales_trend || [];
  document.getElementById('public-enterprise-count').textContent = formatNumber(summary.enterprise_count);
  document.getElementById('public-capacity-total').textContent = `${formatNumber(summary.capacity_remaining_total)} ${formatValue(summary.capacity_unit)}`;
  document.getElementById('public-preorder-total').textContent = `${formatNumber(summary.preorder_quantity_total)} ${formatValue(summary.preorder_unit)}`;
  document.getElementById('public-transport-total').textContent = formatNumber(transportTotal || transportItems.length);
  document.getElementById('public-order-total').textContent = `${formatNumber(summary.committed_order_quantity_total)} kg`;
  document.getElementById('public-sales-total').textContent = formatMoney(summary.sales_amount_total);
  document.getElementById('public-transport-kpi-note').textContent = abnormalCount ? `${abnormalCount} 条异常路径` : '全部运行正常';
  document.getElementById('public-order-peak').textContent = orderTrend.length ? `峰值 ${formatNumber(Math.max(...orderTrend.map((item) => Number(item.quantity) || 0)))} kg` : '—';
  document.getElementById('public-sales-peak').textContent = salesTrend.length ? `峰值 ${formatMoney(Math.max(...salesTrend.map((item) => Number(item.amount) || 0)))}` : '—';
  document.getElementById('public-trend-range').textContent = `近 ${formatNumber(summary.trend_days || orderTrend.length)} 日`;
  document.getElementById('public-data-cutoff').textContent = formatValue(overview.json && overview.json.data_cutoff);
  renderCapacityList(dataOf(capacity) || []);
  renderPreorderList(dataOf(preorders) || []);
  renderTransportSummary(transportItems);
  renderLineChart('public-order-chart', orderTrend, 'date', 'quantity', 'orderArea');
  renderLineChart('public-sales-chart', salesTrend, 'date', 'amount', 'salesArea');
  renderEnterpriseDonut(summary.enterprise_order_pie || []);
  renderPolicyFeed(dataOf(policies) || []);
  renderRouteMap(transportItems);
  if (syncState) syncState.textContent = '数据同步正常';
  setMessage('E02 公开大屏已同步；仅展示公开白名单字段。', 'success');
}

async function loadCalculation() {
  const kind = document.getElementById('calc-kind').value;
  const resultEl = document.getElementById('calculation-result');
  resultEl.textContent = '计算中…';
  let body = {};
  if (kind === 'routes/estimate') {
    body = {
      origin: document.getElementById('calc-origin').value.trim(),
      destination: document.getElementById('calc-destination').value.trim(),
    };
  }
  const result = await getAPI().calculate(kind, body);
  if (!result.ok) {
    requireAuth(result);
    resultEl.textContent = errorOf(result);
    setMessage(errorOf(result), 'error');
    return;
  }
  resultEl.textContent = JSON.stringify(dataOf(result), null, 2);
  setMessage('B01 计算接口已返回结果；请按 calculation_status 处理缺失输入或规则。', 'success');
}

async function handleImport(event) {
  event.preventDefault();
  const file = document.getElementById('import-file').files[0];
  if (!file) {
    setMessage('请先选择 XLSX 文件。', 'warning');
    return;
  }
  document.getElementById('import-result').textContent = '正在预检整本工作簿…';
  const result = await getAPI().precheckImport(file);
  if (!result.ok) {
    requireAuth(result);
    document.getElementById('import-result').textContent = errorOf(result);
    setMessage(errorOf(result), 'error');
    return;
  }
  const data = dataOf(result) || {};
  state.importBatchId = data.batch_id || null;
  document.getElementById('import-result').textContent = JSON.stringify(data, null, 2);
  document.getElementById('confirm-import').hidden = data.status !== 'READY_TO_CONFIRM';
  setMessage(data.status === 'READY_TO_CONFIRM' ? '预检通过，请确认后整本写入。' : '预检已返回，请查看结果。', 'success');
}

async function confirmImport() {
  if (!state.importBatchId) return;
  const result = await getAPI().confirmImport(state.importBatchId);
  if (!result.ok) {
    requireAuth(result);
    setMessage(errorOf(result), 'error');
    return;
  }
  document.getElementById('import-result').textContent = JSON.stringify(dataOf(result), null, 2);
  document.getElementById('confirm-import').hidden = true;
  setMessage('导入批次已提交；后端按整本事务处理。', 'success');
}

function setupResourceSelects() {
  Object.entries(RESOURCE_GROUPS).forEach(([section, resources]) => {
    const select = document.getElementById(`${section}-resource`);
    resources.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
    select.value = state.resource[section];
    select.addEventListener('change', async () => {
      state.resource[section] = select.value;
      await loadResource(section);
    });
    document.getElementById(`${section}-refresh`).addEventListener('click', () => loadResource(section));
  });
}

function showSection(section) {
  state.activeSection = section;
  const isPublic = section === 'public';
  document.body.classList.toggle('screen-mode', isPublic);
  document.querySelectorAll('.page-section').forEach((item) => item.classList.toggle('active', item.id === section));
  document.querySelectorAll('.sidebar button[data-section]').forEach((item) => item.classList.toggle('active', item.dataset.section === section));
  const titles = { overview: 'E01 管理总览', enterprise: '主数据与企业', production: '生产计划与订单', inventory: '库存、销售与冻库', transport: '运输任务与资源', import: 'B01 批量导入', analytics: 'B01 计算与建议', public: 'E02 公开大屏' };
  document.getElementById('page-title').textContent = titles[section] || '黑土闭环';
  if (section === 'overview') loadOverview();
  if (RESOURCE_GROUPS[section]) loadResource(section);
  if (isPublic) {
    updatePublicClock();
    requestAnimationFrame(applyPublicScreenScale);
    loadPublicDashboard();
  } else {
    window.scrollTo({ top: 0, left: 0 });
  }
}

async function exitPublicScreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  showSection('overview');
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const result = await getAPI().login(username, password);
  if (!result.ok) {
    document.getElementById('login-message').textContent = errorOf(result);
    return;
  }
  const me = await getAPI().getCurrentUser();
  renderAuthState(dataOf(me) || { username, role: 'E01' });
  document.getElementById('auth-panel').hidden = true;
  setMessage('E01 登录成功。', 'success');
  showSection(state.activeSection);
}

async function handleLogout() {
  await getAPI().logout();
  renderAuthState(null);
  document.getElementById('auth-panel').hidden = false;
  setMessage('已退出 E01 会话；E02 公开大屏仍可访问。', 'info');
}

function initPage() {
  const mockToggle = document.getElementById('toggle-mock');
  mockToggle.checked = getAPI().isMock();
  mockToggle.addEventListener('change', () => {
    localStorage.setItem('useMock', mockToggle.checked ? 'true' : 'false');
    getAPI().clearTokens();
    renderAuthState(null);
    setMessage(mockToggle.checked ? '已切换到本地 Mock 数据。' : `已切换到 Live：${getAPI().getLiveBase()}`, 'info');
    showSection(state.activeSection);
  });

  document.querySelectorAll('.sidebar button[data-section]').forEach((button) => button.addEventListener('click', () => showSection(button.dataset.section)));
  document.getElementById('open-login').addEventListener('click', () => { document.getElementById('auth-panel').hidden = false; });
  document.getElementById('close-login').addEventListener('click', () => { document.getElementById('auth-panel').hidden = true; });
  document.getElementById('logout-button').addEventListener('click', handleLogout);
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('import-form').addEventListener('submit', handleImport);
  document.getElementById('confirm-import').addEventListener('click', confirmImport);
  document.getElementById('calc-kind').addEventListener('change', () => {
    const isRoute = document.getElementById('calc-kind').value === 'routes/estimate';
    document.getElementById('route-fields').hidden = !isRoute;
    document.getElementById('route-fields-destination').hidden = !isRoute;
  });
  document.getElementById('run-calculation').addEventListener('click', loadCalculation);
  document.getElementById('public-refresh').addEventListener('click', loadPublicDashboard);
  document.getElementById('public-fullscreen').addEventListener('click', togglePublicFullscreen);
  document.getElementById('public-exit').addEventListener('click', exitPublicScreen);
  window.addEventListener('resize', applyPublicScreenScale);
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('public-fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
    applyPublicScreenScale();
  });
  updatePublicClock();
  window.setInterval(updatePublicClock, 1000);
  setupResourceSelects();
  setupOverviewDetails();
  renderAuthState(null);
  showSection('overview');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage);
else initPage();
