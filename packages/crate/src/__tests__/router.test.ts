import { describe, it, expect } from 'vitest';
import { matchRoute, findRootCommand } from '../router.js';
import type { CommandRoute } from '../types.js';

describe('Router', () => {
  describe('matchRoute', () => {
    it('should match static routes', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = matchRoute(routes, ['deploy']);
      expect(result).not.toBeNull();
      expect(result?.route.segments).toEqual(['deploy']);
      expect(result?.params).toEqual({});
      expect(result?.remainingArgs).toEqual([]);
    });

    it('should match dynamic routes', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/info/[id]/+command.ts',
          segments: ['info', '[id]'],
          params: ['id'],
          isDynamic: true,
        },
      ];

      const result = matchRoute(routes, ['info', '123']);
      expect(result).not.toBeNull();
      expect(result?.route.segments).toEqual(['info', '[id]']);
      expect(result?.params).toEqual({ id: '123' });
      expect(result?.remainingArgs).toEqual([]);
    });

    it('should return null for no match', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = matchRoute(routes, ['nonexistent']);
      expect(result).toBeNull();
    });

    it('should capture remaining args after route match', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = matchRoute(routes, ['deploy', 'production', '--force']);
      expect(result).not.toBeNull();
      expect(result?.remainingArgs).toEqual(['production', '--force']);
    });

    it('should match nested static routes', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/db/migrate/+command.ts',
          segments: ['db', 'migrate'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = matchRoute(routes, ['db', 'migrate']);
      expect(result).not.toBeNull();
      expect(result?.route.segments).toEqual(['db', 'migrate']);
    });

    it('should match mixed static and dynamic segments', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/app/[name]/config/+command.ts',
          segments: ['app', '[name]', 'config'],
          params: ['name'],
          isDynamic: true,
        },
      ];

      const result = matchRoute(routes, ['app', 'myapp', 'config']);
      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ name: 'myapp' });
    });

    it('should handle routes in order', () => {
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
      ];

      // Should match in order - first route matches
      const result = matchRoute(routes, ['info', 'special']);
      expect(result?.params).toEqual({ id: 'special' });
    });
  });

  describe('findRootCommand', () => {
    it('should find root command with index segment', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/index/+command.ts',
          segments: ['index'],
          params: [],
          isDynamic: false,
        },
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = findRootCommand(routes);
      expect(result).not.toBeNull();
      expect(result?.segments).toEqual(['index']);
    });

    it('should return null when no root command exists', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = findRootCommand(routes);
      expect(result).toBeNull();
    });

    it('should only match single-segment index route', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/db/index/+command.ts',
          segments: ['db', 'index'],
          params: [],
          isDynamic: false,
        },
      ];

      const result = findRootCommand(routes);
      expect(result).toBeNull();
    });
  });
});
