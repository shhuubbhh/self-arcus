/**
 * Arcus Exchange API Client
 * Official REST API integration for Arcus Perpetuals Exchange
 * Documentation: https://docs.arcus.xyz/
 */

const DEFAULT_WALLET = '0x3484a6A12409902379Db26c9B56D52592AE25727';
const BASE_URL = 'https://api.arcus.xyz';

class ArcusApiClient {
  constructor() {
    this.wallet = localStorage.getItem('arcus_wallet') || DEFAULT_WALLET;
    this.baseUrl = BASE_URL;
    this.refreshTimer = null;
    this.refreshInterval = 30000; // 30s default
    this.isAutoRefresh = true;
    this.isLoading = false;
    this.lastFetched = null;
    this.listeners = [];
  }

  setWallet(newWallet) {
    if (!newWallet || !newWallet.trim()) return;
    this.wallet = newWallet.trim();
    localStorage.setItem('arcus_wallet', this.wallet);
    this.fetchData();
  }

  onUpdate(callback) {
    this.listeners.push(callback);
  }

  notify(data, error = null) {
    this.listeners.forEach(cb => cb(data, error));
  }

  async fetchEndpoint(path) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  }

  async fetchData() {
    this.isLoading = true;
    const wallet = this.wallet;

    try {
      // Parallel requests for all relevant exchange data
      const [
        statsRes,
        accountRes,
        positionsRes,
        fillsRes,
        ordersRes,
        portfolioRes,
        fundingRes,
        transfersRes,
        marketsRes,
        leaderboardRes
      ] = await Promise.allSettled([
        this.fetchEndpoint(`/v1/account/stats?address=${wallet}&include=feeTier,volumes&windows=24h,7d,30d`),
        this.fetchEndpoint(`/v1/account?address=${wallet}`),
        this.fetchEndpoint(`/v1/positions?address=${wallet}`),
        this.fetchEndpoint(`/v1/fills?address=${wallet}&limit=100`),
        this.fetchEndpoint(`/v1/orders?address=${wallet}&limit=100`),
        this.fetchEndpoint(`/v1/portfolio?address=${wallet}`),
        this.fetchEndpoint(`/v1/funding?address=${wallet}&limit=100`),
        this.fetchEndpoint(`/v1/accountTransferUpdates?address=${wallet}&limit=50`),
        this.fetchEndpoint(`/v1/markets`),
        this.fetchEndpoint(`/v1/leaderboard?window=30d`)
      ]);

      const data = {
        wallet,
        fetchedAt: new Date().toISOString(),
        isLive: true,
        stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
        account: accountRes.status === 'fulfilled' ? accountRes.value : null,
        positions: positionsRes.status === 'fulfilled' ? positionsRes.value : null,
        fills: fillsRes.status === 'fulfilled' ? fillsRes.value : null,
        orders: ordersRes.status === 'fulfilled' ? ordersRes.value : null,
        portfolio: portfolioRes.status === 'fulfilled' ? portfolioRes.value : null,
        funding: fundingRes.status === 'fulfilled' ? fundingRes.value : null,
        transfers: transfersRes.status === 'fulfilled' ? transfersRes.value : null,
        markets: marketsRes.status === 'fulfilled' ? marketsRes.value : null,
        leaderboard: leaderboardRes.status === 'fulfilled' ? leaderboardRes.value : null
      };

      // Check if we got essential data
      if (!data.stats && !data.account && !data.fills) {
        throw new Error('Could not fetch essential account data from API');
      }

      this.lastFetched = new Date();
      this.isLoading = false;
      this.notify(data, null);
      return data;
    } catch (err) {
      console.warn('Live API fetch error, falling back to snapshot:', err.message);
      // Fallback to offline cached snapshot if available
      if (window.ARCUS_FALLBACK_SNAPSHOT && (wallet.toLowerCase() === DEFAULT_WALLET.toLowerCase())) {
        const fallbackData = {
          ...window.ARCUS_FALLBACK_SNAPSHOT,
          wallet,
          isLive: false,
          fallbackReason: err.message
        };
        this.lastFetched = new Date();
        this.isLoading = false;
        this.notify(fallbackData, null);
        return fallbackData;
      }

      this.isLoading = false;
      this.notify(null, err);
      throw err;
    }
  }

  setAutoRefresh(enabled, intervalMs = 30000) {
    this.isAutoRefresh = enabled;
    this.refreshInterval = intervalMs;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (enabled) {
      this.refreshTimer = setInterval(() => {
        this.fetchData();
      }, this.refreshInterval);
    }
  }
}

window.arcusApi = new ArcusApiClient();
