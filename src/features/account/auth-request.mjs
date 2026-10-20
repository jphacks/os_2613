// 同じ認証の連打は一つの処理にまとめる。最初の呼び出しは同期的に始め、Webのクリック権限を失わない。
export function createAuthRequest() {
  let pending = null;
  return (scope, start) => {
    if (pending) return pending.scope === scope ? pending.promise : Promise.reject(new Error('認証画面が開いています。先に開いた画面で完了するか、閉じてからお試しください。'));
    const current = { scope, promise: null };
    pending = current;
    try { current.promise = Promise.resolve(start()); }
    catch (error) { current.promise = Promise.reject(error); }
    current.promise = current.promise.finally(() => { if (pending === current) pending = null; });
    return current.promise;
  };
}
