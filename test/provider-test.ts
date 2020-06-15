import {ProxyProvider, ProxyServer, ProxyType} from '../src';

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

describe('ProxyProvider Test', function () {
  it('concurrent limited', async function () {
    const provider = new MojoProxyProvider({
      numberOfMaxConcurrents: 2
    });

    const a = await provider.getServer();
    should.exist(a);

    const b = await provider.getServer();
    should.exist(b);

    const c = await provider.getServer();
    should.not.exist(c);
  });

  it('concurrent unlimited', async function () {
    const provider = new MojoProxyProvider({
      numberOfMaxConcurrents: -1
    });

    const a = await provider.getServer();
    should.exist(a);

    const b = await provider.getServer();
    should.exist(b);

    const c = await provider.getServer();
    should.exist(c);
  });
});
