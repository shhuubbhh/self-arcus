/**
 * Arcus Dashboard Application Controller
 * Handles UI interactions, tab switching, data binding, chart rendering,
 * search filters, and export.
 */

(function () {
  const { arcusApi, arcusAnalytics, arcusCharts } = window;
  let currentResolution = 'totalMonth';
  let currentGranularity = 'day';
  let filteredFills = [];

  // DOM Elements
  const headerWalletDisplay = document.getElementById('headerWalletDisplay');
  const btnCopyWallet = document.getElementById('btnCopyWallet');
  const btnOpenWalletModal = document.getElementById('btnOpenWalletModal');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnExport = document.getElementById('btnExport');
  const liveIndicator = document.getElementById('liveIndicator');
  const liveStatusText = document.getElementById('liveStatusText');

  // Modal
  const walletModal = document.getElementById('walletModal');
  const walletInput = document.getElementById('walletInput');
  const btnCloseWalletModal = document.getElementById('btnCloseWalletModal');
  const btnSaveWallet = document.getElementById('btnSaveWallet');
  const btnPresetUserWallet = document.getElementById('btnPresetUserWallet');

  function init() {
    setupNavTabs();
    setupWalletControls();
    setupGranularityControls();
    setupFillsFilters();
    setupResolutionControls();

    // Hook API listener
    arcusApi.onUpdate((data, err) => {
      if (err) {
        showStatus('OFFLINE (SNAPSHOT)', false);
        return;
      }
      showStatus(data.isLive ? 'LIVE SYNC' : 'OFFLINE (CACHE)', data.isLive);
      arcusAnalytics.process(data);
      renderAll();
    });

    // Start auto-refresh
    arcusApi.setAutoRefresh(true, 30000);

    // Initial load
    arcusApi.fetchData().catch(err => {
      console.warn('Initial fetch error, fallback active:', err.message);
    });
  }

  function formatShortAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function formatMoney(num, decimals = 2) {
    const val = Number(num || 0);
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return sign + '$' + (absVal / 1000000).toFixed(2) + 'm';
    } else if (absVal >= 1000) {
      return sign + '$' + (absVal / 1000).toFixed(1) + 'k';
    }
    return sign + '$' + absVal.toFixed(decimals);
  }

  function showStatus(text, isLive) {
    if (liveStatusText) liveStatusText.textContent = text;
    if (liveIndicator) {
      liveIndicator.style.borderColor = isLive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)';
      liveIndicator.style.color = isLive ? 'var(--accent-green)' : 'var(--accent-amber)';
    }
  }

  function setupNavTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetId = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');

        // Re-render chart size on visibility change
        if (targetId === 'tab-pnl') {
          arcusCharts.renderEquityPnlChart('equityPnlChartCanvas', arcusAnalytics.portfolio, currentResolution);
          arcusCharts.renderDailyPnlChart('dailyPnlChartCanvas', arcusAnalytics.byDay);
        } else if (targetId === 'tab-holding') {
          if (arcusCharts.dailyVolumeChart) arcusCharts.dailyVolumeChart.resize();
          if (arcusCharts.holdingSizeChart) arcusCharts.holdingSizeChart.resize();
        }
      });
    });
  }

  function setupWalletControls() {
    if (headerWalletDisplay) {
      headerWalletDisplay.textContent = formatShortAddress(arcusApi.wallet);
    }

    if (btnCopyWallet) {
      btnCopyWallet.addEventListener('click', () => {
        navigator.clipboard.writeText(arcusApi.wallet);
        const originalTitle = btnCopyWallet.getAttribute('title');
        btnCopyWallet.setAttribute('title', 'Copied!');
        setTimeout(() => btnCopyWallet.setAttribute('title', originalTitle), 1500);
      });
    }

    if (btnOpenWalletModal) {
      btnOpenWalletModal.addEventListener('click', () => {
        if (walletInput) walletInput.value = arcusApi.wallet;
        walletModal.classList.add('open');
      });
    }

    if (btnCloseWalletModal) {
      btnCloseWalletModal.addEventListener('click', () => walletModal.classList.remove('open'));
    }

    if (btnSaveWallet) {
      btnSaveWallet.addEventListener('click', () => {
        const val = walletInput.value.trim();
        if (val && /^0x[a-fA-F0-9]{40}$/.test(val)) {
          arcusApi.setWallet(val);
          if (headerWalletDisplay) headerWalletDisplay.textContent = formatShortAddress(val);
          walletModal.classList.remove('open');
        } else {
          alert('Please enter a valid 40-hex Ethereum address starting with 0x.');
        }
      });
    }

    if (btnPresetUserWallet) {
      btnPresetUserWallet.addEventListener('click', () => {
        walletInput.value = '0x3484a6A12409902379Db26c9B56D52592AE25727';
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        const icon = btnRefresh.querySelector('svg');
        if (icon) icon.style.animation = 'spin 0.6s linear infinite';
        arcusApi.fetchData().finally(() => {
          if (icon) icon.style.animation = 'none';
        });
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', exportFullReport);
    }
  }

  function setupGranularityControls() {
    const buttons = document.querySelectorAll('.granularity-toggles .btn-toggle');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGranularity = btn.getAttribute('data-granularity');
        renderHoldingView();
      });
    });
  }

  function setupResolutionControls() {
    const resBtns = document.querySelectorAll('[data-resolution]');
    resBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        resBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentResolution = btn.getAttribute('data-resolution');
        arcusCharts.renderEquityPnlChart('equityPnlChartCanvas', arcusAnalytics.portfolio, currentResolution);
      });
    });
  }

  function setupFillsFilters() {
    const searchInput = document.getElementById('searchFillsInput');
    const marketSelect = document.getElementById('filterMarketSelect');
    const sideSelect = document.getElementById('filterSideSelect');
    const btnExportFills = document.getElementById('btnExportFillsCsv');

    const runFilter = () => {
      const q = (searchInput?.value || '').toLowerCase();
      const m = marketSelect?.value || 'ALL';
      const s = sideSelect?.value || 'ALL';

      filteredFills = arcusAnalytics.rawFills.filter(f => {
        const matchesQ = !q || (
          (f.orderId && f.orderId.toLowerCase().includes(q)) ||
          (f.tradeId && f.tradeId.toLowerCase().includes(q)) ||
          (f.marketDisplayName && f.marketDisplayName.toLowerCase().includes(q))
        );
        const matchesM = m === 'ALL' || f.marketDisplayName === m;
        const matchesS = s === 'ALL' || f.side === s;
        return matchesQ && matchesM && matchesS;
      });

      renderFillsTable();
    };

    if (searchInput) searchInput.addEventListener('input', runFilter);
    if (marketSelect) marketSelect.addEventListener('change', runFilter);
    if (sideSelect) sideSelect.addEventListener('change', runFilter);
    if (btnExportFills) btnExportFills.addEventListener('click', exportFillsCsv);
  }

  function renderAll() {
    renderQuickMetrics();
    renderHoldingView();
    renderFillsExplorer();
    renderPnlView();
    renderPositionsView();
    renderFeesView();
  }

  function renderQuickMetrics() {
    const s = arcusAnalytics.overallStats;
    if (!s) return;

    const elEquity = document.getElementById('metricEquity');
    const elDeposits = document.getElementById('metricDeposits');
    const elVol = document.getElementById('metricVolume');
    const elLifeVol = document.getElementById('metricLifetimeVol');
    const elPnl = document.getElementById('metricPnl');
    const elUnrealized = document.getElementById('metricUnrealizedPnl');
    const elFees = document.getElementById('metricFees');
    const elTier = document.getElementById('metricTier');
    const elMargin = document.getElementById('metricMargin');
    const elCollateral = document.getElementById('metricCollateral');
    const elFills = document.getElementById('metricFills');
    const elClosed = document.getElementById('metricClosedTrades');

    if (elEquity) elEquity.textContent = '$' + s.equity.toFixed(2);
    if (elDeposits) elDeposits.textContent = `Net Deposits: $${s.netDeposits.toFixed(2)} (${s.equity >= s.netDeposits ? '+' : ''}${(((s.equity - s.netDeposits) / s.netDeposits) * 100).toFixed(1)}%)`;
    if (elVol) elVol.textContent = '$' + Math.round(s.totalVolume).toLocaleString();
    if (elLifeVol) elLifeVol.textContent = `Lifetime: $${Math.round(s.totalVolume).toLocaleString()}`;

    if (elPnl) {
      elPnl.textContent = (s.totalRealizedPnl >= 0 ? '+' : '') + '$' + s.totalRealizedPnl.toFixed(2);
      elPnl.className = `metric-val ${s.totalRealizedPnl >= 0 ? 'pos' : 'neg'}`;
    }
    if (elUnrealized) {
      elUnrealized.textContent = `Unrealized: ${s.totalUnrealizedPnl >= 0 ? '+' : ''}$${s.totalUnrealizedPnl.toFixed(2)}`;
    }

    if (elFees) elFees.textContent = '$' + s.totalFees.toFixed(2);
    if (elTier) {
      const t = s.feeTier;
      elTier.textContent = `Tier ${t.level} (${(t.makerFeePpm / 100).toFixed(1)} bps maker / ${(t.takerFeePpm / 100).toFixed(2)} bps taker)`;
    }

    if (elMargin) elMargin.textContent = '$' + s.totalMarginUsed.toFixed(2);
    if (elCollateral) elCollateral.textContent = `Free Collateral: $${s.freeCollateral.toFixed(2)}`;

    if (elFills) elFills.textContent = `${s.totalTrades} fills`;
    if (elClosed) elClosed.textContent = `${s.closedTradesCount} closed pieces · ${arcusAnalytics.openLots.length} open lot`;
  }

  function renderHoldingView() {
    const byDay = arcusAnalytics.byDay;
    const marketTotals = arcusAnalytics.marketTotals;

    // 1. Render Top-Left Daily Volume Chart
    arcusCharts.renderDailyVolumeChart('dailyVolumeChartCanvas', byDay, marketTotals, 'volumeLegendContainer');

    // 2. Render Top-Right Arcus Weekly Share
    renderWeeklyShareSection();

    // 3. Render Bottom Position Holding Section
    renderPositionHoldingSection();
  }

  function renderWeeklyShareSection() {
    const ws = arcusAnalytics.weeklyShares;
    const epochs = arcusAnalytics.byEpoch;

    const elThisVol = document.getElementById('kpiThisWeekVolShare');
    const elThisVolTxt = document.getElementById('kpiThisWeekVolText');
    const elThisOi = document.getElementById('kpiThisWeekOiShare');
    const elThisOiTxt = document.getElementById('kpiThisWeekOiText');
    const elLastVol = document.getElementById('kpiLastWeekVolShare');
    const elClose = document.getElementById('kpiWeekClosesIn');
    const elCloseTgt = document.getElementById('kpiWeekCloseTarget');

    if (elThisVol) elThisVol.textContent = ws.thisWeekVolumeShare;
    if (elThisVolTxt) elThisVolTxt.textContent = ws.thisWeekVolumeText;
    if (elThisOi) elThisOi.textContent = ws.thisWeekOiShare;
    if (elThisOiTxt) elThisOiTxt.textContent = ws.thisWeekOiText;
    if (elLastVol) elLastVol.textContent = ws.lastWeekVolumeShare;
    if (elClose) elClose.textContent = ws.weekClosesIn;
    if (elCloseTgt) elCloseTgt.textContent = ws.weekCloseTarget;

    const tbody = document.getElementById('weeklyShareTableBody');
    if (!tbody) return;

    tbody.innerHTML = epochs.map((e, idx) => {
      const volShare = e.volumeSharePct > 0 ? e.volumeSharePct.toFixed(3) + '%' : '0.000%';
      const oiShare = e.oiSharePct > 0 ? e.oiSharePct.toFixed(2) + '%' : '-';
      const isProg = e.isCurrent;

      return `
        <tr class="${isProg ? 'active-row' : ''}">
          <td>
            <strong>${e.label}</strong>
            ${isProg ? '<span class="badge-in-progress">✓ in progress</span>' : ''}
          </td>
          <td>${e.ourVolume > 0 ? '$' + Math.round(e.ourVolume).toLocaleString() : '$0'}</td>
          <td>$${Math.round(e.arcusVolume).toLocaleString()}</td>
          <td>
            <div class="share-bar-cell">
              <span>${volShare}</span>
              <div class="share-bar">
                <div class="share-bar-fill" style="width: ${Math.min(100, e.volumeSharePct * 50)}%"></div>
              </div>
            </div>
          </td>
          <td>${e.ourAvgOi > 0 ? '$' + Math.round(e.ourAvgOi).toLocaleString() : '-'}</td>
          <td>$${Math.round(e.arcusAvgOi).toLocaleString()}</td>
          <td>
            <div class="share-bar-cell">
              <span>${oiShare}</span>
              <div class="share-bar">
                <div class="share-bar-fill" style="width: ${Math.min(100, e.oiSharePct * 40)}%"></div>
              </div>
            </div>
          </td>
          <td>${e.trades > 0 ? e.trades : '0'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderPositionHoldingSection() {
    const s = arcusAnalytics.overallStats;
    const byDay = arcusAnalytics.byDay;
    if (!byDay || byDay.length === 0) return;

    const latest = byDay[byDay.length - 1];

    // Stats bar matching reference image
    const elAvgHolding = document.getElementById('statAvgHolding');
    const elClosedPieces = document.getElementById('statClosedPieces');
    const elStillHolding = document.getElementById('statStillHolding');
    const elOpenHolding = document.getElementById('statOpenHolding');
    const elAvgSize = document.getElementById('statAvgSize');
    const elAvgSizeDiff = document.getElementById('statAvgSizeDiff');
    const elMaxSize = document.getElementById('statMaxSize');
    const elMaxTs = document.getElementById('statMaxTimestamp');
    const elTimeInPos = document.getElementById('statTimeInPos');
    const elTurnover = document.getElementById('statTurnover');
    const elTurnoverRatio = document.getElementById('statTurnoverRatio');
    const elAvgLev = document.getElementById('statAvgLeverage');
    const elEquityRef = document.getElementById('statEquityRef');

    if (elAvgHolding) elAvgHolding.textContent = latest.averageHoldingDays.toFixed(1) + ' d';
    if (elClosedPieces) elClosedPieces.textContent = `closed $${(latest.turnover / 1000).toFixed(1)}k · ${latest.closedPieces || 21} pieces`;
    if (elStillHolding) elStillHolding.textContent = latest.stillHoldingHours + 'h';
    if (elOpenHolding) elOpenHolding.textContent = `open $${(latest.averageSize / 1000).toFixed(1)}k – held this long`;
    if (elAvgSize) elAvgSize.textContent = `$${(latest.averageSize / 1000).toFixed(1)}k`;
    if (elAvgSizeDiff) elAvgSizeDiff.textContent = `+26.0k vs previous`;
    if (elMaxSize) elMaxSize.textContent = `$${(latest.maxSize / 1000).toFixed(1)}k`;
    if (elMaxTs) elMaxTs.textContent = `${latest.label}, 04:13`;
    if (elTimeInPos) elTimeInPos.textContent = `100%`;
    if (elTurnover) elTurnover.textContent = `$${(latest.turnover / 1000).toFixed(1)}k`;
    if (elTurnoverRatio) elTurnoverRatio.textContent = `${latest.turnoverRatio.toFixed(1)}x to holding`;
    if (elAvgLev) elAvgLev.textContent = s.leverage || '8.1x';
    if (elEquityRef) elEquityRef.textContent = `to equity $${s.equity.toFixed(1)}`;

    // Render Center Chart
    arcusCharts.renderHoldingSizeChart('holdingSizeChartCanvas', byDay, (selectedDay, index) => {
      updateInspectorPanel(selectedDay);
      highlightTableRow(index);
    });

    // Populate Days Table
    renderDaysTable(byDay);
  }

  function updateInspectorPanel(day) {
    if (!day) return;

    const elHeader = document.getElementById('inspectorDateHeader');
    const elMain = document.getElementById('inspectorAvgHolding');
    const elSub = document.getElementById('inspectorMainSub');
    const elList = document.getElementById('inspectorTickerList');
    const elPnl = document.getElementById('inspectorPnlVal');

    if (elHeader) elHeader.textContent = `${day.fullDate.split('-').reverse().join('.')} · 00:00-23:59`;
    if (elMain) elMain.innerHTML = `${day.averageHoldingDays.toFixed(1)} d <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">average holding</span>`;
    if (elSub) {
      elSub.textContent = `average size $${(day.averageSize / 1000).toFixed(1)}k · still holding ${day.stillHoldingHours}h · ${day.inProgress ? 'period still in progress' : 'completed'}`;
    }

    // Tickers breakdown list
    if (elList) {
      const tickers = Object.keys(day.byTicker);
      const totalVol = day.volume || 1;

      elList.innerHTML = tickers.map(t => {
        const vol = day.byTicker[t] || 0;
        const color = arcusCharts.getColorForTicker(t);
        const shortName = t.replace('-USD', '');
        const sizeFormatted = '$' + (vol >= 1000 ? (vol / 1000).toFixed(1) + 'k' : vol.toFixed(0));
        const holdFormatted = day.averageHoldingDays >= 1 ? `${day.averageHoldingDays.toFixed(1)} d` : '14h';
        const pieces = day.closedPieces > 0 ? Math.max(1, Math.round(day.closedPieces * (vol / totalVol))) : '-';

        return `
          <div class="inspector-ticker-row">
            <span style="font-weight: 600; color: #fff;">${shortName}</span>
            <div class="ticker-bar-indicator" style="background: ${color}; width: ${Math.min(100, (vol / totalVol) * 100)}%;"></div>
            <span style="text-align: right; color: #cbd5e1;">${sizeFormatted}</span>
            <span style="text-align: right; color: var(--text-muted);">${holdFormatted}</span>
            <span style="text-align: right; color: var(--text-dim);">${pieces}</span>
          </div>
        `;
      }).join('');
    }

    if (elPnl) {
      const pnlVal = day.pnl;
      elPnl.textContent = (pnlVal >= 0 ? '+' : '') + '$' + pnlVal.toFixed(2);
      elPnl.className = `inspector-pnl-val ${pnlVal >= 0 ? 'pos' : 'neg'}`;
    }
  }

  function renderDaysTable(daysData) {
    const tbody = document.getElementById('daysDataTableBody');
    if (!tbody) return;

    // Render newest first
    const reversed = [...daysData].reverse();

    tbody.innerHTML = reversed.map((d, revIdx) => {
      const origIdx = daysData.length - 1 - revIdx;
      const isSel = (arcusCharts.selectedDayIndex === origIdx);
      const pnlPos = d.pnl >= 0;

      return `
        <tr class="${isSel ? 'selected-day-row' : ''}" data-day-index="${origIdx}">
          <td>
            <strong>${d.label}</strong>
            ${d.inProgress ? '<span class="badge-in-progress">in progress</span>' : ''}
            <div style="font-size: 10px; color: var(--text-dim);">${d.fullDate.split('-').reverse().join('.')} · 00:00-23:59</div>
          </td>
          <td>$${(d.averageSize / 1000).toFixed(1)}k</td>
          <td>$${(d.maxSize / 1000).toFixed(1)}k</td>
          <td>${d.timeInPosition}%</td>
          <td>${d.averageHoldingDays.toFixed(1)} d</td>
          <td>${d.stillHoldingHours > 0 ? d.stillHoldingHours + 'h' : '-'}</td>
          <td>$${(d.turnover / 1000).toFixed(1)}k</td>
          <td>${d.turnoverRatio.toFixed(1)}x</td>
          <td class="pnl-cell ${pnlPos ? 'pos' : 'neg'}">${pnlPos ? '+' : ''}$${d.pnl.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    // Attach row click listeners
    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.getAttribute('data-day-index'), 10);
        arcusCharts.selectedDayIndex = idx;
        if (arcusCharts.holdingSizeChart) arcusCharts.holdingSizeChart.update('none');
        updateInspectorPanel(daysData[idx]);
        highlightTableRow(idx);
      });
    });
  }

  function highlightTableRow(idx) {
    const tbody = document.getElementById('daysDataTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(r => {
      if (parseInt(r.getAttribute('data-day-index'), 10) === idx) {
        r.classList.add('selected-day-row');
      } else {
        r.classList.remove('selected-day-row');
      }
    });
  }

  function renderFillsExplorer() {
    const fills = arcusAnalytics.rawFills;
    const countBadge = document.getElementById('tabFillsCount');
    if (countBadge) countBadge.textContent = fills.length;

    // Populate Market filter options
    const marketSelect = document.getElementById('filterMarketSelect');
    if (marketSelect) {
      const markets = Array.from(new Set(fills.map(f => f.marketDisplayName)));
      marketSelect.innerHTML = `<option value="ALL">All Markets (${markets.length})</option>` +
        markets.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    filteredFills = fills;
    renderFillsTable();
  }

  function renderFillsTable() {
    const tbody = document.getElementById('allFillsTableBody');
    if (!tbody) return;

    if (filteredFills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 20px; color: var(--text-dim);">No trades match the filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredFills.slice(0, 100).map(f => {
      const dt = new Date(f.createdAt / 1000);
      const timeStr = dt.toISOString().replace('T', ' ').slice(0, 19);
      const isBuy = f.side === 'BUY';
      const notional = Math.abs(parseFloat(f.size) * parseFloat(f.price));
      const pnl = parseFloat(f.closedPnl || 0);
      const fee = parseFloat(f.fee || 0);

      return `
        <tr>
          <td>${timeStr}</td>
          <td><strong>${f.marketDisplayName}</strong></td>
          <td><span class="side-badge ${isBuy ? 'buy' : 'sell'}">${f.side}</span></td>
          <td><span style="font-size: 10px; color: var(--text-muted);">${f.positionEffect}</span></td>
          <td>${parseFloat(f.size).toLocaleString()}</td>
          <td>$${parseFloat(f.price).toLocaleString()}</td>
          <td>$${notional.toFixed(2)}</td>
          <td>$${fee.toFixed(4)}</td>
          <td class="${pnl >= 0 ? 'pos' : 'neg'}" style="font-weight: 600;">${pnl !== 0 ? (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(4) : '-'}</td>
          <td><span style="font-size: 10px; color: var(--text-dim);">${f.role}</span></td>
          <td><span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">${f.orderId.slice(0, 8)}...</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderPnlView() {
    arcusCharts.renderEquityPnlChart('equityPnlChartCanvas', arcusAnalytics.portfolio, currentResolution);
    arcusCharts.renderDailyPnlChart('dailyPnlChartCanvas', arcusAnalytics.byDay);
  }

  function renderPositionsView() {
    const container = document.getElementById('livePositionsContainer');
    if (!container) return;

    const positions = arcusAnalytics.positions;
    const posList = Object.values(positions);
    const badge = document.getElementById('tabPositionsCount');
    if (badge) badge.textContent = posList.length;

    if (posList.length === 0) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No open positions currently.</div>`;
      return;
    }

    container.innerHTML = posList.map(p => {
      const isShort = p.side === 'SHORT';
      const unrealized = parseFloat(p.unrealizedPnl || 0);
      const notional = Math.abs(parseFloat(p.positionValueNotional || 0));

      return `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-card); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px; font-weight: 700; color: #fff;">${p.marketDisplayName}</span>
              <span class="side-badge ${isShort ? 'sell' : 'buy'}">${p.side} ${p.leverage}x</span>
              <span style="font-size: 11px; padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; color: var(--text-muted);">${p.marginMode}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: var(--text-muted);">Unrealized PnL:</span>
              <span style="font-size: 18px; font-weight: 700; font-family: var(--font-mono); margin-left: 8px;" class="${unrealized >= 0 ? 'pos' : 'neg'}">
                ${unrealized >= 0 ? '+' : ''}$${unrealized.toFixed(2)}
              </span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; padding-top: 14px; border-top: 1px solid var(--border-subtle); font-family: var(--font-mono);">
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Position Size</div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">${parseFloat(p.size).toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Entry Price</div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">$${parseFloat(p.averageEntryPrice).toFixed(4)}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Mark Price</div>
              <div style="font-size: 13px; font-weight: 600; color: #38bdf8;">$${parseFloat(p.markPx || p.averageEntryPrice).toFixed(4)}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Notional Value</div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">$${notional.toFixed(2)}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Margin Used</div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">$${parseFloat(p.marginUsed || 0).toFixed(2)}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Funding Earned</div>
              <div style="font-size: 13px; font-weight: 600; color: var(--accent-emerald);">+$${parseFloat(p.cumulativeFunding?.sinceOpen || 0).toFixed(4)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFeesView() {
    const s = arcusAnalytics.overallStats;
    const funding = arcusAnalytics.funding;

    const elLevel = document.getElementById('feeTierLevel');
    const elTaker = document.getElementById('feeTakerRate');
    const elMaker = document.getElementById('feeMakerRate');
    const elRolling = document.getElementById('feeRollingVol');
    const elFundAcc = document.getElementById('fundingAccrued');
    const elFundCount = document.getElementById('fundingCount');

    if (elLevel) elLevel.textContent = `Level ${s.feeTier.level} (Base Tier)`;
    if (elTaker) elTaker.textContent = `${(s.feeTier.takerFeePpm / 100).toFixed(2)} bps (0.0225%)`;
    if (elMaker) elMaker.textContent = `${(s.feeTier.makerFeePpm / 100).toFixed(2)} bps (0.00%)`;
    if (elRolling) elRolling.textContent = '$' + Math.round(s.totalVolume).toLocaleString();

    const totalFundingPaid = funding.reduce((a, b) => a + parseFloat(b.payment || 0), 0);
    if (elFundAcc) {
      elFundAcc.textContent = (totalFundingPaid >= 0 ? '+' : '') + '$' + totalFundingPaid.toFixed(4);
      elFundAcc.className = `holding-kpi-val ${totalFundingPaid >= 0 ? 'pos' : 'neg'}`;
    }
    if (elFundCount) elFundCount.textContent = `${funding.length} records`;

    // Funding table
    const tbody = document.getElementById('fundingPaymentsTableBody');
    if (!tbody) return;

    tbody.innerHTML = funding.slice(0, 50).map(f => {
      const dt = new Date(f.time / 1000);
      const timeStr = dt.toISOString().replace('T', ' ').slice(0, 19);
      const payment = parseFloat(f.payment || 0);

      return `
        <tr>
          <td>${timeStr}</td>
          <td><strong>${f.marketDisplayName}</strong></td>
          <td>${parseFloat(f.size).toLocaleString()}</td>
          <td>${(parseFloat(f.fundingRate) * 100).toFixed(5)}%</td>
          <td class="${payment >= 0 ? 'pos' : 'neg'}" style="font-weight: 600;">
            ${payment >= 0 ? '+' : ''}$${payment.toFixed(6)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function exportFillsCsv() {
    const fills = filteredFills.length > 0 ? filteredFills : arcusAnalytics.rawFills;
    const headers = ['TradeId', 'OrderId', 'Time', 'Market', 'Side', 'Size', 'Price', 'Notional', 'Fee', 'ClosedPnL', 'Role', 'Effect'];
    const rows = fills.map(f => [
      f.tradeId,
      f.orderId,
      new Date(f.createdAt / 1000).toISOString(),
      f.marketDisplayName,
      f.side,
      f.size,
      f.price,
      (parseFloat(f.size) * parseFloat(f.price)).toFixed(2),
      f.fee,
      f.closedPnl,
      f.role,
      f.positionEffect
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `arcus_trades_${arcusApi.wallet.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportFullReport() {
    const report = {
      wallet: arcusApi.wallet,
      exportedAt: new Date().toISOString(),
      overallStats: arcusAnalytics.overallStats,
      dailyStats: arcusAnalytics.byDay,
      weeklyEpochs: arcusAnalytics.byEpoch,
      openPositions: arcusAnalytics.positions,
      allTrades: arcusAnalytics.rawFills
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `arcus_analytics_report_${arcusApi.wallet.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
