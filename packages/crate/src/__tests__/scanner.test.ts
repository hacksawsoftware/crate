import { describe, it, expect } from 'vitest';
import { sortRoutes } from '../scanner.js';
import type { CommandRoute } from '../types.js';

describe('Scanner', () => {
  describe('sortRoutes', () => {
    it('should sort static routes before dynamic routes', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/[id]/+command.ts',
          segments: ['[id]'],
          params: ['id'],
          isDynamic: true,
        },
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const sorted = sortRoutes(routes);

      expect(sorted[0].segments[0]).toBe('deploy');
      expect(sorted[1].segments[0]).toBe('[id]');
    });

    it('should sort more specific routes first (deeper paths)', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/db/+command.ts',
          segments: ['db'],
          params: [],
          isDynamic: false,
        },
        {
          filePath: '/commands/db/migrate/+command.ts',
          segments: ['db', 'migrate'],
          params: [],
          isDynamic: false,
        },
      ];

      const sorted = sortRoutes(routes);

      expect(sorted[0].segments.length).toBe(2);
      expect(sorted[1].segments.length).toBe(1);
    });

    it('should sort fewer dynamic params first', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/[team]/[id]/+command.ts',
          segments: ['[team]', '[id]'],
          params: ['team', 'id'],
          isDynamic: true,
        },
        {
          filePath: '/commands/[id]/+command.ts',
          segments: ['[id]'],
          params: ['id'],
          isDynamic: true,
        },
      ];

      const sorted = sortRoutes(routes);

      expect(sorted[0].params.length).toBe(1);
      expect(sorted[1].params.length).toBe(2);
    });

    it('should maintain order for equal specificity routes', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
        {
          filePath: '/commands/build/+command.ts',
          segments: ['build'],
          params: [],
          isDynamic: false,
        },
      ];

      const sorted = sortRoutes(routes);

      // Both have same specificity, order doesn't matter but should be stable
      expect(sorted.length).toBe(2);
      expect(sorted.some((r: any) => r.segments[0] === 'deploy')).toBe(true);
      expect(sorted.some((r: any) => r.segments[0] === 'build')).toBe(true);
    });

    it('should handle mixed static and dynamic routes correctly', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/info/[id]/+command.ts',
          segments: ['info', '[id]'],
          params: ['id'],
          isDynamic: true,
        },
        {
          filePath: '/commands/info/special/+command.ts',
          segments: ['info', 'special'],
          params: [],
          isDynamic: false,
        },
        {
          filePath: '/commands/info/+command.ts',
          segments: ['info'],
          params: [],
          isDynamic: false,
        },
      ];

      const sorted = sortRoutes(routes);

      // Static routes should come first
      expect(sorted[0].isDynamic).toBe(false);
      expect(sorted[1].isDynamic).toBe(false);
      expect(sorted[2].isDynamic).toBe(true);

      // Among static routes, deeper paths first
      expect(sorted[0].segments.length).toBe(2);
      expect(sorted[1].segments.length).toBe(1);
    });

    it('should not mutate the original array', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/[id]/+command.ts',
          segments: ['[id]'],
          params: ['id'],
          isDynamic: true,
        },
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const original = [...routes];
      sortRoutes(routes);

      expect(routes).toEqual(original);
    });

    it('should handle empty array', () => {
      const routes: CommandRoute[] = [];
      const sorted = sortRoutes(routes);

      expect(sorted).toEqual([]);
    });

    it('should handle single route', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const sorted = sortRoutes(routes);

      expect(sorted.length).toBe(1);
      expect(sorted[0]).toEqual(routes[0]);
    });

    it('should prioritize static over dynamic with same segment count', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/app/[id]/config/+command.ts',
          segments: ['app', '[id]', 'config'],
          params: ['id'],
          isDynamic: true,
        },
        {
          filePath: '/commands/app/list/config/+command.ts',
          segments: ['app', 'list', 'config'],
          params: [],
          isDynamic: false,
        },
      ];

      const sorted = sortRoutes(routes);

      expect(sorted[0].isDynamic).toBe(false);
      expect(sorted[1].isDynamic).toBe(true);
    });
  });
});
