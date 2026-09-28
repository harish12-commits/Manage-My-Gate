/**
 * Node's built-in fetch keeps idle sockets in a process-wide pool. The backend closes
 * them after its keep-alive timeout, and the next fetch then fails with ECONNRESET.
 * Global setup and the suites share one process (--runInBand), so turn reuse off for both.
 */
const { Agent, setGlobalDispatcher } = require('undici');

setGlobalDispatcher(new Agent({ pipelining: 0 }));
