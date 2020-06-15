import {
  ProxyProvider, ProxyServerContext
} from './proxy-provider';

const S_PROXY_CONTEXT_CLOSE = Symbol('PROXY_CONTEXT_CLOSE');

interface IProxyProviderItem {
  provider: ProxyProvider;
}

export class PooledProxyServerContext {
  private _pool: ProxyPool;
  private _ctx: ProxyServerContext;
  private _alive: boolean;

  constructor(pool: ProxyPool, ctx: ProxyServerContext) {
    this._pool = pool;
    this._ctx = ctx;
    this._alive = true;
  }

  public close(): void {
    this._alive = false;
    this._pool[S_PROXY_CONTEXT_CLOSE](this._ctx);
  }

  public get alive(): boolean {
    return this._alive;
  }
}

export class ProxyPool {
  private _providers: Map<string, IProxyProviderItem> = new Map<string, IProxyProviderItem>();

  public addProvider(provider: ProxyProvider): void {
    this._providers.set(provider.getId(), {
      provider: provider
    });
  }

  public removeProvider(provider: ProxyProvider | string): void {
    if (typeof provider === 'string') {
      this._providers.delete(provider);
    } else {
      this._providers.delete(provider.getId());
    }
  }

  public [S_PROXY_CONTEXT_CLOSE](ctx: ProxyServerContext): void {
    ctx.close();
  }

  public close(): Promise<void> {
    const it = this._providers.entries();
    let cur = it.next();
    const plist: Promise<any>[] = [];
    while (!cur.done) {
      try {
        plist.push(cur.value[1].provider.close());
      } catch (e) {
        // ignore
      }
      cur = it.next();
    }
    return plist.reduce((prev, cur) => {
      return prev
        .then(() => cur)
        .catch(e => cur);
    });
  }

  public getServer(ignoreError?: boolean): Promise<PooledProxyServerContext | null> {
    const _ignoreError = ignoreError || false;
    const providerList = (() => {
      const list: IProxyProviderItem[] = [];
      const it = this._providers.entries();
      for (let current = it.next(); !current.done; current = it.next()) {
        list.push(current.value[1]);
      }
      return list.sort(() => Math.random() - Math.random());
    })();

    const doExecute = (resolve: (a: PooledProxyServerContext | null) => void, reject: (e: any) => void) => {
      const item = providerList.shift();
      if (!item) {
        resolve(null);
        return ;
      }
      if (item.provider.availableServerCount <= 0) {
        doExecute(resolve, reject);
        return ;
      }
      item.provider.getServer()
        .then(s => {
          if (!s) {
            doExecute(resolve, reject);
          } else {
            resolve(new PooledProxyServerContext(this, s));
          }
        })
        .catch(e => {
          if (_ignoreError) {
            doExecute(resolve, reject);
          } else {
            reject(e);
          }
        });
    };
    return new Promise<PooledProxyServerContext | null>((resolve, reject) => {
      doExecute(resolve, reject);
    });
  }
}
