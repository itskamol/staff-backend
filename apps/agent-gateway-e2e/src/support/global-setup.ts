import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
    // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
    console.log('\nSetting up...\n');

    const rawHost = process.env.HOST ?? 'localhost';
    const host = /^https?:\/\//.test(rawHost) ? 'localhost' : rawHost;
    const port = Number(process.env.PORT ?? 4100);
    await waitForPortOpen(port, { host });

    // Hint: Use `globalThis` to pass variables to global teardown.
    globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
