import { expect } from 'chai';
import 'mocha';

import { Geo } from './geo';

describe('Geo utils', () => {
  it('should calculate the distance between two points', () => {
    const distance = Geo.distance(0, 0, 180, 0);
    expect(distance).to.be.closeTo(Math.PI * Geo.EARTH_RADIUS, 0.01); // 2 x pi x radius / 2
  });

  it('should return zero as the distance between the same two points', () => {
    const distance = Geo.distance(3.0, -4.0, 3.0, -4.0);
    expect(distance).to.be.equal(0.0);
  });
});
