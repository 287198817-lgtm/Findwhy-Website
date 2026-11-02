// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// Aliyun runs `node dist/server/entry.mjs`. Vercel sets VERCEL=1 at build time
// and cannot serve that Node bundle; it needs the Vercel Build Output API.
const adapter = process.env.VERCEL === '1' ? vercel() : node({ mode: 'standalone' });

// https://astro.build/config
export default defineConfig({
	adapter,
	vite: {
		build: {
			target: ['safari16.2', 'ios16.2', 'chrome100', 'edge100', 'firefox100'],
			cssTarget: ['safari16.2', 'ios16.2', 'chrome100', 'edge100', 'firefox100'],
		},
	},
	redirects: {
		'/illustration/gh': {
			destination: '/series/explosion',
			status: 301,
		},
		'/illustration/manian': {
			destination: '/series/manian',
			status: 301,
		},
		'/illustration/mengyou': {
			destination: '/series/mengyou',
			status: 301,
		},
	},
});
