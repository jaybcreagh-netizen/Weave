import { useDashboardCacheStore } from '../dashboardCacheStore';

describe('dashboardCacheStore battery refresh handling', () => {
  beforeEach(() => {
    useDashboardCacheStore.getState().invalidateAll();
  });

  it('dedupes repeated refreshes for the same battery check-in timestamp', () => {
    const store = useDashboardCacheStore.getState();

    expect(store.triggerBatterySeasonRefresh(1700000000000)).toBe(true);
    const firstSignal = useDashboardCacheStore.getState().batteryRefreshSignal;
    expect(firstSignal).toBeGreaterThan(0);

    expect(useDashboardCacheStore.getState().triggerBatterySeasonRefresh(1700000000000)).toBe(false);
    expect(useDashboardCacheStore.getState().batteryRefreshSignal).toBe(firstSignal);
  });

  it('coalesces rapid refresh attempts into one pulse', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5000);

    try {
      expect(useDashboardCacheStore.getState().triggerBatterySeasonRefresh(1)).toBe(true);
      expect(useDashboardCacheStore.getState().triggerBatterySeasonRefresh(2)).toBe(false);
      expect(useDashboardCacheStore.getState().lastBatteryRefreshTimestamp).toBe(2);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
