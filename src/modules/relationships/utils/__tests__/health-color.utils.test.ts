import { getFriendHealthGradient, HEALTH_SCORE_ANCHORS } from '../health-color.utils';

describe('health-color utils', () => {
  it('exposes requested score anchors', () => {
    expect(HEALTH_SCORE_ANCHORS).toEqual([100, 75, 60, 50, 30, 20, 10]);
  });

  it('returns exact anchor colors at known anchor scores (light mode)', () => {
    const atHundred = getFriendHealthGradient(100, false);
    const atTen = getFriendHealthGradient(10, false);

    expect(atHundred.colors).toEqual(['#059669', '#10B981']);
    expect(atTen.colors).toEqual(['#44403C', '#57534E']);
  });

  it('interpolates between anchors', () => {
    const atFifty = getFriendHealthGradient(50, false);
    const atSixty = getFriendHealthGradient(60, false);
    const atMid = getFriendHealthGradient(55, false);

    expect(atMid.colors[0]).not.toBe(atFifty.colors[0]);
    expect(atMid.colors[0]).not.toBe(atSixty.colors[0]);
    expect(atMid.opacity).toBeLessThan(atFifty.opacity);
    expect(atMid.opacity).toBeGreaterThan(atSixty.opacity);
  });

  it('clamps out-of-range scores', () => {
    const belowRange = getFriendHealthGradient(-100, true);
    const lowBound = getFriendHealthGradient(0, true);
    const aboveRange = getFriendHealthGradient(500, true);
    const highBound = getFriendHealthGradient(100, true);

    expect(belowRange).toEqual(lowBound);
    expect(aboveRange).toEqual(highBound);
  });
});
