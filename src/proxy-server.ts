import * as uuid from 'uuid';
import * as https from 'https';
import {
  SocksProxyAgent
} from 'socks-proxy-agent';

const S_PROXY_SERVER_INSTANCE = Symbol('PROXY_SERVER_INSTANCE');

export const PROXY_TYPE_MASK  = 0x00ff0000;
export const PROXY_TYPE_HTTP  = 0x00010000;
export const PROXY_TYPE_SOCKS = 0x00020000;
export const PROXY_VERSION_MASK = 0x0000ff00;
export const PROXY_FLAGS_MASK = 0x000000ff;

export enum ProxyType {
  HTTP = PROXY_TYPE_HTTP,
  SOCKS = PROXY_TYPE_SOCKS,
  SOCKS4 = PROXY_TYPE_SOCKS | (4 << 8),
  SOCKS4A = PROXY_TYPE_SOCKS | (4 << 8) | 0x01,
  SOCKS5 = PROXY_TYPE_SOCKS | (5 << 8),
  SOCKS5H = PROXY_TYPE_SOCKS | (5 << 8) | 0x01,
}

export interface IProxyServerInfo {
  proxyType: ProxyType;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
}

export abstract class ProxyServer {
  private _uuid: string;

  protected _proxyType: ProxyType;
  protected _host: string;
  protected _port: number;
  protected _username: string | null;
  protected _password: string | null;

  constructor(options: IProxyServerInfo) {
    this[S_PROXY_SERVER_INSTANCE] = true;
    this._uuid = uuid.v4();
    this._proxyType = options.proxyType;
    this._host = options.host;
    this._port = options.port;
    this._username = options.username;
    this._password = options.password;
  }

  public get id(): string {
    return this._uuid;
  }

  public get proxyType(): ProxyType {
    return this._proxyType;
  }

  public get isHttpProxy(): boolean {
    return ((this._proxyType & PROXY_TYPE_MASK) === PROXY_TYPE_HTTP);
  }

  public get isSocksProxy(): boolean {
    return ((this._proxyType & PROXY_TYPE_MASK) === PROXY_TYPE_SOCKS);
  }

  public get socksVersion(): number {
    if (this.isSocksProxy) {
      return (this._proxyType & PROXY_VERSION_MASK) >>> 8;
    } else {
      return 0;
    }
  }

  public get socksFlags(): number {
    return this._proxyType & PROXY_FLAGS_MASK;
  }

  public abstract healthCheck(): Promise<boolean>;

  public getProxyServerInfo(): Promise<IProxyServerInfo> {
    return Promise.resolve({
      proxyType: this._proxyType,
      host: this._host,
      port: this._port,
      username: this._username,
      password: this._password
    });
  }

  public createSocksAgent(opts?: https.AgentOptions): Promise<https.Agent> {
    if (!this.isSocksProxy) {
      throw new Error('Proxy is not socks');
    }
    return this.getProxyServerInfo()
      .then(info => {
        const protocol = (() => {
          switch (this.socksVersion) {
          case 4:
            if (this.socksFlags == 0x01) {
              return 'socks4a';
            } else {
              return 'socks4';
            }
          case 5:
            if (this.socksFlags == 0x01) {
              return 'socks5h';
            } else {
              return 'socks5';
            }
          }
          return 'socks';
        })();
        const agent = new SocksProxyAgent({
          ...opts,
          host: info.host,
          port: info.port,
          userId: info.username || undefined,
          password: info.password || undefined,
          protocol: protocol + ':'
        });
        return (agent as any) as https.Agent;
      });
  }
}

export function isProxyServerInstance(o: any): boolean {
  return !!o[S_PROXY_SERVER_INSTANCE];
}
