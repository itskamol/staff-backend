/* eslint-disable */
import axios from 'axios';

module.exports = async function () {
    // Configure axios for tests to use.
    const rawHost = process.env.HOST ?? 'localhost';
    const host = /^https?:\/\//.test(rawHost) ? 'localhost' : rawHost;
    const port = process.env.PORT ?? '4100';
    axios.defaults.baseURL = `http://${host}:${port}`;
};
