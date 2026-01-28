import { useState, useEffect, useCallback } from 'react';

// 缓存版本号，更新时自动清除旧缓存
const CACHE_VERSION = 'v1';

// 缓存键前缀
const CACHE_KEYS = {
  CHARACTERS: 'cache_characters',
  MESSAGES: 'cache_messages',
  CUSTOMIZATION: 'cache_customization',
  PROFILE: 'cache_profile',
} as const;

interface CacheEntry<T> {
  version: string;
  userId: string;
  data: T;
  timestamp: number;
}

// 缓存过期时间（24小时）
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * 通用本地缓存 Hook
 * 用于在 LocalStorage 中缓存数据，实现秒开界面
 */
export function useLocalCache<T>(
  key: string,
  userId: string | undefined
) {
  const fullKey = `${key}_${userId}`;

  // 从缓存读取数据
  const getCache = useCallback((): T | null => {
    if (!userId) return null;
    
    try {
      const cached = localStorage.getItem(fullKey);
      if (!cached) return null;
      
      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // 版本检查
      if (entry.version !== CACHE_VERSION) {
        localStorage.removeItem(fullKey);
        return null;
      }
      
      // 用户检查
      if (entry.userId !== userId) {
        localStorage.removeItem(fullKey);
        return null;
      }
      
      // 过期检查
      if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
        localStorage.removeItem(fullKey);
        return null;
      }
      
      return entry.data;
    } catch (e) {
      console.warn('[Cache] Failed to read cache:', key, e);
      return null;
    }
  }, [fullKey, userId]);

  // 写入缓存
  const setCache = useCallback((data: T) => {
    if (!userId) return;
    
    try {
      const entry: CacheEntry<T> = {
        version: CACHE_VERSION,
        userId,
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch (e) {
      console.warn('[Cache] Failed to write cache:', key, e);
      // 存储空间不足时尝试清理旧缓存
      try {
        clearOldCaches();
        const entry: CacheEntry<T> = {
          version: CACHE_VERSION,
          userId,
          data,
          timestamp: Date.now(),
        };
        localStorage.setItem(fullKey, JSON.stringify(entry));
      } catch {
        // 忽略
      }
    }
  }, [fullKey, userId]);

  // 清除缓存
  const clearCache = useCallback(() => {
    localStorage.removeItem(fullKey);
  }, [fullKey]);

  return { getCache, setCache, clearCache };
}

/**
 * 清理旧缓存
 */
function clearOldCaches() {
  const keysToCheck = Object.keys(localStorage);
  for (const key of keysToCheck) {
    if (key.startsWith('cache_')) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const entry = JSON.parse(cached);
          if (entry.version !== CACHE_VERSION || Date.now() - entry.timestamp > CACHE_EXPIRY) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }
}

/**
 * 好友列表缓存 Hook
 */
export function useCharactersCache(userId: string | undefined) {
  return useLocalCache<any[]>(CACHE_KEYS.CHARACTERS, userId);
}

/**
 * 对话记录缓存 Hook（按角色ID）
 */
export function useMessagesCache(userId: string | undefined, characterId: string | undefined) {
  return useLocalCache<any[]>(`${CACHE_KEYS.MESSAGES}_${characterId}`, userId);
}

/**
 * 个性化设置缓存 Hook
 */
export function useCustomizationCache(userId: string | undefined) {
  return useLocalCache<any>(CACHE_KEYS.CUSTOMIZATION, userId);
}

/**
 * 用户资料缓存 Hook
 */
export function useProfileCache(userId: string | undefined) {
  return useLocalCache<any>(CACHE_KEYS.PROFILE, userId);
}

export { CACHE_KEYS };
