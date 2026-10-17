// Web版は保存キーも方式も維持し、追加済みの本をそのまま読めるようにする。
export const libraryStorage = {
  async getItem(key: string): Promise<string | null> { return window.localStorage.getItem(key); },
  async setItem(key: string, value: string): Promise<void> { window.localStorage.setItem(key, value); },
};
