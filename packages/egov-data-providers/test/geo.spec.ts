import { Geo } from '../src/geo';

describe('Geo utils', () => {
  test('calculates the distance between two points', () => {
    const distance = Geo.distance(0, 0, 180, 0);
    expect(distance).toBeCloseTo(Math.PI * Geo.EARTH_RADIUS, 5); // 2 x pi x radius / 2
  });

  test('return zero as the distance between the same two points', () => {
    const distance = Geo.distance(3.0, -4.0, 3.0, -4.0);
    expect(distance).toBe(0.0);
  });
});
