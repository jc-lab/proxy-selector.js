import * as uuid from 'uuid';
import OrderSafety from './order-safety';
import {
  ProxyServer
} from './proxy-server';

const S_PROXY_CONTEXT_CLOSE = Symbol('PROXY_CONTEXT_CLOSE');

interface BanItem {
  forever: boolean;
  banedAt: [number, number];
}

export class ProxyServerContext {
  private _provider: ProxyProvider;
  private _server: ProxyServer;
  private _alive: boolean;

  constructor(provider: ProxyProvider, server: ProxyServer) {
    this._provider = provider;
    this._server = server;
    this._alive = true;
  }

  public close(): void {
    this._alive = false;
    this._provider[S_PROXY_CONTEXT_CLOSE](this._server);
  }

  public get alive(): boolean {
    return this._alive;
  }
}

interface IGetServerQueueItem {
  resolve: (a: ProxyServerContext | null) => void;
  reject: (e: any) => void;
}

export abstract class ProxyProvider {
  protected _id: string = uuid.v4();
  protected _banList: Map<string, BanItem> = new Map();
  protected abstract _numberOfMaxConcurrents: number;
  protected _usedServers: Set<string> = new Set();
  private _serverList: ProxyServer[] = [];

  private _getServerQueue: OrderSafety = new OrderSafety();

  protected _setServerList(serverList: ProxyServer[]) {
    this._serverList = serverList;
    this._banList.clear();
  }

  protected _computeAvailableServerCount(totalCount?: number) {
    const _totalCount = totalCount || this._serverList
      .filter(v => (!this._banList.has(v.id)) && (!this._usedServers.has(v.id)))
      .length;
    if (this._numberOfMaxConcurrents >= 0) {
      return Math.min(_totalCount, this._numberOfMaxConcurrents - this.usedServerCount);
    } else {
      return _totalCount;
    }
  }

  public getId(): string {
    return this._id;
  }

  public get totalServerCount(): number {
    return this._serverList.length;
  }

  public get availableServerCount(): number {
    return this._computeAvailableServerCount();
  }

  public get usedServerCount(): number {
    return this._usedServers.size;
  }

  public getServer(): Promise<ProxyServerContext | null> {
    return this._getServerQueue.run<ProxyServerContext | null>(() => {
      const list = this._serverList
        .filter(s => !this._usedServers.has(s.id) && !this._banList.has(s.id))
        .sort(() => Math.random() - Math.random());

      if (this._computeAvailableServerCount(list.length) <= 0) {
        return Promise.resolve(null);
      }

      const doExecute = (resolve: (v: ProxyServerContext | null) => void, reject: (e) => void) => {
        const current = list.shift();
        if (current) {
          const _current = current;
          current.healthCheck()
            .then(health => {
              if (health) {
                this._usedServers.add(_current.id);
                resolve(new ProxyServerContext(this, _current));
              } else {
                doExecute(resolve, reject);
              }
            })
            .catch(e => {
              reject(e);
            });
        } else {
          resolve(null);
        }
      };
      return new Promise<ProxyServerContext|null>((resolve, reject) => {
        doExecute(resolve, reject);
      });
    });
  }

  public [S_PROXY_CONTEXT_CLOSE](server: ProxyServer) {
    this._usedServers.delete(server.id);
  }

  protected _clearBanedServers() {
    this._banList.clear();
  }

  public banServer(serverId: ProxyServer | string, forever?: boolean): void {
    const _serverId = (typeof serverId === 'string') ? serverId : serverId.id;
    const _forever = forever || false;
    this._banList.set(_serverId, {
      forever: _forever,
      banedAt: process.hrtime()
    });
  }

  public unbanServer(serverId: ProxyServer | string): void {
    const id = (typeof serverId === 'string') ? serverId : serverId.id;
    this._banList.delete(id);
  }

  public init(): Promise<void> {
    return Promise.resolve();
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }
}
