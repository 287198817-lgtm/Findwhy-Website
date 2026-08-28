// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
	adapter: vercel(),
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
