import {
  ProxyServer,
  ProxyProvider,
  ProxyPool, ProxyType
} from '../src';

const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const should = chai.should();

function createMojoProxyServer(): MojoProxyServer {
  return new MojoProxyServer({
    proxyType: ProxyType.HTTP,
    host: '127.0.0.1',
    port: 0,
    username: null,
    password: null,
  });
}

class MojoProxyServer extends ProxyServer {
  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class MojoProxyProvider extends ProxyProvider {
  protected _numberOfMaxConcurrents: number = 3;

  constructor(options: {
    numberOfMaxConcurrents: number
  }) {
    super();
    this._numberOfMaxConcurrents = options.numberOfMaxConcurrents;
    this._setServerList([
      createMojoProxyServer(),
      createMojoProxyServer(),
      createMojoProxyServer()
    ]);
  }
}

describe('ProxyPool Test', function () {
  it('concurrent limited', async function () {
    const providerA = new MojoProxyProvider({
      numberOfMaxConcurrents: 2
    });
    const providerB = new MojoProxyProvider({
      numberOfMaxConcurrents: 2
    });

    const pool = new ProxyPool();
    pool.addProvider(providerA);
    pool.addProvider(providerB);

    const a = await pool.getServer();
    should.exist(a);

    const b = await pool.getServer();
    should.exist(b);

    const c = await pool.getServer();
    should.exist(c);

    const d = await pool.getServer();
    should.exist(d);

    const e = await pool.getServer();
    should.not.exist(e);

    const f = await pool.getServer();
    should.not.exist(f);
  });

  it('concurrent unlimited', async function () {
    const providerA = new MojoProxyProvider({
      numberOfMaxConcurrents: -1
    });
    const providerB = new MojoProxyProvider({
      numberOfMaxConcurrents: -1
    });

    const pool = new ProxyPool();
    pool.addProvider(providerA);
    pool.addProvider(providerB);

    const a = await pool.getServer();
    should.exist(a);

    const b = await pool.getServer();
    should.exist(b);

    const c = await pool.getServer();
    should.exist(c);

    const d = await pool.getServer();
    should.exist(d);

    const e = await pool.getServer();
    should.exist(e);

    const f = await pool.getServer();
    should.exist(f);
  });
});
