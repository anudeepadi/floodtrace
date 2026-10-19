import { describe, expect, it } from 'vitest';
import { EVENTS, SITES, SOURCES, TIMELINE_END_MIN } from './incident';
import { createExtent } from '../geo/mercator';

const extent = createExtent({ zoom: 11, x0: 1508, x1: 1510, y0: 855, y1: 858 });

describe('incident data integrity', () => {
  it('places every site inside the downloaded map so nothing renders off-terrain', () => {
    for (const s of SITES) {
      expect(s.lon, s.id).toBeGreaterThan(extent.west);
      expect(s.lon, s.id).toBeLessThan(extent.east);
      expect(s.lat, s.id).toBeGreaterThan(extent.south);
      expect(s.lat, s.id).toBeLessThan(extent.north);
    }
  });

  it('starts the route at the collapse site — the flood model measures distance from there', () => {
    expect(SITES.find(s => s.onRoute)?.kind).toBe('origin');
  });

  it('cites a known source for every site and event, so no claim is unsourced', () => {
    const ids = new Set(Object.keys(SOURCES));
    for (const item of [...SITES, ...EVENTS]) {
      expect(item.sources.length, item.id).toBeGreaterThan(0);
      for (const src of item.sources) expect(ids.has(src), `${item.id}:${src}`).toBe(true);
    }
  });

  it('never marks a model-derived event as observed', () => {
    for (const e of EVENTS) if (e.tMin === null) expect(e.certainty).not.toBe('observed');
  });

  it('every event references an existing site and falls inside the timeline', () => {
    const siteIds = new Set(SITES.map(s => s.id));
    for (const e of EVENTS) {
      if (e.siteId) expect(siteIds.has(e.siteId), e.id).toBe(true);
      if (e.tMin !== null) expect(e.tMin).toBeLessThanOrEqual(TIMELINE_END_MIN);
      if (e.tMin === null) expect(e.siteId, e.id).toBeDefined();
    }
  });

  it('has unique ids so selection state is unambiguous', () => {
    expect(new Set(SITES.map(s => s.id)).size).toBe(SITES.length);
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(EVENTS.length);
  });
});
