/**
 * Arcus Dashboard Charting Engine
 * Uses Chart.js with custom plugins for dashed maximum markers,
 * custom stacked bar tooltips, and interactive day selection.
 */

class ArcusCharts {
  constructor() {
    this.dailyVolumeChart = null;
    this.holdingSizeChart = null;
    this.equityPnlChart = null;
    this.dailyPnlChart = null;
    this.selectedDayIndex = null;
    this.onSelectDayCallback = null;

    // Palette for tickers matching Arcus dark theme
    this.tickerColors = {
      'BTC-USD': '#f59e0b',
      'ETH-USD': '#6366f1',
      'SOL-USD': '#f97316',
      'XRP-USD': '#06b6d4',
      'HYPE-USD': '#ec4899',
      'PUMP-USD': '#a855f7',
      'LIT-USD': '#eab308',
      'NVDA': '#84cc16',
      'QQQ': '#38bdf8',
      'SPY': '#10b981',
      'BTC': '#f59e0b',
      'ZEC': '#f472b6',
      'USO': '#818cf8',
      'SNOK': '#eab308',
      'AAPL': '#60a5fa',
      'SLV': '#34d399',
      'ETH': '#6366f1',
      'SOL': '#f97316',
      'AMD': '#f59e0b',
      'SPCX': '#ec4899',
      'SKHY': '#14b8a6',
      'MU': '#3b82f6',
      'CRCL': '#a855f7'
    };
  }

  getColorForTicker(ticker) {
    if (this.tickerColors[ticker]) return this.tickerColors[ticker];
    // Dynamic deterministic fallback color
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) {
      hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }

  formatCurrency(val, decimals = 0) {
    if (val >= 1000000) {
      return '$' + (val / 1000000).toFixed(1) + 'm';
    } else if (val >= 1000) {
      return '$' + (val / 1000).toFixed(decimals) + 'k';
    }
    return '$' + val.toFixed(decimals);
  }

  renderDailyVolumeChart(canvasId, daysData, marketTotals, legendContainerId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.dailyVolumeChart) {
      this.dailyVolumeChart.destroy();
    }

    // Collect all unique tickers
    const allTickers = Object.keys(marketTotals);
    const labels = daysData.map(d => {
      const parts = d.fullDate.split('-');
      return `${parts[2]}/${parts[1]}`;
    });

    const datasets = allTickers.map(ticker => {
      const color = this.getColorForTicker(ticker);
      return {
        label: ticker,
        data: daysData.map(d => d.byTicker[ticker] || 0),
        backgroundColor: color,
        borderRadius: 2,
        stack: 'volumeStack'
      };
    });

    this.dailyVolumeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 }
            }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => this.formatCurrency(val)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                if (!val) return null;
                return ` ${ctx.dataset.label}: ${this.formatCurrency(val, 1)} ($${Math.round(val).toLocaleString()})`;
              },
              footer: (items) => {
                const total = items.reduce((a, b) => a + (b.raw || 0), 0);
                return `Total Volume: $${Math.round(total).toLocaleString()}`;
              }
            }
          }
        }
      }
    });

    // Populate legend container below chart
    this.renderVolumeLegend(legendContainerId, marketTotals);
  }

  renderVolumeLegend(containerId, marketTotals) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const sortedMarkets = Object.values(marketTotals).sort((a, b) => b.volume - a.volume);
    el.innerHTML = sortedMarkets.map(m => {
      const color = this.getColorForTicker(m.market);
      const shortName = m.market.replace('-USD', '');
      const formattedVol = '$' + Math.round(m.volume).toLocaleString();
      return `
        <div class="legend-pill" title="${m.market}: ${formattedVol}">
          <span class="legend-dot" style="background-color: ${color}"></span>
          <span class="legend-ticker">${shortName}</span>
          <span class="legend-value">${formattedVol}</span>
        </div>
      `;
    }).join('');
  }

  renderHoldingSizeChart(canvasId, daysData, onSelectDay) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.holdingSizeChart) {
      this.holdingSizeChart.destroy();
    }

    this.onSelectDayCallback = onSelectDay;
    const labels = daysData.map(d => d.label);

    // Collect all tickers appearing across days
    const tickersSet = new Set();
    daysData.forEach(d => {
      Object.keys(d.byTicker).forEach(t => tickersSet.add(t));
    });
    const tickers = Array.from(tickersSet);

    // Build stacked datasets for each ticker
    const datasets = tickers.map(ticker => {
      const color = this.getColorForTicker(ticker);
      return {
        type: 'bar',
        label: ticker.replace('-USD', ''),
        data: daysData.map(d => {
          // Normalize to pair size
          const totalVol = d.volume || 1;
          const share = (d.byTicker[ticker] || 0) / totalVol;
          return d.averageSize * share;
        }),
        backgroundColor: color,
        stack: 'sizeStack',
        borderRadius: 2
      };
    });

    // Custom plugin to draw the dashed maximum marker above each stacked bar
    const maxMarkerPlugin = {
      id: 'maxMarkerPlugin',
      afterDatasetsDraw: (chart) => {
        const { ctx, scales: { x, y } } = chart;
        ctx.save();

        daysData.forEach((day, index) => {
          const xPos = x.getPixelForValue(index);
          const yPos = y.getPixelForValue(day.maxSize);
          const barWidth = 28;

          // Dashed orange line marker
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(xPos - barWidth / 2, yPos);
          ctx.lineTo(xPos + barWidth / 2, yPos);
          ctx.stroke();

          // Maximum amount text
          ctx.setLineDash([]);
          ctx.fillStyle = '#f59e0b';
          ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`$${(day.maxSize / 1000).toFixed(1)}k`, xPos, yPos - 5);
        });

        // Draw selected day indicator outline
        if (this.selectedDayIndex !== null && daysData[this.selectedDayIndex]) {
          const selX = x.getPixelForValue(this.selectedDayIndex);
          const selDay = daysData[this.selectedDayIndex];
          const topY = y.getPixelForValue(selDay.maxSize);
          const botY = y.bottom;
          const highlightWidth = 36;

          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.strokeRect(selX - highlightWidth / 2, topY - 14, highlightWidth, botY - topY + 16);
        }

        ctx.restore();
      }
    };

    this.holdingSizeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      plugins: [maxMarkerPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (evt, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const index = activeElements[0].index;
            this.selectedDayIndex = index;
            this.holdingSizeChart.update('none');
            if (this.onSelectDayCallback) {
              this.onSelectDayCallback(daysData[index], index);
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 }
            }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => this.formatCurrency(val)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            padding: 12,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${this.formatCurrency(ctx.raw, 1)}`,
              footer: (items) => {
                const total = items.reduce((a, b) => a + (b.raw || 0), 0);
                const day = daysData[items[0].dataIndex];
                return `Total Size: ${this.formatCurrency(total, 1)}\nMaximum: ${this.formatCurrency(day.maxSize, 1)}`;
              }
            }
          }
        }
      }
    });

    // Default select latest day
    if (this.selectedDayIndex === null && daysData.length > 0) {
      this.selectedDayIndex = daysData.length - 1;
      if (this.onSelectDayCallback) {
        this.onSelectDayCallback(daysData[this.selectedDayIndex], this.selectedDayIndex);
      }
    }
  }

  renderEquityPnlChart(canvasId, portfolioData, resolution = 'totalMonth') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.equityPnlChart) {
      this.equityPnlChart.destroy();
    }

    let equityPoints = [];
    let pnlPoints = [];

    if (portfolioData && portfolioData.data) {
      const match = portfolioData.data.find(item => item[0] === resolution);
      if (match && match[1]) {
        equityPoints = match[1].accountEquityHistory || [];
        pnlPoints = match[1].pnlHistory || [];
      }
    }

    const labels = equityPoints.map(p => {
      const d = new Date(p[0] / 1000);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit' });
    });

    const equityValues = equityPoints.map(p => parseFloat(p[1]));
    const pnlValues = pnlPoints.map(p => parseFloat(p[1]));

    this.equityPnlChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Account Equity ($)',
            data: equityValues,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.2,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'Cumulative PnL ($)',
            data: pnlValues,
            borderColor: '#38bdf8',
            borderDash: [5, 5],
            fill: false,
            tension: 0.2,
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 }
            }
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#10b981',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (v) => '$' + v.toFixed(0)
            }
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: {
              color: '#38bdf8',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (v) => (v >= 0 ? '+' : '') + '$' + v.toFixed(0)
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#cbd5e1',
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            padding: 10
          }
        }
      }
    });
  }

  renderDailyPnlChart(canvasId, daysData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.dailyPnlChart) {
      this.dailyPnlChart.destroy();
    }

    const labels = daysData.map(d => d.label);
    const pnlData = daysData.map(d => d.pnl);
    const feesData = daysData.map(d => d.fees);

    const backgroundColors = pnlData.map(v => v >= 0 ? '#10b981' : '#f43f5e');

    this.dailyPnlChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Daily Realized PnL ($)',
            data: pnlData,
            backgroundColor: backgroundColors,
            borderRadius: 3
          },
          {
            type: 'line',
            label: 'Daily Fees Paid ($)',
            data: feesData,
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            pointRadius: 2,
            backgroundColor: 'transparent'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 }
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (v) => (v >= 0 ? '+' : '') + '$' + v.toFixed(0)
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#cbd5e1',
              font: { family: 'Inter', size: 11 }
            }
          }
        }
      }
    });
  }
}

window.arcusCharts = new ArcusCharts();
